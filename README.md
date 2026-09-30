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

员工端文章编辑器支持 Markdown 编辑、对照和服务端预览；分类与标签支持搜索选择。重新编辑时读取源文，旧文章保持纯文本模式。标题、正文和分类标签有效时，停止输入 2 秒后自动保存，保存期间可以继续输入；未保存离开时仍有提醒。更新前后端后需重启文章服务，使 Flyway 执行新增的 V8 修订号迁移，否则编辑器会提示缺少修订号并停止保存。

预览不会保存文章；分类标签服务或预览失败可重试，内容不会被清空。正文上限 100,000 字符，不支持原始 HTML 执行或表格等 Markdown 扩展。

自动保存只更新当前草稿，手动保存或提交发布才记录有变化的历史快照。首次自动保存后会保留在该草稿编辑地址；同一次创建的网络重试复用客户端草稿标识，避免重复文章。离线时显示离线状态，联网后继续保存；服务端保存失败时可继续编辑并重试。

刷新后如有未保存内容，会提示恢复或丢弃，不会自动覆盖服务器正文。恢复副本存于当前标签页的 `sessionStorage`，按账号及文章隔离，最长 24 小时、每账号最多 5 条，退出登录或其他标签页切换账号时清理。关闭标签页后不保证恢复；浏览器禁用存储或空间不足时会显示提示。正文不会写入 `localStorage`，恢复副本也不包含认证令牌。

保存与发布均携带文章修订号。其他标签页或设备已更新文章时，编辑器暂停自动保存并保留本地正文；查看服务器版本后，显式确认采用服务器内容或保留本地内容继续编辑。后者仍需通过最新修订号校验，不能跳过并发保护。

组织范围支持部门／团队名称搜索和多选，团队也可按所属部门搜索。作者仅能选择自己所属的组织，管理员可选全部现存组织；后端仍逐一校验权限及组织存在性，前端选择器不是安全边界。范围切换会清空旧目标，已失效目标必须显式移除。组织目录失败可重试、保留正文并允许保存草稿，但不能提交指定组织发布。范围设置仍只在提交发布时生效，保存草稿不保存发布设置。

更新后需启动 `OrgServiceApplication`（8082，`local` Profile），重启 Config Server、Gateway、Permission Service 和 Article Service。组织及文章服务本地已配置相同的开发令牌 `local-org-token`；如设置 `INTERNAL_ORG_TOKEN`，两端必须一致，非本地环境必须注入独立密钥，不能使用此公开开发值。详细步骤见后端仓库 `docs/local-ide-startup.md` 和 `docs/api/organization-scope.md`。

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
npm test -- article-editor.spec.ts draft-autosave.spec.ts auth-boundaries.spec.ts organization-scope.spec.ts authentication.spec.ts --project=chromium --workers=2
```

运行前需启动两端 Vite 开发服务。2026-09-30 回归：员工端 103 项单元测试、管理端 37 项，两端构建及累计 43 项 Chromium 浏览器用例通过（42 项完整回归后，恢复基线修复新增 1 项，并重跑全部 15 项草稿自动保存与恢复用例）。1440px／390px 布局验收通过；浏览器 API 使用测试桩，不等同于完整后端联调或部署验收。
