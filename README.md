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

员工端文章编辑器支持 Markdown 编辑、对照和服务端预览；分类与标签支持搜索选择。重新编辑时读取源文，旧文章保持纯文本模式。未保存离开时有提醒，暂不支持自动保存。更新后需要在 IDEA 重新加载 Maven 并重启文章服务（新增 CommonMark 依赖），否则新正文格式和预览接口不可用。

预览不会保存文章；分类标签服务或预览失败可重试，内容不会被清空。正文上限 100,000 字符，不支持原始 HTML 执行或表格等 Markdown 扩展。组织范围目前仍使用 ID 输入，后续改为目录搜索多选。

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

上述完整 Playwright 流程中，发布搜索与团队审核场景需要真实后端及 Elasticsearch。本轮可独立运行的浏览器回归使用 API 测试桩：

```powershell
cd e2e
$env:E2E_PORTAL_URL='http://127.0.0.1:5173'
$env:E2E_ADMIN_URL='http://127.0.0.1:5174'
npm test -- article-editor.spec.ts auth-boundaries.spec.ts --project=chromium --workers=2
```

运行前需启动两端 Vite 开发服务。2026-09-25 回归：员工端 50 项单元测试、管理端 37 项，两端构建、16 项浏览器测试及 1440px／390px 布局验收通过；这不等同于完整后端联调或部署验收。
