// 应用入口：注册路由、主题、Service Worker、器械库预加载
import { register, render } from './router.js';
import { getSettings } from './store.js';
import { loadEquipment } from './lib/data.js';
import { renderHome } from './pages/home.js';
import { renderTrain } from './pages/train.js';
import { renderLibrary, renderEquipmentDetail } from './pages/equipment.js';
import { renderDiet } from './pages/diet.js';
import { renderChat } from './pages/chat.js';
import { renderProfile } from './pages/profile.js';
import { renderSettings } from './pages/settings.js';
import { renderFeedback } from './pages/feedback.js';

register('/home', renderHome);
register('/train', renderTrain);
register('/library', renderLibrary);
register('/library/:id', renderEquipmentDetail);
register('/diet', renderDiet);
register('/chat', renderChat);
register('/profile', renderProfile);
register('/settings', renderSettings);
register('/feedback', renderFeedback);

function applyTheme() {
  const theme = getSettings().theme;
  const dark = theme === 'dark' || (theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}
applyTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

// 预加载器械库（写入 localStorage 缓存，供离线使用）
loadEquipment().catch(() => {});

// PWA Service Worker（仅 https / localhost 下可注册）
if ('serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

render();
