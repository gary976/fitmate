# FitMate 健身助手

手机网页版健身 PWA：拍照识别器械、按部位生成训练计划（附 B站教学视频）、AI 健身问答、拍照记录饮食。

## 电脑上启动

```bash
# 仅静态页面（不需要 AI 功能时）
node tools/serve.mjs

# 静态页面 + 火山方舟代理（AI 功能需要）
node tools/serve.mjs --proxy
```

打开 http://localhost:8000 即可预览。

## 手机上使用

1. 手机与电脑连同一个 Wi-Fi。
2. 电脑上运行 `ipconfig` 查看 IPv4 地址（如 192.168.1.5）。
3. 手机浏览器访问 `http://192.168.1.5:8000`（首次 Windows 防火墙弹窗选"允许"）。
4. AI 功能：设置里 API 地址改为 `http://192.168.1.5:8787/v3`（电脑需用 `--proxy` 启动）。
5. Android Chrome：`chrome://flags` 搜索 `unsafely-treat-insecure-origin-as-secure`，填入上面的地址并重启浏览器，即可"添加到主屏幕"像 App 一样安装使用。

## AI 配置（火山方舟）

1. 登录 [火山方舟控制台](https://console.volcengine.com/ark)，开通 `glm-5-3-flash-260828` 模型（GLM-5 系列原生多模态，支持图片识别；也可开通 doubao-seed-2-1-turbo 并在 App 设置里改模型名）。
2. 在「API Key 管理」创建 API Key。
3. App「我的 → 设置」里粘贴 API Key。

## 数据与备份

- 所有数据（训练记录、饮食、聊天、设置）只存在本机浏览器 localStorage。
- 「我的 → 数据备份」可导出/导入 JSON 备份文件。
- 换手机或清浏览器缓存前，务必先导出。

## 教学视频

使用 B站官方 iframe 播放器内嵌播放（合规）。`data/equipment.json` 中每个动作的 `video.bvid` 指向已核对的教学视频；为空的条目会显示"去B站搜索"链接。想换视频：在 B站找到目标视频，复制地址栏里的 `BV` 开头视频号填入对应 `bvid` 字段即可。

## 项目结构

- `data/equipment.json` — 器械库（名称/肌群/动作要点/注意事项/视频），想扩充器械改这个文件
- `js/api/` — 火山方舟客户端与 prompt 设计
- `js/pages/` — 各页面
- `sw.js` — 离线缓存（更新后请把 `VERSION` 号 +1）
