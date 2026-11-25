# Child-mode network and tracking audit — 2026-11-24

**Draft for owner review; no production deployment or database changes.**

## Evidence reviewed

- GitHub `main` source (current website and static publish manifest): `child.html`, `child-vault.js`, `child-session.js`, `auth-config.js`, `index.html`, `auth.html`, `permission.html`, `permission-page.js`, `public-shop.js`, `privacy.html`, `netlify.toml`, `tools/build-public-site.mjs`.
- Netlify connection confirmed the `fairybucks-com` site on Netlify's developer plan, with ready published deployment and forms disabled. Its aggregate edge request statistics confirm hosting receives traffic; those statistics do **not** expose a browser's complete request waterfall or Supabase traffic.
- Remote page inspection was unavailable. On November 25, 2026, the operator supplied photographs of Microsoft Edge DevTools **Network** results for homepage (7 requests) and Parent Portal navigation/authentication (52 cumulative requests), with a Domain column on successive views. This verifies selected runtime requests, **not** a complete sanitized HAR or exhaustive audit of all 52 destinations. Child Mode was blocked by the existing parent-permission gate; no child access or browser capture was performed.
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
| Privacy notice on `main` | Listed **GitHub Pages** as the hosting provider, despite Netlify being current host. | **Confirmed factual discrepancy; fix intentionally DEFERRED to the coordinated notice-version/reconsent update** |
| Deployment | Allowlisted pages/scripts/assets copied to `dist`; temporary operator SQL/tests excluded. Public permission test UI excluded. | Positive data-minimization step |
| CSP | Production `netlify.toml` has limited general CSP; built `_headers` adds `Content-Security-Policy-Report-Only` with self, Supabase and jsDelivr. | Not yet a blocking/enforcing network control |

### Explicitly not verified

1. Screenshots of homepage and parent requests were reviewed: the homepage displayed same-origin HTML/CSS/JS/inline images; Parent Portal displayed requests to `fairybucks.com`, `cdn.jsdelivr.net` (Supabase ESM library modules), and the configured Supabase project domain. No obvious advertising/pixel domain appeared in the **shown** requests. These views do **not** establish absence of undisplayed domains; no complete HAR exists, and `/child.html` was **not** tested because access remained correctly denied.
2. The operator used an authorized parent test session. No credentials, cookies, JWTs, PINs, request payloads or child-session tokens were requested or stored in this repository. Child Mode did not open.
3. Netlify and Supabase host/CDN infrastructure can collect identifiers at the network edge even when website JavaScript contains no tracker. This source audit cannot determine how providers' internal subprocessors use those identifiers.
4. The embedded publishing key is designed for public clients, but the child session token must remain secret. Third-party JavaScript loaded on same-origin parent pages warrants supply-chain review and strict CSP before launch.
5. Existing Netlify DPA and subprocessor list provide contractual evidence, not standalone proof of COPPA compliance or confirmed use of particular subprocessors on each request.

## Proposed changes / tests

- The Netlify hosting discrepancy is addressed in **staged PR #71**, alongside versioned parental reconsent; this separate audit PR deliberately does not edit the current notice.
- Add `tests/child-network-privacy.mjs`, a **static regression** that checks child HTML for newly added third-party resources, child imports and explicit RPC destination, credential/referrer controls, session token storage boundary, current notice mismatch reporting, and known tracker signatures. This is intentionally limited to inspected source patterns; a pass is **not a live network proof**.
- Add it to `tests/package.json` CI test command. Require GitHub Actions checks to pass before review.
- **Next (deferred, no gate bypass):** when a legitimately verified permission test parent can enter Child Mode, capture its Domain column for entry, treasure shop and exit. Avoid exporting raw HAR; never commit identifiers or authentication artifacts to the repository. No need to troubleshoot intentionally disabled email-rehearsal functionality as part of this network audit.
- **Separate issue observed:** despite `main` static publish manifest excluding `permission-test.html`, operator could open that URL on `fairybucks.com` and the associated Supabase rehearsal function responded 503. Actual domain routing/build provenance should be independently checked before release. This is not proof of an exploitable bypass, and the email rehearsal does not grant consent.

**Launch assessment:** Child Mode code has no *identified* third-party marketing analytics/pixel SDKs, but does send child-session RPCs to Supabase and page requests to Netlify. Hosting/identity logs require provider privacy review and real browser confirmation. Keep public enrollment OFF.
