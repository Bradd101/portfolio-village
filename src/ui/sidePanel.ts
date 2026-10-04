import { siteContent } from '../content';
import { ICONS } from './icons';
import { loadProfile, saveProfile, type PlayerProfile } from './profile';

// Escapes text dropped into innerHTML templates. The player name is the only
// user-typed value rendered this way, so this guards against someone naming
// their character something like "><script>...
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export type ItemKey =
  | 'logs'
  | 'oakLogs'
  | 'mapleLogs'
  | 'shrimp'
  | 'sardine'
  | 'trout'
  | 'salmon'
  | 'cookedShrimp'
  | 'cookedSardine'
  | 'cookedTrout'
  | 'cookedSalmon'
  | 'copperOre'
  | 'tinOre'
  | 'ironOre'
  | 'silverOre'
  | 'goldOre'
  | 'gem';
export type Tab = 'inventory' | 'skills' | 'customize';
export type ArmorTier = 'none' | 'bronze' | 'iron' | 'steel';

// Independent equipment slots, each chosen separately so the player can mix
// and match (e.g. a steel chestplate with a cloth skirt).
export type EquipSlot = 'hat' | 'cape' | 'body' | 'legs' | 'weapon';

export interface CustomizeChange {
  shirt?: number;
  skin?: number;
  name?: string;
  equip?: { slot: EquipSlot; option: string };
}

export const EQUIP_SLOTS: { slot: EquipSlot; label: string }[] = [
  { slot: 'hat', label: 'Head' },
  { slot: 'cape', label: 'Cape' },
  { slot: 'body', label: 'Body' },
  { slot: 'legs', label: 'Legs' },
  { slot: 'weapon', label: 'Weapon' },
];

// Each slot's options. 'none' is always first. `swatch` tints the option chip.
export const EQUIP_OPTIONS: Record<EquipSlot, { id: string; label: string; swatch: string }[]> = {
  hat: [
    { id: 'none', label: 'None', swatch: '#5a564c' },
    { id: 'bronzeHelm', label: 'Bronze helm', swatch: '#c87f4a' },
    { id: 'ironHelm', label: 'Iron helm', swatch: '#8a8a8a' },
    { id: 'steelHelm', label: 'Steel helm', swatch: '#c3d4de' },
    { id: 'wizardHat', label: 'Wizard hat', swatch: '#5a3b9c' },
  ],
  cape: [
    { id: 'none', label: 'None', swatch: '#5a564c' },
    { id: 'red', label: 'Red cape', swatch: '#b23a2a' },
    { id: 'blue', label: 'Blue cape', swatch: '#2f5fb0' },
    { id: 'green', label: 'Green cape', swatch: '#3a8a3a' },
    { id: 'gold', label: 'Gold cape', swatch: '#d4af37' },
  ],
  body: [
    { id: 'none', label: 'None', swatch: '#5a564c' },
    { id: 'bronzeBody', label: 'Bronze plate', swatch: '#c87f4a' },
    { id: 'ironBody', label: 'Iron plate', swatch: '#8a8a8a' },
    { id: 'steelBody', label: 'Steel plate', swatch: '#c3d4de' },
  ],
  legs: [
    { id: 'none', label: 'None', swatch: '#5a564c' },
    { id: 'bronzeLegs', label: 'Bronze legs', swatch: '#c87f4a' },
    { id: 'ironLegs', label: 'Iron legs', swatch: '#8a8a8a' },
    { id: 'steelLegs', label: 'Steel legs', swatch: '#c3d4de' },
    { id: 'skirt', label: 'Cloth skirt', swatch: '#8a5a9c' },
  ],
  weapon: [
    { id: 'none', label: 'None', swatch: '#5a564c' },
    { id: 'bronzeSword', label: 'Bronze sword', swatch: '#c87f4a' },
    { id: 'ironSword', label: 'Iron sword', swatch: '#8a8a8a' },
    { id: 'steelSword', label: 'Steel sword', swatch: '#c3d4de' },
    { id: 'waterStaff', label: 'Water staff', swatch: '#3b9fe0' },
    { id: 'fireStaff', label: 'Fire staff', swatch: '#e0541a' },
    { id: 'whip', label: 'Obey whip', swatch: '#1c1c1c' },
  ],
};

// Actions the player can take on an inventory item. 'use' means "light a fire"
// for logs; raw fish are cooked by using them on a fire out in the world.
export type ItemAction = 'drop' | 'light' | 'eat';

const ITEM_META: Record<ItemKey, { name: string }> = {
  logs: { name: 'Logs' },
  oakLogs: { name: 'Oak logs' },
  mapleLogs: { name: 'Maple logs' },
  shrimp: { name: 'Raw shrimp' },
  sardine: { name: 'Raw sardine' },
  trout: { name: 'Raw trout' },
  salmon: { name: 'Raw salmon' },
  cookedShrimp: { name: 'Shrimp' },
  cookedSardine: { name: 'Sardine' },
  cookedTrout: { name: 'Trout' },
  cookedSalmon: { name: 'Salmon' },
  copperOre: { name: 'Copper ore' },
  tinOre: { name: 'Tin ore' },
  ironOre: { name: 'Iron ore' },
  silverOre: { name: 'Silver ore' },
  goldOre: { name: 'Gold ore' },
  gem: { name: 'Shiny gem' },
};

export const ITEM_LABELS: Record<ItemKey, string> = Object.fromEntries(
  (Object.entries(ITEM_META) as [ItemKey, { name: string }][]).map(([k, v]) => [k, v.name])
) as Record<ItemKey, string>;

const LOG_KEYS: ItemKey[] = ['logs', 'oakLogs', 'mapleLogs'];

// Raw fish key -> its cooked counterpart, used by the fireplace interaction.
const COOK_MAP: Partial<Record<ItemKey, ItemKey>> = {
  shrimp: 'cookedShrimp',
  sardine: 'cookedSardine',
  trout: 'cookedTrout',
  salmon: 'cookedSalmon',
};

// The cooked fish you can eat (the values of COOK_MAP).
const COOKED_FISH_KEYS: ItemKey[] = Object.values(COOK_MAP) as ItemKey[];

export const SHIRT_SWATCHES = [0xe58b3c, 0x4a90d9, 0x8a2222, 0x2f6b2f, 0x7a4ab0, 0x2b2118];
export const SKIN_SWATCHES = [0xf0c89a, 0xd9a066, 0xa8703e, 0x6b4a2a];

export class SidePanel {
  private root: HTMLDivElement;
  private contentEl: HTMLDivElement;
  private activeTab: Tab | null = null;
  private inventory: Partial<Record<ItemKey, number>> = {};
  private onCustomizeCb: ((change: CustomizeChange) => void) | null = null;

  private playerName = 'Adventurer';
  private equipment: Record<EquipSlot, string> = {
    hat: 'none',
    cape: 'none',
    body: 'none',
    legs: 'none',
    weapon: 'none',
  };
  // Chosen shirt/skin colours (null = keep the character's built-in default).
  private shirt: number | null = null;
  private skin: number | null = null;
  private onItemActionCb: ((action: ItemAction, key: ItemKey) => void) | null = null;
  private openMenuKey: ItemKey | null = null;

  constructor() {
    // Restore any saved customization from a previous visit.
    const saved = loadProfile();
    if (saved.name) this.playerName = saved.name;
    if (saved.equipment) this.equipment = { ...this.equipment, ...saved.equipment };
    this.shirt = saved.shirt ?? null;
    this.skin = saved.skin ?? null;

    this.root = document.createElement('div');
    this.root.id = 'side-panel';

    this.contentEl = document.createElement('div');
    this.contentEl.className = 'sp-content';

    const tabs = document.createElement('div');
    tabs.className = 'sp-tabs';
    tabs.append(
      this.makeTabBtn('Inventory', 'inventory'),
      this.makeTabBtn('Skills', 'skills'),
      this.makeTabBtn('Customize', 'customize')
    );

    this.root.append(this.contentEl, tabs);
    document.body.appendChild(this.root);
  }

  onCustomize(cb: (change: CustomizeChange) => void) {
    this.onCustomizeCb = cb;
  }

  // The current customization, so the 3D scene can apply saved values on boot.
  getProfile(): PlayerProfile {
    return {
      name: this.playerName,
      shirt: this.shirt ?? undefined,
      skin: this.skin ?? undefined,
      equipment: { ...this.equipment },
    };
  }

  onItemAction(cb: (action: ItemAction, key: ItemKey) => void) {
    this.onItemActionCb = cb;
  }

  addItem(key: ItemKey, qty = 1) {
    this.inventory[key] = (this.inventory[key] ?? 0) + qty;
    if (this.activeTab === 'inventory') this.render();
  }

  hasItem(key: ItemKey): boolean {
    return (this.inventory[key] ?? 0) > 0;
  }

  removeItem(key: ItemKey, qty = 1) {
    const current = this.inventory[key] ?? 0;
    this.inventory[key] = Math.max(0, current - qty);
    if (this.activeTab === 'inventory') this.render();
  }

  // Converts every raw fish in the inventory to its cooked counterpart.
  // Returns the display names of what got cooked, for the caller to toast.
  cookRawFish(): string[] {
    const cooked: string[] = [];
    for (const [rawKey, cookedKey] of Object.entries(COOK_MAP) as [ItemKey, ItemKey][]) {
      const qty = this.inventory[rawKey] ?? 0;
      if (qty <= 0) continue;
      this.inventory[rawKey] = 0;
      this.inventory[cookedKey] = (this.inventory[cookedKey] ?? 0) + qty;
      cooked.push(`${qty} ${ITEM_META[cookedKey].name.toLowerCase()}`);
    }
    if (cooked.length > 0 && this.activeTab === 'inventory') this.render();
    return cooked;
  }

  private makeTabBtn(label: string, tab: Tab) {
    const btn = document.createElement('button');
    btn.className = 'sp-tab-btn';
    btn.textContent = label;
    btn.addEventListener('click', () => {
      this.activeTab = this.activeTab === tab ? null : tab;
      this.render();
    });
    return btn;
  }

  private render() {
    this.contentEl.classList.toggle('visible', this.activeTab !== null);
    if (this.activeTab === 'inventory') {
      this.contentEl.innerHTML = this.renderInventory();
      this.wireInventory();
    } else if (this.activeTab === 'skills') {
      this.contentEl.innerHTML = this.renderSkills();
    } else if (this.activeTab === 'customize') {
      this.contentEl.innerHTML = this.renderCustomize();
      this.wireCustomize();
    }
  }

  private renderInventory(): string {
    const entries = (Object.entries(this.inventory) as [ItemKey, number][]).filter(([, qty]) => qty > 0);
    if (!entries.some(([key]) => key === this.openMenuKey)) this.openMenuKey = null;

    const slots = entries.map(
      ([key, qty]) => `
      <div class="inv-slot${key === this.openMenuKey ? ' selected' : ''}" data-key="${key}" title="${ITEM_META[key].name}">
        <div class="inv-icon" style="background-image:url(${ICONS[key]})"></div>
        <div class="inv-qty">${qty}</div>
      </div>`
    );
    while (slots.length < 28) slots.push('<div class="inv-slot empty"></div>');

    let menu = '';
    if (this.openMenuKey) {
      const key = this.openMenuKey;
      const actions: string[] = [];
      if (LOG_KEYS.includes(key))
        actions.push('<button class="inv-action" data-action="light">Light a fire</button>');
      if (COOKED_FISH_KEYS.includes(key))
        actions.push('<button class="inv-action" data-action="eat">Eat</button>');
      actions.push('<button class="inv-action" data-action="drop">Drop</button>');
      menu = `<div class="inv-menu"><span class="inv-menu-name">${ITEM_META[key].name}</span>${actions.join('')}</div>`;
    }

    const hint = entries.length
      ? '<p class="inv-hint">Tap an item for options.</p>'
      : '<p class="inv-hint">Empty. Chop trees and fish the pond to gather items.</p>';

    return `<h3>Inventory</h3><div class="inv-grid">${slots.join('')}</div>${menu}${hint}`;
  }

  private wireInventory() {
    this.contentEl.querySelectorAll<HTMLDivElement>('.inv-slot[data-key]').forEach((slot) => {
      slot.addEventListener('click', () => {
        const key = slot.dataset.key as ItemKey;
        this.openMenuKey = this.openMenuKey === key ? null : key;
        this.render();
      });
    });
    this.contentEl.querySelectorAll<HTMLButtonElement>('.inv-action').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action as ItemAction;
        const key = this.openMenuKey;
        if (!key) return;
        this.openMenuKey = null;
        this.onItemActionCb?.(action, key);
        this.render();
      });
    });
  }

  private renderSkills(): string {
    const totalLevel = siteContent.skillLevels.reduce((sum, s) => sum + s.level, 0);
    const maxTotal = siteContent.skillLevels.length * 99;
    return `
      <h3>Skills</h3>
      <p class="skills-total">Total level: <strong>${totalLevel}</strong> / ${maxTotal}</p>
      <div class="skills-grid">
        ${siteContent.skillLevels
          .map(
            (s) => `
          <div class="skill-tile${s.level >= 99 ? ' maxed' : ''}" title="${s.name}">
            <div class="skill-icon" style="background:${s.color}"></div>
            <div class="skill-info">
              <div class="skill-name">${s.name}</div>
              <div class="skill-level">${s.level}<span class="skill-max">/99</span></div>
            </div>
          </div>`
          )
          .join('')}
      </div>`;
  }

  private renderCustomize(): string {
    const equipRows = EQUIP_SLOTS.map(({ slot, label }) => {
      const options = EQUIP_OPTIONS[slot]
        .map(
          (o) => `
          <button class="equip-btn${o.id === this.equipment[slot] ? ' selected' : ''}" data-slot="${slot}" data-option="${o.id}" title="${o.label}">
            <span class="equip-swatch" style="background:${o.swatch}"></span>
            <span>${o.label}</span>
          </button>`
        )
        .join('');
      return `<p class="sp-sub">${label}</p><div class="equip-row">${options}</div>`;
    }).join('');

    return `
      <h3>Customize</h3>
      <p class="sp-sub">Name</p>
      <input type="text" class="sp-name-input" maxlength="16" value="${escapeHtml(this.playerName)}" placeholder="Adventurer" />
      <p class="sp-sub">Shirt colour</p>
      <div class="swatch-row">
        ${SHIRT_SWATCHES.map((c) => `<button class="swatch${c === this.shirt ? ' selected' : ''}" data-shirt="${c}" style="background:#${c.toString(16).padStart(6, '0')}"></button>`).join('')}
      </div>
      <p class="sp-sub">Skin tone</p>
      <div class="swatch-row">
        ${SKIN_SWATCHES.map((c) => `<button class="swatch${c === this.skin ? ' selected' : ''}" data-skin="${c}" style="background:#${c.toString(16).padStart(6, '0')}"></button>`).join('')}
      </div>
      ${equipRows}
    `;
  }

  private wireCustomize() {
    const nameInput = this.contentEl.querySelector<HTMLInputElement>('.sp-name-input');
    nameInput?.addEventListener('change', () => {
      const trimmed = nameInput.value.trim();
      this.playerName = trimmed || 'Adventurer';
      nameInput.value = this.playerName;
      this.onCustomizeCb?.({ name: this.playerName });
      saveProfile({ name: this.playerName });
    });

    this.contentEl.querySelectorAll<HTMLButtonElement>('.swatch[data-shirt]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.shirt = Number(btn.dataset.shirt);
        this.contentEl.querySelectorAll('.swatch[data-shirt]').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.onCustomizeCb?.({ shirt: this.shirt });
        saveProfile({ shirt: this.shirt });
      });
    });
    this.contentEl.querySelectorAll<HTMLButtonElement>('.swatch[data-skin]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.skin = Number(btn.dataset.skin);
        this.contentEl.querySelectorAll('.swatch[data-skin]').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.onCustomizeCb?.({ skin: this.skin });
        saveProfile({ skin: this.skin });
      });
    });
    this.contentEl.querySelectorAll<HTMLButtonElement>('.equip-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const slot = btn.dataset.slot as EquipSlot;
        const option = btn.dataset.option as string;
        this.equipment[slot] = option;
        this.contentEl
          .querySelectorAll(`.equip-btn[data-slot="${slot}"]`)
          .forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.onCustomizeCb?.({ equip: { slot, option } });
        saveProfile({ equipment: { [slot]: option } });
      });
    });
  }
}
