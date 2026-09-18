# 部署指南：随时随地访问 FitMate

> 现状：**软件本体已发布在 GitHub Pages**（`https://gary976.github.io/fitmate/`，实测国内可访问）。
> 剩下的事：**AI 接口中转**部署到腾讯云函数 SCF（火山方舟不支持浏览器直连，且 workers.dev / edgeone 默认域名在国内均不可用，已排除）。

## 最终方案：GitHub Pages（软件本体）+ 腾讯云函数 SCF（AI 代理）

### 第 1 步：创建 SCF 函数（约 10 分钟）

1. 登录 [腾讯云函数控制台](https://console.cloud.tencent.com/scf)（区域选 **广州** 或就近）。
2. **函数服务 → 新建**，按下面填写：
   - 函数类型：**Web 函数**
   - 函数名称：`fitmate-ai`
   - 运行环境：**Node.js 18.15**
   - 提交方法：**本地上传 ZIP 包** → 选择 `D:\code\fitmate\deploy\fitmate-ai-scf.zip`
3. 展开 **高级配置**：
   - 环境变量：添加 `ARK_API_KEY` = 你的火山方舟 API Key（这样手机 App 里 Key 可以留空，更安全）
   - 执行超时时间：改为 **60 秒**（AI 流式回复需要）
4. 点 **完成** 创建。

### 第 2 步：开启函数 URL 公网访问

1. 进入函数详情 → **函数 URL**（或「触发方式」里的函数 URL）→ 点 **编辑**，开启**公网访问**，认证方式选**无需认证**。
2. 得到函数 URL，形如 `https://1xxxxxxx-xxxxxxxx.gz.tencentscf.com`（默认域名**免备案、长期有效**）。
3. 验证：浏览器直接打开该地址应显示 `POST only`；用手机访问也应显示同样内容 → 说明国内可达。

### 第 3 步：在 App 里填设置

打开 App →「我的 → 设置」：

| 设置项 | 填什么 |
|---|---|
| API 地址 | 函数 URL（`https://xxxx.tencentscf.com`） |
| API Key | **留空**（Key 已存在函数环境变量里） |
| 模型名称 | `glm-5-3-flash-260828`（默认，不用改） |

保存后到 AI 页问一句，能流式回复就全部打通了。

## 更新软件本体

改动代码后：提交推送到 GitHub（Pages 自动更新），并把 `sw.js` 第一行 `VERSION` +1（如 `fitmate-v2` → `fitmate-v3`），手机缓存才会刷新。

## 更新 AI 代理（很少需要）

改 `deploy/scf/index.js` 后重新运行 `python deploy/scf/make_zip.py` 生成 zip，在函数页面 **函数代码 → 上传 → 本地 ZIP 包** 重新上传即可。

## 常见问题

- **AI 报「未配置 API Key」**：函数环境变量里没配 `ARK_API_KEY` 或名字拼错（必须完全一致），改后在函数页面保存并等 1 分钟生效。
- **AI 报 401**：方舟 Key 无效，或模型 `glm-5-3-flash-260828` 未在[方舟控制台](https://console.volcengine.com/ark)开通。
- **AI 报超时/长时间无响应**：确认函数「执行超时时间」已设为 ≥60 秒；流量高峰偶发慢属正常。
- **视频看不了**：B站 iframe 需要手机有网，流量即可。
- **国内访问 GitHub 偶尔慢**：属正常；App 已做离线缓存（PWA），打开过一次后大部分界面离线也能用，只有 AI 功能需要联网。

## 已排除的方案（留档）

- **Cloudflare Worker**（`deploy/cloudflare-worker.js`，已部署）：workers.dev 域名在国内被 DNS 污染 + SNI 阻断，无法访问。
- **腾讯 EdgeOne Pages**（`functions/api/[[default]].js`，已部署）：默认域名 `edgeone.cool` 因平台合规策略国内返回 401 且不可关闭（含大陆加速需 ICP 备案）。
