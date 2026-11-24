-- Register EXHIBIT 02: River-Map Pattern Stone · Raking-Light Inspection (WebGL optical stage)
-- Guarded with a derived subquery so both MySQL 8.4 (avoiding Error 1093) and H2 MODE=MySQL succeed cleanly,
-- and minimal test fixtures without 'river-map-pattern-stone' remain untouched.

INSERT INTO exhibits_3d (
  artifact_id,
  title,
  title_en,
  slug,
  summary,
  summary_en,
  description,
  description_en,
  model_url,
  model_source_ref,
  model_format,
  model_size_bytes,
  cover_image_url,
  cover_asset_ref,
  display_no,
  source_credit,
  source_url,
  license_label,
  collection_location,
  status,
  published_at,
  created_by,
  updated_by
)
SELECT
  a.id,
  '河洛图纹石板 · 斜射光刻痕检视',
  'River-Map Pattern Stone · Raking-Light Inspection',
  'river-map-stone-raking',
  '以低掠射角可调光学台细察石板阴刻河道、同心圆阵与石理风化痕迹，支持 360° 光向牵引、2.4× 光学放大镜与乌金墨拓显影。',
  'Sweep low-angle raking light across the incised stone tablet to inspect carved river channels, compass rings, and weathered slate grain with a 2.4× optical loupe and ink-rubbing relief mode.',
  '本展项围绕馆内原创概念展品《河洛图纹石板》构建 WebGL 斜射光（Raking Light）光学检视台：通过调节掠射光源方位角与低仰角阴影，原本平视难以察觉的浅阴刻双河交汇线、河图同心节点与石材层理得以清晰浮现，亦可一键切换“乌金墨拓”模式比对拓印留白。本品为项目原创概念数字展项，不代表特定考古出土石刻拓本。',
  'Built around the museum’s original concept object River-Map Pattern Stone, this WebGL raking-light stage reveals shallow incised river channels, concentric node constellations, and slate strata through low-angle grazing shadows, a 2.4× optical loupe, and a Xuan-paper ink-rubbing relief view. It is an original curatorial concept exhibit rather than a scan of an excavated stele.',
  '/media/editorial/explore-river-map-stone-user-v2.webp',
  'PLATE-RIVER-MAP-STONE-RAKING-V1',
  'GLB',
  51274,
  '/media/editorial/explore-river-map-stone-user-v2.webp',
  'IMG-EDITORIAL-RIVER-MAP-STONE-V2',
  '02',
  '河洛数字博物馆 · 原创概念光学展项',
  '',
  'Original curatorial concept · WebGL raking-light stage',
  '河洛数字博物馆 · 金石光学检视室',
  'PUBLISHED',
  TIMESTAMP '2026-01-01 00:00:00',
  a.created_by,
  a.updated_by
FROM artifacts a
WHERE a.slug = 'river-map-pattern-stone'
  AND a.deleted_at IS NULL
  AND EXISTS (SELECT 1 FROM users u WHERE u.id = a.created_by)
  AND NOT EXISTS (
    SELECT 1 FROM (SELECT id FROM exhibits_3d WHERE slug = 'river-map-stone-raking') existing
  );
