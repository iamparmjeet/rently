-- Custom SQL migration file, put your code below! --
-- base_rent was stored in rupees by the unit create/edit forms while every
-- reader assumed paise. Live-workspace units were only ever created via those
-- forms, so all of them need scaling. Sample/demo workspaces were seeded in
-- paise and are excluded; leaving the sample workspace deletes its data before
-- workspace_mode flips to 'live', so no paise rows carry over.

-- 1) Leases that accepted the buggy prefill have rent stored numerically equal
--    to the unit's rupee value (manual rupee entry always gets x100 by toPaise,
--    so it can never collide with this value). Runs BEFORE units are scaled.
UPDATE leases l
SET rent = l.rent * 100
FROM units un
JOIN properties p ON p.id = un.property_id
JOIN "user" u ON u.id = p.owner_id
WHERE l.unit_id = un.id
  AND u.workspace_mode = 'live'
  AND l.rent = un.base_rent;

-- 2) Scale the units themselves.
UPDATE units un
SET base_rent = un.base_rent * 100
FROM properties p
JOIN "user" u ON u.id = p.owner_id
WHERE un.property_id = p.id
  AND u.workspace_mode = 'live';
