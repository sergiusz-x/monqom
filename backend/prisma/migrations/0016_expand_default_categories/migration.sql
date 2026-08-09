-- Adds only missing defaults; existing user categories and history remain untouched.
WITH defaults(parent_name, child_name, parent_icon, child_icon, parent_order, child_order) AS (
 VALUES
 ('Pets','Pet Food & Supplies','🐾','🦴',9,1),('Pets','Veterinary Care','🐾','🐶',9,2),('Pets','Pet Care','🐾','✂️',9,3),
 ('Personal Care & Fitness','Cosmetics','🧴','🧴',10,1),('Personal Care & Fitness','Hairdresser','🧴','💇',10,2),('Personal Care & Fitness','Gym & Sport','🧴','🏋️',10,3),('Personal Care & Fitness','Therapy','🧴','🧠',10,4),
 ('Digital Services','Apps & Cloud','☁️','📱',11,1),('Digital Services','Hosting & Domains','☁️','🌐',11,2),
 ('Transport','Car Maintenance','🚗','🔧',3,5),('Transport','Car Wash','🚗','🧽',3,6),('Transport','Car Insurance','🚗','🛡️',3,7)
), parents AS (
 INSERT INTO categories (id, workspace_id, parent_id, name, system_key, icon, sort_order, updated_at)
 SELECT 'cat_' || md5(w.id || ':' || d.parent_name), w.id, NULL, d.parent_name,
        'categories.' || trim(BOTH '.' FROM regexp_replace(lower(d.parent_name), '[^a-z0-9]+', '.', 'g')), d.parent_icon, d.parent_order, CURRENT_TIMESTAMP
 FROM workspaces w CROSS JOIN (SELECT DISTINCT parent_name, parent_icon, parent_order FROM defaults) d
 WHERE NOT EXISTS (SELECT 1 FROM categories c WHERE c.workspace_id=w.id AND c.parent_id IS NULL AND c.name=d.parent_name)
 ON CONFLICT (id) DO NOTHING
 RETURNING id
)
INSERT INTO categories (id, workspace_id, parent_id, name, system_key, icon, sort_order, updated_at)
SELECT 'cat_' || md5(w.id || ':' || d.parent_name || '/' || d.child_name), w.id, p.id, d.child_name,
       'categories.' || trim(BOTH '.' FROM regexp_replace(lower(d.child_name), '[^a-z0-9]+', '.', 'g')), d.child_icon, d.child_order, CURRENT_TIMESTAMP
FROM workspaces w JOIN defaults d ON true JOIN categories p ON p.workspace_id=w.id AND p.parent_id IS NULL AND p.name=d.parent_name
WHERE NOT EXISTS (SELECT 1 FROM categories c WHERE c.workspace_id=w.id AND c.parent_id=p.id AND c.name=d.child_name);