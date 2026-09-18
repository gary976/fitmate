# 部署指南：随时随地访问 FitMate（免费方案）

目标：把 FitMate 发布到互联网，手机用流量/任何 Wi-Fi 都能打开，不再依赖和电脑同一网络。

结构：
- **软件本体** → GitHub Pages（免费静态托管）
- **AI 代理** → Cloudflare Worker（免费额度足够个人使用，API Key 存云端更安全）

全程约 20-30 分钟，只需要注册两个免费账号。

---

## 第 1 部分：发布软件本体到 GitHub Pages

1. 注册/登录 [GitHub](https://github.com)。
2. 右上角 **＋ → New repository**，名字填 `fitmate`，选 **Public**（免费账号才能开 Pages），点 Create repository。
3. 上传文件：在仓库页面点 **uploading an existing file**，把 `D:\code\fitmate` 里的**所有文件和文件夹**拖进去（不要上传 docs 和 tools，可选；其余 index.html、css、js、data、icons、manifest.webmanifest、sw.js 都要），点 **Commit changes**。
   - 提示：文件多时网页上传可能慢，也可以装 [GitHub Desktop](https://desktop.github.com) 拖拽整个文件夹。
4. 开启 Pages：仓库 **Settings → Pages**，Source 选 **Deploy from a branch**，Branch 选 **main**、目录 **/(root)**，Save。
5. 等 1-2 分钟，访问 `https://<你的用户名>.github.io/fitmate/` 能打开就成功了。
6. 手机浏览器打开这个地址，菜单里选 **添加到主屏幕**（Android Chrome 建议先在地址栏最左侧点 ℹ️ → 允许安装），即可像 App 一样全屏使用。

## 第 2 部分：创建 Cloudflare Worker（AI 代理）

1. 注册/登录 [Cloudflare](https://dash.cloudflare.com)，左侧菜单选 **Workers & Pages → Create**，选 **Create Worker**，名字填 `fitmate-ai`，点 Deploy。
2. 部署后点 **Edit code**，把编辑器里的默认代码**全部删除**，粘贴 `D:\code\fitmate\deploy\cloudflare-worker.js` 的完整内容，点右上 **Deploy**。
3. 配置 API Key（存在云端，手机上不用填）：Worker 页面 **Settings → Variables and Secrets → Add**：
   - Type 选 **Secret**，名字填 `ARK_API_KEY`，值填你的火山方舟 API Key，保存。
4. 记下你的 Worker 地址，形如 `https://fitmate-ai.<你的子域>.workers.dev`。

> API Key 还没创建？去[火山方舟控制台](https://console.volcengine.com/ark)开通 `glm-5-3-flash-260828` 模型，在「API Key 管理」创建即可。

## 第 3 部分：在 App 里填一次设置

打开 App →「我的 → 设置」：

| 设置项 | 填什么 |
|---|---|
| API 地址 | `https://fitmate-ai.<你的子域>.workers.dev/v3` |
| API Key | **留空**（Key 已存云端） |
| 模型名称 | `glm-5-3-flash-260828`（默认不用改） |

保存后回到 AI 页随便问一句，能回复就全通了。

## 之后更新软件

改了代码后，把变化的部分重新上传到 GitHub 仓库（或用 GitHub Desktop 提交），Pages 会自动更新；同时把 `sw.js` 第一行的 `VERSION` 号 +1（如 `fitmate-v2`），手机上的缓存才会刷新。

## 常见问题

- **`<用户名>.github.io/fitmate/` 打开是 404**：等几分钟；检查 Pages 设置里分支是否选对。
- **AI 提示 "Worker 未配置 ARK_API_KEY"**：第 2 部分第 3 步没做或名字拼错（必须完全一致）。
- **AI 401 错误**：方舟 Key 无效或模型没开通。
- **视频看不了**：B站 iframe 需要手机有网，流量即可。
- **国内访问 GitHub 偶尔慢**：属正常，换网络环境或稍等；如长期无法接受可随时让我改成"国内云服务"方案。
