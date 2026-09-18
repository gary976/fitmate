#!/usr/bin/env node
// FitMate 本地开发工具：静态服务器 + 可选的火山方舟 CORS 代理
// 用法：
//   node tools/serve.mjs            # 仅静态服务，端口 8000
//   node tools/serve.mjs --proxy    # 同时在 8787 端口开启方舟代理（解决浏览器直连跨域）
import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATIC_PORT = 8000;
const PROXY_PORT = 8787;
const PROXY_UPSTREAM = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
};

const wantProxy = process.argv.includes('--proxy');

const staticServer = http.createServer(async (req, res) => {
  try {
    let urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (urlPath === '/') urlPath = '/index.html';
    // 局域网访问时提示：SW 需要 https 或 localhost
    const file = path.normalize(path.join(ROOT, urlPath));
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    const data = await fs.readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  }
});

const proxyServer = http.createServer((req, res) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
  if (req.method !== 'POST') { res.writeHead(405, cors); res.end(); return; }
  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    const headers = { 'Content-Type': 'application/json' };
    if (req.headers.authorization) headers.Authorization = req.headers.authorization;
    const upstream = http; // 使用 https 模块
    import('node:https').then(https => {
      const preq = https.request(PROXY_UPSTREAM, { method: 'POST', headers }, pres => {
        res.writeHead(pres.statusCode || 502, { ...cors, 'Content-Type': pres.headers['content-type'] || 'application/json' });
        pres.pipe(res); // 流式透传（支持 SSE）
      });
      preq.on('error', e => { res.writeHead(502, cors); res.end(JSON.stringify({ error: { message: '代理请求方舟失败: ' + e.message } })); });
      preq.end(Buffer.concat(chunks));
    });
  });
});

staticServer.listen(STATIC_PORT, '0.0.0.0', () => {
  console.log(`✔ 静态服务: http://localhost:${STATIC_PORT}  (手机请用电脑局域网 IP 访问)`);
  if (wantProxy) {
    proxyServer.listen(PROXY_PORT, '0.0.0.0', () => {
      console.log(`✔ 方舟代理: http://<电脑IP>:${PROXY_PORT}/chat/completions`);
      console.log('  在 App 设置里把 API 地址改为: http://<电脑IP>:8787/v3');
    });
  } else {
    console.log('提示: 需要 AI 功能时请用 node tools/serve.mjs --proxy 同时开启代理');
  }
});
