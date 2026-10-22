-- Clear seeded demo donations and placeholder campaign updates from live D1 database
DELETE FROM donations WHERE id LIKE 'don-%' OR billplz_bill_id LIKE 'bpz_seed_%';
DELETE FROM campaign_updates WHERE id IN ('upd-coralku-1', 'upd-coralku-2', 'upd-coralku-3', 'upd-coralku-4');
