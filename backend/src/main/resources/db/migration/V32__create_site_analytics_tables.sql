CREATE TABLE site_page_daily_stats (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  stat_date DATE NOT NULL,
  route_type VARCHAR(32) NOT NULL,
  target_slug VARCHAR(180) NOT NULL DEFAULT '',
  target_title VARCHAR(200) NULL,
  pv_count INT UNSIGNED NOT NULL DEFAULT 0,
  uv_count INT UNSIGNED NOT NULL DEFAULT 0,
  is_demo TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT pk_site_page_daily_stats PRIMARY KEY (id),
  CONSTRAINT uq_site_page_daily_key UNIQUE (stat_date, route_type, target_slug, is_demo),
  INDEX idx_site_page_daily_date (stat_date, is_demo),
  INDEX idx_site_page_daily_route (route_type, stat_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE site_visitor_daily_uniques (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  stat_date DATE NOT NULL,
  scope_key VARCHAR(220) NOT NULL,
  visitor_hash CHAR(64) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT pk_site_visitor_daily_uniques PRIMARY KEY (id),
  CONSTRAINT uq_site_visitor_daily UNIQUE (stat_date, scope_key, visitor_hash),
  INDEX idx_site_visitor_date (stat_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
