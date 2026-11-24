ALTER TABLE categories ADD COLUMN name_en VARCHAR(100);
ALTER TABLE categories ADD COLUMN description_zh VARCHAR(300);
ALTER TABLE categories ADD COLUMN description_en VARCHAR(300);
ALTER TABLE artifacts ADD COLUMN content_en TEXT;
ALTER TABLE artifacts ADD COLUMN period_en VARCHAR(100);
ALTER TABLE artifacts ADD COLUMN material_en VARCHAR(100);
ALTER TABLE articles ADD COLUMN content_en TEXT;
ALTER TABLE exhibits_3d ADD COLUMN description_en TEXT;
ALTER TABLE products ADD COLUMN description_en TEXT;
ALTER TABLE products ADD COLUMN category_code VARCHAR(40);
ALTER TABLE products ADD COLUMN inspiration_artifact_slug VARCHAR(120);

-- Test length instead of SQL equality so PAD SPACE collations cannot turn a manual space into an empty value.
UPDATE categories SET
  name_en=COALESCE(CASE WHEN CHAR_LENGTH(name_en)>0 THEN name_en END,CASE code WHEN 'BRONZE' THEN 'Ritual Bronzes' WHEN 'JADE' THEN 'Jade and Ritual' WHEN 'RIVER' THEN 'Stories of the Heluo Rivers' END),
  description_zh=COALESCE(CASE WHEN CHAR_LENGTH(description_zh)>0 THEN description_zh END,description),
  description_en=COALESCE(CASE WHEN CHAR_LENGTH(description_en)>0 THEN description_en END,CASE code
    WHEN 'BRONZE' THEN 'Read ritual vessels through silhouette, ornament, and the craft of casting.'
    WHEN 'JADE' THEN 'Explore symmetry, light, and ritual imagination through jade forms.'
    WHEN 'RIVER' THEN 'Follow water, vessels, and patterns through the landscapes and stories of Heluo.' END)
WHERE code IN ('BRONZE','JADE','RIVER');

UPDATE artifacts SET
  content_en=COALESCE(CASE WHEN CHAR_LENGTH(content_en)>0 THEN content_en END,CASE slug
    WHEN 'heluo-bronze-ding' THEN 'The Heluo Bronze Ding is a digital reconstruction based on the Cleveland Museum of Art tripod 1962.281. Begin with the two upright handles, then follow the patterned band around the body and compare the three legs from several angles. The source catalog dates the reference object to the Shang Anyang period, about 1250–1046 BCE, and records overall dimensions of 24.5 × 20 cm. It does not establish an excavation site, weight, or inscription.'
    WHEN 'heluo-bronze-jue' THEN 'This original concept pairs a long pouring spout and raised posts with a narrow body on three legs. Compare its directional profile to the balanced silhouette of a ding. The visual borrowing evokes early ritual bronze design; it is not the record of an excavated vessel.'
    WHEN 'river-map-jade-bi' THEN 'A central opening and shallow rings invite the eye to travel from rim to center and back again. Look for alternating relief and shadow when the light moves across the surface. This original concept draws on the visual language of ritual jade discs rather than representing an archaeological object.'
    WHEN 'painted-pottery-water-jar' THEN 'Follow the painted lines as they bend around the shoulder of the jar. A generous body and narrower neck invite questions about carrying and storing water, while the repeating motif suggests a current. This is a project-original interpretation, not a recovered prehistoric vessel.'
    WHEN 'river-map-pattern-stone' THEN 'Read the incised lines as a possible river network, then try reading them as a diagram of relationships. Neither reading is definitive: the original concept uses stone and pattern to ask how a place becomes legible.'
    WHEN 'water-bird-bronze' THEN 'Notice the lift of the head, the compact folded wings, and the low stance before looking for surface details. The silhouette captures a pause at the water edge. This original concept sculpture imagines a dialogue between natural forms and bronze craft.' END),
  period_en=COALESCE(CASE WHEN CHAR_LENGTH(period_en)>0 THEN period_en END,CASE slug WHEN 'heluo-bronze-ding' THEN 'Shang dynasty, Anyang period (ca. 1250–1046 BCE)' ELSE 'Contemporary concept design' END),
  material_en=COALESCE(CASE WHEN CHAR_LENGTH(material_en)>0 THEN material_en END,CASE slug
    WHEN 'heluo-bronze-ding' THEN 'Bronze (reference object)'
    WHEN 'river-map-jade-bi' THEN 'Jade (concept material)'
    WHEN 'painted-pottery-water-jar' THEN 'Painted earthenware (concept material)'
    WHEN 'river-map-pattern-stone' THEN 'Stone (concept material)'
    ELSE 'Bronze (concept material)' END)
WHERE slug IN ('heluo-bronze-ding','heluo-bronze-jue','river-map-jade-bi','painted-pottery-water-jar','river-map-pattern-stone','water-bird-bronze');

UPDATE articles SET content_en=COALESCE(CASE WHEN CHAR_LENGTH(content_en)>0 THEN content_en END,CASE slug
    WHEN 'why-negative-space-matters' THEN 'Empty space in an exhibition gives the eye a place to rest. Compare a crowded caption and image with the same pair at a comfortable distance. Notice how much easier it is to find the object first, read its label second, and return to its details with a question in mind.'
    WHEN 'river-as-timeline' THEN 'Start with a river rather than a date. Follow the relationships among water, settlement, labor, and the motifs people made. Compare the painted jar with the pattern stone, keeping broad historical context separate from the museum project’s original interpretations.'
    WHEN 'how-to-read-bronze' THEN 'First ask how the object stands; next trace where its surface pattern changes; finally ask what use its form suggests. Try the sequence on the ding and the concept jue, and distinguish what you can see from what the source record confirms.'
    WHEN 'visit-and-digital-guide' THEN 'Browse the public collection or book an available time for a visit. In the digital hall, rotate or zoom to compare the tripod from several sides. If 3D is unavailable, use the three illustrated stops. Luosheng can explain a highlight or point to the booking page; only you can confirm a reservation.' END)
WHERE slug IN ('why-negative-space-matters','river-as-timeline','how-to-read-bronze','visit-and-digital-guide');

UPDATE exhibits_3d SET description_en=COALESCE(CASE WHEN CHAR_LENGTH(description_en)>0 THEN description_en END,
  'Rotate this digital reconstruction of the Heluo Bronze Ding to compare its handles, patterned body, and three legs. Switch between the surface view and point cloud, or use the three illustrated viewing stops when a 3D view is unavailable.')
WHERE slug='heluo-bronze-ding-3d';

UPDATE products SET
  description_en=COALESCE(CASE WHEN CHAR_LENGTH(description_en)>0 THEN description_en END,CASE slug
    WHEN 'river-line-teacup-set' THEN 'A calm band of flowing lines around the cup borrows its rhythm from the painted water-pattern jar. Turn it in your hand to follow how the motif changes with the curve.'
    WHEN 'heluo-silk-scarf' THEN 'The water-bird sculpture inspires a repeating motif that alternates stillness with movement. Folding the scarf changes which birds and lines are visible.'
    WHEN 'river-map-notebook' THEN 'The cover treats the museum pattern stone as a starting point for an imagined map. Use its pages for field notes, sketches, or the questions you want to carry out of the gallery.' END),
  category_code=COALESCE(CASE WHEN CHAR_LENGTH(category_code)>0 THEN category_code END,CASE slug
    WHEN 'river-line-teacup-set' THEN 'TEAWARE' WHEN 'heluo-silk-scarf' THEN 'TEXTILE' ELSE 'STATIONERY' END),
  inspiration_artifact_slug=COALESCE(CASE WHEN CHAR_LENGTH(inspiration_artifact_slug)>0 THEN inspiration_artifact_slug END,CASE slug
    WHEN 'river-line-teacup-set' THEN 'painted-pottery-water-jar'
    WHEN 'heluo-silk-scarf' THEN 'water-bird-bronze'
    WHEN 'river-map-notebook' THEN 'river-map-pattern-stone' END)
WHERE slug IN ('river-line-teacup-set','heluo-silk-scarf','river-map-notebook');
