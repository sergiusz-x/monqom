-- Repair children missed when 0016 inserted new parents and children in one statement.
-- Keep renamed or archived defaults and user-created categories untouched.
WITH defaults(parent_name, parent_key, child_name, child_icon, child_order) AS (
    VALUES
        ('Pets', 'categories.pets', 'Pet Food & Supplies', '🦴', 1),
        ('Pets', 'categories.pets', 'Veterinary Care', '🐶', 2),
        ('Pets', 'categories.pets', 'Pet Care', '✂️', 3),
        ('Personal Care & Fitness', 'categories.personal.care.fitness', 'Cosmetics', '🧴', 1),
        ('Personal Care & Fitness', 'categories.personal.care.fitness', 'Hairdresser', '💇', 2),
        ('Personal Care & Fitness', 'categories.personal.care.fitness', 'Gym & Sport', '🏋️', 3),
        ('Personal Care & Fitness', 'categories.personal.care.fitness', 'Therapy', '🧠', 4),
        ('Digital Services', 'categories.digital.services', 'Apps & Cloud', '📱', 1),
        ('Digital Services', 'categories.digital.services', 'Hosting & Domains', '🌐', 2)
), candidates AS (
    SELECT p.workspace_id, p.id AS parent_id, d.*,
        'categories.' || trim(BOTH '.' FROM regexp_replace(lower(d.child_name), '[^a-z0-9]+', '.', 'g')) AS child_key,
        'cat_' || md5(p.workspace_id || ':' || d.parent_name || '/' || d.child_name) AS migration_id,
        'cat_' || left(encode(sha256(convert_to(p.workspace_id || ':' || d.parent_name || '/' || d.child_name, 'UTF8')), 'hex'), 32) AS seed_id
    FROM categories p
    JOIN defaults d ON p.system_key = d.parent_key
    WHERE p.parent_id IS NULL AND p.type = 'expense' AND p.deleted_at IS NULL
)
INSERT INTO categories (id, workspace_id, parent_id, name, system_key, icon, sort_order, type, updated_at)
SELECT c.migration_id, c.workspace_id, c.parent_id, c.child_name, c.child_key, c.child_icon, c.child_order, 'expense', CURRENT_TIMESTAMP
FROM candidates c
WHERE NOT EXISTS (
    SELECT 1 FROM categories existing
    WHERE existing.workspace_id = c.workspace_id
      AND (existing.id IN (c.migration_id, c.seed_id)
           OR (existing.parent_id = c.parent_id AND (existing.name = c.child_name OR existing.system_key = c.child_key)))
)
ON CONFLICT (id) DO NOTHING;
