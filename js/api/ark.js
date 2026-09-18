// 火山方舟 (Volcano Ark) OpenAI 兼容客户端：普通对话 / SSE 流式 / 视觉消息 / JSON 解析
import { getSettings } from '../store.js';

export class AppError extends Error {
  constructor(type, msg) { super(msg); this.type = type; }
}

function endpoint(baseUrl) { return baseUrl.replace(/\/+$/, '') + '/chat/completions'; }

function buildBody(model, messages, stream, temperature) {
  const body = { model, messages, temperature };
  if (stream) body.stream = true;
  return body;
}

/**
 * 调用方舟对话接口
 * @param {Array} messages OpenAI 格式消息；图片用 content 数组 {type:'image_url', image_url:{url:'data:...'}}
 * @param {object} opts { stream, onDelta(deltaText, fullText), temperature }
 * @returns {Promise<string>} 完整回复文本
 */
export async function chat(messages, { stream = false, onDelta = null, temperature = 0.7 } = {}) {
  const s = getSettings();
  // 直连方舟必须有 Key；走自建代理（地址不含 volces.com）时 Key 可存在服务端
  const usingProxy = !/volces\.com/i.test(s.baseUrl);
  if (!s.apiKey && !usingProxy) throw new AppError('NOKEY', '还没有设置 API Key，请到「我的 → 设置」里填写火山方舟的 API Key（或把 API 地址改为你的云端代理）。');
  const headers = { 'Content-Type': 'application/json' };
  if (s.apiKey) headers.Authorization = 'Bearer ' + s.apiKey;
  let res;
  try {
    res = await fetch(endpoint(s.baseUrl), {
      method: 'POST',
      headers,
      body: JSON.stringify(buildBody(s.model, messages, stream, temperature)),
    });
  } catch (e) {
    throw new AppError('NETWORK',
      '网络请求失败（常见原因：浏览器跨域 CORS 限制）。\n解决办法：用本地代理 `node tools/serve.mjs --proxy` 或云端代理（见 docs/deploy.md），然后在「我的 → 设置」修改 API 地址。');
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let msg = `API 返回错误 ${res.status}`;
    try { const j = JSON.parse(text); msg = j.error?.message || msg; } catch {}
    if (res.status === 401) msg += '（请检查 API Key 是否正确）';
    throw new AppError('API', msg);
  }
  if (!stream) {
    const j = await res.json();
    return j.choices?.[0]?.message?.content ?? '';
  }
  // SSE 流式
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '', full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') continue;
      try {
        const j = JSON.parse(data);
        const d = j.choices?.[0]?.delta?.content || '';
        if (d) { full += d; onDelta && onDelta(d, full); }
      } catch {}
    }
  }
  return full;
}

/** 从 AI 回复中稳健地解析 JSON（容忍 markdown 围栏与前后杂文） */
export function parseJSON(text) {
  let t = String(text).trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(t); } catch {}
  const m = t.match(/[{[][\s\S]*[}\]]/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  throw new AppError('PARSE', 'AI 返回的内容无法解析，请重试。原始内容：\n' + t.slice(0, 300));
}

/** 带图片的消息构造 */
export function userWithImage(text, dataUrl) {
  return {
    role: 'user',
    content: [
      { type: 'text', text },
      { type: 'image_url', image_url: { url: dataUrl } },
    ],
  };
}
