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

员工端文章编辑器支持 Markdown 编辑、对照和服务端预览；分类与标签支持搜索选择。重新编辑时读取源文，旧文章保持纯文本模式。标题、正文和分类标签有效时，停止输入 2 秒后自动保存，保存期间可以继续输入；未保存离开时仍有提醒。更新前后端时需先完成 V8 修订号迁移，再重启文章服务。**本机共享数据库的 `local` Profile 关闭 Flyway，仅重启不会迁移**，必须按后端 `docs/api/local-demo.md` 备份并手动执行一次 V8；独立数据库且启用 Flyway 的环境使用自动迁移。缺少修订号时编辑器会停止保存。

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

### 无 Elasticsearch 的真实本机联调

完成后端单库迁移，按后端 `docs/local-ide-startup.md` 启动 Gateway、注册配置中心及业务服务，再启动两个 Vite。标签服务的本地配置使用内存缓存；搜索投递默认暂停并保留队列，因此无需启动 Elasticsearch 或 MinIO。

```powershell
cd e2e
npm run test:live:articles
```

套件默认使用员工端 `http://127.0.0.1:5173`、管理端 `http://127.0.0.1:5174`、Gateway `http://127.0.0.1:8080`；可分别用 `E2E_PORTAL_URL`、`E2E_ADMIN_URL`、`E2E_API_URL` 覆盖。模拟令牌默认 `local-dev-token`，自定义时设置 `E2E_MOCK_TOKEN` 并保持两个 Vite 和 Gateway 一致。浏览器使用已安装的 Chrome。

7 项真实测试覆盖并发幂等创建、修订冲突无副作用、自动保存与发布竞态、历史快照、离线刷新恢复、双窗口冲突选择，以及管理端审核通过和退回。不拦截业务 API 响应；刷新恢复测试仅暂停浏览器计时器并切换离线状态。测试创建带随机 `LIVE-` 前缀的文章，只清理本项创建的待审核单并软删除自己的文章，审计与历史记录按业务规则保留；不要指向生产数据库。配置与默认浏览器回归独立，可单独运行，不要求搜索索引可用。

### Elasticsearch 搜索

员工端 `/search` 支持全文关键词、高亮、分类／标签组合过滤、相关程度／最新发布排序和分页。筛选与页码写入地址栏，刷新和浏览器返回可恢复；高亮内容通过纯文本渲染，不执行 HTML。总数只展示已完成权限核验的准确值，未确定时使用上一页／下一页导航；达到候选扫描上限时提示缩小范围。

管理端 `/search-tasks` 可查看失败／待处理任务，重试发布、撤回、删除和同步任务，也可重新同步全部文章。普通作者和读者不能访问管理接口。搜索读取前由后端再核对文章当前状态、修订和权限，已撤回或无权访问的旧索引不会显示。

后端的 `docs/local-elasticsearch.md` 说明 D 盘本地安装与启停。启动 Elasticsearch，并使用后端脚本 `start-local-services.ps1 -IncludeSearch`；现有文章可从管理端排入全量同步。两个 Vite 与 Gateway 令牌保持一致。

```powershell
cd e2e
npm run test:live:search  # 4 项真实搜索场景，需 ES、完整后端和两端 Vite
npm run test:live        # 同时运行 7 项文章联调和 4 项搜索联调
npm test -- search-ui.spec.ts --project=chromium --workers=1
```

搜索联调使用随机 `SEARCHLIVE-` 前缀并只清理自己的文章，验证高亮筛选、排序分页、撤回删除与旧修订防覆盖、团队权限及全量同步；会对测试文章注入过期索引以核验权限边界。ES 地址默认 `http://127.0.0.1:9200`，搜索服务默认 `http://127.0.0.1:8088`；可用 `E2E_ELASTICSEARCH_URL`、`E2E_SEARCH_SERVICE_URL`、`E2E_SEARCH_TOKEN` 覆盖。`search-ui.spec.ts` 的 4 项浏览器测试使用 API 测试桩，覆盖异常重试、纯文本高亮、请求竞态、翻页保持已提交关键词及失败任务恢复。

在 D 盘安装新依赖前设置 `$env:npm_config_cache='D:\NodeCache\enterprise-blog'`；已有 `node_modules` 可直接复用。

2026-10-22：员工端 104 项、管理端 38 项单元测试及两端生产构建通过；Chromium 46 项完整回归后新增翻页边界用例，4 项搜索 UI 用例全部通过，共覆盖 47 项不同页面用例。11 项真实 PostgreSQL／Elasticsearch 联调通过。搜索桌面与 390px 手机截图已检查，无横向溢出。后端另有实际停机恢复测试，详见其 `docs/search-verification-2026-10-22.md`。
