// 我的：身体数据与目标、数据备份、入口
import { go } from '../router.js';
import { store, getBody, saveBody } from '../store.js';
import { esc, toast, confirmBox } from '../lib/ui.js';

export async function renderProfile(view) {
  const body = getBody();
  view.innerHTML = `<div class="page">
    <h1 style="margin-bottom:12px">我的</h1>
    <div class="card">
      <h2>身体数据与目标</h2>
      <div class="form-grid">
        <div class="form-row"><label>体重 (kg)</label><input id="b-weight" type="number" step="0.1" value="${body.weightKg || ''}" placeholder="70"></div>
        <div class="form-row"><label>身高 (cm)</label><input id="b-height" type="number" value="${body.heightCm || ''}" placeholder="175"></div>
        <div class="form-row"><label>训练水平</label>
          <select id="b-level">
            <option value="beginner" ${body.level === 'beginner' ? 'selected' : ''}>新手（<1 年）</option>
            <option value="intermediate" ${body.level === 'intermediate' ? 'selected' : ''}>中级（1-3 年）</option>
            <option value="advanced" ${body.level === 'advanced' ? 'selected' : ''}>高级（3 年+）</option>
          </select></div>
        <div class="form-row"><label>每日蛋白质目标 (g)</label><input id="b-protein" type="number" value="${body.goalProteinG || ''}" placeholder="120"></div>
        <div class="form-row" style="grid-column:1/3"><label>每日热量目标 (千卡)</label><input id="b-kcal" type="number" value="${body.goalKcal || ''}" placeholder="2200"></div>
      </div>
      <button class="btn" id="b-save">保存</button>
    </div>

    <div class="card">
      <div class="list-item" id="go-settings" style="cursor:pointer"><div class="grow"><div class="title">⚙️ 设置</div><div class="sub">API Key、模型、深色模式</div></div><span class="muted">›</span></div>
      <div class="list-item" id="go-feedback" style="cursor:pointer"><div class="grow"><div class="title">💡 改进需求</div><div class="sub">记录想加的功能，复制给 AI 迭代</div></div><span class="muted">›</span></div>
    </div>

    <div class="card">
      <h2>数据备份</h2>
      <div class="small" style="margin:6px 0 10px">所有数据只存在本机浏览器里，换手机或清缓存前请先导出。</div>
      <div class="btn-row">
        <button class="btn ghost" id="d-export">导出备份</button>
        <button class="btn ghost" id="d-import">导入备份</button>
      </div>
      <div class="small" style="margin-top:8px">当前占用：${(store.usage() / 1024).toFixed(1)} KB</div>
      <input type="file" id="d-file" accept="application/json" style="display:none">
    </div>
  </div>`;

  view.querySelector('#b-save').onclick = () => {
    saveBody({
      weightKg: +view.querySelector('#b-weight').value || null,
      heightCm: +view.querySelector('#b-height').value || null,
      level: view.querySelector('#b-level').value,
      goalKcal: +view.querySelector('#b-kcal').value || 2200,
      goalProteinG: +view.querySelector('#b-protein').value || 120,
    });
    toast('已保存 ✅');
  };
  view.querySelector('#go-settings').onclick = () => go('/settings');
  view.querySelector('#go-feedback').onclick = () => go('/feedback');

  view.querySelector('#d-export').onclick = () => {
    const blob = new Blob([JSON.stringify(store.exportAll(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `fitmate-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  view.querySelector('#d-import').onclick = () => view.querySelector('#d-file').click();
  view.querySelector('#d-file').onchange = async e => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const obj = JSON.parse(await f.text());
      if (await confirmBox('导入会合并覆盖同名数据，确定继续？')) {
        store.importAll(obj);
        toast('导入成功 ✅');
      }
    } catch (err) {
      toast('导入失败：' + err.message, 3000);
    }
  };
}
