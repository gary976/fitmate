// 设置页：API Key、模型、API 地址、主题
import { go } from '../router.js';
import { getSettings, saveSettings } from '../store.js';
import { esc, toast } from '../lib/ui.js';

export async function renderSettings(view) {
  const s = getSettings();
  view.innerHTML = `<div class="page">
    <div class="page-head"><button class="back" onclick="history.back()">‹</button><h1>设置</h1></div>
    <div class="card">
      <h2>AI（火山方舟）</h2>
      <div class="form-row"><label>API Key</label><input id="s-key" type="password" value="${esc(s.apiKey)}" placeholder="在方舟控制台「API Key 管理」创建"></div>
      <div class="form-row"><label>模型名称</label><input id="s-model" value="${esc(s.model)}" placeholder="glm-5-3-flash-260828"></div>
      <div class="small" style="margin:-6px 0 10px">GLM-5.3-Flash 支持图片识别。若无法开通，可改为 doubao-seed-2-1-turbo。</div>
      <div class="form-row"><label>API 地址</label><input id="s-url" value="${esc(s.baseUrl)}"></div>
      <div class="small">
        ① 局域网：电脑运行 <b>node tools/serve.mjs --proxy</b>，地址改 http://电脑IP:8787/v3<br>
        ② 随时随地：用云端代理（部署见 docs/deploy.md），地址改 https://你的名字.workers.dev/v3，此时 API Key 可留空（已存在云端更安全）
      </div>
    </div>
    <div class="card">
      <h2>外观</h2>
      <div class="chips" id="s-theme">
        ${['auto', 'light', 'dark'].map(t => `<button class="chip ${s.theme === t ? 'on' : ''}" data-t="${t}">${{ auto: '跟随系统', light: '浅色', dark: '深色' }[t]}</button>`).join('')}
      </div>
    </div>
    <div class="card">
      <h2>AI 个性化</h2>
      <div class="list-item"><div class="grow"><div class="title">问答时结合我的训练与饮食数据</div><div class="sub">让 AI 回答更贴合你的情况</div></div>
        <button class="mv-done ${s.usePersonalContext ? 'on' : ''}" id="s-ctx">${s.usePersonalContext ? '✓ 开' : '关'}</button></div>
    </div>
    <button class="btn" id="s-save">保存设置</button>
    <div style="height:8px"></div>
  </div>`;

  view.querySelector('#s-theme').addEventListener('click', e => {
    const c = e.target.closest('.chip');
    if (!c) return;
    view.querySelectorAll('#s-theme .chip').forEach(x => x.classList.remove('on'));
    c.classList.add('on');
    const settings = getSettings();
    settings.theme = c.dataset.t;
    saveSettings(settings);
    document.documentElement.dataset.theme = c.dataset.t === 'dark' ? 'dark' : c.dataset.t === 'light' ? 'light' : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  });
  view.querySelector('#s-ctx').onclick = e => {
    const settings = getSettings();
    settings.usePersonalContext = !settings.usePersonalContext;
    saveSettings(settings);
    e.target.classList.toggle('on', settings.usePersonalContext);
    e.target.textContent = settings.usePersonalContext ? '✓ 开' : '关';
  };
  view.querySelector('#s-save').onclick = () => {
    const settings = getSettings();
    settings.apiKey = view.querySelector('#s-key').value.trim();
    settings.model = view.querySelector('#s-model').value.trim() || settings.model;
    settings.baseUrl = view.querySelector('#s-url').value.trim() || settings.baseUrl;
    saveSettings(settings);
    toast('设置已保存 ✅');
    go('/profile');
  };
}
