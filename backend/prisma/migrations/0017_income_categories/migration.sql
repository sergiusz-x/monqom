ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'expense';
CREATE INDEX IF NOT EXISTS "categories_workspace_id_type_idx" ON "categories"("workspace_id", "type");
WITH seeds(parent_name, parent_icon, parent_order, child_name, child_icon, child_order) AS (
 VALUES ('Work','💼',1,'Salary','💰',1),('Work','💼',1,'Business & Freelance','🧑‍💻',2),('Other income','✨',2,'Transfer from a person','🤝',1),('Other income','✨',2,'Refund','↩️',2),('Other income','✨',2,'Gift','🎁',3),('Other income','✨',2,'Sale','🏷️',4),('Other income','✨',2,'Other','➕',5)
), parents AS (SELECT DISTINCT w.id workspace_id, s.parent_name, s.parent_icon, s.parent_order FROM "workspaces" w CROSS JOIN seeds s)
INSERT INTO "categories" ("id","workspace_id","parent_id","name","system_key","icon","sort_order","type","created_at","updated_at")
SELECT 'cat_' || md5(workspace_id || ':income/' || parent_name), workspace_id, NULL, parent_name, CASE parent_name WHEN 'Work' THEN 'categories.income.work' ELSE 'categories.income.other' END, parent_icon, parent_order, 'income', NOW(), NOW() FROM parents
ON CONFLICT ("id") DO NOTHING;
WITH seeds(parent_name, child_name, child_icon, child_order) AS (
 VALUES ('Work','Salary','💰',1),('Work','Business & Freelance','🧑‍💻',2),('Other income','Transfer from a person','🤝',1),('Other income','Refund','↩️',2),('Other income','Gift','🎁',3),('Other income','Sale','🏷️',4),('Other income','Other','➕',5)
)
INSERT INTO "categories" ("id","workspace_id","parent_id","name","system_key","icon","sort_order","type","created_at","updated_at")
SELECT 'cat_' || md5(w.id || ':income/' || s.parent_name || '/' || s.child_name), w.id, 'cat_' || md5(w.id || ':income/' || s.parent_name), s.child_name, CASE s.child_name WHEN 'Salary' THEN 'categories.income.salary' WHEN 'Business & Freelance' THEN 'categories.income.business.freelance' WHEN 'Transfer from a person' THEN 'categories.income.transfer.person' WHEN 'Refund' THEN 'categories.income.refund' WHEN 'Gift' THEN 'categories.income.gift' WHEN 'Sale' THEN 'categories.income.sale' ELSE 'categories.income.other.source' END, s.child_icon, s.child_order, 'income', NOW(), NOW() FROM "workspaces" w CROSS JOIN seeds s
ON CONFLICT ("id") DO NOTHING;
