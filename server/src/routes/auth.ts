import { Router } from 'express';
import jwt from 'jsonwebtoken';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { getPool } from '../db.js';
import { AppError } from '../errors.js';

export const authRouter = Router();

interface UserRow extends RowDataPacket {
  id: number;
}

function signToken(userId: number): string {
  return jwt.sign({ sub: String(userId) }, process.env.JWT_SECRET ?? 'dev-only-secret', {
    expiresIn: '7d',
  });
}

// TODO: POST /login —— 微信 code 换 openid（code2session）后按 openid 建/查用户再签发，
// 与下方 dev-login 共用 signToken，接入时替换实现即可。

/**
 * POST /api/auth/dev-login —— 仅本地联调用（NODE_ENV=production 时禁用）：
 * 固定一个 dev 用户，方便在微信登录接入前把下单链路跑通。
 */
authRouter.post('/dev-login', async (_req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    next(new AppError(404, 'NOT_FOUND', '接口不存在'));
    return;
  }
  try {
    const pool = getPool();
    const [ins] = await pool.execute<ResultSetHeader>(
      'INSERT INTO `user` (openid, nickname) VALUES (?, ?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)',
      ['dev-openid', '本地联调用户'],
    );
    const [rows] = await pool.execute<UserRow[]>('SELECT id FROM `user` WHERE openid = ?', [
      'dev-openid',
    ]);
    const userId = rows[0]?.id ?? ins.insertId;
    res.json({ ok: true, data: { token: signToken(userId), userId } });
  } catch (err) {
    next(err);
  }
});
