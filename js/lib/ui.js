// 通用 UI 小工具
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function toast(msg, ms = 2200) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(t._h);
  t._h = setTimeout(() => { t.style.display = 'none'; }, ms);
}

export function sheet(html) {
  const mask = document.createElement('div');
  mask.className = 'sheet-mask';
  mask.innerHTML = `<div class="sheet"><div class="grab"></div>${html}</div>`;
  mask.addEventListener('click', e => { if (e.target === mask) close(); });
  document.body.appendChild(mask);
  function close() { mask.remove(); }
  return { el: mask, close };
}

export function confirmBox(msg, okText = '确定') {
  return new Promise(resolve => {
    const s = sheet(`
      <div style="text-align:center;padding:6px 4px 14px">${esc(msg)}</div>
      <div class="btn-row">
        <button class="btn ghost" data-a="no">取消</button>
        <button class="btn" data-a="yes">${esc(okText)}</button>
      </div>`);
    s.el.addEventListener('click', e => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a) { s.close(); resolve(a === 'yes'); }
    });
  });
}

export function spinnerHtml(text = '加载中…') {
  return `<div style="text-align:center;padding:20px"><span class="spinner"></span> <span class="muted">${esc(text)}</span></div>`;
}

export function fmtDate(dateStr) {
  const t = todayStr();
  if (dateStr === t) return '今天';
  const d = new Date(dateStr + 'T12:00:00');
  const diff = Math.round((new Date(t + 'T12:00:00') - d) / 86400000);
  if (diff === 1) return '昨天';
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function shiftDate(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
