import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { AppError } from '../errors.js';

export interface OrderItemInput {
  skuId: number;
  quantity: number;
}

export interface CreatedOrder {
  orderId: number;
  orderNo: string;
  totalAmount: number;
  status: 0;
}

interface SkuRow extends RowDataPacket {
  id: number;
  price: string;
  stock: number;
}

interface OrderRow extends RowDataPacket {
  id: number;
  status: number;
}

interface OrderItemRow extends RowDataPacket {
  sku_id: number;
  quantity: number;
}

/** 订单号：MM + 毫秒时间戳 + 4 位随机，总长不超过 orders.order_no 的 32。 */
function genOrderNo(): string {
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `MM${Date.now()}${rand}`;
}

/** 支付截止时间（下单后 15 分钟），按 MySQL DATETIME 字面量格式输出。 */
function payDeadline(): string {
  const d = new Date(Date.now() + 15 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * 创建订单（防超卖核心）：
 * 单事务内逐个 SKU 先查价、再用条件更新扣库存——
 *   UPDATE sku SET stock = stock - ? WHERE id = ? AND stock >= ?
 * 受影响行数为 0 即库存不足，抛错回滚整单，保证不会卖出超过库存的数量。
 * 明细按 skuId 升序处理，统一加锁顺序，降低并发下单死锁概率。
 */
export async function createOrder(
  conn: PoolConnection,
  userId: number,
  items: OrderItemInput[],
): Promise<CreatedOrder> {
  // 同一 SKU 多行先合并，避免逐行扣减时误判库存不足。
  const merged = new Map<number, number>();
  for (const item of items) {
    merged.set(item.skuId, (merged.get(item.skuId) ?? 0) + item.quantity);
  }
  const lines = [...merged.entries()]
    .map(([skuId, quantity]) => ({ skuId, quantity }))
    .sort((a, b) => a.skuId - b.skuId);

  await conn.beginTransaction();
  try {
    let total = 0;
    const priced: { skuId: number; price: number; quantity: number }[] = [];

    for (const line of lines) {
      const [skuRows] = await conn.execute<SkuRow[]>(
        'SELECT id, price, stock FROM sku WHERE id = ?',
        [line.skuId],
      );
      if (skuRows.length === 0) {
        throw new AppError(404, 'SKU_NOT_FOUND', `SKU ${line.skuId} 不存在`);
      }
      const price = Number(skuRows[0].price);

      const [upd] = await conn.execute<ResultSetHeader>(
        'UPDATE sku SET stock = stock - ? WHERE id = ? AND stock >= ?',
        [line.quantity, line.skuId, line.quantity],
      );
      if (upd.affectedRows === 0) {
        throw new AppError(409, 'INSUFFICIENT_STOCK', `SKU ${line.skuId} 库存不足`);
      }

      total += price * line.quantity;
      priced.push({ skuId: line.skuId, price, quantity: line.quantity });
    }

    const orderNo = genOrderNo();
    const totalAmount = Math.round(total * 100) / 100;
    const [ins] = await conn.execute<ResultSetHeader>(
      'INSERT INTO orders (order_no, user_id, total_amount, status, pay_deadline) VALUES (?, ?, ?, 0, ?)',
      [orderNo, userId, totalAmount.toFixed(2), payDeadline()],
    );
    const orderId = ins.insertId;

    for (const line of priced) {
      await conn.execute(
        'INSERT INTO order_item (order_id, sku_id, price, quantity) VALUES (?, ?, ?, ?)',
        [orderId, line.skuId, line.price.toFixed(2), line.quantity],
      );
    }

    await conn.commit();
    return { orderId, orderNo, totalAmount, status: 0 };
  } catch (err) {
    await conn.rollback();
    throw err;
  }
}

/**
 * 取消订单（仅限待支付 0）：状态流转用条件更新兜底，
 * 同事务内把订单明细的库存逐行回补。
 */
export async function cancelOrder(
  conn: PoolConnection,
  userId: number,
  orderId: number,
): Promise<{ orderId: number; status: 4 }> {
  await conn.beginTransaction();
  try {
    const [orderRows] = await conn.execute<OrderRow[]>(
      'SELECT id, status FROM orders WHERE id = ? AND user_id = ? FOR UPDATE',
      [orderId, userId],
    );
    if (orderRows.length === 0) {
      throw new AppError(404, 'ORDER_NOT_FOUND', '订单不存在');
    }
    if (orderRows[0].status !== 0) {
      throw new AppError(409, 'INVALID_STATUS', '当前订单状态不允许取消');
    }

    const [upd] = await conn.execute<ResultSetHeader>(
      'UPDATE orders SET status = 4 WHERE id = ? AND status = 0',
      [orderId],
    );
    if (upd.affectedRows === 0) {
      throw new AppError(409, 'INVALID_STATUS', '当前订单状态不允许取消');
    }

    const [itemRows] = await conn.execute<OrderItemRow[]>(
      'SELECT sku_id, quantity FROM order_item WHERE order_id = ?',
      [orderId],
    );
    for (const item of itemRows) {
      await conn.execute('UPDATE sku SET stock = stock + ? WHERE id = ?', [
        item.quantity,
        item.sku_id,
      ]);
    }

    await conn.commit();
    return { orderId, status: 4 };
  } catch (err) {
    await conn.rollback();
    throw err;
  }
}
