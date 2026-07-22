# 企业技术博客前端

该仓库包含两个独立的 Vue 3 + Vite 应用：员工端 `web-portal` 与管理端 `web-admin`，以及 Playwright 端到端测试。

后端服务位于相邻的 `enterprise-blog-backend` 仓库。前端只通过 Gateway 的 `/api/**` 调用后端，不依赖后端源码。

## 本地启动

先启动后端 Gateway（默认 `http://localhost:8080`），然后在两个终端分别执行：

```powershell
cd web-portal
pnpm install --frozen-lockfile
pnpm dev
```

```powershell
cd web-admin
pnpm install --frozen-lockfile
$env:VITE_BASE_PATH = "/admin/"
pnpm dev
```

员工端地址为 `http://localhost:5173`，管理端地址为 `http://localhost:5174/admin/`。

## 验证

```powershell
cd web-portal; pnpm build; pnpm exec vitest run --pool=forks
cd ../web-admin; pnpm build; pnpm exec vitest run --pool=forks
cd ../e2e; pnpm test
```
