const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

document.querySelectorAll('[data-guild-switch]').forEach((select) => {
  select.addEventListener('change', () => {
    if (select.value) window.location.assign(`/dashboard/${encodeURIComponent(select.value)}`);
  });
});

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

  document.addEventListener('keydown', (event) => {
    const target = event.target;
    const isEditing = target instanceof HTMLElement &&
      (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

    if (event.key === '/' && !isEditing && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      moduleSearch.focus();
    }
  });
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function enhanceSingleRolePicker(select) {
  if (!select.id || select.dataset.enhanced === 'true') return;

  const wrapper = makeElement('div', 'role-picker');
  const trigger = makeElement('button', 'role-picker__trigger');
  const value = makeElement('span', 'role-picker__value');
  const chevron = makeElement('span', 'role-picker__chevron');
  const panel = makeElement('div', 'role-picker__panel');
  const search = makeElement('input', 'role-picker__search');
  const optionList = makeElement('div', 'role-picker__options');
  const emptyState = makeElement('p', 'role-picker__empty', 'No matching roles.');
  const form = select.form ?? document;
  const label = [...form.querySelectorAll('label[for]')].find((item) => item.htmlFor === select.id);
  const triggerId = `${select.id}-picker`;
  const listId = `${select.id}-options`;

  wrapper.dataset.rolePicker = 'enhanced';
  trigger.type = 'button';
  trigger.id = triggerId;
  trigger.setAttribute('role', 'combobox');
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', listId);
  value.textContent = select.selectedOptions[0]?.textContent?.trim() || 'Select a role';
  trigger.append(value, chevron);
  search.type = 'search';
  search.placeholder = 'Search server roles';
  search.autocomplete = 'off';
  search.setAttribute('aria-label', 'Search server roles');
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
  }

  const syncValue = () => {
    value.textContent = select.selectedOptions[0]?.textContent?.trim() || 'Select a role';
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
      option.hidden = !option.textContent.toLocaleLowerCase().includes(query);
      if (!option.hidden) visibleCount += 1;
    }
    emptyState.hidden = visibleCount > 0;
  });

  search.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      [...optionList.children].find((option) => !option.hidden)?.focus();
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
  document.addEventListener('click', (event) => {
    if (!wrapper.contains(event.target) && !panel.hidden) close();
  });
}

document.querySelectorAll('select[data-role-picker="single"]').forEach(enhanceSingleRolePicker);

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
    const submitButton = form.querySelector('button[type="submit"]');
    if (!submitButton) return;

    let status = form.querySelector('[data-form-status]');
    if (!status) {
      status = makeElement('p', 'form-save-status');
      status.dataset.formStatus = '';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      form.querySelector('.form-actions')?.prepend(status);
    }

    const originalLabel = submitButton.textContent;
    submitButton.textContent = 'Saving changes…';
    submitButton.disabled = true;
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
      submitButton.textContent = 'Settings saved';
      submitButton.classList.add('button--saved');
      status.textContent = 'Your settings have been saved.';
    } catch (error) {
      console.error('[dashboard] Unable to save module settings:', error);
      submitButton.textContent = 'Save failed';
      status.textContent = 'The settings could not be saved. Please try again.';
    } finally {
      window.setTimeout(() => {
        submitButton.textContent = originalLabel;
        submitButton.classList.remove('button--saved');
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
    } catch (error) {
      console.error('[dashboard] Unable to save role permission:', error);
      input.checked = previousValue;
      status.textContent = `Could not save /${cmd}. Try again.`;
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
