// 本地规则版训练计划生成（AI 不可用 / 无 Key 时的降级方案）
import { store } from '../store.js';

// 肌群编排固定顺序：大肌群在前
const GROUP_ORDER = ['chest', 'back', 'legs', 'shoulders', 'glutes', 'arms', 'core', 'cardio'];
const GROUP_NAME = { chest: '胸', back: '背', shoulders: '肩', arms: '手臂', legs: '腿', glutes: '臀', core: '核心', cardio: '有氧' };

/** 每个肌群挑前 1-2 个器械的主动作，复合动作优先（equipment.json 中数组顺序即推荐顺序） */
export function localPlan(groupIds, eqData, durationMin = 60) {
  const perGroup = durationMin <= 40 ? 1 : durationMin >= 90 ? 2 : (groupIds.length >= 3 ? 1 : 2);
  const ordered = GROUP_ORDER.filter(g => groupIds.includes(g));
  const blocks = [];
  let order = 1;
  for (const gid of ordered) {
    const eqs = eqData.equipment.filter(e => (e.muscleGroups || []).includes(gid));
    for (const e of eqs.slice(0, perGroup)) {
      const m = e.movements && e.movements[0];
      if (!m) continue;
      blocks.push({
        order: order++,
        movementId: m.id,
        sets: m.sets || '3',
        reps: m.reps || '8-12',
        restSec: m.restSec || 90,
        tip: (m.keyPoints && m.keyPoints[0]) || '',
      });
    }
  }
  return {
    planTitle: `${ordered.map(g => GROUP_NAME[g] || g).join(' + ')} 训练计划（本地模板）`,
    estimatedMin: durationMin,
    blocks,
    source: 'local',
  };
}

/** 把 movementId 解析回 {equipment, movement} */
export function findMovement(eqData, movementId) {
  for (const e of eqData.equipment) {
    const m = (e.movements || []).find(m => m.id === movementId);
    if (m) return { equipment: e, movement: m };
  }
  return null;
}
