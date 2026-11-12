import mysql, { type Pool, type PoolConnection } from 'mysql2/promise';

let pool: Pool | undefined;

/** 全局 MySQL 连接池（懒初始化，配置走环境变量，见 .env.example）。 */
export function getPool(): Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST ?? '127.0.0.1',
      port: Number(process.env.DB_PORT ?? 3306),
      user: process.env.DB_USER ?? 'root',
      password: process.env.DB_PASSWORD ?? '',
      database: process.env.DB_NAME ?? 'mini_mall',
      waitForConnections: true,
      connectionLimit: 10,
    });
  }
  return pool;
}

export type { PoolConnection };
