// 训练页：选肌群生成计划（AI / 本地降级）+ 计划执行 + 器械库入口
import { go } from '../router.js';
import { store, getSettings, today, getPlanHistory, addPlanHistory } from '../store.js';
import { esc, toast, spinnerHtml, sheet } from '../lib/ui.js';
import { loadEquipment, GROUP_META } from '../lib/data.js';
import { chat, parseJSON, AppError } from '../api/ark.js';
import { planSystem, planUser } from '../api/prompts.js';
import { localPlan, findMovement } from '../lib/planner.js';
import { videoCardHtml, bindVideoCards } from '../lib/bilibili.js';

export async function renderTrain(view) {
  const eq = await loadEquipment();
  view.innerHTML = `<div class="page">
    <h1 style="margin-bottom:12px">训练</h1>
    <div class="card">
      <h2>今天练哪里？</h2>
      <div class="chips" id="group-chips" style="margin:10px 0 12px">
        ${Object.entries(GROUP_META).filter(([g]) => g !== 'cardio').map(([g, m]) =>
          `<button class="chip" data-g="${g}">${m.icon} ${m.name}</button>`).join('')}
      </div>
      <div class="form-row">
        <label>预计时长</label>
        <select id="duration">
          <option value="40">约 40 分钟（紧凑）</option>
          <option value="60" selected>约 60 分钟（标准）</option>
          <option value="90">约 90 分钟（充分）</option>
        </select>
      </div>
      <div class="btn-row">
        <button class="btn ghost" id="btn-local">用本地模板生成</button>
        <button class="btn" id="btn-ai">✨ AI 生成计划</button>
      </div>
    </div>
    <div id="plan-area"></div>
  </div>`;

  const selected = new Set();
  view.querySelectorAll('#group-chips .chip').forEach(c => {
    c.onclick = () => { c.classList.toggle('on'); c.classList.contains('on') ? selected.add(c.dataset.g) : selected.delete(c.dataset.g); };
  });

  const planArea = view.querySelector('#plan-area');
  const cur = store.get('currentPlan');
  if (cur) renderPlan(planArea, cur, eq);
  renderHistory(planArea);

  view.querySelector('#btn-local').onclick = () => {
    if (!selected.size) return toast('请先选择至少一个部位');
    const plan = localPlan([...selected], eq, +view.querySelector('#duration').value);
    setCurrentPlan(plan, [...selected], 'local');
    planArea.innerHTML = '';
    renderPlan(planArea, store.get('currentPlan'), eq);
    renderHistory(planArea);
  };

  view.querySelector('#btn-ai').onclick = async () => {
    if (!selected.size) return toast('请先选择至少一个部位');
    const groups = [...selected];
    const dur = +view.querySelector('#duration').value;
    const s = getSettings();
    if (!s.apiKey) {
      toast('未设置 API Key，已使用本地模板', 3000);
      view.querySelector('#btn-local').click();
      return;
    }
    // loading sheet
    const s1 = sheet(`<div>${spinnerHtml('AI 教练正在编排计划…')}</div>`);
    try {
      const subset = eq.equipment.filter(e => (e.muscleGroups || []).some(g => selected.has(g)) || (e.secondaryGroups || []).some(g => selected.has(g)));
      const raw = await chat(
        [{ role: 'system', content: planSystem(subset) }, { role: 'user', content: planUser(groups.map(g => GROUP_META[g].name), dur) }],
        { temperature: 0.4 }
      );
      const plan = parseJSON(raw);
      if (!plan.blocks || !plan.blocks.length) throw new AppError('PARSE', '计划内容为空');
      // 校验 movementId，剔除库中不存在的
      plan.blocks = plan.blocks.filter(b => findMovement(eq, b.movementId));
      if (!plan.blocks.length) throw new AppError('PARSE', 'AI 引用的动作不在库中，请重试');
      plan.source = 'ai';
      s1.close();
      setCurrentPlan(plan, groups, 'ai');
      planArea.innerHTML = '';
      renderPlan(planArea, store.get('currentPlan'), eq);
      renderHistory(planArea);
      toast('计划已生成 ✅');
    } catch (e) {
      s1.close();
      const s2 = sheet(`<div style="padding:6px 4px 10px;white-space:pre-wrap;font-size:14px">⚠️ ${esc(e.message || '生成失败')}</div>
        <div class="btn-row"><button class="btn ghost" id="dg-local">改用本地模板</button><button class="btn" id="dg-retry">重试</button></div>`);
      s2.el.querySelector('#dg-local').onclick = () => { s2.close(); view.querySelector('#btn-local').click(); };
      s2.el.querySelector('#dg-retry').onclick = () => { s2.close(); view.querySelector('#btn-ai').click(); };
    }
  };
}

function setCurrentPlan(plan, groups, source) {
  const blocks = plan.blocks.map(b => ({ ...b, done: false }));
  store.set('currentPlan', {
    date: today(), groups, source,
    plan: { planTitle: plan.planTitle, estimatedMin: plan.estimatedMin, blocks },
  });
}

function renderPlan(area, cur, eq) {
  if (cur.date !== today()) {
    area.innerHTML = `<div class="card"><div class="muted">当前计划是 ${esc(cur.date)} 的，选择部位生成今天的计划吧。</div>
      <button class="btn ghost small" id="keep-old" style="margin-top:10px">继续用这份计划</button></div>`;
    area.querySelector('#keep-old').onclick = () => { store.set('currentPlan', { ...cur, date: today() }); renderPlan(area, { ...cur, date: today() }, eq); };
    return;
  }
  const p = cur.plan;
  const doneCount = p.blocks.filter(b => b.done).length;
  area.innerHTML = `
    <div class="card" style="background:var(--primary-soft)">
      <div class="tag p">${cur.source === 'ai' ? 'AI 教练编排' : '本地模板'}</div>
      <h2 style="margin:8px 0 2px">${esc(p.planTitle)}</h2>
      <div class="small">进度 ${doneCount}/${p.blocks.length} · 约 ${p.estimatedMin || 60} 分钟</div>
      ${p.blocks.length && doneCount === p.blocks.length ? '' : ''}
    </div>
    ${p.blocks.map((b, i) => {
      const found = findMovement(eq, b.movementId);
      if (!found) return '';
      const { equipment, movement } = found;
      return `<div class="mv-card">
        <div class="mv-head">
          <div class="mv-order">${i + 1}</div>
          <div class="grow">
            <div style="font-weight:700">${esc(movement.name)} <span class="small">${esc(equipment.name)}</span></div>
            <div class="mv-meta">
              <span class="tag">${esc(b.sets)} 组</span><span class="tag">${esc(b.reps)} 次/组</span><span class="tag">休息 ${b.restSec || 90}s</span>
            </div>
            ${b.tip ? `<div class="small" style="margin-top:4px">💡 ${esc(b.tip)}</div>` : ''}
          </div>
          <button class="mv-done ${b.done ? 'on' : ''}" data-i="${i}">${b.done ? '✓ 已练' : '完成'}</button>
        </div>
        ${(movement.keyPoints || []).length ? `<ul class="kp">${movement.keyPoints.map(k => `<li>${esc(k)}</li>`).join('')}</ul>` : ''}
        ${(movement.cautions || []).length ? `<ul class="kp" style="color:var(--warn)">⚠️ ${movement.cautions.map(k => `<li>${esc(k)}</li>`).join('')}</ul>` : ''}
        ${videoCardHtml(movement.video, `${equipment.name} 标准动作 教学`)}
      </div>`;
    }).join('')}
    <button class="btn" id="finish-btn" style="margin-top:6px">完成训练，存入记录</button>
    <div style="height:4px"></div>`;
  bindVideoCards(area);
  area.querySelectorAll('.mv-done').forEach(btn => {
    btn.onclick = () => {
      const cur2 = store.get('currentPlan');
      cur2.plan.blocks[+btn.dataset.i].done = !cur2.plan.blocks[+btn.dataset.i].done;
      store.set('currentPlan', cur2);
      btn.classList.toggle('on');
      btn.textContent = btn.classList.contains('on') ? '✓ 已练' : '完成';
    };
  });
  area.querySelector('#finish-btn').onclick = () => {
    const cur2 = store.get('currentPlan');
    addPlanHistory({
      title: cur2.plan.planTitle, date: cur2.date,
      blocks: cur2.plan.blocks.length,
      done: cur2.plan.blocks.filter(b => b.done).length,
      groups: cur2.groups,
    });
    store.del('currentPlan');
    toast('训练已记录 👏');
    area.innerHTML = '';
    renderHistory(area);
  };
}

function renderHistory(area) {
  const old = area.querySelector('.history-block');
  if (old) old.remove();
  const h = getPlanHistory();
  if (!h.length) return;
  const div = document.createElement('div');
  div.className = 'history-block';
  div.innerHTML = `<div class="section-title">训练记录</div><div class="card">
    ${h.slice(0, 8).map(x => `<div class="list-item"><div class="grow">
      <div class="title">${esc(x.title)}</div>
      <div class="sub">${esc(x.date)} · 完成 ${x.done}/${x.blocks} 个动作</div></div></div>`).join('')}
  </div>`;
  area.appendChild(div);
}
