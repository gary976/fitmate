// B站官方 iframe 内嵌播放器组件（懒加载：点击封面才加载 iframe）
import { esc } from './ui.js';

export function iframeSrc(bvid, page = 1) {
  return `https://player.bilibili.com/player.html?bvid=${encodeURIComponent(bvid)}&page=${page}&high_quality=1&danmaku=0&autoplay=0`;
}

/** 视频卡 HTML。video: {bvid,title,page,verified} 或 null */
export function videoCardHtml(video, fallbackQuery = '') {
  if (!video || !video.bvid) {
    return `<div class="video-empty">🎬 教学视频待补充${fallbackQuery ? `，可 <a target="_blank" rel="noopener" href="https://search.bilibili.com/all?keyword=${encodeURIComponent(fallbackQuery)}">去B站搜索「${esc(fallbackQuery)}」</a>` : ''}</div>`;
  }
  return `<div class="video-card" data-bvid="${esc(video.bvid)}">
    <div class="video-cover">
      <div class="play">▶</div>
      <div style="font-size:13px">点击播放：${esc(video.title || 'B站教学视频')}${video.verified ? '' : '<br><span style="font-size:11px;opacity:.7">（未人工核对）</span>'}</div>
    </div>
  </div>`;
}

/** 绑定容器内所有 .video-card 的点击展开 */
export function bindVideoCards(root) {
  root.querySelectorAll('.video-card[data-bvid]').forEach(card => {
    card.addEventListener('click', () => {
      if (card.querySelector('iframe')) return;
      const bvid = card.dataset.bvid;
      const title = card.querySelector('.v-title')?.textContent || '';
      card.innerHTML = `<iframe src="${iframeSrc(bvid)}" scrolling="no" frameborder="0" allowfullscreen="true"></iframe>${title ? `<div class="v-title">${esc(title)}</div>` : ''}`;
    }, { once: false });
  });
}

/** 校验 bvid 格式（BV 开头 + 10 位字母数字） */
export function isValidBvid(bvid) {
  return /^BV[0-9A-Za-z]{10}$/.test(bvid || '');
}
