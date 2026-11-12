import type { ErrorRequestHandler } from 'express';

/** 业务错误：带 HTTP 状态码和稳定错误码，路由层直接 throw。 */
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ ok: false, code: err.code, message: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ ok: false, code: 'INTERNAL_ERROR', message: '服务器内部错误' });
};
