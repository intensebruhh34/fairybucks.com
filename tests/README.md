# Catalog purchase checks

Run `npm ci --prefix tests` then `npm test --prefix tests`.

The PGlite fixture models the existing tables and Supabase JWT helpers, loads all checked-in migrations, then runs the rollback verification with authenticated and anonymous roles. It checks parent PIN tokens, family ownership, child-safe payloads, canonical prices, and preservation of existing request costs and balances. The fixture is not a substitute for running the separate rollback query on the configured Supabase project.

Browser QA used a local fixture with the real explorer-requests module and mocked RPC responses: locked state, purchase details, approval, continued purchase access, and relocking. Live retailer prices and checkout were not tested; listed prices came from the owner's November 11 screenshots.
