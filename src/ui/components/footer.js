// src/ui/components/footer.js — 页脚（深色区块，night 底）
import { t } from '../i18n.js';

/**
 * @param {{router:object}} options
 */
export function createFooter({ router } = {}) {
  const footer = document.createElement('footer');
  footer.className = 'site-footer';

  const wrap = document.createElement('div');
  wrap.className = 'site-footer__inner';

  // 品牌陈述
  const brandCol = document.createElement('div');
  brandCol.className = 'site-footer__brand';
  const seal = document.createElement('span');
  seal.className = 'site-footer__seal';
  seal.setAttribute('aria-hidden', 'true');
  seal.textContent = '珠';
  const statement = document.createElement('p');
  statement.className = 'site-footer__statement';
  statement.textContent = t('footer.statement');
  const latin = document.createElement('p');
  latin.className = 'site-footer__latin';
  latin.textContent = 'BORN OF THE ELEMENTS · STRUNG FOR YOU';
  const desc = document.createElement('p');
  desc.className = 'site-footer__desc';
  desc.textContent = t('footer.desc');
  brandCol.append(seal, statement, latin, desc);

  // 链接列
  const columns = document.createElement('div');
  columns.className = 'site-footer__columns';

  columns.appendChild(makeColumn('footer.series', [
    { label: t('footer.series1'), section: 'generator' },
    { label: t('footer.series2'), section: 'generator' },
    { label: t('footer.series3'), section: 'generator' },
  ], router));
  columns.appendChild(makeColumn('footer.help', [
    { label: t('footer.help1'), route: '/about' },
    { label: t('footer.help2'), route: '/about' },
    { label: t('footer.help3'), route: '/about' },
    { label: t('footer.help4'), route: '/about' },
  ], router));
  columns.appendChild(makeColumn('footer.follow', [
    { label: t('footer.wechat'), route: '/about' },
    { label: t('footer.xiaohongshu'), route: '/about' },
    { label: t('footer.instagram'), route: '/about' },
  ], router));

  // 底部
  const bottom = document.createElement('div');
  bottom.className = 'site-footer__bottom';
  const copyright = document.createElement('span');
  copyright.textContent = t('footer.copyright');
  const note = document.createElement('span');
  note.className = 'site-footer__note';
  note.textContent = t('footer.shopify');
  const topBtn = document.createElement('button');
  topBtn.type = 'button';
  topBtn.className = 'site-footer__top';
  topBtn.textContent = t('footer.backTop');
  topBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  bottom.append(copyright, note, topBtn);

  const fineprint = document.createElement('p');
  fineprint.className = 'site-footer__fineprint';
  fineprint.textContent = t('footer.note');

  wrap.append(brandCol, columns, bottom, fineprint);
  footer.appendChild(wrap);

  return {
    el: footer,
    destroy() { footer.remove(); },
  };
}

function makeColumn(titleKey, links, router) {
  const col = document.createElement('div');
  col.className = 'site-footer__col';
  const title = document.createElement('h2');
  title.className = 'site-footer__title';
  title.textContent = t(titleKey);
  const list = document.createElement('ul');
  for (const link of links) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'site-footer__link';
    btn.textContent = link.label;
    btn.addEventListener('click', () => {
      if (link.route) router.navigate(link.route);
      else if (link.section) router.navigate('/', { section: link.section });
    });
    li.appendChild(btn);
    list.appendChild(li);
  }
  col.append(title, list);
  return col;
}
