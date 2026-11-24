# Child-mode network and tracking audit — 2026-11-24

**Draft for owner review; no production deployment or database changes.**

## Evidence reviewed

- GitHub `main` source (current website and static publish manifest): `child.html`, `child-vault.js`, `child-session.js`, `auth-config.js`, `index.html`, `auth.html`, `permission.html`, `permission-page.js`, `public-shop.js`, `privacy.html`, `netlify.toml`, `tools/build-public-site.mjs`.
- Netlify connection confirmed the `fairybucks-com` site on Netlify's developer plan, with ready published deployment and forms disabled. Its aggregate edge request statistics confirm hosting receives traffic; those statistics do **not** expose a browser's complete request waterfall or Supabase traffic.
- An attempt to fetch deployed `fairybucks.com` pages via remote page inspection was unsuccessful. Therefore a full browser live-network/HAR observation **was not performed** and no claim is made that the live deployment matches the current GitHub source byte-for-byte.
- The `netlify.toml` headers and public build script were inspected, but **CSP is currently report-only** for strict script/connect allowlisting; it does not yet enforce third-party request restrictions.

## Confirmed by source inspection

| Layer | Observed outbound or storage behavior | Classification |
|---|---|---|
| Child page initial HTML | Self-hosted stylesheet `/vault-theme.css`, `/auth-config.js`, `/child-vault.js`. No explicit third-party scripts, images, iframes or tracking pixels in `child.html`. | Same-origin asset requests (Netlify processes request metadata) |
| Child code imports | Self-hosted `/delivery-stages.js`, `/child-session.js`, `/treasure-catalog.js`. | Same-origin Netlify assets |
| Child vault API | POST `https://cuyrujodyxpxzkdwxstk.supabase.co/rest/v1/rpc/fairybucks_child_action`, with `apikey` public publishable key, JSON body carrying child-session token, action and optional request information; `credentials:'omit'`, `cache:'no-store'`, `referrerPolicy:'no-referrer'`. | Third-party network request to Supabase; server may observe IP address, User-Agent, TLS/network metadata and request timestamps |
| Child session | 64-digit lowercase hex token in **sessionStorage**, plus optional pending-request UUID mapping. No child token in URL query string or `localStorage` in inspected code. | Sensitive browser-local token; script-accessible within same origin |
| Parent auth/permission | Parent UI imports `@supabase/supabase-js@2/+esm` from `cdn.jsdelivr.net`; Supabase Auth, Edge Functions and database calls occur through SDK. | Third-party SDK/CDN requests; version is not fixed to a specific release |
| Public landing | Large artwork images inline as `data:image/webp;base64` and a self-hosted SVG. | No off-site image host shown in inspected markup |
| Privacy notice on `main` | Listed **GitHub Pages** as the hosting provider, despite Netlify being current host. | **Confirmed factual discrepancy; proposed correction in this PR** |
| Deployment | Allowlisted pages/scripts/assets copied to `dist`; temporary operator SQL/tests excluded. Public permission test UI excluded. | Positive data-minimization step |
| CSP | Production `netlify.toml` has limited general CSP; built `_headers` adds `Content-Security-Policy-Report-Only` with self, Supabase and jsDelivr. | Not yet a blocking/enforcing network control |

### Explicitly not verified

1. No full browser HAR / DevTools capture of initial landing, `/auth.html` or `/child.html`; therefore **no claim of zero hidden third-party requests**, nor any definitive inventory of Supabase SDK module dependency fetches, can be made.
2. No child browser was signed in and no parent tokens, PINs, consent emails or real user data were used in this audit.
3. Netlify and Supabase host/CDN infrastructure can collect identifiers at the network edge even when website JavaScript contains no tracker. This source audit cannot determine how providers' internal subprocessors use those identifiers.
4. The embedded publishing key is designed for public clients, but the child session token must remain secret. Third-party JavaScript loaded on same-origin parent pages warrants supply-chain review and strict CSP before launch.
5. Existing Netlify DPA and subprocessor list provide contractual evidence, not standalone proof of COPPA compliance or confirmed use of particular subprocessors on each request.

## Proposed changes / tests

- Update `privacy.html` to identify **Netlify** rather than GitHub Pages, with accurate request/log disclosure. No claim that all logs are deleted immediately.
- Add `tests/child-network-privacy.mjs`, a **static regression** that checks child HTML for newly added third-party resources, child imports and explicit RPC destination, credential/referrer controls, session token storage boundary, Netlify attribution, and known tracker signatures. This is intentionally limited to inspected source patterns; a pass is **not a live network proof**.
- Add it to `tests/package.json` CI test command. Require GitHub Actions checks to pass before review.
- Next separate review: use a controlled desktop browser with DevTools Network Preserve Log, filter by Domain, reload landing/parent/child page with fictional test account, export a **sanitized HAR** (remove authorization headers, JWTs, emails, child tokens, IPs, request bodies and cookies) or use an ephemeral browser harness. Ensure that any HAR is never committed to a public repository.

**Launch assessment:** Child Mode code has no *identified* third-party marketing analytics/pixel SDKs, but does send child-session RPCs to Supabase and page requests to Netlify. Hosting/identity logs require provider privacy review and real browser confirmation. Keep public enrollment OFF.
