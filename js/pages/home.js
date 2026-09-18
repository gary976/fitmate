// 首页：今日概览 + 快捷入口
import { go } from '../router.js';
import { store, getDiet, getBody, today, getPlanHistory } from '../store.js';
import { esc } from '../lib/ui.js';
import { recognizeFlow } from './equipment.js';

export function renderHome(view) {
  const body = getBody();
  const diet = getDiet(today());
  const kcal = diet.meals ? Object.values(diet.meals).flat().reduce((s, i) => s + (+i.kcal || 0), 0) : 0;
  const protein = diet.meals ? Object.values(diet.meals).flat().reduce((s, i) => s + (+i.proteinG || 0), 0) : 0;
  const plan = store.get('currentPlan');
  const history = getPlanHistory();

  view.innerHTML = `<div class="page">
    <h1 style="margin-bottom:2px">FitMate 💪</h1>
    <div class="muted" style="margin-bottom:14px">你的随身健身助手</div>

    <div class="card ring-row">
      <svg class="ring" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="42" fill="none" stroke="var(--line)" stroke-width="10"/>
        <circle cx="50" cy="50" r="42" fill="none" stroke="var(--primary)" stroke-width="10"
          stroke-linecap="round" stroke-dasharray="${(Math.min(1, kcal / (body.goalKcal || 2200)) * 264).toFixed(1)} 264"
          transform="rotate(-90 50 50)"/>
        <text x="50" y="49" text-anchor="middle" fill="var(--text)">${Math.round(kcal)}</text>
        <text x="50" y="64" text-anchor="middle" fill="var(--text-3)" style="font-size:8px">/ ${body.goalKcal || 2200} 千卡</text>
      </svg>
      <div class="nutri-grid">
        <div class="nutri-cell"><div class="v">${Math.round(protein)}g</div><div class="k">今日蛋白质 / 目标 ${body.goalProteinG || 120}g</div></div>
        <div class="nutri-cell"><div class="v">${plan ? '已排课' : '未排课'}</div><div class="k">今日训练计划</div></div>
      </div>
    </div>

    <div class="quick-grid">
      <button class="quick-card" id="q-recognize"><div class="ic">📷</div><div class="t">识别器械</div><div class="d">拍照告诉你是什么、怎么练</div></button>
      <button class="quick-card" id="q-plan"><div class="ic">📋</div><div class="t">开始训练</div><div class="d">选部位，生成今日计划</div></button>
      <button class="quick-card" id="q-diet"><div class="ic">🍽️</div><div class="t">记录饮食</div><div class="d">拍照估算热量与蛋白质</div></button>
      <button class="quick-card" id="q-chat"><div class="ic">💬</div><div class="t">问 AI 教练</div><div class="d">健身问题随时问</div></button>
    </div>

    ${plan ? `<div class="card" id="home-plan" style="cursor:pointer">
      <div class="tag p">今日计划</div>
      <h2 style="margin:8px 0 2px">${esc(plan.plan.planTitle || '训练计划')}</h2>
      <div class="small">共 ${plan.plan.blocks.length} 个动作 · 约 ${plan.plan.estimatedMin || 60} 分钟</div>
    </div>` : ''}
    ${history.length ? `<div class="section-title">最近训练</div><div class="card">${history.slice(0, 3).map(h => `
      <div class="list-item"><div class="grow"><div class="title">${esc(h.title)}</div><div class="sub">${esc(h.date)} · ${h.blocks} 个动作</div></div></div>`).join('')}</div>` : ''}
  </div>`;

  view.querySelector('#q-recognize').onclick = () => recognizeFlow();
  view.querySelector('#q-plan').onclick = () => go('/train');
  view.querySelector('#q-diet').onclick = () => go('/diet');
  view.querySelector('#q-chat').onclick = () => go('/chat');
  const hp = view.querySelector('#home-plan');
  if (hp) hp.onclick = () => go('/train');
}
