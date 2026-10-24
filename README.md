# mini-mall-fullstack

微信小程序商城 · 全栈练手项目

前端用 uni-app（Vue 3 + TypeScript）一套代码出微信小程序和 App，后端用 Node.js（Express + TypeScript）+ MySQL + Redis，把商城的核心链路完整走通：登录、商品、购物车、下单、支付、防超卖。

这个项目也是我的面试复习落地：设计要点与我的[面试笔记仓库](https://github.com/archie6/frontend-interview-notes)一一对应，代码写到哪，笔记就能讲到哪。

## 功能路线图

- [x] 项目骨架与设计文档
- [ ] 数据库表结构与种子数据
- [ ] 微信登录（code 换 openid）+ JWT 鉴权中间件
- [ ] 商品列表 / 详情、SKU 规格与库存
- [ ] 购物车（增删改查、勾选结算）
- [ ] 下单与订单状态机、库存防超卖（条件更新）
- [ ] 支付（模拟统一下单与回调）、订单超时自动取消
- [ ] 小程序端页面：首页 / 商品详情 / 购物车 / 订单 / 我的
- [ ] 部署到自己的服务器（HTTPS + 进程守护）

## 技术栈

| 层 | 选型 |
|---|---|
| 小程序 / App | uni-app + Vue 3 + TypeScript + Pinia |
| 后端 | Node.js + Express + TypeScript |
| 数据库 | MySQL 8（核心业务数据）+ Redis（库存热点、订单超时队列） |
| 鉴权 | JWT（access token）+ RBAC 预留 |

## 架构一图流

```
小程序 / App (uni-app)
        │ HTTPS + JWT
        ▼
Express API ── MySQL（用户/商品/SKU/购物车/订单）
        │
        └── Redis（库存扣减、超时关单延迟队列）
```

## 本地运行（后端）

```bash
cd server
npm install
npm run dev
# 健康检查：GET http://localhost:3000/health
```

## 设计文档

表结构、订单状态机、接口清单和防超卖方案见 [docs/design.md](docs/design.md)。
