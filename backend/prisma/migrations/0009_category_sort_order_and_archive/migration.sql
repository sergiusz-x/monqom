ALTER TABLE "categories"
ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "deleted_at" TIMESTAMP(3);

UPDATE "categories"
SET "sort_order" = CASE "name"
    WHEN 'Food' THEN 1
    WHEN 'Housing' THEN 2
    WHEN 'Transport' THEN 3
    WHEN 'Health' THEN 4
    WHEN 'Entertainment' THEN 5
    WHEN 'Shopping' THEN 6
    WHEN 'Utilities' THEN 7
    WHEN 'Education' THEN 8
    ELSE "sort_order"
END
WHERE "parent_id" IS NULL;

UPDATE "categories" AS child
SET "sort_order" = CASE
    WHEN parent."name" = 'Food' AND child."name" = 'Groceries' THEN 1
    WHEN parent."name" = 'Food' AND child."name" = 'Restaurants' THEN 2
    WHEN parent."name" = 'Food' AND child."name" = 'Dining Out' THEN 2
    WHEN parent."name" = 'Food' AND child."name" = 'Coffee' THEN 3
    WHEN parent."name" = 'Food' AND child."name" = 'Delivery' THEN 4
    WHEN parent."name" = 'Housing' AND child."name" = 'Rent' THEN 1
    WHEN parent."name" = 'Housing' AND child."name" = 'Utilities' THEN 2
    WHEN parent."name" = 'Housing' AND child."name" = 'Maintenance' THEN 3
    WHEN parent."name" = 'Housing' AND child."name" = 'Insurance' THEN 4
    WHEN parent."name" = 'Transport' AND child."name" = 'Fuel' THEN 1
    WHEN parent."name" = 'Transport' AND child."name" = 'Public Transport' THEN 2
    WHEN parent."name" = 'Transport' AND child."name" = 'Public Transit' THEN 2
    WHEN parent."name" = 'Transport' AND child."name" = 'Taxi' THEN 3
    WHEN parent."name" = 'Transport' AND child."name" = 'Parking' THEN 4
    WHEN parent."name" = 'Health' AND child."name" = 'Pharmacy' THEN 1
    WHEN parent."name" = 'Health' AND child."name" = 'Doctor' THEN 2
    WHEN parent."name" = 'Health' AND child."name" = 'Dental' THEN 3
    WHEN parent."name" = 'Entertainment' AND child."name" = 'Streaming' THEN 1
    WHEN parent."name" = 'Entertainment' AND child."name" = 'Games' THEN 2
    WHEN parent."name" = 'Entertainment' AND child."name" = 'Events' THEN 3
    WHEN parent."name" = 'Shopping' AND child."name" = 'Clothing' THEN 1
    WHEN parent."name" = 'Shopping' AND child."name" = 'Electronics' THEN 2
    WHEN parent."name" = 'Shopping' AND child."name" = 'Home Goods' THEN 3
    WHEN parent."name" = 'Utilities' AND child."name" = 'Electricity' THEN 1
    WHEN parent."name" = 'Utilities' AND child."name" = 'Water' THEN 2
    WHEN parent."name" = 'Utilities' AND child."name" = 'Internet' THEN 3
    WHEN parent."name" = 'Utilities' AND child."name" = 'Phone' THEN 4
    WHEN parent."name" = 'Education' AND child."name" = 'Books' THEN 1
    WHEN parent."name" = 'Education' AND child."name" = 'Courses' THEN 2
    WHEN parent."name" = 'Education' AND child."name" = 'Supplies' THEN 3
    ELSE child."sort_order"
END
FROM "categories" AS parent
WHERE child."workspace_id" = parent."workspace_id"
  AND child."parent_id" = parent."id";
