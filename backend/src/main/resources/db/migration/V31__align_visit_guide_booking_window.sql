-- Update only the known obsolete seed text; retain all other editorial fields and edits.
-- REPLACE matches case-sensitively even when MySQL's column equality does not.
UPDATE articles
SET summary = '一文了解未来 365 天预约查询窗口、单笔 1–30 人规则、3D 展厅操作与推荐游览动线。'
WHERE slug = 'visit-and-digital-guide' AND deleted_at IS NULL
  AND summary = '一文了解未来 14 天公开预约窗口、单笔 1–30 人规则、3D 展厅操作与推荐游览动线。'
  AND CHAR_LENGTH(REPLACE(summary, '一文了解未来 14 天公开预约窗口、单笔 1–30 人规则、3D 展厅操作与推荐游览动线。', '')) = 0;

UPDATE articles
SET summary_en = 'Plan your visit with our 365-day booking search window, 1–30 visitor rules, 3D hall controls, and recommended routes.'
WHERE slug = 'visit-and-digital-guide' AND deleted_at IS NULL
  AND summary_en = 'Plan your visit with our 14-day booking window, 1–30 visitor rules, 3D hall controls, and recommended routes.'
  AND CHAR_LENGTH(REPLACE(summary_en, 'Plan your visit with our 14-day booking window, 1–30 visitor rules, 3D hall controls, and recommended routes.', '')) = 0;

UPDATE articles
SET content = REPLACE(content,
  '河洛数字博物馆的公开入馆预约窗口为“今天起未来 14 天”，系统仅展示状态为开放且仍有余量的时段；',
  '公开预约可查询今天起未来 365 天内的时段，系统仅展示状态为开放且仍有余量的时段；')
WHERE slug = 'visit-and-digital-guide' AND deleted_at IS NULL
  AND CHAR_LENGTH(REPLACE(content,
    '河洛数字博物馆的公开入馆预约窗口为“今天起未来 14 天”，系统仅展示状态为开放且仍有余量的时段；', '')) < CHAR_LENGTH(content);
