import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';

import { AppError } from '../errors.js';

declare module 'express-serve-static-core' {
  interface Request {
    userId?: number;
  }
}

/**
 * JWT 鉴权：Authorization: Bearer <token>，token 的 sub 即 user.id。
 * 签发入口见 routes/auth.ts（微信登录待接入，现仅 dev 登录供本地联调）。
 */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.header('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    next(new AppError(401, 'UNAUTHORIZED', '缺少登录凭证'));
    return;
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET ?? 'dev-only-secret') as jwt.JwtPayload;
    const userId = Number(payload.sub);
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new Error('invalid sub');
    }
    req.userId = userId;
    next();
  } catch {
    next(new AppError(401, 'UNAUTHORIZED', '登录凭证无效或已过期'));
  }
};
