// 器械库：列表/搜索、器械详情、拍照识别流程
import { go } from '../router.js';
import { esc, toast, spinnerHtml, sheet } from '../lib/ui.js';
import { loadEquipment, GROUP_META } from '../lib/data.js';
import { chat, parseJSON, userWithImage } from '../api/ark.js';
import { recognizeSystem } from '../api/prompts.js';
import { pickImage } from '../lib/vision.js';
import { videoCardHtml, bindVideoCards } from '../lib/bilibili.js';

let libFilter = { group: 'all', q: '' };

export async function renderLibrary(view) {
  const eq = await loadEquipment();
  view.innerHTML = `<div class="page">
    <div class="page-head">
      <h1 style="flex:1">器械库</h1>
      <button class="btn small" id="lib-recognize">📷 拍照识别</button>
    </div>
    <input id="lib-search" placeholder="搜索器械名称…" value="${esc(libFilter.q)}" style="margin-bottom:10px">
    <div class="chips" id="lib-groups" style="margin-bottom:12px">
      <button class="chip ${libFilter.group === 'all' ? 'on' : ''}" data-g="all">全部</button>
      ${Object.entries(GROUP_META).map(([g, m]) =>
        `<button class="chip ${libFilter.group === g ? 'on' : ''}" data-g="${g}">${m.name}</button>`).join('')}
    </div>
    <div id="lib-list"></div>
  </div>`;

  const listEl = view.querySelector('#lib-list');
  function drawList() {
    const q = libFilter.q.trim().toLowerCase();
    const items = eq.equipment.filter(e => {
      const inGroup = libFilter.group === 'all' || (e.muscleGroups || []).includes(libFilter.group);
      const inQ = !q || e.name.toLowerCase().includes(q) || (e.aliases || []).some(a => a.toLowerCase().includes(q));
      return inGroup && inQ;
    });
    listEl.innerHTML = items.length ? `<div class="card">${items.map(e => `
      <div class="list-item" data-id="${e.id}" style="cursor:pointer">
        <div class="mg-badge">${(e.muscleGroups || []).map(g => GROUP_META[g]?.icon || '').join('') || '🏋️'}</div>
        <div class="grow"><div class="title">${esc(e.name)}</div>
        <div class="sub">${(e.muscleGroups || []).map(g => GROUP_META[g]?.name || g).join('、')} · ${(e.movements || []).length} 个动作</div></div>
        <span class="muted">›</span>
      </div>`).join('')}</div>`
      : `<div class="empty"><div class="big">🔍</div>没有找到匹配的器械</div>`;
    listEl.querySelectorAll('.list-item').forEach(item => {
      item.onclick = () => go('/library/' + item.dataset.id);
    });
  }
  drawList();
  view.querySelector('#lib-search').oninput = e => { libFilter.q = e.target.value; drawList(); };
  view.querySelectorAll('#lib-groups .chip').forEach(c => {
    c.onclick = () => {
      view.querySelectorAll('#lib-groups .chip').forEach(x => x.classList.remove('on'));
      c.classList.add('on');
      libFilter.group = c.dataset.g;
      drawList();
    };
  });
  view.querySelector('#lib-recognize').onclick = () => recognizeFlow();
}

export async function renderEquipmentDetail(view, params) {
  const eq = await loadEquipment();
  const e = eq.equipment.find(x => x.id === params.id);
  if (!e) { view.innerHTML = '<div class="empty">未找到该器械</div>'; return; }
  view.innerHTML = `<div class="page">
    <div class="page-head"><button class="back" onclick="history.back()">‹</button><h1>${esc(e.name)}</h1></div>
    <div class="card">
      <div>${(e.muscleGroups || []).map(g => `<span class="tag p">${GROUP_META[g]?.name || g}（主）</span>`).join('')}
      ${(e.secondaryGroups || []).map(g => `<span class="tag">${GROUP_META[g]?.name || g}（辅）</span>`).join('')}</div>
      ${(e.notes || []).length ? `<ul class="kp" style="margin-top:10px">${e.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
    </div>
    ${e.movements.map(m => `
      <div class="mv-card">
        <div style="font-weight:700;font-size:16px">${esc(m.name)}</div>
        <div class="mv-meta"><span class="tag">${esc(m.sets || '3')} 组</span><span class="tag">${esc(m.reps || '8-12')} 次/组</span><span class="tag">休息 ${m.restSec || 90}s</span></div>
        ${(m.keyPoints || []).length ? `<div class="section-title" style="margin:10px 0 2px">标准动作要点</div><ul class="kp">${m.keyPoints.map(k => `<li>${esc(k)}</li>`).join('')}</ul>` : ''}
        ${(m.cautions || []).length ? `<div class="section-title" style="margin:10px 0 2px;color:var(--warn)">⚠️ 注意事项</div><ul class="kp" style="color:var(--warn)">${m.cautions.map(k => `<li>${esc(k)}</li>`).join('')}</ul>` : ''}
        ${videoCardHtml(m.video, `${e.name} ${m.name} 教学`)}
      </div>`).join('')}
  </div>`;
  bindVideoCards(view);
}

/** 拍照识别流程：选图 → AI 识别 → 结果弹层 */
export async function recognizeFlow() {
  let dataUrl;
  try { dataUrl = await pickImage({ camera: true }); }
  catch { return; }
  const eq = await loadEquipment();
  const s = sheet(`<img class="rec-photo" src="${dataUrl}">${spinnerHtml('AI 正在识别器械…')}`);
  try {
    const raw = await chat(
      [{ role: 'system', content: recognizeSystem(eq) }, userWithImage('请识别这张照片里的健身器械。', dataUrl)],
      { temperature: 0.2 }
    );
    const r = parseJSON(raw);
    const eqItem = r.equipmentId ? eq.equipment.find(x => x.id === r.equipmentId) : null;
    const conf = Math.round((+r.confidence || 0) * 100);
    const similar = (r.similarIds || []).map(id => eq.equipment.find(x => x.id === id)).filter(Boolean);
    s.el.querySelector('.sheet').innerHTML = `
      <img class="rec-photo" src="${dataUrl}">
      ${eqItem ? `
        <div style="text-align:center;margin:4px 0 10px"><div style="font-size:13px;color:var(--text-3)">识别结果（${conf}% 把握）</div>
        <div style="font-size:22px;font-weight:800;margin-top:2px">${esc(eqItem.name)}</div></div>
        <div class="conf-bar"><i style="width:${conf}%"></i></div>
        <div class="muted" style="margin:10px 0">${esc(r.reason || '')}</div>
        <div class="btn-row">
          ${conf < 60 ? `<button class="btn ghost" id="rec-similar">不是这个，换一个</button>` : ''}
          <button class="btn" id="rec-go">查看练法与视频 ›</button>
        </div>`
      : `<div class="empty"><div class="big">🤔</div>没能认出这个器械<br><span class="small">${esc(r.reason || '试试拍得近一点、正对器械')}</span>
        ${similar.length ? `<div class="chips" style="margin-top:12px;justify-content:center">${similar.map(x => `<button class="chip" data-id="${x.id}">${esc(x.name)}</button>`).join('')}</div>` : ''}</div>`}
    `;
    const goBtn = s.el.querySelector('#rec-go');
    if (goBtn) goBtn.onclick = () => { s.close(); go('/library/' + eqItem.id); };
    const simBtn = s.el.querySelector('#rec-similar');
    if (simBtn) simBtn.onclick = () => { s.close(); go('/library'); };
    s.el.querySelectorAll('.chip[data-id]').forEach(c => {
      c.onclick = () => { s.close(); go('/library/' + c.dataset.id); };
    });
  } catch (e) {
    s.el.querySelector('.sheet').innerHTML = `
      <img class="rec-photo" src="${dataUrl}">
      <div style="padding:6px 4px 10px;white-space:pre-wrap;font-size:14px">⚠️ ${esc(e.message || '识别失败')}</div>
      <button class="btn ghost" onclick="this.closest('.sheet-mask').remove()">关闭</button>`;
  }
}
