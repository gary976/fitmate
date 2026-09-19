// 极简 hash 路由：支持精确路径与 /xxx/:id 参数
const routes = new Map();

export function register(path, fn) { routes.set(path, fn); }
export function go(path) { location.hash = '#' + path; }
export function current() { return (location.hash || '#/home').slice(1); }

function match(path) {
  if (routes.has(path)) return { fn: routes.get(path), params: {} };
  const seg = path.split('/').filter(Boolean);
  for (const [r, f] of routes) {
    const rs = r.split('/').filter(Boolean);
    if (rs.length !== seg.length) continue;
    const params = {};
    let ok = true;
    rs.forEach((s, i) => {
      if (s.startsWith(':')) params[s.slice(1)] = decodeURIComponent(seg[i]);
      else if (s !== seg[i]) ok = false;
    });
    if (ok) return { fn: f, params };
  }
  return null;
}

export async function render() {
  const view = document.getElementById('view');
  const path = current();
  const m = match(path) || { fn: routes.get('/home'), params: {} };
  view.innerHTML = '';
  window.scrollTo(0, 0);
  try {
    await m.fn(view, m.params);
  } catch (e) {
    view.innerHTML = `<div class="empty"><div class="big">😵</div>页面出错了<br><span class="small">${(e && e.message) || e}</span></div>`;
  }
  const tab = path.split('/')[1] || 'home';
  document.querySelectorAll('#tabbar button').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
    b.classList.toggle('hidden-tab', tab === 'chat' && b.dataset.tab !== 'chat' && false);
  });
}

window.addEventListener('hashchange', render);

// 底部 TabBar 点击导航
document.getElementById('tabbar').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (b && b.dataset.tab) go('/' + b.dataset.tab);
});
