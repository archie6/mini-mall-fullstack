import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';

import { errorHandler } from './errors.js';
import { authRouter } from './routes/auth.js';
import { ordersRouter } from './routes/orders.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'mini-mall-server',
    time: new Date().toISOString(),
  });
});

// 业务路由按 docs/design.md 的接口清单逐步接入：
app.use('/api/auth', authRouter);
// app.use('/api/products', productRouter);
// app.use('/api/cart', cartRouter);
app.use('/api/orders', ordersRouter);

app.use(errorHandler);

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  console.log(`mini-mall-server listening on http://localhost:${port}`);
});
