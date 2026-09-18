// FitMate AI 代理 - EdgeOne Pages Functions
// 路由：POST /api/chat/completions → 转发到火山方舟（与前端同域名，天然无跨域）
// API Key：优先用 EdgeOne 环境变量 ARK_API_KEY；否则透传客户端带来的 Authorization

const UPSTREAM = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function getEnvKey(env) {
  if (!env) return '';
  if (typeof env.ARK_API_KEY === 'string') return env.ARK_API_KEY;
  if (env.ARK_API_KEY && typeof env.ARK_API_KEY.get === 'function') return env.ARK_API_KEY.get('ARK_API_KEY') || '';
  return '';
}

export async function onRequest(context) {
  const request = context.request;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const url = new URL(request.url);
  if (request.method !== 'POST' || !url.pathname.endsWith('/chat/completions')) {
    return json({ error: { message: '只支持 POST /api/chat/completions' } }, 404);
  }

  const headers = { 'Content-Type': 'application/json' };
  const auth = request.headers.get('Authorization');
  if (auth && auth !== 'Bearer ') {
    headers.Authorization = auth;
  } else {
    const key = getEnvKey(context.env);
    if (key) headers.Authorization = 'Bearer ' + key;
    else return json({ error: { message: '未配置 API Key：请在 App 设置里填写，或在 EdgeOne 环境变量里配置 ARK_API_KEY' } }, 500);
  }

  try {
    const upstream = await fetch(UPSTREAM, { method: 'POST', headers, body: await request.text() });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { ...CORS, 'Content-Type': upstream.headers.get('content-type') || 'application/json' },
    });
  } catch (e) {
    return json({ error: { message: '转发到火山方舟失败：' + (e.message || e) } }, 502);
  }
}
