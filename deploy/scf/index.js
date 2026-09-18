// FitMate AI 代理 - 腾讯云函数 SCF Web 函数
// 监听 0.0.0.0:9000，把收到的 POST 转发到火山方舟（支持 SSE 流式透传）
// API Key 优先用客户端带来的 Authorization，否则用环境变量 ARK_API_KEY

const http = require('http');
const https = require('https');

const UPSTREAM_HOST = 'ark.cn-beijing.volces.com';
const UPSTREAM_PATH = '/api/v3/chat/completions';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const server = http.createServer((req, res) => {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method !== 'POST') { res.writeHead(405); res.end('POST only'); return; }

  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    const headers = { 'Content-Type': 'application/json' };
    const auth = req.headers['authorization'];
    if (auth && auth !== 'Bearer ') headers.Authorization = auth;
    else if (process.env.ARK_API_KEY) headers.Authorization = 'Bearer ' + process.env.ARK_API_KEY;
    else {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: { message: '未配置 API Key：请在函数环境变量设置 ARK_API_KEY，或在 App 里填写 Key' } }));
      return;
    }
    const preq = https.request({ host: UPSTREAM_HOST, path: UPSTREAM_PATH, method: 'POST', headers }, pres => {
      res.writeHead(pres.statusCode || 502, {
        'Content-Type': pres.headers['content-type'] || 'application/json',
        'Cache-Control': 'no-cache',
      });
      pres.pipe(res); // 流式透传（支持 SSE）
    });
    preq.on('error', e => {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: { message: '转发到火山方舟失败：' + e.message } }));
    });
    preq.end(Buffer.concat(chunks));
  });
});

server.listen(9000, '0.0.0.0', () => console.log('fitmate-ai proxy listening on 9000'));
