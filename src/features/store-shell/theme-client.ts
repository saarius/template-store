export type Appearance = 'system' | 'light' | 'dark';
export const APPEARANCE_KEY = 'backroadbum.theme';
export function appearance(value: unknown): Appearance {
  return value === 'light' || value === 'dark' ? value : 'system';
}

/** Preference persistence is optional; a storage refusal must never break shopping. */
export function saveAppearance(storage: Pick<Storage, 'setItem' | 'removeItem'>, mode: Appearance): boolean {
  try {
    if (mode === 'system') storage.removeItem(APPEARANCE_KEY);
    else storage.setItem(APPEARANCE_KEY, mode);
    return true;
  } catch { return false; }
}

export function hydrateStoreTheme(): void {
  const root = document.documentElement;
  const controls = document.querySelectorAll<HTMLSelectElement>('[data-theme-select]');
  const sync = (mode: Appearance) => {
    root.dataset.theme = mode;
    for (const select of controls) select.value = mode;
  };
  sync(appearance(root.dataset.theme));
  for (const select of controls) {
    if (select.dataset.themeBound) continue;
    select.dataset.themeBound = 'true';
    select.addEventListener('change', () => {
      const mode = appearance(select.value);
      sync(mode);
      const persisted = saveAppearance(localStorageSafe(), mode);
      const message = select.closest('[data-theme-control]')?.querySelector('[data-theme-message]');
      if (message) message.textContent = persisted ? '' : 'Applied for this page. Your browser couldn’t save the preference.';
    });
    select.closest<HTMLElement>('[data-theme-control]')?.removeAttribute('hidden');
  }
  window.addEventListener('storage', event => {
    if (event.key === APPEARANCE_KEY || event.key === null) sync(appearance(event.newValue));
  });
}

function localStorageSafe(): Pick<Storage, 'setItem' | 'removeItem'> {
  try { return window.localStorage; }
  catch { return { setItem() { throw Error('Storage unavailable'); }, removeItem() { throw Error('Storage unavailable'); } }; }
}
