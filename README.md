# 企业技术博客前端

仓库包含两个独立的 Vue 3 + Vite 应用：员工端 `web-portal`、管理端 `web-admin`，以及 Playwright 端到端测试。前端只通过 Gateway 的 `/api/**` 调用后端。

## 本地启动

在两个应用目录分别安装依赖并启动：

```powershell
cd web-portal
Copy-Item .env.example .env.local
npm install
npm run dev
```

```powershell
cd web-admin
Copy-Item .env.example .env.local
npm install
npm run dev
```

员工端地址为 `http://localhost:5173`，管理端地址为 `http://localhost:5174`。

必要的本地认证配置：

```text
VITE_AUTH_MODE=local
VITE_MOCK_OIDC_TOKEN=local-dev-token
```

`VITE_MOCK_OIDC_TOKEN` 必须与本地 Gateway 的 `GATEWAY_DEV_MOCK_TOKEN` 一致。三个演示账号为 `u-admin`、`u-author`、`u-reader`，通过账号卡片一键登录，无密码。

本地会话只在当前应用的 `localStorage` 保存版本号和账号 ID，模拟令牌不会落盘。员工端和管理端会话彼此独立；管理端非管理员登录后只显示无权限页。

## OIDC 预留边界

页面和 API 客户端只依赖统一 `AuthProvider` 契约。未来接入 Keycloak、Azure AD 等企业身份源时，实现 Authorization Code + PKCE、回调恢复、Token 刷新、退出和 `Authorization: Bearer ...` 即可，不需要改动业务页面。

生产构建不会默认开启本地演示模式，必须配置企业 OIDC。当前版本未安装 OIDC SDK，也没有后端密码表、登录接口或服务端 Session。

## 验证

```powershell
cd web-portal
npm test -- --run
npm run build

cd ../web-admin
npm test -- --run
npm run build

cd ../e2e
npm test
```
