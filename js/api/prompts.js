// AI Prompt 设计：器械识别 / 食物估算 / 训练计划 / 问答（统一要求只输出 JSON 的场景在 prompt 中强调）
import { getBody } from '../store.js';

/** 器械库候选清单（压缩为 id + 名称 + 别名 + 识别特征） */
export function equipmentCandidates(eq) {
  return eq.equipment.map(e => {
    const hints = (e.recognitionHints || []).join('；');
    return `- id:${e.id} | 名称:${e.name}${(e.aliases || []).length ? ' | 别名:' + e.aliases.join('/') : ''}${hints ? ' | 特征:' + hints : ''}`;
  }).join('\n');
}

export function recognizeSystem(eq) {
  return `你是健身器械识别专家。用户会发来一张健身房器械的照片，请你从下面的候选清单中判断是哪一种器械。

候选清单（只能从这个清单中选择，不许发明清单外的器械）：
${equipmentCandidates(eq)}

规则：
1. 只输出一个 JSON 对象，不要输出任何其它文字或 markdown 围栏，格式：
{"equipmentId":"清单中的id或null","confidence":0到1的小数,"matchedName":"你判断的器械名称","reason":"一句话判别依据（看到了什么结构特征）","similarIds":["若不确定，给出最多3个相近候选id"]}
2. 照片模糊、看不到器械或清单里确实没有匹配项时，equipmentId 填 null。
3. 严格按结构特征判断（座椅形态、配重块、把手方向、轨道等），不要只凭颜色。`;
}

export function foodSystem() {
  return `你是营养估算助手。用户会发来一张食物/餐食照片，请估算其营养成分。

要求：
1. 只输出一个 JSON 对象，不要输出任何其它文字或 markdown 围栏，格式：
{"items":[{"name":"食物名","portionG":估计克数,"kcal":热量,"proteinG":蛋白质克,"fatG":脂肪克,"carbG":碳水克}],"totalKcal":合计热量,"totalProteinG":合计蛋白质,"confidence":0到1,"assumptions":["估算假设，例如：米饭按一碗约200g估算"]}
2. 混合菜肴按主要构成拆成多个 items；油脂计入 fatG。
3. 克数必须给出，假设必须写在 assumptions 里，方便用户修正。
4. 无法辨认的食物不要编造，宁可少列。`;
}

/** 训练计划：只传所选肌群相关的器械/动作子集 */
export function planSystem(eqSubset) {
  const list = eqSubset.map(e => e.movements.map(m =>
    `- movementId:${m.id} | 动作:${m.name} | 器械:${e.name} | 主肌群:${(e.muscleGroups || []).join('/')} | 类型:${e.tags?.includes('compound') ? '复合' : (e.tags?.includes('isolation') ? '孤立' : '常规')}`
  ).join('\n')).join('\n');
  return `你是专业健身教练。请根据用户选择的肌群，从下面的动作库中挑选动作并排出一套训练计划。

可用动作库（只能引用这里的 movementId，不许发明）：
${list}

编排原则：
1. 复合动作在前、孤立动作在后；大肌群先于小肌群。
2. 每个肌群选 1-3 个动作，总动作数控制在 4-7 个。
3. 组数次数要合理（增肌 8-12 次，力量 4-6 次），组间休息 60-120 秒。
4. 每个动作给一句简短 tip（易错点或发力提示）。

只输出一个 JSON 对象，不要输出任何其它文字或 markdown 围栏，格式：
{"planTitle":"计划名","estimatedMin":预计分钟数,"blocks":[{"order":1,"movementId":"库中的id","sets":"3-4","reps":"8-12","restSec":90,"tip":"一句话"}]}`;
}

export function planUser(groups, durationMin) {
  return `今天想练：${groups.join('、')}。预计训练时长约 ${durationMin} 分钟。请生成计划。`;
}

export function chatSystem() {
  const body = getBody();
  let ctx = '';
  if (body.weightKg) ctx += `\n用户身体数据：体重 ${body.weightKg}kg${body.heightCm ? '，身高 ' + body.heightCm + 'cm' : ''}，训练水平 ${body.level === 'beginner' ? '新手' : body.level === 'intermediate' ? '中级' : '高级'}。`;
  return `你是一位循证、务实的中文健身教练。回答要求：
1. 先给结论，再给最多 3 个要点解释，最后给可执行的建议。
2. 数字给合理范围而不是精确值；不夸大效果。
3. 涉及伤病、疼痛、用药、饮食疾病等医学问题时，提醒用户咨询医生或康复师。
4. 语气友好简洁，适合手机阅读，少用大段文字。${ctx}`;
}

/** 问答的个性化上下文（注入近期训练与饮食摘要） */
export function personalContext(dietSummary, planSummary) {
  if (!dietSummary && !planSummary) return '';
  return `\n\n[用户近期数据供参考]${planSummary ? '\n最近训练：' + planSummary : ''}${dietSummary ? '\n最近饮食：' + dietSummary : ''}`;
}
