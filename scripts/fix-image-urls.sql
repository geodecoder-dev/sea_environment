-- Repair existing live campaign updates rows where image_url pointed to /src/assets/images/
UPDATE campaign_updates
SET image_url = REPLACE(image_url, '/src/assets/images/', '/images/')
WHERE image_url LIKE '/src/assets/images/%';
