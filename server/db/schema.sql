-- mini-mall-fullstack · MySQL 建表脚本
-- 来源：docs/design.md 的 7 张核心表 + 订单状态机（0 待支付 / 1 待发货 / 2 待收货 / 3 已完成 / 4 已取消 / 5 已退款）
-- 执行：mysql -u <user> -p <database> < schema.sql

CREATE TABLE IF NOT EXISTS `user` (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  openid VARCHAR(64) NOT NULL,
  nickname VARCHAR(64) NULL,
  phone VARCHAR(20) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_openid (openid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(128) NOT NULL,
  cover VARCHAR(512) NULL,
  detail TEXT NULL,
  status TINYINT NOT NULL DEFAULT 1 COMMENT '1=上架, 0=下架',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sku (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id BIGINT UNSIGNED NOT NULL,
  spec_text VARCHAR(128) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  stock INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_product_id (product_id),
  CONSTRAINT fk_sku_product FOREIGN KEY (product_id) REFERENCES product (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cart_item (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  sku_id BIGINT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uk_user_sku (user_id, sku_id),
  CONSTRAINT fk_cart_user FOREIGN KEY (user_id) REFERENCES `user` (id),
  CONSTRAINT fk_cart_sku FOREIGN KEY (sku_id) REFERENCES sku (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_no VARCHAR(32) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  status TINYINT NOT NULL DEFAULT 0 COMMENT '0=待支付, 1=待发货, 2=待收货, 3=已完成, 4=已取消, 5=已退款',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  pay_deadline DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_order_no (order_no),
  KEY idx_user_status (user_id, status),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES `user` (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_item (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  sku_id BIGINT UNSIGNED NOT NULL,
  price DECIMAL(10, 2) NOT NULL COMMENT '下单时价格快照',
  quantity INT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  KEY idx_order_id (order_id),
  CONSTRAINT fk_order_item_order FOREIGN KEY (order_id) REFERENCES orders (id),
  CONSTRAINT fk_order_item_sku FOREIGN KEY (sku_id) REFERENCES sku (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_no VARCHAR(32) NOT NULL,
  transaction_id VARCHAR(64) NULL,
  amount DECIMAL(10, 2) NOT NULL,
  status TINYINT NOT NULL DEFAULT 0 COMMENT '0=待支付, 1=已支付, 2=已退款（与回调幂等配合）',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_payment_order_no (order_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
