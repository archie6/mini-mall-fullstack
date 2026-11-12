import { Router } from 'express';
import type { RowDataPacket } from 'mysql2/promise';

import { getPool } from '../db.js';
import { AppError } from '../errors.js';
import { requireAuth } from '../middleware/auth.js';
import { cancelOrder, createOrder, type OrderItemInput } from '../services/orderService.js';

export const ordersRouter = Router();

ordersRouter.use(requireAuth);

function parseItems(body: unknown): OrderItemInput[] {
  const items = (body as { items?: unknown })?.items;
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError(400, 'INVALID_ITEMS', 'items 必须是非空数组');
  }
  return items.map((raw) => {
    const skuId = Number((raw as { skuId?: unknown })?.skuId);
    const quantity = Number((raw as { quantity?: unknown })?.quantity);
    if (!Number.isInteger(skuId) || skuId <= 0 || !Number.isInteger(quantity) || quantity <= 0) {
      throw new AppError(400, 'INVALID_ITEMS', '每项需为正整数 skuId 与 quantity');
    }
    return { skuId, quantity };
  });
}

/** POST /api/orders 创建订单（扣库存、防超卖） */
ordersRouter.post('/', async (req, res, next) => {
  const conn = await getPool().getConnection();
  try {
    const items = parseItems(req.body);
    const created = await createOrder(conn, req.userId!, items);
    res.status(201).json({ ok: true, data: created });
  } catch (err) {
    next(err);
  } finally {
    conn.release();
  }
});

interface OrderListRow extends RowDataPacket {
  id: number;
  order_no: string;
  total_amount: string;
  status: number;
  created_at: Date;
  sku_id: number | null;
  price: string | null;
  quantity: number | null;
}

/** GET /api/orders 我的订单列表（含明细） */
ordersRouter.get('/', async (req, res, next) => {
  try {
    const [rows] = await getPool().execute<OrderListRow[]>(
      `SELECT o.id, o.order_no, o.total_amount, o.status, o.created_at,
              oi.sku_id, oi.price, oi.quantity
         FROM orders o
         LEFT JOIN order_item oi ON oi.order_id = o.id
        WHERE o.user_id = ?
        ORDER BY o.id DESC, oi.id ASC`,
      [req.userId!],
    );
    const byId = new Map<number, Record<string, unknown>>();
    for (const row of rows) {
      let order = byId.get(row.id);
      if (!order) {
        order = {
          id: row.id,
          orderNo: row.order_no,
          totalAmount: Number(row.total_amount),
          status: row.status,
          createdAt: row.created_at,
          items: [],
        };
        byId.set(row.id, order);
      }
      if (row.sku_id !== null) {
        (order.items as unknown[]).push({
          skuId: row.sku_id,
          price: Number(row.price),
          quantity: row.quantity,
        });
      }
    }
    res.json({ ok: true, data: [...byId.values()] });
  } catch (err) {
    next(err);
  }
});

/** POST /api/orders/:id/cancel 取消订单（回滚库存） */
ordersRouter.post('/:id/cancel', async (req, res, next) => {
  const orderId = Number(req.params.id);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    next(new AppError(400, 'INVALID_ID', '订单 id 不合法'));
    return;
  }
  const conn = await getPool().getConnection();
  try {
    const result = await cancelOrder(conn, req.userId!, orderId);
    res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  } finally {
    conn.release();
  }
});
