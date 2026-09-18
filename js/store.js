// localStorage 封装：命名空间、导出/导入、常用数据访问
const NS = 'fitmate:v1:';

export const store = {
  get(k, def = null) {
    try {
      const v = localStorage.getItem(NS + k);
      return v == null ? def : JSON.parse(v);
    } catch { return def; }
  },
  set(k, v) { localStorage.setItem(NS + k, JSON.stringify(v)); },
  del(k) { localStorage.removeItem(NS + k); },
  exportAll() {
    const o = { _app: 'fitmate', _v: 1, _exportedAt: new Date().toISOString() };
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(NS)) {
        try { o[k.slice(NS.length)] = JSON.parse(localStorage.getItem(k)); } catch {}
      }
    }
    return o;
  },
  importAll(obj) {
    if (obj._app !== 'fitmate') throw new Error('不是 FitMate 的备份文件');
    for (const [k, v] of Object.entries(obj)) {
      if (k.startsWith('_')) continue;
      localStorage.setItem(NS + k, JSON.stringify(v));
    }
  },
  clearAll() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(NS)) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
  },
  usage() { let n = 0; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(NS)) n += (localStorage.getItem(k) || '').length; } return n; },
};

const DEFAULT_SETTINGS = {
  apiKey: '',
  model: 'glm-5-3-flash-260828',
  baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
  theme: 'auto',
  usePersonalContext: true,
};

export function getSettings() { return { ...DEFAULT_SETTINGS, ...store.get('settings', {}) }; }
export function saveSettings(s) { store.set('settings', s); }

export function getBody() { return store.get('body', { weightKg: null, heightCm: null, level: 'beginner', goalKcal: 2200, goalProteinG: 120 }); }
export function saveBody(b) { store.set('body', b); }

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function getDiet(date = today()) { return store.get('diet:' + date, { meals: { breakfast: [], lunch: [], dinner: [], snack: [] } }); }
export function saveDiet(rec, date = today()) { store.set('diet:' + date, rec); }

export function getPlanHistory() { return store.get('planHistory', []); }
export function addPlanHistory(p) { const h = getPlanHistory(); h.unshift(p); store.set('planHistory', h.slice(0, 60)); }
