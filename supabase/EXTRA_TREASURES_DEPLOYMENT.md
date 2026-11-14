# Hot Wheels and Barbie

Run `migrations/20261114170000_hot_wheels_barbie.sql`, then run `checks/hot_wheels_barbie.sql` in a separate SQL Editor query. The verification uses the existing two test parents and rolls back all fixtures. After PASS, review and merge the PR.

New slots: 13 Hot Wheels Ferrari Five-Pack, 14 FB; 14 Barbie Pink Paisley Doll, 11 FB. Both use Treasure category and the existing request, approval, protected purchase, delivery and FB-return flows. Existing 12 items, balances and request costs are unchanged. The shop already renders dynamic catalog lists and needs no slot limit change.

Price observations are from the owner's November 14 screenshots, not live retailer verification. Hot Wheels shows $9.99; the selected Barbie #249 Pink Paisley shows $6.29, differing from the owner's typed $10. FB prices use round up plus 4. Both screenshots show discounts; parents must check the current selected product and checkout total before approval. Images have not been copied; emoji art remains. Supplier data is stored only in the private purchase table and the SQL folder remains excluded from Pages.
