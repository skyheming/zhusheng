// src/ui/components/share-card.js — 分享卡：复制链接（含 clipboard 降级）
import { t } from '../i18n.js';
import { toast } from './toast.js';

/** 分享链接：origin + pathname + #/design/<token>?ref=share */
export function buildShareUrl(token) {
  return `${window.location.origin}${window.location.pathname}#/design/${token}?ref=share`;
}

/** 复制文本；返回是否成功 */
export async function copyText(text) {
  if (!text) return false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* 继续降级 */ }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '-200px';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/** 复制分享链接并 toast；失败时返回 false（调用方负责降级展示） */
export async function copyShareLink(token) {
  const url = buildShareUrl(token);
  const ok = await copyText(url);
  if (ok) toast(t('share.copied'));
  else toast(t('share.failed'), { tone: 'danger', duration: 4200 });
  return { ok, url };
}

/**
 * 分享卡。
 * @param {{token:string, designId:string, onCopyFallback?:()=>void, compact?:boolean}} options
 */
export function createShareCard({ token, designId = '', compact = false } = {}) {
  const wrap = document.createElement('div');
  wrap.className = `zs-share${compact ? ' zs-share--compact' : ''}`;

  const head = document.createElement('div');
  head.className = 'zs-share__head';
  const title = document.createElement('span');
  title.className = 'zs-share__title';
  title.textContent = t('design.shareTitle');
  const id = document.createElement('span');
  id.className = 'zs-share__id';
  id.textContent = designId;
  head.append(title, id);

  const hint = document.createElement('p');
  hint.className = 'zs-share__hint';
  hint.textContent = t('design.shareHint');

  const actions = document.createElement('div');
  actions.className = 'zs-share__actions';

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'zs-btn zs-btn--ghost zs-share__copy';
  copyBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="5.2" y="5.2" width="8.3" height="8.3" rx=".6" stroke="currentColor" stroke-width="1.2"/><path d="M10.8 5.2V3.1a.6.6 0 0 0-.6-.6H3.1a.6.6 0 0 0-.6.6v7.1a.6.6 0 0 0 .6.6h2.1" stroke="currentColor" stroke-width="1.2"/></svg><span>${t('cta.copyLink')}</span>`;
  copyBtn.setAttribute('aria-label', t('share.aria'));

  const fallback = document.createElement('input');
  fallback.type = 'text';
  fallback.className = 'zs-share__fallback';
  fallback.readOnly = true;
  fallback.hidden = true;
  fallback.setAttribute('aria-label', t('share.manual'));
  fallback.value = token ? buildShareUrl(token) : '';

  copyBtn.addEventListener('click', async () => {
    if (!token) return;
    const { ok } = await copyShareLink(token);
    if (!ok) {
      fallback.hidden = false;
      fallback.focus();
      fallback.select();
    }
  });

  const social = document.createElement('div');
  social.className = 'zs-share__social';
  for (const [key, glyph] of [['wechat', '微'], ['xiaohongshu', '小']]) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'zs-share__social-btn';
    btn.title = `${t(`share.${key}`)} · ${t('share.coming')}`;
    btn.setAttribute('aria-label', `${t(`share.${key}`)} · ${t('share.coming')}`);
    btn.textContent = glyph;
    btn.addEventListener('click', () => toast(`${t(`share.${key}`)}${t('share.coming')}`));
    social.appendChild(btn);
  }

  actions.append(copyBtn, social);
  wrap.append(head, hint, actions, fallback);
  return wrap;
}
