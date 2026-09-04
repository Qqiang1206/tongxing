#!/usr/bin/env bash
# 全新机器部署初始化：安装依赖 → 从数据库导入内容快照 → 同步静态数据 → 构建 → 校验
set -euo pipefail
cd "$(dirname "$0")/.."

echo "[1/6] 安装依赖"
npm ci
npm ci --prefix server

echo "[2/6] 从数据库导入内容快照"
npm run server:import

echo "[3/6] 同步静态数据"
npm run sync:static

echo "[4/6] 构建"
npm run build

echo "[5/6] 构建 CSS"
npm run build:css

echo "[6/6] 校验"
npm run validate
node scripts/check-css-coverage.mjs

echo "部署初始化完成 — 生产启动：pm2 start（或 systemd），务必先完成 docs/enable-https.md"
