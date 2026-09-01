-- Custom SQL migration file, put your code below! --
-- Reverses the over-scaling by 0018 for the public demo workspace. The demo
-- persona keeps workspace_mode='live' (demo status is tracked via
-- account_mode='public_demo'), so 0018's live-mode filter wrongly scaled its
-- seeded paise rows. Leases first, same reason as 0018.
UPDATE leases l
SET rent = l.rent / 100
FROM units un
JOIN properties p ON p.id = un.property_id
JOIN "user" u ON u.id = p.owner_id
WHERE l.unit_id = un.id
  AND u.account_mode = 'public_demo'
  AND l.rent = un.base_rent;

UPDATE units un
SET base_rent = un.base_rent / 100
FROM properties p
JOIN "user" u ON u.id = p.owner_id
WHERE un.property_id = p.id
  AND u.account_mode = 'public_demo';
