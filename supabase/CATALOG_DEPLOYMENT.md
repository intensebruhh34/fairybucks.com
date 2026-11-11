# Catalog purchase rollout

1. Before merging the PR, run `migrations/20261111210000_catalog_parent_purchases.sql` in the Supabase SQL Editor. This updates the 12 catalog slots and installs the private purchase table and PIN-protected RPC. Existing request prices and wallet balances are not changed.
2. In a separate query run `checks/catalog_parent_purchases.sql`. Sign in to the first test account beforehand if it reports no session. This query uses the two existing test parents and rolls back every test record, including its temporary PIN unlock.
3. After PASS, merge the PR. GitHub Pages uses `_config.yml` to exclude Supabase scripts and tests from the published site. Do not add `.nojekyll` or change to a raw-root uploader without preserving these exclusions. The repository itself is public; retailer mappings are product metadata, not secrets.
4. Sign in, open an explorer, unlock parent controls, and click View purchase details for a pending or approved request. Check the selected version at the retailer before approving or ordering.

This release adds catalog mapping and manual retailer purchase links only. Approval spends FB; it does not order or pay. Delivery stages and refunds after approval remain future work. Product images have not been copied from retailer screenshots. Retail prices are dated observations, not a live feed; tax/shipping may exceed the FB allowance. Supplier details are available only for the owning family's pending, approved or fulfilled requests after server-side authentication and PIN token validation.
