// FitMate AI 代理 - 腾讯云函数 SCF Web 函数
// 把 FitMate 的 OpenAI 格式请求翻译成方舟 Coding Plan（Anthropic 格式）请求，
// 这样可以复用用户已有的 Claude Code 套餐，无需单独开通按量付费。
// 监听 0.0.0.0:9000；Key 取环境变量 ARK_API_KEY。

const http = require('http');
const https = require('https');

const HOST = process.env.UPSTREAM_HOST || 'ark.cn-beijing.volces.com';
const PATH = process.env.UPSTREAM_PATH || '/api/plan/v1/messages';
const MODEL = process.env.PLAN_MODEL || 'ark-code-latest';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

// OpenAI 内容 → Anthropic 内容（处理图片 dataURL）
function toAnthropicContent(c) {
  if (typeof c === 'string') return c;
  const out = [];
  for (const p of c) {
    if (p.type === 'text') out.push({ type: 'text', text: p.text });
    else if (p.type === 'image_url') {
      const m = /^data:([^;]+);base64,(.*)$/s.exec(p.image_url.url);
      if (m) out.push({ type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } });
    }
  }
  return out;
}

function toAnthropicBody(openai) {
  const sys = [];
  const msgs = [];
  for (const m of openai.messages || []) {
    if (m.role === 'system') sys.push(typeof m.content === 'string' ? m.content : JSON.stringify(m.content));
    else msgs.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: toAnthropicContent(m.content) });
  }
  const body = { model: MODEL, max_tokens: openai.max_tokens || 4096, messages: msgs };
  if (sys.length) body.system = sys.join('\n\n');
  if (typeof openai.temperature === 'number') body.temperature = openai.temperature;
  if (openai.stream) body.stream = true;
  return body;
}

function toOpenAIResp(ant) {
  const text = (ant.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  return {
    id: ant.id || 'chatcmpl-proxy',
    object: 'chat.completion',
    model: ant.model || MODEL,
    choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: ant.stop_reason === 'max_tokens' ? 'length' : 'stop' }],
    usage: { prompt_tokens: ant.usage?.input_tokens || 0, completion_tokens: ant.usage?.output_tokens || 0, total_tokens: (ant.usage?.input_tokens || 0) + (ant.usage?.output_tokens || 0) },
  };
}

// Anthropic SSE → OpenAI SSE
function sseTransform(clientRes, upstreamRes) {
  const enc = { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache' };
  clientRes.writeHead(upstreamRes.statusCode || 200, enc);
  let buf = '';
  upstreamRes.setEncoding('utf8');
  upstreamRes.on('data', chunk => {
    buf += chunk;
    let idx;
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const raw = buf.slice(0, idx); buf = buf.slice(idx + 2);
      const dataLine = raw.split('\n').find(l => l.startsWith('data:'));
      if (!dataLine) continue;
      const payload = dataLine.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      let ev; try { ev = JSON.parse(payload); } catch { continue; }
      if (ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta') {
        clientRes.write(`data: ${JSON.stringify({ id: 'chatcmpl-proxy', object: 'chat.completion.chunk', choices: [{ index: 0, delta: { content: ev.delta.text } }] })}\n\n`);
      } else if (ev.type === 'message_delta' && ev.delta && ev.delta.stop_reason) {
        clientRes.write(`data: ${JSON.stringify({ id: 'chatcmpl-proxy', object: 'chat.completion.chunk', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })}\n\n`);
      } else if (ev.type === 'error') {
        clientRes.write(`data: ${JSON.stringify({ error: { message: ev.error?.message || 'upstream error' } })}\n\n`);
      }
    }
  });
  upstreamRes.on('end', () => { clientRes.write('data: [DONE]\n\n'); clientRes.end(); });
  upstreamRes.on('error', () => clientRes.end());
}

const server = http.createServer((req, res) => {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method !== 'POST') { res.writeHead(405); res.end('POST only'); return; }

  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    const key = process.env.ARK_API_KEY;
    if (!key) { json(res, 500, { error: { message: '函数未配置 ARK_API_KEY 环境变量' } }); return; }

    let openai; try { openai = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { json(res, 400, { error: { message: '请求不是合法 JSON' } }); return; }
    const body = JSON.stringify(toAnthropicBody(openai));

    const preq = https.request({
      host: HOST, path: PATH, method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key, 'anthropic-version': '2023-06-01' },
    }, pres => {
      const ct = pres.headers['content-type'] || '';
      if ((pres.statusCode || 500) >= 400 || ct.includes('application/json')) {
        // 错误或非流式响应
        const parts = [];
        pres.on('data', c => parts.push(c));
        pres.on('end', () => {
          const txt = Buffer.concat(parts).toString('utf8');
          if ((pres.statusCode || 500) >= 400) { json(res, pres.statusCode, { error: { message: txt.slice(0, 500) } }); return; }
          try { json(res, 200, toOpenAIResp(JSON.parse(txt))); }
          catch { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(txt); }
        });
      } else {
        sseTransform(res, pres);
      }
    });
    preq.on('error', e => json(res, 502, { error: { message: '转发失败：' + e.message } }));
    preq.end(body);
  });
});

server.listen(9000, '0.0.0.0', () => console.log('fitmate-ai plan-proxy listening on 9000'));
