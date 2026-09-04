(() => {
  const A = globalThis.SDApp;
  if (!A) return;
  const PORTAL_CLASS = 'sd-soft-select-portal';
  let openState = null;
  const labelFor = select => select.options[select.selectedIndex]?.textContent?.trim() || select.getAttribute('data-placeholder') || 'Select';
  const portalMenus = () => [...document.querySelectorAll(`.${PORTAL_CLASS}`)];
  const prune = () => portalMenus().forEach(menu => {
    const select = menu.__sdSelect;
    if (!select?.isConnected) menu.remove();
  });
  const reorderVisibleOptions = (menu, q = '') => {
    if (!menu) return;
    const query = String(q || '').trim().toLowerCase(),
      items = [...menu.querySelectorAll('.sd-soft-select-option')];
    for (const item of items) item.hidden = Boolean(query && !item.textContent.toLowerCase().includes(query));
    items.sort((a, b) => {
      const aa = !a.hidden && a.classList.contains('active'),
        ba = !b.hidden && b.classList.contains('active');
      if (aa !== ba) return ba - aa;
      if (a.hidden !== b.hidden) return Number(a.hidden) - Number(b.hidden);
      return Number(a.dataset.index || 0) - Number(b.dataset.index || 0);
    });
    for (const item of items) menu.appendChild(item);
  };
  const positionMenu = state => {
    if (!state?.button?.isConnected || !state?.menu?.isConnected) return;
    const { button, menu } = state, rect = button.getBoundingClientRect();
    const gap = 8, edge = 10;
    const nav = document.querySelector('.bottom-nav');
    const navTop = nav?.getBoundingClientRect()?.top;
    const usableBottom = Math.min(innerHeight - edge, Number.isFinite(navTop) ? navTop - gap : innerHeight - edge);
    const below = Math.max(0, usableBottom - rect.bottom - gap);
    const above = Math.max(0, rect.top - edge - gap);
    const openAbove = below < 150 && above > below;
    const room = Math.max(96, Math.min(320, openAbove ? above : below));
    const desiredWidth = Math.max(rect.width, 180);
    const width = Math.min(desiredWidth, Math.max(180, innerWidth - edge * 2));
    const left = Math.max(edge, Math.min(rect.left, innerWidth - edge - width));
    menu.style.left = `${Math.round(left)}px`;
    menu.style.width = `${Math.round(width)}px`;
    menu.style.maxHeight = `${Math.round(room)}px`;
    menu.style.top = openAbove ? 'auto' : `${Math.round(rect.bottom + gap)}px`;
    menu.style.bottom = openAbove ? `${Math.round(innerHeight - rect.top + gap)}px` : 'auto';
    menu.dataset.placement = openAbove ? 'top' : 'bottom';
  };
  const close = (except = null) => {
    if (openState && openState.wrap !== except) {
      openState.wrap?.classList.remove('open');
      openState.button?.setAttribute('aria-expanded', 'false');
      openState.menu?.classList.remove('open');
      openState.menu?.setAttribute('aria-hidden', 'true');
      openState = null;
    }
    document.querySelectorAll('.sd-soft-select.open').forEach(w => {
      if (w !== except) {
        w.classList.remove('open');
        w.querySelector('.sd-soft-select-button')?.setAttribute('aria-expanded', 'false');
      }
    });
    portalMenus().forEach(menu => {
      if (!except || menu !== except.__sdMenu) {
        menu.classList.remove('open');
        menu.setAttribute('aria-hidden', 'true');
      }
    });
    prune();
  };
  const rebuild = select => {
    const wrap = select.closest('.sd-soft-select');
    if (!wrap) return;
    const button = wrap.querySelector('.sd-soft-select-button'), menu = wrap.__sdMenu;
    if (!button || !menu) return;
    button.textContent = labelFor(select);
    button.disabled = select.disabled;
    menu.innerHTML = '';
    const searchable = select.dataset.searchable === 'true' || select.options.length >= 10;
    let search = null;
    if (searchable) {
      search = document.createElement('input');
      search.type = 'search';
      search.className = 'sd-soft-select-search';
      search.placeholder = select.dataset.searchPlaceholder || 'Search…';
      search.autocomplete = 'off';
      search.addEventListener('click', ev => ev.stopPropagation());
      search.addEventListener('keydown', ev => {
        if (ev.key === 'Escape') {
          ev.preventDefault();
          close();
          button.focus({ preventScroll: true });
        }
        ev.stopPropagation();
      });
      search.addEventListener('input', () => reorderVisibleOptions(menu, search.value));
      menu.appendChild(search);
    }
    [...select.options].map((opt, index) => ({ opt, index })).sort((a, b) => {
      const as = a.index === select.selectedIndex && String(a.opt.value || '') !== '',
        bs = b.index === select.selectedIndex && String(b.opt.value || '') !== '';
      return Number(bs) - Number(as) || a.index - b.index;
    }).forEach(({ opt, index }) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'sd-soft-select-option';
      item.dataset.value = opt.value;
      item.dataset.index = String(index);
      item.textContent = opt.textContent;
      item.disabled = opt.disabled;
      item.classList.toggle('active', index === select.selectedIndex);
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', index === select.selectedIndex ? 'true' : 'false');
      item.addEventListener('click', ev => {
        ev.preventDefault();
        ev.stopPropagation();
        if (opt.disabled) return;
        select.selectedIndex = index;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        rebuild(select);
        close();
        button.focus({ preventScroll: true });
      });
      menu.appendChild(item);
    });
    if (openState?.select === select) positionMenu(openState);
  };
  const enhance = select => {
    if (!select || select.multiple) return;
    const existing = select.closest('.sd-soft-select');
    if (existing) {
      rebuild(select);
      return;
    }
    const wrap = document.createElement('div');
    wrap.className = 'sd-soft-select' + (select.classList.contains('compact-select') ? ' compact' : '');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sd-soft-select-button';
    button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-expanded', 'false');
    const menu = document.createElement('div');
    menu.className = `sd-soft-select-menu ${PORTAL_CLASS}`;
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('aria-hidden', 'true');
    menu.__sdSelect = select;
    wrap.__sdMenu = menu;
    select.parentNode.insertBefore(wrap, select);
    wrap.append(select, button);
    document.body.appendChild(menu);
    select.classList.add('sd-native-select');
    button.addEventListener('click', ev => {
      ev.preventDefault();
      ev.stopPropagation();
      if (wrap.classList.contains('open')) {
        close();
        return;
      }
      close();
      wrap.classList.add('open');
      button.setAttribute('aria-expanded', 'true');
      menu.classList.add('open');
      menu.setAttribute('aria-hidden', 'false');
      openState = { wrap, button, menu, select };
      rebuild(select);
      positionMenu(openState);
      requestAnimationFrame(() => {
        const search = menu.querySelector('.sd-soft-select-search');
        if (search) search.focus({ preventScroll: true });
        else menu.querySelector('.active')?.scrollIntoView({ block: 'nearest' });
      });
    });
    button.addEventListener('keydown', ev => {
      if (['ArrowDown', 'Enter', ' '].includes(ev.key) && !wrap.classList.contains('open')) {
        ev.preventDefault();
        button.click();
      }
    });
    select.addEventListener('change', () => rebuild(select));
    rebuild(select);
  };
  A.enhanceSoftSelects = (scope = document) => {
    prune();
    scope.querySelectorAll?.('select:not([multiple])').forEach(enhance);
  };
  A.refreshSoftSelect = select => rebuild(select);
  A.closeSoftSelects = close;
  A.repositionSoftSelect = () => openState && positionMenu(openState);
  document.addEventListener('click', () => close());
  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape') close();
  });
  document.addEventListener('scroll', () => openState && positionMenu(openState), true);
  window.addEventListener('resize', () => openState && positionMenu(openState), { passive: true });
})();
