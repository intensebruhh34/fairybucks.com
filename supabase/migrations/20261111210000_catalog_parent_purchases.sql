begin;

-- Stop rather than silently populate a partial catalog.
do $$ begin
  if (select count(*) from public.treasures where shop_key between 1 and 12) <> 12 then
    raise exception 'Expected all twelve catalog slots';
  end if;
end $$;

-- Request prices remain captured in price_at_request; do not update requests or wallets.
update public.treasures t set name = v.name, category = v.category,
  fairy_price = v.price, description = v.description
from (values
  (1, 'Little Scientist Kit', 'Learning', 15, 'Explore hands-on experiments with a 40+ or 50+ experiment science kit.'),
  (2, 'Magical Art Studio', 'Creativity', 14, 'Create colorful, glowing ocean-themed foam artwork.'),
  (3, 'Paint Your Own Dino Racers', 'Creativity', 14, 'Paint and race six dinosaur pull-back cars.'),
  (4, 'Fairy Garden Starter', 'Treasure', 19, 'Arrange a tiny fairy world with 48 miniature garden decorations. Planter, soil and seeds are not included.'),
  (5, 'Puzzle Quest', 'Learning', 14, 'Solve 100+ mazes, word searches and brain teasers. Listed for ages 8–12.'),
  (6, 'Cuddly Star Friend', 'Treasure', 25, 'Meet a soft purple star friend that glows with colorful lights. 13-inch version.'),
  (7, 'Space Gem Discovery Kit', 'Learning', 23, 'Dig into planet-shaped blocks to discover 15 gemstones. Listed for ages 6+.'),
  (8, 'I Spy Picture Quest', 'Learning', 17, 'Search detailed pictures and solve riddles in I Spy A to Z. Hardcover book.'),
  (9, 'Pirate Treasure Dig Kit', 'Treasure', 20, 'Uncover pirate-themed treasures in a five-in-one digging adventure. Listed for ages 6+.'),
  (10, 'Make Your Own Jewelry', 'Creativity', 19, 'Design charm bracelets and necklaces with an aqua-themed 95-piece kit. Listed for ages 5–12.'),
  (11, 'Outdoor Explorer Kit', 'Learning', 24, 'Explore nature with binoculars, bug-catching tools and a blue explorer bag. Listed for ages 4–8.'),
  (12, 'Colorful Clay Set', 'Creativity', 12, 'Shape your own creations with 32 colors of air-dry clay and three sculpting tools.')
) as v(shop_key, name, category, price, description)
where t.shop_key = v.shop_key;

-- Retailer details never belong in child-visible tables or JavaScript.
create table private.fairybucks_purchase_options (
  treasure_id uuid primary key references public.treasures(id) on delete cascade,
  product_version text not null,
  observed_price_cents integer not null check (observed_price_cents > 0),
  purchase_url text not null check (purchase_url ~ '^https://a[.]co/d/[A-Za-z0-9]+$'),
  price_checked_on date not null
);
alter table private.fairybucks_purchase_options enable row level security;
revoke all on private.fairybucks_purchase_options from public, anon, authenticated;
insert into private.fairybucks_purchase_options
  (treasure_id, product_version, observed_price_cents, purchase_url, price_checked_on)
select t.id, v.version, v.cents, v.url, date '2026-11-11'
from (values
  (1, 'UNGLINGA science kit — choose 40+ or 50+ experiments', 999, 'https://a.co/d/0dg6OKpy'),
  (2, 'Novamira — Mystical Glow Ocean foam painting kit', 999, 'https://a.co/d/00aV9llI'),
  (3, 'Mchochy — 6 dinosaur pull-back cars with paints', 999, 'https://a.co/d/0igWgceu'),
  (4, 'CHAKANLX — 48-piece fairy garden decorations', 1499, 'https://a.co/d/0hvq9TmJ'),
  (5, 'Wordy Wizard — Ultimate Puzzle Activity Book, paperback', 999, 'https://a.co/d/0gvtVpfj'),
  (6, 'WEWILL — purple glowing star plush, 13 inch', 2099, 'https://a.co/d/0cfWpX1t'),
  (7, 'GobiDex — 15-gemstone space digging kit', 1899, 'https://a.co/d/059i6dWL'),
  (8, 'I Spy A to Z: A Book of Picture Riddles — hardcover', 1297, 'https://a.co/d/03Q3KF0K'),
  (9, 'Piano Potato — 5-in-1 Pirate Treasure Dig Kit', 1599, 'https://a.co/d/06sw4a3Q'),
  (10, 'VICTLOV — Aqua 95 Pieces charm bracelet making kit', 1499, 'https://a.co/d/06n6RQNp'),
  (11, 'ESSENSON — blue bug catcher and explorer kit', 1999, 'https://a.co/d/0a9UjzO7'),
  (12, 'MuseLuxe — 32 Colors air-dry clay with 3 tools', 799, 'https://a.co/d/0f26Cpqv')
) as v(shop_key, version, cents, url)
join public.treasures t on t.shop_key = v.shop_key;

create function public.fairybucks_parent_purchase(
  p_child_id uuid, p_request_id uuid, p_unlock_token text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  parent uuid := auth.uid();
  auth_session uuid := nullif(auth.jwt()->>'session_id', '')::uuid;
  result jsonb;
begin
  if parent is null or not exists (
    select 1 from auth.sessions where id = auth_session and user_id = parent
  ) then
    raise insufficient_privilege using message = 'A signed-in parent is required';
  end if;
  if p_unlock_token is null or p_unlock_token !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('status', 'unlock_required');
  end if;
  perform 1 from private.fairybucks_parent_unlocks
    where parent_id = parent and session_id = auth_session
      and token_hash = extensions.digest(p_unlock_token, 'sha256')
      and expires_at > clock_timestamp() for share;
  if not found then return jsonb_build_object('status', 'unlock_required'); end if;

  select jsonb_build_object('status', 'available', 'version', o.product_version,
    'price_cents', o.observed_price_cents, 'checked_on', o.price_checked_on,
    'url', o.purchase_url)
  into result
  from public.treasure_requests r
  join public.child_profiles c on c.id = r.child_id
  join public.families f on f.id = c.family_id
  join private.fairybucks_purchase_options o on o.treasure_id = r.treasure_id
  where r.id = p_request_id and r.child_id = p_child_id and f.owner_id = parent
    and r.status in ('pending', 'approved', 'fulfilled');
  return coalesce(result, jsonb_build_object('status', 'unavailable'));
end $$;
revoke all on function public.fairybucks_parent_purchase(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.fairybucks_parent_purchase(uuid, uuid, text) to authenticated;
notify pgrst, 'reload schema';
commit;
