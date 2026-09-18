// 改进需求收集：想加的功能写下来，复制给 Claude Code 迭代
import { store } from '../store.js';
import { esc, toast, confirmBox } from '../lib/ui.js';

export async function renderFeedback(view) {
  const list = () => store.get('feedback', []);
  view.innerHTML = `<div class="page">
    <div class="page-head"><button class="back" onclick="history.back()">‹</button><h1>改进需求</h1></div>
    <div class="card" style="background:var(--accent-soft)">
      <div class="small" style="color:var(--accent)">这个软件由你和 AI 一起迭代：把想要的功能写在这里，点「复制全部」，然后在电脑上打开 Claude Code 粘贴给它，就能不断完善这个 App。</div>
    </div>
    <div class="card">
      <div class="form-row"><textarea id="fb-text" rows="3" placeholder="例如：希望训练页能记录每组的重量"></textarea></div>
      <button class="btn" id="fb-add">添加需求</button>
    </div>
    <div class="card" id="fb-list"></div>
    <button class="btn ghost" id="fb-copy">复制全部需求</button>
    <div style="height:8px"></div>
  </div>`;

  function draw() {
    const items = list();
    view.querySelector('#fb-list').innerHTML = items.length
      ? items.map(x => `<div class="list-item"><div class="grow"><div class="title" style="font-weight:400">${esc(x.text)}</div><div class="sub">${esc(x.date)}</div></div>
          <button class="small" data-del="${x.id}" style="color:var(--danger);background:none;border:none">删除</button></div>`).join('')
      : '<div class="small">还没有需求，写下第一条吧</div>';
    view.querySelectorAll('[data-del]').forEach(b => {
      b.onclick = async () => {
        if (await confirmBox('删除这条需求？')) {
          store.set('feedback', list().filter(x => x.id !== b.dataset.del));
          draw();
        }
      };
    });
  }
  draw();

  view.querySelector('#fb-add').onclick = () => {
    const t = view.querySelector('#fb-text').value.trim();
    if (!t) return toast('先写下你的需求');
    const items = list();
    items.unshift({ id: Date.now().toString(36), text: t, date: new Date().toLocaleDateString('zh-CN') });
    store.set('feedback', items);
    view.querySelector('#fb-text').value = '';
    draw();
    toast('已添加 ✅');
  };
  view.querySelector('#fb-copy').onclick = () => {
    const items = list();
    if (!items.length) return toast('还没有需求');
    const text = 'FitMate 改进需求：\n' + items.map((x, i) => `${i + 1}. ${x.text}`).join('\n');
    navigator.clipboard?.writeText(text).then(() => toast('已复制，去粘贴给 Claude Code 吧'), () => {
      // 剪贴板不可用时降级为弹层展示
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove();
      toast('已复制 ✅');
    });
  };
}
