// 饮食页：日期切换、营养汇总、餐次记录（拍照 AI 估算 / 手动）
import { store, getDiet, saveDiet, getBody, today } from '../store.js';
import { esc, toast, spinnerHtml, sheet, fmtDate, shiftDate } from '../lib/ui.js';
import { chat, parseJSON, userWithImage } from '../api/ark.js';
import { foodSystem } from '../api/prompts.js';
import { pickImage } from '../lib/vision.js';

const MEALS = [
  { id: 'breakfast', name: '早餐', icon: '🌅' },
  { id: 'lunch', name: '午餐', icon: '☀️' },
  { id: 'dinner', name: '晚餐', icon: '🌙' },
  { id: 'snack', name: '加餐', icon: '🍎' },
];

export async function renderDiet(view, params, date = today()) {
  const body = getBody();
  const rec = getDiet(date);
  const all = MEALS.flatMap(m => rec.meals[m.id] || []);
  const sum = {
    kcal: all.reduce((s, i) => s + (+i.kcal || 0), 0),
    protein: all.reduce((s, i) => s + (+i.proteinG || 0), 0),
    fat: all.reduce((s, i) => s + (+i.fatG || 0), 0),
    carb: all.reduce((s, i) => s + (+i.carbG || 0), 0),
  };
  const goal = body.goalKcal || 2200;

  view.innerHTML = `<div class="page">
    <div class="page-head">
      <button class="back" id="d-prev">‹</button>
      <h1 style="flex:1;text-align:center;font-size:18px">${fmtDate(date)}</h1>
      <button class="back" id="d-next" style="transform:rotate(180deg)">‹</button>
    </div>
    <div class="card ring-row">
      <svg class="ring" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="42" fill="none" stroke="var(--line)" stroke-width="10"/>
        <circle cx="50" cy="50" r="42" fill="none" stroke="var(--primary)" stroke-width="10"
          stroke-linecap="round" stroke-dasharray="${(Math.min(1, sum.kcal / goal) * 264).toFixed(1)} 264" transform="rotate(-90 50 50)"/>
        <text x="50" y="49" text-anchor="middle" fill="var(--text)">${Math.round(sum.kcal)}</text>
        <text x="50" y="64" text-anchor="middle" fill="var(--text-3)" style="font-size:8px">/ ${goal} 千卡</text>
      </svg>
      <div class="nutri-grid">
        <div class="nutri-cell"><div class="v" style="color:var(--accent)">${Math.round(sum.protein)}g</div><div class="k">蛋白质 / 目标 ${body.goalProteinG || 120}g</div></div>
        <div class="nutri-cell"><div class="v">${Math.round(sum.carb)}g</div><div class="k">碳水</div></div>
        <div class="nutri-cell"><div class="v">${Math.round(sum.fat)}g</div><div class="k">脂肪</div></div>
        <div class="nutri-cell"><div class="v">${all.length}</div><div class="k">共 ${all.length} 条记录</div></div>
      </div>
    </div>
    <div id="meal-list"></div>
    <button class="btn" id="d-add" style="margin-top:4px">＋ 记录一餐</button>
  </div>`;

  const mealList = view.querySelector('#meal-list');
  mealList.innerHTML = MEALS.map(m => {
    const items = rec.meals[m.id] || [];
    return `<div class="section-title">${m.icon} ${m.name}</div>
    <div class="card">${items.length ? items.map((it, i) => `
      <div class="list-item">
        <div class="grow"><div class="title">${esc(it.name)}${it.portionG ? `<span class="small"> 约${it.portionG}g</span>` : ''}</div>
        <div class="sub">蛋白质 ${Math.round(+it.proteinG || 0)}g${it.fatG != null ? ` · 脂肪 ${Math.round(+it.fatG || 0)}g` : ''}${it.carbG != null ? ` · 碳水 ${Math.round(+it.carbG || 0)}g` : ''}${it.byAI ? ' · <span class="tag">AI 估算</span>' : ''}</div></div>
        <div style="text-align:right"><div style="font-weight:700">${Math.round(+it.kcal || 0)}<span class="small"> 千卡</span></div>
        <button class="small" data-del="${m.id}:${i}" style="color:var(--danger);background:none;border:none">删除</button></div>
      </div>`).join('') : `<div class="small" style="padding:6px 0">还没有记录</div>`}</div>`;
  }).join('');

  mealList.querySelectorAll('[data-del]').forEach(b => {
    b.onclick = () => {
      const [meal, idx] = b.dataset.del.split(':');
      const r = getDiet(date);
      r.meals[meal].splice(+idx, 1);
      saveDiet(r, date);
      renderDiet(view, params, date);
    };
  });

  view.querySelector('#d-prev').onclick = () => renderDiet(view, params, shiftDate(date, -1));
  view.querySelector('#d-next').onclick = () => renderDiet(view, params, shiftDate(date, 1));
  view.querySelector('#d-add').onclick = () => addSheet(view, date);
}

function addSheet(view, date) {
  const s = sheet(`
    <h2 style="margin-bottom:12px">记录一餐</h2>
    <div class="btn-row">
      <button class="btn" id="add-photo">📷 拍照 AI 估算</button>
      <button class="btn ghost" id="add-manual">✍️ 手动填写</button>
    </div>`);
  s.el.querySelector('#add-photo').onclick = () => { s.close(); photoFlow(view, date); };
  s.el.querySelector('#add-manual').onclick = () => { s.close(); manualSheet(view, date); };
}

/** 拍照 → AI 估算 → 可修正 → 入库 */
async function photoFlow(view, date) {
  let dataUrl;
  try { dataUrl = await pickImage({ camera: true }); }
  catch { return; }
  const s = sheet(`<img class="rec-photo" src="${dataUrl}">${spinnerHtml('AI 正在估算营养…')}`);
  try {
    const raw = await chat(
      [{ role: 'system', content: foodSystem() }, userWithImage('请估算这张食物照片的营养成分。', dataUrl)],
      { temperature: 0.2 }
    );
    const r = parseJSON(raw);
    const items = (r.items || []).map(it => ({
      name: it.name || '食物', portionG: Math.round(+it.portionG || 0),
      kcal: Math.round(+it.kcal || 0), proteinG: Math.round(+it.proteinG || 0),
      fatG: Math.round(+it.fatG || 0), carbG: Math.round(+it.carbG || 0), byAI: true,
    }));
    if (!items.length) throw new Error('没能识别出食物，试试手动填写');
    editSheet(view, date, items, r.assumptions || []);
  } catch (e) {
    s.el.querySelector('.sheet').innerHTML = `
      <img class="rec-photo" src="${dataUrl}">
      <div style="padding:6px 4px 10px;white-space:pre-wrap;font-size:14px">⚠️ ${esc(e.message || '估算失败')}</div>
      <div class="btn-row"><button class="btn ghost" id="f-manual">改用手动填写</button>
      <button class="btn" onclick="this.closest('.sheet-mask').remove()">关闭</button></div>`;
    s.el.querySelector('#f-manual').onclick = () => { s.close(); manualSheet(view, date); };
  }
}

/** AI 结果修正/手动填写 共用弹层 */
function editSheet(view, date, items, assumptions = []) {
  const s = sheet(`
    ${assumptions.length ? `<div class="card" style="background:var(--warn-soft);padding:10px"><div class="small" style="color:var(--warn)">估算假设：${esc(assumptions.join('；'))}（数值可修改）</div></div>` : ''}
    <h2 style="margin-bottom:10px">确认并保存</h2>
    <div class="form-row"><label>加入哪一餐</label>
      <select id="e-meal">${MEALS.map(m => `<option value="${m.id}">${m.name}</option>`).join('')}</select></div>
    <div id="e-rows">${items.map((it, i) => `
      <div class="card" data-i="${i}">
        <div class="form-grid">
          <div class="form-row" style="grid-column:1/3"><label>名称</label><input name="name" value="${esc(it.name)}"></div>
          <div class="form-row"><label>克数</label><input name="portionG" type="number" value="${it.portionG || ''}"></div>
          <div class="form-row"><label>热量(千卡)</label><input name="kcal" type="number" value="${it.kcal || ''}"></div>
          <div class="form-row"><label>蛋白质(g)</label><input name="proteinG" type="number" value="${it.proteinG || ''}"></div>
          <div class="form-row"><label>脂肪(g)</label><input name="fatG" type="number" value="${it.fatG || ''}"></div>
        </div>
      </div>`).join('')}
    </div>
    <button class="btn" id="e-save">保存记录</button>`);
  s.el.querySelector('#e-save').onclick = () => {
    const meal = s.el.querySelector('#e-meal').value;
    const rows = [...s.el.querySelectorAll('#e-rows .card')];
    const rec = getDiet(date);
    rows.forEach(row => {
      const get = n => row.querySelector(`[name="${n}"]`).value;
      const name = get('name').trim();
      if (!name) return;
      rec.meals[meal].push({
        name, portionG: +get('portionG') || 0, kcal: +get('kcal') || 0,
        proteinG: +get('proteinG') || 0, fatG: +get('fatG') || 0, carbG: 0, ts: Date.now(),
      });
    });
    saveDiet(rec, date);
    s.close();
    toast('已记录 ✅');
    renderDiet(view, {}, date);
  };
}

function manualSheet(view, date) {
  const s = sheet(`
    <h2 style="margin-bottom:10px">手动添加</h2>
    <div class="form-row"><label>加入哪一餐</label>
      <select id="m-meal">${MEALS.map(m => `<option value="${m.id}">${m.name}</option>`).join('')}</select></div>
    <div class="form-grid">
      <div class="form-row" style="grid-column:1/3"><label>食物名称</label><input id="m-name" placeholder="如：鸡胸肉"></div>
      <div class="form-row"><label>克数</label><input id="m-portionG" type="number" placeholder="150"></div>
      <div class="form-row"><label>热量(千卡)</label><input id="m-kcal" type="number" placeholder="165"></div>
      <div class="form-row"><label>蛋白质(g)</label><input id="m-proteinG" type="number" placeholder="31"></div>
      <div class="form-row"><label>脂肪(g)</label><input id="m-fatG" type="number" placeholder="4"></div>
    </div>
    <button class="btn" id="m-save">保存</button>`);
  s.el.querySelector('#m-save').onclick = () => {
    const name = s.el.querySelector('#m-name').value.trim();
    if (!name) return toast('请填写食物名称');
    const rec = getDiet(date);
    rec.meals[s.el.querySelector('#m-meal').value].push({
      name, portionG: +s.el.querySelector('#m-portionG').value || 0,
      kcal: +s.el.querySelector('#m-kcal').value || 0,
      proteinG: +s.el.querySelector('#m-proteinG').value || 0,
      fatG: +s.el.querySelector('#m-fatG').value || 0, carbG: 0, ts: Date.now(),
    });
    saveDiet(rec, date);
    s.close();
    toast('已记录 ✅');
    renderDiet(view, {}, date);
  };
}
