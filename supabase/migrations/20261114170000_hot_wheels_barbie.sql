begin;

-- New slots only; no existing treasure, wallet or request is modified.
insert into public.treasures(shop_key,name,category,fairy_price,description,is_active) values
(13,'Hot Wheels Ferrari Five-Pack','Treasure',14,'Race and display five 1:64 scale Ferrari toy cars. Listed for ages 3+.',true),
(14,'Barbie Pink Paisley Doll','Treasure',11,'Create your own adventures with Barbie Fashionistas #249, wearing a pink paisley outfit and white platform sandals. Listed for ages 3+.',true);

-- Retailer metadata remains in the PIN-protected private table.
insert into private.fairybucks_purchase_options(treasure_id,product_version,observed_price_cents,purchase_url,price_checked_on)
select t.id,v.version,v.cents,v.url,date '2026-11-14'
from (values
 (13,'Hot Wheels — Ferrari 5-Pack, five 1:64 scale cars',999,'https://a.co/d/01spso0w'),
 (14,'Barbie Fashionistas Style Doll #249 — Pink Paisley',629,'https://a.co/d/01EoZDMn')
) as v(shop_key,version,cents,url)
join public.treasures t on t.shop_key=v.shop_key;
notify pgrst, 'reload schema';
commit;
