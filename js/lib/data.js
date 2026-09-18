// 器械库数据加载：fetch data/equipment.json，并缓存到 localStorage 供离线使用
import { store } from '../store.js';

let cache = null;

export async function loadEquipment() {
  if (cache) return cache;
  const local = store.get('equipmentData');
  try {
    const res = await fetch('data/equipment.json');
    if (res.ok) {
      cache = await res.json();
      store.set('equipmentData', cache);
      return cache;
    }
  } catch {}
  if (local) { cache = local; return cache; }
  throw new Error('器械库数据加载失败');
}

export const GROUP_META = {
  chest: { name: '胸', icon: '🫁' },
  back: { name: '背', icon: '🦾' },
  shoulders: { name: '肩', icon: '🪨' },
  arms: { name: '手臂', icon: '💪' },
  legs: { name: '腿', icon: '🦵' },
  glutes: { name: '臀', icon: '🍑' },
  core: { name: '核心', icon: '🧱' },
  cardio: { name: '有氧', icon: '🏃' },
};
