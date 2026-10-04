// Persists the player's character customization (name, colours, equipment) to
// localStorage so it survives a page reload. Everything here fails soft: if
// storage is unavailable (private browsing, quota, etc.) the site still works,
// customization just won't stick between visits.

export interface PlayerProfile {
  name?: string;
  shirt?: number;
  skin?: number;
  equipment?: Record<string, string>;
}

const STORAGE_KEY = 'village-profile';

export function loadProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as PlayerProfile) : {};
  } catch {
    return {};
  }
}

// Shallow-merges a patch into the stored profile; equipment is merged per slot
// so changing one slot doesn't wipe the others.
export function saveProfile(patch: PlayerProfile): void {
  try {
    const current = loadProfile();
    const next: PlayerProfile = { ...current, ...patch };
    if (patch.equipment) next.equipment = { ...current.equipment, ...patch.equipment };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable; skip persistence
  }
}
