# 设计文档

## 核心数据表（MySQL）

| 表 | 关键字段 | 说明 |
|---|---|---|
| user | id, openid(唯一), nickname, phone, created_at | 微信登录用户 |
| product | id, name, cover, detail, status(上架/下架), created_at | 商品 SPU |
| sku | id, product_id, spec_text, price, stock | 规格与库存，扣减在此表 |
| cart_item | id, user_id, sku_id, quantity | 购物车行，user_id+sku_id 唯一 |
| orders | id, order_no(唯一), user_id, total_amount, status, created_at, pay_deadline | 订单主表 |
| order_item | id, order_id, sku_id, price, quantity | 下单时价格快照 |
| payment | id, order_no(唯一), transaction_id, amount, status | 支付记录，回调幂等靠 order_no 唯一键 |

## 订单状态机

```
待支付(0) ──支付成功──▶ 待发货(1) ──发货──▶ 待收货(2) ──确认收货──▶ 已完成(3)
   │
   ├──超时未付 / 用户取消──▶ 已取消(4)（回滚库存）
   └──支付后申请退款──▶ 已退款(5)（回滚库存）
```

状态只能按箭头方向流转，每次流转校验前置状态，防并发乱序。

## 接口清单（v1）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | /api/auth/login | 小程序 code 换 openid，签发 JWT |
| GET | /api/products | 商品列表（分页） |
| GET | /api/products/:id | 商品详情（含 SKU） |
| GET | /api/cart | 我的购物车 |
| POST | /api/cart | 加购（传 skuId + 目标数量） |
| POST | /api/orders | 创建订单（扣库存、防超卖） |
| POST | /api/pay/mock-notify | 模拟支付回调（验签位预留、幂等） |
| GET | /api/orders | 我的订单列表 |
| POST | /api/orders/:id/cancel | 取消订单（回滚库存） |

## 防超卖

下单扣库存用条件更新，一条 SQL 决定成败：

```sql
UPDATE sku SET stock = stock - #{qty}
WHERE id = #{skuId} AND stock >= #{qty};
```

受影响行数为 0 即库存不足，整单回滚。配合 Redis 预扣减扛热点 SKU（后续迭代）。

## 幂等

- 创建订单：前端传幂等键（或按 user_id + 幂等 token 唯一约束），重复提交只返回同一订单。
- 支付回调：payment.order_no 唯一键 + 先查状态，重复回调直接返回成功，不重复改单。

## 订单超时取消

下单时把订单号写入 Redis 延迟队列（或用过期键监听），到期未支付则关单并回滚库存；同时支付回调里校验订单状态，已取消的订单拒绝入账并走退款流程。
