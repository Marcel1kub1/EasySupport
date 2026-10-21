const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

let toastTimer;
let pickerSequence = 0;
let navigationController;

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function showToast(message, type = 'success') {
  let region = document.querySelector('[data-toast-region]');
  if (!region) {
    region = makeElement('div', 'toast-region');
    region.dataset.toastRegion = '';
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-relevant', 'additions text');
    region.setAttribute('aria-atomic', 'false');
    document.body.append(region);
  }

  const toast = makeElement('div', `toast toast--${type}`);
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  const indicator = makeElement('span', 'toast__indicator', type === 'error' ? '!' : '✓');
  const text = makeElement('span', 'toast__message', message);
  const dismiss = makeElement('button', 'toast__dismiss', '×');
  dismiss.type = 'button';
  dismiss.setAttribute('aria-label', 'Dismiss notification');
  dismiss.addEventListener('click', () => toast.remove());
  toast.append(indicator, text, dismiss);
  region.replaceChildren(toast);
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.remove(), 4200);
}

function initialiseWorkspace() {
const moduleSearch = document.querySelector('[data-module-search]');
if (moduleSearch) {
  const cards = [...document.querySelectorAll('[data-module-card]')];
  const resultCount = document.querySelector('[data-search-count]');
  const emptyState = document.querySelector('[data-search-empty]');

  const filterModules = () => {
    const query = moduleSearch.value.trim().toLocaleLowerCase();
    let visibleCount = 0;

    for (const card of cards) {
      const matches = card.dataset.search.toLocaleLowerCase().includes(query);
      card.hidden = !matches;
      if (matches) visibleCount += 1;
    }

    if (resultCount) resultCount.textContent = `${visibleCount} ${visibleCount === 1 ? 'module' : 'modules'}`;
    if (emptyState) emptyState.hidden = visibleCount !== 0;
  };

  moduleSearch.addEventListener('input', filterModules);

}

function enhanceSingleRolePicker(select) {
  if (select.dataset.enhanced === 'true') return;
  if (!select.id) select.id = `select-picker-${++pickerSequence}`;

  const wrapper = makeElement('div', 'role-picker');
  const trigger = makeElement('button', 'role-picker__trigger');
  const value = makeElement('span', 'role-picker__value');
  const chevron = makeElement('span', 'role-picker__chevron');
  const panel = makeElement('div', 'role-picker__panel');
  const search = makeElement('input', 'role-picker__search');
  const optionList = makeElement('div', 'role-picker__options');
  const emptyState = makeElement('p', 'role-picker__empty', 'No matching options.');
  const form = select.form ?? document;
  const label = [...form.querySelectorAll('label[for]')].find((item) => item.htmlFor === select.id);
  const fieldLabel = select.closest('.setting-field')?.querySelector('.setting-label');
  const groupLabel = select.matches('[data-guild-switch]')
    ? select.closest('.guild-switcher')?.querySelector('span')?.textContent?.trim()
    : null;
  const kind = select.matches('[data-guild-switch]') ? 'guilds'
    : /channel/i.test(fieldLabel?.textContent ?? '') ? 'channels'
    : /role/i.test(fieldLabel?.textContent ?? '') ? 'roles'
    : /category/i.test(fieldLabel?.textContent ?? '') ? 'categories'
    : 'options';
  const emptyLabel = select.options[0]?.value === ''
    ? select.options[0].textContent.trim()
    : `Select ${kind === 'options' ? 'an option' : `a ${kind.slice(0, -1)}`}`;
  const triggerId = `${select.id}-picker`;
  const listId = `${select.id}-options`;

  wrapper.dataset.rolePicker = 'enhanced';
  trigger.type = 'button';
  trigger.id = triggerId;
  trigger.setAttribute('role', 'combobox');
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', listId);
  value.textContent = select.selectedOptions[0]?.textContent?.trim() || emptyLabel;
  trigger.append(value, chevron);
  search.type = 'search';
  search.placeholder = `Search ${kind}`;
  search.autocomplete = 'off';
  search.setAttribute('aria-label', `${groupLabel ? `${groupLabel}: ` : ''}Search ${kind}`);
  optionList.id = listId;
  optionList.setAttribute('role', 'listbox');
  panel.hidden = true;
  emptyState.hidden = true;

  for (const option of select.options) {
    const row = makeElement('button', 'role-picker__option', option.textContent.trim());
    row.type = 'button';
    row.tabIndex = -1;
    row.setAttribute('role', 'option');
    row.setAttribute('aria-selected', String(option.selected));
    row.dataset.value = option.value;
    optionList.append(row);
  }

  panel.append(search, optionList, emptyState);
  select.before(wrapper);
  wrapper.append(select, trigger, panel);

  select.classList.add('role-picker__native');
  select.tabIndex = -1;
  select.setAttribute('aria-hidden', 'true');
  select.dataset.enhanced = 'true';
  if (label) {
    label.htmlFor = triggerId;
    if (!label.id) label.id = `${select.id}-label`;
    trigger.setAttribute('aria-labelledby', `${label.id} ${triggerId}`);
  } else {
    trigger.setAttribute('aria-label', `${groupLabel ?? fieldLabel?.textContent?.trim() ?? `Select ${kind}`} selection`);
  }

  const syncValue = () => {
    value.textContent = select.selectedOptions[0]?.textContent?.trim() || emptyLabel;
    for (const option of optionList.children) {
      option.setAttribute('aria-selected', String(option.dataset.value === select.value));
    }
  };

  const close = (returnFocus = false) => {
    panel.hidden = true;
    wrapper.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
    search.value = '';
    for (const option of optionList.children) option.hidden = false;
    emptyState.hidden = true;
    if (returnFocus) trigger.focus();
  };
  wrapper.addEventListener('picker:close', () => close());

  const open = () => {
    panel.hidden = false;
    wrapper.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
    search.focus();
  };

  trigger.addEventListener('click', () => {
    if (panel.hidden) open();
    else close();
  });

  trigger.addEventListener('keydown', (event) => {
    if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      open();
    }
  });

  search.addEventListener('input', () => {
    const query = search.value.trim().toLocaleLowerCase();
    let visibleCount = 0;
    for (const option of optionList.children) {
      option.hidden = !`${option.textContent} ${option.dataset.value}`.toLocaleLowerCase().includes(query);
      if (!option.hidden) visibleCount += 1;
    }
    emptyState.hidden = visibleCount > 0;
  });

  search.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const options = [...optionList.children].filter((option) => !option.hidden);
      const selected = options.find((option) => option.dataset.value === select.value);
      (event.key === 'ArrowUp' && selected ? selected : options[0])?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    }
  });

  optionList.addEventListener('click', (event) => {
    const option = event.target.closest('[role="option"]');
    if (!option) return;
    select.value = option.dataset.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    syncValue();
    close(true);
  });

  optionList.addEventListener('keydown', (event) => {
    const options = [...optionList.children].filter((option) => !option.hidden);
    const currentIndex = options.indexOf(event.target);
    let nextIndex = currentIndex;
    if (event.key === 'ArrowDown') nextIndex = Math.min(currentIndex + 1, options.length - 1);
    else if (event.key === 'ArrowUp') nextIndex = Math.max(currentIndex - 1, 0);
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = options.length - 1;
    else if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
      return;
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.target.click();
      return;
    } else {
      return;
    }
    event.preventDefault();
    options[nextIndex]?.focus();
  });

  select.addEventListener('change', syncValue);
}

document.querySelectorAll('.app-shell select:not([multiple])').forEach(enhanceSingleRolePicker);

document.querySelectorAll('[data-guild-switch]').forEach((select) => {
  select.addEventListener('change', () => {
    if (select.value) navigateDashboard(`/dashboard/${encodeURIComponent(select.value)}`);
  });
});

function enhanceRoleListPicker(widget) {
  const field = widget.closest('.setting-field');
  const valueInput = field?.querySelector('[data-role-list-value]');
  const search = widget.querySelector('[data-role-search]');
  const list = widget.querySelector('[data-role-options]');
  const chips = widget.querySelector('[data-role-chips]');
  if (!field || !valueInput || !search || !list || !chips) return;

  const label = field.querySelector('.setting-label');
  const options = [...list.querySelectorAll('[data-role-option]')];
  const selected = new Set(valueInput.value.split(',').map((id) => id.trim()).filter(Boolean));
  const emptyState = makeElement('p', 'role-picker__empty', 'No matching roles.');
  emptyState.hidden = true;

  valueInput.type = 'hidden';
  widget.hidden = false;
  search.id ||= `${valueInput.id}-search`;
  if (label) label.htmlFor = search.id;
  list.append(emptyState);

  const update = () => {
    valueInput.value = [...selected].join(',');
    for (const option of options) {
      option.setAttribute('aria-selected', String(selected.has(option.dataset.roleId)));
    }

    chips.replaceChildren();
    for (const option of options) {
      if (!selected.has(option.dataset.roleId)) continue;
      const chip = makeElement('span', 'role-list-widget__chip');
      const name = makeElement('span', '', option.dataset.roleName);
      const remove = makeElement('button', '', '×');
      remove.type = 'button';
      remove.setAttribute('aria-label', `Remove ${option.dataset.roleName} role`);
      remove.addEventListener('click', () => {
        selected.delete(option.dataset.roleId);
        update();
        search.focus();
      });
      chip.append(name, remove);
      chips.append(chip);
    }
  };

  const filter = () => {
    const query = search.value.trim().toLocaleLowerCase();
    let visibleCount = 0;
    for (const option of options) {
      option.hidden = !`${option.dataset.roleName} ${option.dataset.roleId}`.toLocaleLowerCase().includes(query);
      if (!option.hidden) visibleCount += 1;
    }
    emptyState.hidden = visibleCount > 0;
  };

  list.addEventListener('click', (event) => {
    const option = event.target.closest('[data-role-option]');
    if (!option) return;
    const id = option.dataset.roleId;
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    update();
  });

  search.addEventListener('input', filter);
  search.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      [...list.querySelectorAll('[data-role-option]')].find((option) => !option.hidden)?.focus();
    }
  });

  list.addEventListener('keydown', (event) => {
    const visibleOptions = options.filter((option) => !option.hidden);
    const index = visibleOptions.indexOf(event.target);
    let nextIndex = index;
    if (event.key === 'ArrowDown') nextIndex = Math.min(index + 1, visibleOptions.length - 1);
    else if (event.key === 'ArrowUp') nextIndex = Math.max(index - 1, 0);
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = visibleOptions.length - 1;
    else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.target.click();
      return;
    } else if (event.key === 'Escape') {
      event.preventDefault();
      search.focus();
      return;
    } else {
      return;
    }
    event.preventDefault();
    visibleOptions[nextIndex]?.focus();
  });

  update();
  filter();
}

document.querySelectorAll('[data-role-multiselect]').forEach(enhanceRoleListPicker);

document.querySelectorAll('.settings-form').forEach((form) => {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector('[data-save-button]');
    if (!submitButton) return;

    let status = form.querySelector('[data-form-status]');
    if (!status) {
      status = makeElement('p', 'form-save-status');
      status.dataset.formStatus = '';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      form.querySelector('.form-actions')?.prepend(status);
    }

    submitButton.disabled = true;
    submitButton.dataset.saveState = 'saving';
    submitButton.setAttribute('aria-label', 'Saving settings');
    status.textContent = 'Saving your settings.';

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(new FormData(form)),
      });
      if (!response.ok) throw new Error(`Settings save returned HTTP ${response.status}`);
      if (new URL(response.url).pathname !== new URL(form.action, window.location.href).pathname) {
        throw new Error('The session expired before the settings could be saved.');
      }
      submitButton.dataset.saveState = 'saved';
      submitButton.setAttribute('aria-label', 'Settings saved');
      status.textContent = 'Your settings have been saved.';
      showToast('Settings saved', 'success');
    } catch (error) {
      console.error('[dashboard] Unable to save module settings:', error);
      submitButton.dataset.saveState = 'error';
      submitButton.setAttribute('aria-label', 'Save failed');
      status.textContent = 'The settings could not be saved. Please try again.';
      showToast('Could not save settings. Please try again.', 'error');
    } finally {
      window.setTimeout(() => {
        submitButton.dataset.saveState = 'idle';
        submitButton.setAttribute('aria-label', submitButton.dataset.defaultLabel);
        submitButton.disabled = false;
      }, 1800);
    }
  });
});

const permissionSearch = document.querySelector('[data-permission-search]');
if (permissionSearch) {
  const matrix = document.querySelector('[data-role-matrix]');
  const emptyState = document.querySelector('[data-permission-empty]');
  const rows = [...document.querySelectorAll('[data-role-row]')];
  const columns = [...document.querySelectorAll('[data-command-column]')];
  const cells = [...document.querySelectorAll('[data-command-cell]')];

  permissionSearch.addEventListener('input', () => {
    const query = permissionSearch.value.trim().toLocaleLowerCase();
    const matchingCommands = columns.filter((column) => column.dataset.commandColumn.toLocaleLowerCase().includes(query));
    const filterCommands = query.length > 0 && matchingCommands.length > 0;
    let visibleRows = 0;

    for (const column of columns) {
      column.hidden = filterCommands && !matchingCommands.includes(column);
    }
    for (const cell of cells) {
      cell.hidden = filterCommands && !matchingCommands.some((column) => column.dataset.commandColumn === cell.dataset.commandCell);
    }
    for (const row of rows) {
      const roleMatches = row.dataset.roleName.toLocaleLowerCase().includes(query);
      row.hidden = Boolean(query) && !roleMatches && !filterCommands;
      if (!row.hidden) visibleRows += 1;
    }
    if (emptyState) emptyState.hidden = visibleRows > 0 || (filterCommands && columns.length > 0);
    if (matrix) matrix.classList.toggle('is-filtered', Boolean(query));
  });
}

function getPermissionStatus() {
  let status = document.querySelector('[data-permission-status]');
  if (!status) {
    status = makeElement('p', 'permission-save-status');
    status.dataset.permissionStatus = '';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    document.querySelector('.permissions-page')?.append(status);
  }
  return status;
}

document.querySelectorAll('.permission-toggle input, .role-command-row input').forEach((input) => {
  input.addEventListener('change', async () => {
    const control = input.closest('[data-role][data-cmd]');
    if (!control) return;
    const { role, cmd } = control.dataset;
    const guildId = document.querySelector('.permissions-page')?.dataset.guildId;
    if (!guildId) {
      console.error('[dashboard] Cannot save role permission without a guild ID.');
      input.checked = !input.checked;
      getPermissionStatus().textContent = 'Could not save this permission because the guild is unavailable.';
      showToast('Could not save this permission.', 'error');
      return;
    }
    const previousValue = !input.checked;
    const status = getPermissionStatus();
    input.disabled = true;
    status.textContent = `Saving /${cmd} permission.`;

    try {
      const response = await fetch(`/admin/${encodeURIComponent(guildId)}/roles/${encodeURIComponent(role)}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ command_name: cmd, allowed: String(input.checked) }),
      });
      if (!response.ok) throw new Error(`Permission save returned HTTP ${response.status}`);
      if (new URL(response.url).pathname !== `/admin/${encodeURIComponent(guildId)}/roles/${encodeURIComponent(role)}`) {
        throw new Error('The session expired before the permission could be saved.');
      }
      status.textContent = `Permission for /${cmd} saved.`;
      showToast(`/${cmd} permission saved`, 'success');
    } catch (error) {
      console.error('[dashboard] Unable to save role permission:', error);
      input.checked = previousValue;
      status.textContent = `Could not save /${cmd}. Try again.`;
      showToast(`Could not save /${cmd} permission.`, 'error');
    } finally {
      input.disabled = false;
    }
  });
});

const queryParams = new URLSearchParams(window.location.search);
if (queryParams.get('saved') === '1') {
  const flash = makeElement('div', 'flash flash--success', 'Settings saved successfully.');
  flash.setAttribute('role', 'status');
  document.querySelector('.workspace')?.prepend(flash);
  window.setTimeout(() => flash.remove(), 3500);
}

function saveReadRelease(guildId, version) {
  const key = `easySupport:release-read:${guildId}`;
  try {
    const storedVersions = JSON.parse(window.localStorage.getItem(key) || '[]');
    if (!Array.isArray(storedVersions)) throw new Error('Stored release read state is not a list.');
    const readVersions = new Set(storedVersions.filter((storedVersion) => typeof storedVersion === 'string'));
    readVersions.add(version);
    window.localStorage.setItem(key, JSON.stringify([...readVersions]));
    return true;
  } catch (error) {
    console.error('[dashboard] Could not store release read state:', error);
    return false;
  }
}

function isReleaseRead(guildId, version) {
  try {
    const readVersions = JSON.parse(window.localStorage.getItem(`easySupport:release-read:${guildId}`) || '[]');
    return Array.isArray(readVersions) && readVersions.includes(version);
  } catch (error) {
    console.error('[dashboard] Could not load release read state:', error);
    return false;
  }
}

document.querySelectorAll('[data-release-indicator]').forEach((indicator) => {
  const { guildId, releaseId } = indicator.dataset;
  if (guildId && releaseId && isReleaseRead(guildId, releaseId)) indicator.hidden = true;
});

document.querySelectorAll('[data-release-notice], [data-release-card]').forEach((release) => {
  const { guildId, releaseId } = release.dataset;
  if (guildId && releaseId && isReleaseRead(guildId, releaseId) && release.matches('[data-release-notice]')) {
    release.hidden = true;
  }

  release.querySelectorAll('[data-dismiss-release], [data-mark-release]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!guildId || !releaseId || !saveReadRelease(guildId, releaseId)) return;
      document.querySelectorAll('[data-release-indicator]').forEach((indicator) => {
        if (indicator.dataset.guildId === guildId && indicator.dataset.releaseId === releaseId) indicator.hidden = true;
      });
      if (release.matches('[data-release-notice]')) {
        release.hidden = true;
      } else {
        button.textContent = 'Read';
        button.disabled = true;
      }
    });
  });
});

function initialiseMotion() {
  const { gsap, ScrollTrigger } = window;
  if (!gsap || !ScrollTrigger || reducedMotion.matches) return;

  gsap.registerPlugin(ScrollTrigger);
  gsap.utils.toArray('[data-reveal]').forEach((element) => {
    gsap.fromTo(element, { autoAlpha: 0, y: 17 }, {
      autoAlpha: 1,
      y: 0,
      duration: .55,
      ease: 'power2.out',
      scrollTrigger: { trigger: element, start: 'top 91%', once: true },
    });
  });

  gsap.utils.toArray('[data-product-visual] img').forEach((image) => {
    gsap.fromTo(image, { scale: 1.04 }, {
      scale: 1,
      ease: 'none',
      scrollTrigger: {
        trigger: image.closest('[data-product-visual]'),
        start: 'top bottom',
        end: 'bottom top',
        scrub: .8,
      },
    });
  });

  const media = gsap.matchMedia();
  media.add('(min-width: 1000px) and (min-height: 680px) and (prefers-reduced-motion: no-preference)', () => {
    const section = document.querySelector('.product-story');
    const backCard = document.querySelector('[data-story-card="back"]');
    const frontCard = document.querySelector('[data-story-card="front"]');
    if (!section || !backCard || !frontCard) return undefined;

    const timeline = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: 'top top+=28',
        end: '+=620',
        scrub: .7,
        pin: section,
        anticipatePin: 1,
      },
    });
    timeline.fromTo(backCard, { x: 28, y: 30, scale: .9, rotation: 3, autoAlpha: .65 }, {
      x: 0,
      y: -13,
      scale: .97,
      rotation: 0,
      autoAlpha: 1,
    }, 0);
    timeline.fromTo(frontCard, { y: 36, scale: .93 }, { y: -9, scale: 1 }, .08);
    return () => timeline.scrollTrigger?.kill();
  });
}

initialiseMotion();
}

async function navigateDashboard(url, { replace = false, restoreScroll = false } = {}) {
  const target = new URL(url, window.location.href);
  if (target.origin !== window.location.origin) {
    window.location.assign(target.href);
    return;
  }

  const shell = document.querySelector('.app-shell');
  if (!shell) {
    window.location.assign(target.href);
    return;
  }
  navigationController?.abort();
  const controller = new AbortController();
  navigationController = controller;
  const nextGuildId = target.pathname.match(/^\/dashboard\/([^/]+)/)?.[1] ?? '';
  const isChangingGuild = Boolean(nextGuildId && nextGuildId !== shell.dataset.guildId);
  const serverLoader = shell.querySelector('[data-server-loading]');

  shell.setAttribute('aria-busy', 'true');
  shell.classList.add('is-navigating');
  if (isChangingGuild && serverLoader) {
    serverLoader.hidden = false;
    serverLoader.setAttribute('aria-hidden', 'false');
  }

  try {
    const response = await fetch(target.href, {
      headers: { Accept: 'text/html', 'X-Requested-With': 'XMLHttpRequest' },
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
    });
    if (!response.ok) throw new Error(`Page navigation returned HTTP ${response.status}`);
    if (response.redirected && new URL(response.url).pathname.startsWith('/login')) {
      window.location.assign(response.url);
      return;
    }

    const nextDocument = new DOMParser().parseFromString(await response.text(), 'text/html');
    const nextShell = nextDocument.querySelector('.app-shell');
    if (!nextShell) throw new Error('The requested page did not contain the dashboard shell.');

    shell.replaceWith(nextShell);
    document.title = nextDocument.title;
    if (replace) history.replaceState({}, '', target.href);
    else if (!restoreScroll) history.pushState({}, '', target.href);

    const { gsap, ScrollTrigger } = window;
    if (gsap && ScrollTrigger) ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    initialiseWorkspace();
    if (restoreScroll) window.scrollTo({ top: 0, behavior: 'instant' });
    else window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
    const heading = nextShell.querySelector('.workspace h1');
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  } catch (error) {
    if (controller.signal.aborted) return;
    if (serverLoader) {
      serverLoader.hidden = true;
      serverLoader.setAttribute('aria-hidden', 'true');
    }
    console.error('[dashboard] In-app navigation failed; falling back to a full page load:', error);
    window.location.assign(target.href);
  }
}

document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href]');
  if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (!link.closest('.app-shell') || link.target || link.hasAttribute('download')) return;

  const target = new URL(link.href, window.location.href);
  if (target.origin !== window.location.origin) return;
  if (!/^\/(?:dashboard|admin)\//.test(target.pathname)) return;
  if (target.pathname === window.location.pathname && target.search === window.location.search) {
    event.preventDefault();
    return;
  }

  event.preventDefault();
  navigateDashboard(target.href);
});

document.addEventListener('pointerdown', (event) => {
  document.querySelectorAll('.role-picker.is-open').forEach((wrapper) => {
    if (!wrapper.contains(event.target)) wrapper.dispatchEvent(new Event('picker:close'));
  });
});

document.addEventListener('keydown', (event) => {
  const target = event.target;
  const isEditing = target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
  if (event.key === '/' && !isEditing && !event.metaKey && !event.ctrlKey && !event.altKey) {
    const search = document.querySelector('[data-module-search]');
    if (search) {
      event.preventDefault();
      search.focus();
    }
  }
});

window.addEventListener('popstate', () => {
  navigateDashboard(window.location.href, { replace: true, restoreScroll: true });
});

initialiseWorkspace();
