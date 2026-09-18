// AI 问答页：SSE 流式对话，可附图片
import { store, getSettings, getDiet, getPlanHistory, today } from '../store.js';
import { esc, toast } from '../lib/ui.js';
import { chat, AppError, userWithImage } from '../api/ark.js';
import { chatSystem, personalContext } from '../api/prompts.js';
import { pickImage } from '../lib/vision.js';

const QUICK = ['新手一周练几休几？', '减脂期每天蛋白质吃多少？', '练完肌肉酸痛还能练吗？', '帮我安排一份增肌饮食'];

export async function renderChat(view) {
  const msgs = store.get('chat', []);
  view.innerHTML = `<div class="chat-wrap">
    <div class="chat-list" id="chat-list"></div>
    <div class="chat-bar">
      <button class="attach" id="c-attach">📷</button>
      <textarea id="c-input" placeholder="问 AI 教练…（Enter 发送）"></textarea>
      <button class="send" id="c-send">➤</button>
    </div>
  </div>`;
  const list = view.querySelector('#chat-list');
  let pendingImage = null;

  function drawMsg(m) {
    const div = document.createElement('div');
    div.className = 'bubble ' + (m.role === 'user' ? 'me' : 'ai');
    if (m.img) {
      const img = document.createElement('img');
      img.className = 'chat-thumb'; img.src = m.img;
      div.appendChild(img);
    }
    if (m.content) div.appendChild(document.createTextNode(m.content));
    return div;
  }

  function redraw() {
    const msgs2 = store.get('chat', []);
    list.innerHTML = '';
    if (!msgs2.length) {
      list.innerHTML = `<div class="empty"><div class="big">🤖</div>我是你的 AI 健身教练<br>训练、饮食、恢复的问题都可以问
        <div class="chips" style="margin-top:14px;justify-content:center">${QUICK.map(q => `<button class="chip" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div></div>`;
      list.querySelectorAll('[data-q]').forEach(c => {
        c.onclick = () => { view.querySelector('#c-input').value = c.dataset.q; send(); };
      });
    } else {
      msgs2.forEach(m => list.appendChild(drawMsg(m)));
    }
    list.scrollTop = list.scrollHeight;
  }
  redraw();

  view.querySelector('#c-attach').onclick = async () => {
    try {
      const img = await pickImage({ camera: true });
      pendingImage = img;
      toast('已附上图片，输入问题后发送');
      const thumb = document.createElement('img');
      thumb.className = 'chat-thumb';
      thumb.src = img;
      thumb.style.position = 'fixed';
      thumb.style.right = '70px';
      thumb.style.bottom = '110px';
      thumb.style.zIndex = '60';
      thumb.id = 'pending-img';
      document.body.appendChild(thumb);
    } catch {}
  };

  async function send() {
    const input = view.querySelector('#c-input');
    const text = input.value.trim();
    if (!text && !pendingImage) return;
    const img = pendingImage;
    pendingImage = null;
    document.getElementById('pending-img')?.remove();
    input.value = '';

    const msgs2 = store.get('chat', []);
    msgs2.push({ role: 'user', content: text, img });
    store.set('chat', msgs2);
    redraw();

    // AI 回复气泡（流式更新）
    const aiMsg = { role: 'assistant', content: '' };
    const bubble = drawMsg(aiMsg);
    list.appendChild(bubble);
    list.scrollTop = list.scrollHeight;

    const s = getSettings();
    const hist = msgs2.slice(-12).map(m => {
      if (m.img && m.role === 'user') return userWithImage(m.content || '请看这张图片', m.img);
      return { role: m.role, content: m.content };
    });
    if (s.usePersonalContext) {
      const diet = getDiet(today());
      const items = Object.values(diet.meals || {}).flat();
      const dietSum = items.length ? `今日已摄入约 ${Math.round(items.reduce((x, i) => x + (+i.kcal || 0), 0))} 千卡、蛋白质 ${Math.round(items.reduce((x, i) => x + (+i.proteinG || 0), 0))}g` : '';
      const plans = getPlanHistory();
      const planSum = plans.length ? plans[0].title : '';
      hist[0] = { role: 'system', content: chatSystem() + personalContext(dietSum, planSum) };
    }
    try {
      await chat(hist, {
        stream: true,
        onDelta: (d, full) => {
          bubble.textContent = full;
          list.scrollTop = list.scrollHeight;
        },
      });
    } catch (e) {
      bubble.classList.add('err');
      bubble.textContent = '⚠️ ' + (e instanceof AppError ? e.message : '请求失败：' + (e.message || e));
    }
    const msgs3 = store.get('chat', []);
    msgs3.push({ role: 'assistant', content: bubble.textContent });
    store.set('chat', msgs3);
    if (!bubble.textContent) bubble.textContent = '（空回复）';
  }

  view.querySelector('#c-send').onclick = send;
  view.querySelector('#c-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });
}
