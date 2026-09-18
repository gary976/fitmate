// FitMate AI 代理 - Cloudflare Worker
// 作用：让手机浏览器能跨域调用火山方舟 API，并可把 API Key 安全地存在服务端
// 部署方法见 docs/deploy.md（第 2 部分）

const UPSTREAM = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    const url = new URL(request.url);
    if (request.method !== 'POST' || !url.pathname.endsWith('/chat/completions')) {
      return jsonResponse({ error: { message: '只支持 POST .../v3/chat/completions' } }, 404);
    }

    const headers = { 'Content-Type': 'application/json' };
    // 优先用客户端带来的 Key（本地调试模式）；否则用 Worker 里配置的 ARK_API_KEY
    const auth = request.headers.get('Authorization');
    if (auth && auth !== 'Bearer ') {
      headers.Authorization = auth;
    } else if (env.ARK_API_KEY) {
      headers.Authorization = 'Bearer ' + env.ARK_API_KEY;
    } else {
      return jsonResponse({ error: { message: 'Worker 未配置 ARK_API_KEY，请在 Cloudflare 控制台的 Settings → Variables 里添加' } }, 500);
    }

    const upstream = await fetch(UPSTREAM, {
      method: 'POST',
      headers,
      body: await request.text(),
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { ...CORS, 'Content-Type': upstream.headers.get('content-type') || 'application/json' },
    });
  },
};

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' },
  });
}
