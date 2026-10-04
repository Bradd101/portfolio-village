import * as THREE from 'three';
import { ContentPanel, type PanelType } from '../ui/panel';
import { VillagerChat } from '../ui/villagerChat';
import { SidePanel, ITEM_LABELS, type EquipSlot, type ItemKey } from '../ui/sidePanel';
import { ICONS } from '../ui/icons';
import { showToast } from '../ui/toast';
import type { PlayerProfile } from '../ui/profile';
import { pickWeighted } from '../game/random';
import { slideCircleOutOfBox } from '../game/collision';

// Material colours shared by equipment pieces.
const METAL_COLORS: Record<string, number> = {
  bronze: 0xc87f4a,
  iron: 0x8a8a8a,
  steel: 0xc3d4de,
};
const GOLD_TRIM = 0xd4af37;

type TreeKind = 'normal' | 'oak' | 'maple';

const TREE_KIND_META: Record<
  TreeKind,
  {
    trunkColor: number;
    leafColor: number;
    scale: number;
    logItem: ItemKey;
    logName: string;
    treeLabel: string;
  }
> = {
  normal: {
    trunkColor: 0x6b4226,
    leafColor: 0x2f6b2f,
    scale: 1,
    logItem: 'logs',
    logName: 'logs',
    treeLabel: 'tree',
  },
  oak: {
    trunkColor: 0x4a3018,
    leafColor: 0x3a5c24,
    scale: 1.25,
    logItem: 'oakLogs',
    logName: 'oak logs',
    treeLabel: 'oak tree',
  },
  maple: {
    trunkColor: 0x5a2e14,
    leafColor: 0x8a4a2a,
    scale: 1.15,
    logItem: 'mapleLogs',
    logName: 'maple logs',
    treeLabel: 'maple tree',
  },
};

const FISH_TABLE: { key: ItemKey; label: string; weight: number }[] = [
  { key: 'shrimp', label: 'raw shrimp', weight: 40 },
  { key: 'sardine', label: 'raw sardine', weight: 30 },
  { key: 'trout', label: 'raw trout', weight: 20 },
  { key: 'salmon', label: 'raw salmon', weight: 10 },
];

type OreKind = 'copper' | 'tin' | 'iron' | 'silver' | 'gold';

const ORE_META: Record<
  OreKind,
  { rockColor: number; oreColor: number; item: ItemKey; label: string; yieldChance: number }
> = {
  copper: {
    rockColor: 0x8a7a66,
    oreColor: 0xc87f4a,
    item: 'copperOre',
    label: 'copper ore',
    yieldChance: 0.55,
  },
  tin: { rockColor: 0x8a7a66, oreColor: 0xb8c0c8, item: 'tinOre', label: 'tin ore', yieldChance: 0.55 },
  iron: { rockColor: 0x7a6e60, oreColor: 0x9a5a44, item: 'ironOre', label: 'iron ore', yieldChance: 0.42 },
  silver: {
    rockColor: 0x7a6e60,
    oreColor: 0xc6ccd2,
    item: 'silverOre',
    label: 'silver ore',
    yieldChance: 0.3,
  },
  gold: { rockColor: 0x6e6458, oreColor: 0xd4af37, item: 'goldOre', label: 'gold ore', yieldChance: 0.22 },
};

// A small rocky outcrop (stands in for the mine). Each rock yields one ore type.
const MINING_ROCKS: [number, number, OreKind][] = [
  [34, 7, 'copper'],
  [37, 8, 'tin'],
  [39, 10, 'iron'],
  [35, 11, 'silver'],
  [38, 12, 'gold'],
];
const ROCK_RESPAWN_MS = 8000;

const WORLD_HALF_X = 40;
const WORLD_HALF_Z = 30;
// The visible grass plane reaches far past the walkable bounds so its edge
// always falls beyond the fog and the world never looks like it stops.
const GROUND_VISUAL_HALF = 120;
const PLAYER_SPEED = 6.5;
const PLAYER_RADIUS = 0.4;
const CAM_MIN_DIST = 8;
const CAM_MAX_DIST = 26;
const CAM_ELEVATION = THREE.MathUtils.degToRad(52);
const DRAG_THRESHOLD = 6; // px
// How fast in-world time passes. At 12 a full 24h day takes 2 real minutes.
const WORLD_MINUTES_PER_SECOND = 12;

interface BuildingDef {
  key: string;
  label: string;
  panel: PanelType;
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  wall: number;
  roof: number;
  material: 'stone' | 'wood';
  enterable?: boolean; // if true, built as a walkable interior instead of a solid box
}

const BUILDINGS: BuildingDef[] = [
  {
    key: 'cv',
    label: 'Town Hall (CV)',
    panel: 'cv',
    x: 0,
    z: -16,
    w: 7,
    d: 6,
    h: 5,
    wall: 0x9a9284,
    roof: 0x5a3f28,
    material: 'stone',
  },
  {
    key: 'about',
    label: 'House (About Me)',
    panel: 'about',
    x: -16,
    z: 0,
    w: 9,
    d: 8,
    h: 3.4,
    wall: 0xa86a4a,
    roof: 0x5c3a28,
    material: 'wood',
    enterable: true,
  },
  {
    key: 'projects',
    label: 'Museum (Projects)',
    panel: 'projects',
    x: 16,
    z: 0,
    w: 7.5,
    d: 6.5,
    h: 5.2,
    wall: 0x8e8878,
    roof: 0x5c4a28,
    material: 'stone',
  },
  {
    key: 'contact',
    label: 'Mailbox (Contact)',
    panel: 'contact',
    x: 0,
    z: 16,
    w: 3.5,
    d: 3.5,
    h: 3,
    wall: 0x9a4a3a,
    roof: 0x4a2420,
    material: 'wood',
  },
];

const TREE_SPOTS: [number, number, TreeKind][] = [
  // inner ring near the plaza
  [-9, 9, 'normal'],
  [9, 9, 'oak'],
  [-9, -9, 'maple'],
  [-10, -22, 'normal'],
  [10, -22, 'oak'],
  [-10, 22, 'normal'],
  [10, 22, 'maple'],
  // mid field
  [-24, -18, 'normal'],
  [26, -12, 'normal'],
  [-24, 24, 'normal'],
  [25, 24, 'normal'],
  [18, -12, 'oak'],
  [-22, 12, 'normal'],
  [-20, -14, 'oak'],
  [22, -22, 'normal'],
  // outer / edges, denser woodland feel
  [-30, -22, 'normal'],
  [-34, -6, 'oak'],
  [30, -20, 'normal'],
  [-30, 20, 'oak'],
  [30, 20, 'maple'],
  [-36, -26, 'oak'],
  [-32, -28, 'normal'],
  [-38, -14, 'maple'],
  [-36, 2, 'normal'],
  [-38, 14, 'oak'],
  [-34, 26, 'normal'],
  [-20, 28, 'maple'],
  [-4, 28, 'normal'],
  [8, 28, 'oak'],
  [22, 28, 'normal'],
  [34, 26, 'maple'],
  [38, 16, 'normal'],
  [36, 4, 'oak'],
  [38, -10, 'normal'],
  [34, -16, 'maple'],
  [24, -26, 'oak'],
  [6, -28, 'normal'],
  [-6, -28, 'maple'],
  [-18, -28, 'normal'],
  [36, -24, 'normal'],
];

const POND = { x: 27, z: 13, radius: 3 };

// The cave lives far outside the normal play area (x ~200) so nothing it adds
// to the shared collision/interaction lists can ever reach the village.
const CAVE_ORIGIN = new THREE.Vector3(200, 0, 0);
const CAVE_RADIUS = 9;
// Where the cave mouth sits in the overworld, kept well inside the world
// bounds (not on the edge) in an open patch near the mining area.
const CAVE_ENTRANCE = { x: 33, z: 22 };

interface Obstacle {
  x: number;
  z: number;
  radius: number;
}

// Axis-aligned wall segment; the player slides along it instead of being
// pushed out radially the way a circular obstacle would do.
interface WallBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

// A fire the player has lit from logs. Temporary: it burns out after a while.
interface Fire {
  group: THREE.Group;
  flame: THREE.Mesh;
  light: THREE.PointLight;
  hit: THREE.Mesh;
  bornAt: number;
  x: number;
  z: number;
}

// An item dropped on the ground. Despawns after a short time if not picked up.
interface GroundItem {
  group: THREE.Group;
  key: ItemKey;
  qty: number;
  hit: THREE.Mesh;
  bornAt: number;
}

// A tree instance that can be chopped down and respawns later.
interface TreeInstance {
  id: number;
  group: THREE.Group;
  meshes: THREE.Object3D[];
  x: number;
  z: number;
  kind: TreeKind;
  radius: number;
  alive: boolean;
}

// An ore rock that can be mined out and regenerates later.
interface RockInstance {
  id: number;
  group: THREE.Group;
  meshes: THREE.Object3D[];
  oreMat: THREE.MeshStandardMaterial;
  x: number;
  z: number;
  ore: OreKind;
  radius: number;
  depleted: boolean;
}

const GROUND_ITEM_TTL = 30; // seconds before a dropped item despawns
const FIRE_TTL = 90; // seconds a lit fire lasts
const TREE_RESPAWN_MS = 12000; // how long a chopped tree takes to regrow
const LOG_ITEMS: ItemKey[] = ['logs', 'oakLogs', 'mapleLogs'];
const RAW_FISH_ITEMS: ItemKey[] = ['shrimp', 'sardine', 'trout', 'salmon'];

export class Village {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private container: HTMLElement;

  private player!: THREE.Group;
  private playerShirtMat!: THREE.MeshStandardMaterial;
  private playerSkinMat!: THREE.MeshStandardMaterial;
  private playerArmPivot!: THREE.Object3D;
  private playerArmPivotL!: THREE.Object3D;
  private playerLegL!: THREE.Object3D;
  private playerLegR!: THREE.Object3D;
  private playerHead!: THREE.Mesh;
  private playerTorso!: THREE.Mesh;
  // Walk animation + movement easing state.
  private walkPhase = 0;
  private currentSpeed = 0;
  private playerLabel!: THREE.Sprite;
  private playerName = 'Adventurer';
  // one attached mesh per equipment slot (null when that slot is empty)
  private equipMeshes: Partial<Record<EquipSlot, THREE.Object3D>> = {};
  private equipment: Record<EquipSlot, string> = {
    hat: 'none',
    cape: 'none',
    body: 'none',
    legs: 'none',
    weapon: 'none',
  };
  private heldTool: THREE.Group | null = null;
  private npc!: THREE.Group;
  private npcBase = new THREE.Vector3(4, 0, -4);
  private ground!: THREE.Mesh;
  private interactive: THREE.Object3D[] = [];
  private obstacles: Obstacle[] = [];
  private wallBoxes: WallBox[] = [];
  private gem: THREE.Group | null = null;
  private gemFound = false;

  private moveTarget: THREE.Vector2 | null = null;
  private onArrive: (() => void) | null = null;
  private clickMarker: THREE.Mesh | null = null;
  private clickMarkerAge = 0;
  private clickMarkerTex = new Map<'walk' | 'object', THREE.Texture>();
  private sleeping = false;

  // "Dev energy" from eating cooked fish: a short-lived run-speed boost. Holds
  // the clock time (in seconds) the boost expires at.
  private speedBoostUntil = 0;

  // Honour the OS "reduce motion" accessibility setting: freeze the day/night
  // clock and skip decorative spins, bobs and flicker. Movement you trigger
  // yourself still works.
  private reducedMotion =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Enterable house: the roof is hidden while the player stands inside so you
  // can see the interior from the overhead camera, OSRS-style.
  private houseRoof: THREE.Object3D | null = null;
  private houseBounds: WallBox | null = null;

  // Underground cave. The cave lives far outside the normal play area so its
  // geometry never collides with the village; entering teleports the player
  // there and dims the world lights for a proper gloomy cavern feel.
  private inCave = false;
  private caveRoot: THREE.Group | null = null;
  private caveInteractiveGround: THREE.Mesh | null = null;
  private caveReturn = new THREE.Vector3();
  private transitioning = false;
  private azimuth = Math.PI * 0.25;
  private camDistance = 16;

  private pendingAction: {
    kind: 'tree' | 'fish' | 'rock';
    treeKind?: TreeKind;
    treeId?: number;
    ore?: OreKind;
    rockId?: number;
    x: number;
    z: number;
    started: boolean;
    swingDuration: number;
  } | null = null;
  private swingTimer = 0;

  private minimapCtx!: CanvasRenderingContext2D;
  private minimapSize = 128;

  // lighting references, updated by the day/night cycle
  private sunLight!: THREE.DirectionalLight;
  private ambientLight!: THREE.AmbientLight;

  // world time: minutes within the current in-world day, plus a day counter
  private clockEl!: HTMLDivElement;
  private gameMinutes = 8 * 60; // start at 8am
  private worldDay = 0;
  private worldEpoch = Date.now();
  private lastClockRender = 0;

  // player-lit fires and dropped ground items (both temporary)
  private fires: Fire[] = [];
  private groundItems: GroundItem[] = [];

  // trees that can be chopped down and respawn
  private trees: TreeInstance[] = [];
  private treeIdSeq = 0;
  private treeMaterials = new Map<
    TreeKind,
    { trunk: THREE.MeshStandardMaterial; leaf: THREE.MeshStandardMaterial }
  >();

  // ore rocks that can be mined and regenerate
  private rocks: RockInstance[] = [];
  private rockIdSeq = 0;

  private raycaster = new THREE.Raycaster();
  private clock = new THREE.Clock();

  private panel: ContentPanel;
  private chat: VillagerChat;
  private sidePanel: SidePanel;
  private tooltip: HTMLDivElement;
  private uiLocked = false;

  // pointer / gesture state
  private pointers = new Map<number, { x: number; y: number }>();
  private dragStart = { x: 0, y: 0 };
  private dragging = false;
  private pinchStartDist = 0;
  private pinchStartCamDist = 0;

  constructor(container: HTMLElement, panel: ContentPanel, chat: VillagerChat, sidePanel: SidePanel) {
    this.container = container;
    this.panel = panel;
    this.chat = chat;
    this.sidePanel = sidePanel;

    this.panel.onClose(() => {
      this.uiLocked = false;
    });

    this.sidePanel.onCustomize((change) => {
      if (change.shirt !== undefined) this.playerShirtMat.color.setHex(change.shirt);
      if (change.skin !== undefined) this.playerSkinMat.color.setHex(change.skin);
      if (change.equip !== undefined) this.setEquip(change.equip.slot, change.equip.option);
      if (change.name !== undefined) this.setPlayerName(change.name);
    });

    this.sidePanel.onItemAction((action, key) => {
      if (action === 'drop') this.dropItem(key);
      else if (action === 'light') this.lightFire();
      else if (action === 'eat') this.eatFish(key);
    });

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8fd0e8);
    this.scene.fog = new THREE.Fog(0x8fd0e8, 30, 65);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.tooltip = document.createElement('div');
    this.tooltip.id = 'interact-prompt';
    document.body.appendChild(this.tooltip);

    this.buildMinimap();

    this.buildLighting();
    this.buildGround();
    this.buildPaths();
    this.buildBuildings();
    this.buildTrees();
    this.buildPond();
    this.buildMiningArea();
    this.buildCave();
    this.buildSigns();
    this.buildGem();
    this.buildNpc();
    this.buildPlayer();

    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.bindPointer();

    this.renderer.setAnimationLoop(() => this.tick());
  }

  private minimapScale() {
    return (this.minimapSize / 2 - 6) / Math.max(WORLD_HALF_X, WORLD_HALF_Z);
  }

  private buildMinimap() {
    const wrap = document.createElement('div');
    wrap.id = 'minimap';
    wrap.title = 'Click to travel';
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = this.minimapSize;
    wrap.appendChild(canvas);
    document.body.appendChild(wrap);
    this.minimapCtx = canvas.getContext('2d')!;

    wrap.addEventListener('click', (e) => {
      if (this.uiLocked || !this.player) return;
      const rect = wrap.getBoundingClientRect();
      const cx = e.clientX - rect.left - rect.width / 2;
      const cy = e.clientY - rect.top - rect.height / 2;
      const scale = this.minimapScale();
      const targetX = THREE.MathUtils.clamp(
        this.player.position.x + cx / scale,
        -WORLD_HALF_X + 1,
        WORLD_HALF_X - 1
      );
      const targetZ = THREE.MathUtils.clamp(
        this.player.position.z + cy / scale,
        -WORLD_HALF_Z + 1,
        WORLD_HALF_Z - 1
      );
      this.clearAction();
      this.setMoveTarget(targetX, targetZ);
    });

    // Clock/date readout under the minimap.
    this.clockEl = document.createElement('div');
    this.clockEl.id = 'world-clock';
    document.body.appendChild(this.clockEl);
  }

  // In-world time runs much faster than real time: a full day cycle is a few
  // minutes of play. gameMinutes counts minutes within the current in-world day.
  private updateClock(delta: number) {
    // Reduced motion: hold time still (sleeping still jumps it explicitly).
    if (!this.reducedMotion) this.gameMinutes += delta * WORLD_MINUTES_PER_SECOND;
    while (this.gameMinutes >= 1440) {
      this.gameMinutes -= 1440;
      this.worldDay += 1;
    }

    const now = performance.now();
    if (now - this.lastClockRender < 250) return;
    this.lastClockRender = now;

    const totalMins = Math.floor(this.gameMinutes);
    const hh = Math.floor(totalMins / 60);
    const mm = totalMins % 60;
    const hour12 = ((hh + 11) % 12) + 1;
    const ampm = hh < 12 ? 'AM' : 'PM';

    const date = new Date(this.worldEpoch);
    date.setDate(date.getDate() + this.worldDay);
    const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
    const monthName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][
      date.getMonth()
    ];

    const icon = this.isNight() ? '☾' : '☀';
    this.clockEl.innerHTML =
      `<span class="wc-time">${icon} ${hour12}:${String(mm).padStart(2, '0')} ${ampm}</span>` +
      `<span class="wc-date">${dayName} ${date.getDate()} ${monthName}</span>`;
  }

  private isNight(): boolean {
    const hh = this.gameMinutes / 60;
    return hh < 6 || hh >= 20;
  }

  // Smooth 0..1 "darkness" factor: full day between ~7am-7pm, full night
  // 9pm-5am, with dawn/dusk ramps in between.
  private darkness(): number {
    const hh = this.gameMinutes / 60;
    if (hh >= 7 && hh < 19) return 0;
    if (hh >= 21 || hh < 5) return 1;
    if (hh >= 5 && hh < 7) return 1 - (hh - 5) / 2; // dawn
    return (hh - 19) / 2; // dusk 19..21
  }

  private updateDayNight() {
    // The cave manages its own lighting; don't let the day/night cycle fight it.
    if (this.inCave) return;
    const d = this.darkness();
    // sky from warm day blue to deep navy night
    const daySky = new THREE.Color(0x8fd0e8);
    const nightSky = new THREE.Color(0x151a30);
    const sky = daySky.clone().lerp(nightSky, d);
    this.scene.background = sky;
    if (this.scene.fog) (this.scene.fog as THREE.Fog).color.copy(sky);

    this.sunLight.intensity = THREE.MathUtils.lerp(1.1, 0.12, d);
    this.ambientLight.intensity = THREE.MathUtils.lerp(0.75, 0.32, d);
    this.sunLight.color.copy(new THREE.Color(0xfff3d6).lerp(new THREE.Color(0x6a7bbf), d));
  }

  private drawMinimap() {
    const ctx = this.minimapCtx;
    const s = this.minimapSize;
    const scale = this.minimapScale();
    const px = this.player.position.x;
    const pz = this.player.position.z;

    ctx.clearRect(0, 0, s, s);
    ctx.fillStyle = '#3a5a2e';
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2);
    ctx.fill();

    const toMap = (x: number, z: number): [number, number] => [
      s / 2 + (x - px) * scale,
      s / 2 + (z - pz) * scale,
    ];

    // pond
    const [pondX, pondY] = toMap(POND.x, POND.z);
    ctx.fillStyle = '#3a7bd5';
    ctx.beginPath();
    ctx.arc(pondX, pondY, Math.max(2, POND.radius * scale), 0, Math.PI * 2);
    ctx.fill();

    // buildings
    for (const b of BUILDINGS) {
      const [bx, by] = toMap(b.x, b.z);
      ctx.fillStyle = '#' + b.wall.toString(16).padStart(6, '0');
      ctx.fillRect(bx - 3, by - 3, 6, 6);
    }

    // ore rocks (brown dots)
    ctx.fillStyle = '#8a6a44';
    for (const [rx, rz] of MINING_ROCKS) {
      const [mx, my] = toMap(rx, rz);
      ctx.fillRect(mx - 1.5, my - 1.5, 3, 3);
    }

    // NPC
    const [nx, ny] = toMap(this.npc.position.x, this.npc.position.z);
    ctx.fillStyle = '#4a90d9';
    ctx.beginPath();
    ctx.arc(nx, ny, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // player (always centered, arrow shows facing)
    ctx.save();
    ctx.translate(s / 2, s / 2);
    ctx.rotate(this.player.rotation.y);
    ctx.fillStyle = '#ffd95a';
    ctx.strokeStyle = '#1a120a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(3.5, 4);
    ctx.lineTo(-3.5, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // ---------- scene construction ----------

  private buildLighting() {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xfff3d6, 1.1);
    this.sunLight.position.set(20, 30, 10);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.left = -45;
    this.sunLight.shadow.camera.right = 45;
    this.sunLight.shadow.camera.top = 35;
    this.sunLight.shadow.camera.bottom = -35;
    this.sunLight.shadow.camera.far = 80;
    this.scene.add(this.sunLight);
  }

  private makeCanvasTexture(draw: (ctx: CanvasRenderingContext2D, size: number) => void, size = 128) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    draw(ctx, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private hex(n: number) {
    return '#' + n.toString(16).padStart(6, '0');
  }

  // Procedural surface textures, drawn on a canvas at runtime instead of loaded from image files.
  private makeStoneTexture(base: number) {
    return this.makeCanvasTexture((ctx, s) => {
      ctx.fillStyle = this.hex(base);
      ctx.fillRect(0, 0, s, s);
      const cols = 4;
      const rows = 6;
      const rh = s / rows;
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      for (let r = 0; r <= rows; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * rh);
        ctx.lineTo(s, r * rh);
        ctx.stroke();
      }
      for (let r = 0; r < rows; r++) {
        const offset = (r % 2) * (s / cols / 2);
        for (let c = -1; c <= cols; c++) {
          const x = c * (s / cols) + offset;
          ctx.beginPath();
          ctx.moveTo(x, r * rh);
          ctx.lineTo(x, (r + 1) * rh);
          ctx.stroke();
        }
      }
      for (let i = 0; i < 50; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)';
        ctx.fillRect(Math.random() * s, Math.random() * s, 8 + Math.random() * 10, 5 + Math.random() * 6);
      }
    });
  }

  private makeWoodTexture(base: number) {
    return this.makeCanvasTexture((ctx, s) => {
      ctx.fillStyle = this.hex(base);
      ctx.fillRect(0, 0, s, s);
      const planks = 6;
      for (let i = 0; i < planks; i++) {
        const x = i * (s / planks);
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, s);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(0,0,0,0.12)';
        ctx.lineWidth = 1;
        for (let g = 0; g < 4; g++) {
          const gx = x + ((g + 1) * (s / planks)) / 5 + (Math.random() * 4 - 2);
          ctx.beginPath();
          ctx.moveTo(gx, 0);
          ctx.lineTo(gx + (Math.random() * 6 - 3), s);
          ctx.stroke();
        }
      }
    });
  }

  private makeRoofTexture(base: number) {
    return this.makeCanvasTexture((ctx, s) => {
      ctx.fillStyle = this.hex(base);
      ctx.fillRect(0, 0, s, s);
      const rows = 8;
      const rh = s / rows;
      for (let r = 0; r < rows; r++) {
        ctx.fillStyle = r % 2 === 0 ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.05)';
        ctx.fillRect(0, r * rh, s, rh * 0.45);
      }
    });
  }

  private makeWaterTexture() {
    return this.makeCanvasTexture((ctx, s) => {
      ctx.fillStyle = '#2f7fc1';
      ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        const y = (i + 0.5) * (s / 6);
        ctx.moveTo(0, y);
        for (let x = 0; x <= s; x += 12) ctx.lineTo(x, y + Math.sin(x * 0.2 + i) * 4);
        ctx.stroke();
      }
    });
  }

  private makeLeafTexture(base: number) {
    return this.makeCanvasTexture((ctx, s) => {
      ctx.fillStyle = this.hex(base);
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 90; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.22)';
        const r = 3 + Math.random() * 4;
        ctx.beginPath();
        ctx.arc(Math.random() * s, Math.random() * s, r, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  private buildGround() {
    // Soft mottled grass: a muted base with organic darker/lighter patches and
    // a few grass-blade flecks. No hard checkerboard (that reads as Minecraft);
    // smooth-filtered so it stays painterly rather than pixelated.
    const tex = this.makeCanvasTexture((ctx, s) => {
      ctx.fillStyle = '#5a9e3e';
      ctx.fillRect(0, 0, s, s);
      const patchColors = ['#55973a', '#639f44', '#4f9036', '#6aa84a'];
      for (let i = 0; i < 26; i++) {
        ctx.fillStyle = patchColors[Math.floor(Math.random() * patchColors.length)];
        ctx.globalAlpha = 0.5;
        const r = 10 + Math.random() * 26;
        ctx.beginPath();
        ctx.arc(Math.random() * s, Math.random() * s, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      for (let i = 0; i < 40; i++) {
        ctx.strokeStyle = Math.random() > 0.5 ? 'rgba(40,90,30,0.5)' : 'rgba(150,200,120,0.4)';
        ctx.lineWidth = 1.5;
        const bx = Math.random() * s;
        const by = Math.random() * s;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + (Math.random() * 4 - 2), by - 4 - Math.random() * 4);
        ctx.stroke();
      }
    }, 256);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;

    // The grass plane extends far past the walkable bounds so the player never
    // sees the world edge (that bright void looked like things floated over it).
    // Movement is still clamped to WORLD_HALF; this is purely the visible ground,
    // and the fog fades its distant edge into the sky.
    const groundHalf = GROUND_VISUAL_HALF;
    tex.repeat.set(groundHalf / 2, groundHalf / 2);
    const geo = new THREE.PlaneGeometry(groundHalf * 2, groundHalf * 2);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 1 });
    this.ground = new THREE.Mesh(geo, mat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
  }

  private buildPaths() {
    const pathTex = this.makeStoneTexture(0x9b9b94);
    pathTex.wrapS = pathTex.wrapT = THREE.RepeatWrapping;
    pathTex.repeat.set(5, 5);
    const mat = new THREE.MeshStandardMaterial({ map: pathTex, roughness: 1 });
    const plaza = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), mat);
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = 0.01;
    plaza.receiveShadow = true;
    this.scene.add(plaza);

    const arms: [number, number, number, number][] = [
      [0, -10, 2, 14], // to CV
      [0, 10, 2, 14], // to contact
      [-10, 0, 14, 2], // to about
      [10, 0, 14, 2], // to projects
    ];
    for (const [x, z, w, d] of arms) {
      const seg = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
      seg.rotation.x = -Math.PI / 2;
      seg.position.set(x, 0.01, z);
      seg.receiveShadow = true;
      this.scene.add(seg);
    }
  }

  private makeLabelSprite(text: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(43, 33, 24, 0.88)';
    this.roundRect(ctx, 4, 4, canvas.width - 8, canvas.height - 8, 16);
    ctx.fill();
    ctx.strokeStyle = '#d4af6a';
    ctx.lineWidth = 4;
    this.roundRect(ctx, 6, 6, canvas.width - 12, canvas.height - 12, 14);
    ctx.stroke();
    ctx.fillStyle = '#f5e6c8';
    ctx.font = 'bold 48px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 4);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(3.4, 0.85, 1);
    sprite.renderOrder = 10;
    return sprite;
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Carved wooden sign board: a wood-grain plank with the destination text,
  // used by the signposts that help players find their way around.
  private makeSignTexture(lines: string[]): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    // wood plank background with a few grain streaks
    ctx.fillStyle = '#8a5a30';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(74, 46, 20, 0.5)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 7; i++) {
      const y = (canvas.height / 7) * i + 10;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(170, y + 8, 340, y - 8, canvas.width, y + 4);
      ctx.stroke();
    }
    // routed border
    ctx.strokeStyle = '#4a2e14';
    ctx.lineWidth = 12;
    ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
    // engraved text
    ctx.fillStyle = '#2b1a0c';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lineH = 64;
    const startY = canvas.height / 2 - ((lines.length - 1) * lineH) / 2;
    lines.forEach((line, i) => {
      ctx.font = `bold ${i === 0 ? 58 : 44}px Georgia, serif`;
      ctx.fillText(line, canvas.width / 2, startY + i * lineH);
    });
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // A wooden signpost (post + board) facing the plaza, so the text is readable
  // as you approach from the village centre.
  private buildSignpost(x: number, z: number, lines: string[]) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    // turn the board to face roughly toward the village centre
    group.rotation.y = Math.atan2(-x, -z);

    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.9 });
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.9, 8), woodMat);
    post.position.y = 0.95;
    post.castShadow = true;
    group.add(post);

    const boardMat = new THREE.MeshStandardMaterial({ map: this.makeSignTexture(lines), roughness: 0.85 });
    const board = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.05, 0.1), boardMat);
    board.position.set(0, 1.55, 0.02);
    board.castShadow = true;
    group.add(board);

    this.scene.add(group);
    this.obstacles.push({ x, z, radius: 0.25 + PLAYER_RADIUS });
  }

  // Wayfinding signposts for the two spots people need pointing to.
  private buildSigns() {
    const signs: [number, number, string[]][] = [
      [23, 9.5, ['Fishing', 'Pond']],
      [29.5, 20, ['Cave']],
    ];
    for (const [x, z, lines] of signs) this.buildSignpost(x, z, lines);
  }

  private buildBuildings() {
    for (const b of BUILDINGS) {
      if (b.enterable) {
        this.buildEnterableHouse(b);
        continue;
      }
      const group = new THREE.Group();
      group.position.set(b.x, 0, b.z);

      const wallTex = b.material === 'stone' ? this.makeStoneTexture(b.wall) : this.makeWoodTexture(b.wall);
      wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
      wallTex.repeat.set(Math.max(1, Math.round(b.w / 2)), Math.max(1, Math.round(b.h / 2)));
      const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9 });
      const wall = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), wallMat);
      wall.position.y = b.h / 2;
      wall.castShadow = true;
      wall.receiveShadow = true;
      group.add(wall);

      const roofTex = this.makeRoofTexture(b.roof);
      roofTex.wrapS = roofTex.wrapT = THREE.RepeatWrapping;
      roofTex.repeat.set(2, 2);
      const roofMat = new THREE.MeshStandardMaterial({ map: roofTex, roughness: 0.8 });
      const roofRadius = Math.sqrt(b.w * b.w + b.d * b.d) / 2 + 0.3;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(roofRadius, b.h * 0.55, 4), roofMat);
      roof.position.y = b.h + (b.h * 0.55) / 2;
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      group.add(roof);

      const doorMat = new THREE.MeshStandardMaterial({ color: 0x2b2118 });
      const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.8, 0.1), doorMat);
      door.position.set(0, 0.9, b.d / 2 + 0.051);
      group.add(door);

      const label = this.makeLabelSprite(b.label);
      label.position.set(0, b.h + b.h * 0.55 + 0.9, 0);
      group.add(label);

      group.userData = { type: 'building', panel: b.panel, label: b.label };
      this.scene.add(group);
      this.interactive.push(wall, roof, door);
      wall.userData = roof.userData = door.userData = group.userData;

      this.obstacles.push({ x: b.x, z: b.z, radius: Math.max(b.w, b.d) / 2 + PLAYER_RADIUS + 0.15 });
    }
  }

  // A house you can actually walk into. Instead of one solid box we build four
  // thin walls with a doorway gap in the front, a plank floor, and a roof that
  // vanishes while you're inside so the overhead camera can see in. A bed and a
  // reading journal (which opens the About panel) sit inside.
  private buildEnterableHouse(b: BuildingDef) {
    const group = new THREE.Group();
    group.position.set(b.x, 0, b.z);

    const hw = b.w / 2;
    const hd = b.d / 2;
    const t = 0.25; // wall thickness
    const doorHalf = 0.9; // half-width of the doorway gap in the front wall

    const wallTex = this.makeWoodTexture(b.wall);
    wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
    wallTex.repeat.set(Math.max(1, Math.round(b.w / 2)), Math.max(1, Math.round(b.h / 2)));
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9 });

    // Adds a wall segment both as a mesh (local to the group) and as a
    // world-space collision box so the player slides along it.
    const addWall = (localCx: number, localCz: number, lenX: number, lenZ: number) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(lenX, b.h, lenZ), wallMat);
      mesh.position.set(localCx, b.h / 2, localCz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      const wx = b.x + localCx;
      const wz = b.z + localCz;
      this.wallBoxes.push({
        minX: wx - lenX / 2,
        maxX: wx + lenX / 2,
        minZ: wz - lenZ / 2,
        maxZ: wz + lenZ / 2,
      });
    };

    addWall(0, -hd, b.w, t); // back wall
    addWall(-hw, 0, t, b.d); // left wall
    addWall(hw, 0, t, b.d); // right wall
    // front wall, split either side of the doorway
    const frontSegLen = hw - doorHalf;
    addWall(-(hw + doorHalf) / 2, hd, frontSegLen, t);
    addWall((hw + doorHalf) / 2, hd, frontSegLen, t);

    // plank floor
    const floorTex = this.makeWoodTexture(0x8a5a30);
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(Math.round(b.w / 2), Math.round(b.d / 2));
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(b.w - t, b.d - t),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.95 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.02;
    floor.receiveShadow = true;
    group.add(floor);

    // pyramidal roof, kept as a field so the tick loop can hide it when inside
    const roofTex = this.makeRoofTexture(b.roof);
    roofTex.wrapS = roofTex.wrapT = THREE.RepeatWrapping;
    roofTex.repeat.set(2, 2);
    const roofRadius = Math.sqrt(b.w * b.w + b.d * b.d) / 2 + 0.3;
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(roofRadius, b.h * 0.6, 4),
      new THREE.MeshStandardMaterial({ map: roofTex, roughness: 0.8 })
    );
    roof.position.y = b.h + (b.h * 0.6) / 2;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    group.add(roof);
    this.houseRoof = roof;
    this.houseBounds = { minX: b.x - hw, maxX: b.x + hw, minZ: b.z - hd, maxZ: b.z + hd };

    const label = this.makeLabelSprite(b.label);
    label.position.set(0, b.h + b.h * 0.6 + 0.9, 0);
    group.add(label);

    this.scene.add(group);

    // a reading journal on a lectern in the back-left corner; clicking it opens
    // the About panel just like walking up to the old solid building did
    const jx = b.x - hw + 1.1;
    const jz = b.z - hd + 1.1;
    const standMat = new THREE.MeshStandardMaterial({ color: 0x5a3f28, roughness: 0.9 });
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 0.5), standMat);
    stand.position.set(jx, 0.5, jz);
    stand.castShadow = true;
    const book = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.12, 0.42),
      new THREE.MeshStandardMaterial({ color: 0x9a2a2a, roughness: 0.8 })
    );
    book.position.set(jx, 1.07, jz);
    book.rotation.x = -0.28;
    const journalData = { type: 'building', panel: b.panel, label: 'Read the journal (About Me)' };
    stand.userData = book.userData = journalData;
    this.scene.add(stand, book);
    this.interactive.push(stand, book);
    this.obstacles.push({ x: jx, z: jz, radius: 0.5 + PLAYER_RADIUS });

    // a bed against the right wall for sleeping through to morning
    this.buildBed(b.x + hw - 0.9, b.z, 0);
  }

  // The underground cave, parked far outside the village so its collision boxes
  // and lights never touch the overworld. Entering shows this group, dims the
  // sun, and teleports the player in; a ladder brings them back up.
  private buildCave() {
    const o = CAVE_ORIGIN;
    const root = new THREE.Group();
    root.visible = false;

    // dark stone floor. Made generously large so the camera never sees a hard
    // disc edge (which read like "the edge of the world"); the dark unlit
    // outer floor just fades into the gloom beyond the torchlight.
    const floorTex = this.makeStoneTexture(0x3a342c);
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(16, 16);
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(CAVE_RADIUS + 16, 48),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 1 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(o.x, 0.01, o.z);
    floor.receiveShadow = true;
    floor.userData = { type: 'caveground' };
    root.add(floor);
    this.caveInteractiveGround = floor;

    // a ring of dark boulders forming the cavern walls, with a gap for the exit
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x2e2a24, roughness: 1, flatShading: true });
    const steps = 22;
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      // leave a gap near angle 0 where the exit ladder sits
      if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.32) continue;
      const r = CAVE_RADIUS + 0.4 + Math.sin(i * 1.7) * 0.3;
      const size = 1.3 + ((i * 7) % 5) * 0.18;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(size, 0), rockMat);
      rock.position.set(o.x + Math.cos(a) * r, size * 0.4, o.z + Math.sin(a) * r);
      rock.rotation.set(i * 0.7, i * 1.3, i * 0.5);
      rock.castShadow = true;
      rock.receiveShadow = true;
      root.add(rock);
      this.wallBoxes.push({
        minX: rock.position.x - size * 0.7,
        maxX: rock.position.x + size * 0.7,
        minZ: rock.position.z - size * 0.7,
        maxZ: rock.position.z + size * 0.7,
      });
    }

    // a few stalagmites for atmosphere
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.5;
      const r = CAVE_RADIUS * 0.5;
      const h = 0.8 + (i % 3) * 0.4;
      const sm = new THREE.Mesh(new THREE.ConeGeometry(0.25, h, 6), rockMat);
      sm.position.set(o.x + Math.cos(a) * r, h / 2, o.z + Math.sin(a) * r);
      sm.castShadow = true;
      root.add(sm);
      this.obstacles.push({ x: sm.position.x, z: sm.position.z, radius: 0.25 + PLAYER_RADIUS });
    }

    // wall torches: warm point lights plus a little post and flame
    const torchAngles = [Math.PI * 0.5, Math.PI, Math.PI * 1.5];
    for (const a of torchAngles) {
      const tx = o.x + Math.cos(a) * (CAVE_RADIUS - 0.6);
      const tz = o.z + Math.sin(a) * (CAVE_RADIUS - 0.6);
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 1.4, 6),
        new THREE.MeshStandardMaterial({ color: 0x3a2a18, roughness: 1 })
      );
      post.position.set(tx, 0.7, tz);
      root.add(post);
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.16, 0.4, 6),
        new THREE.MeshStandardMaterial({ color: 0xffa23a, emissive: 0xff7b1a, emissiveIntensity: 1.2 })
      );
      flame.position.set(tx, 1.55, tz);
      root.add(flame);
      const light = new THREE.PointLight(0xffa24a, 1.6, 10);
      light.position.set(tx, 1.7, tz);
      root.add(light);
    }

    // an exit ladder at the gap in the ring
    const ladderMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.9 });
    const ladder = new THREE.Group();
    for (let i = 0; i < 2; i++) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, 0.1), ladderMat);
      rail.position.set(-0.25 + i * 0.5, 1.1, 0);
      ladder.add(rail);
    }
    for (let i = 0; i < 5; i++) {
      const rung = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.08), ladderMat);
      rung.position.set(0, 0.35 + i * 0.45, 0);
      ladder.add(rung);
    }
    const exitX = o.x + CAVE_RADIUS + 0.2;
    const exitZ = o.z;
    ladder.position.set(exitX, 0, exitZ);
    ladder.rotation.y = Math.PI / 2;
    const exitData = { type: 'cave-exit', x: exitX, z: exitZ, radius: 0.8 };
    for (const child of ladder.children) child.userData = exitData;
    root.add(ladder);
    this.interactive.push(...(ladder.children as THREE.Mesh[]));

    this.scene.add(root);
    this.caveRoot = root;

    // richer ore inside the cave: iron, silver and gold clustered around
    const caveOres: [number, number, OreKind][] = [
      [o.x - 2.5, o.z - 2.0, 'iron'],
      [o.x + 1.5, o.z - 3.0, 'silver'],
      [o.x - 3.0, o.z + 2.5, 'gold'],
      [o.x + 3.0, o.z + 2.0, 'silver'],
      [o.x, o.z - 3.5, 'gold'],
    ];
    for (const [x, z, ore] of caveOres) {
      const rock = this.spawnRock(x, z, ore);
      root.add(rock); // reparent so the rock hides when the cave is hidden
    }

    // the cave entrance back in the overworld, near the mining area
    this.buildCaveEntrance();
  }

  // The hole-in-the-ground entrance that sits in the village near the mine.
  private buildCaveEntrance() {
    const ex = CAVE_ENTRANCE.x;
    const ez = CAVE_ENTRANCE.z;
    const group = new THREE.Group();
    group.position.set(ex, 0, ez);

    const rockMat = new THREE.MeshStandardMaterial({ color: 0x5a5148, roughness: 1, flatShading: true });
    // a dark mouth made of rocks arched over a black opening
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (0.1 + (i / 6) * 0.8);
      const size = 0.55 + (i % 2) * 0.2;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(size, 0), rockMat);
      rock.position.set(Math.cos(a) * 1.4, 0.3 + Math.sin(a) * 1.3, Math.sin(a) * 0.3 - 0.4);
      rock.castShadow = true;
      group.add(rock);
    }
    const mouth = new THREE.Mesh(
      new THREE.CircleGeometry(1.1, 20),
      new THREE.MeshStandardMaterial({ color: 0x08060a, roughness: 1 })
    );
    mouth.position.set(0, 0.03, 0.2);
    mouth.rotation.x = -Math.PI / 2;
    mouth.scale.set(1, 1.3, 1);
    const entranceData = { type: 'cave-enter', x: ex, z: ez, radius: 1.2, label: 'Enter the cave' };
    mouth.userData = entranceData;
    group.add(mouth);

    const label = this.makeLabelSprite('Cave');
    label.position.set(0, 2.6, 0);
    group.add(label);

    this.scene.add(group);
    this.interactive.push(mouth);
    // block the rocky sides but leave the mouth walkable so you can step in
    this.obstacles.push({ x: ex - 1.4, z: ez - 0.4, radius: 0.7 });
    this.obstacles.push({ x: ex + 1.4, z: ez - 0.4, radius: 0.7 });
  }

  private buildTrees() {
    // one trunk/leaf material pair per tree kind, reused across every spot of that kind
    const materials = new Map<
      TreeKind,
      { trunk: THREE.MeshStandardMaterial; leaf: THREE.MeshStandardMaterial }
    >();
    for (const kind of Object.keys(TREE_KIND_META) as TreeKind[]) {
      const meta = TREE_KIND_META[kind];
      const trunkTex = this.makeWoodTexture(meta.trunkColor);
      trunkTex.wrapS = trunkTex.wrapT = THREE.RepeatWrapping;
      trunkTex.repeat.set(2, 1);
      const leafTex = this.makeLeafTexture(meta.leafColor);
      materials.set(kind, {
        trunk: new THREE.MeshStandardMaterial({ map: trunkTex, roughness: 1 }),
        leaf: new THREE.MeshStandardMaterial({ map: leafTex, roughness: 1 }),
      });
    }

    this.treeMaterials = materials;
    for (const [x, z, kind] of TREE_SPOTS) {
      this.spawnTree(x, z, kind);
    }
  }

  private spawnTree(x: number, z: number, kind: TreeKind) {
    const meta = TREE_KIND_META[kind];
    const mats = this.treeMaterials.get(kind)!;
    const s = meta.scale;
    const id = this.treeIdSeq++;
    const radius = 0.5 * s;

    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const meshes: THREE.Object3D[] = [];
    const userData = { type: 'tree', kind, x, z, radius, treeId: id };

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.22 * s, 1.3 * s, 8), mats.trunk);
    trunk.position.y = 0.65 * s;
    trunk.castShadow = true;
    trunk.userData = userData;
    group.add(trunk);
    meshes.push(trunk);
    this.interactive.push(trunk);

    // Canopy as a clump of overlapping rounded blobs, layered rather than a
    // single ball. Each blob is interactive too.
    const blobs: [number, number, number, number][] = [
      [0, 2.05, 0, 0.95],
      [0.55, 1.75, 0.2, 0.7],
      [-0.5, 1.8, -0.15, 0.72],
      [0.15, 1.65, -0.55, 0.65],
      [-0.15, 2.35, 0.1, 0.62],
    ];
    for (const [bx, by, bz, br] of blobs) {
      const blob = new THREE.Mesh(new THREE.SphereGeometry(br * s, 10, 8), mats.leaf);
      blob.position.set(bx * s, by * s, bz * s);
      blob.castShadow = true;
      blob.userData = userData;
      group.add(blob);
      meshes.push(blob);
      this.interactive.push(blob);
    }

    this.scene.add(group);
    this.obstacles.push({ x, z, radius: radius + PLAYER_RADIUS });
    this.trees.push({ id, group, meshes, x, z, kind, radius, alive: true });
  }

  // Chop a tree down: a small stump is left, the tree is removed from the
  // world, and it regrows after a short delay (like a depleted OSRS tree).
  private fellTree(tree: TreeInstance) {
    if (!tree.alive) return;
    tree.alive = false;
    this.scene.remove(tree.group);
    this.interactive = this.interactive.filter((o) => !tree.meshes.includes(o));
    this.obstacles = this.obstacles.filter(
      (o) => !(o.x === tree.x && o.z === tree.z && o.radius === tree.radius + PLAYER_RADIUS)
    );
    this.trees = this.trees.filter((t) => t !== tree);

    // leave a short-lived stump so the spot doesn't look empty
    const meta = TREE_KIND_META[tree.kind];
    const stump = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22 * meta.scale, 0.24 * meta.scale, 0.3, 8),
      this.treeMaterials.get(tree.kind)!.trunk
    );
    stump.position.set(tree.x, 0.15, tree.z);
    stump.castShadow = true;
    this.scene.add(stump);

    window.setTimeout(() => {
      this.scene.remove(stump);
      this.spawnTree(tree.x, tree.z, tree.kind);
    }, TREE_RESPAWN_MS);
  }

  // ---------- mining ----------

  private buildMiningArea() {
    // a few grey boulders to read as a rocky outcrop, plus the ore rocks
    const boulderMat = new THREE.MeshStandardMaterial({ color: 0x766c60, roughness: 1 });
    const decoSpots: [number, number, number][] = [
      [36, 15, 0.7],
      [33, 14, 0.5],
      [40, 7, 0.6],
      [41, 12, 0.55],
    ];
    for (const [x, z, r] of decoSpots) {
      const b = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), boulderMat);
      b.position.set(x, r * 0.5, z);
      b.rotation.set(Math.random(), Math.random(), Math.random());
      b.castShadow = true;
      b.receiveShadow = true;
      this.scene.add(b);
      this.obstacles.push({ x, z, radius: r + PLAYER_RADIUS });
    }

    for (const [x, z, ore] of MINING_ROCKS) {
      this.spawnRock(x, z, ore);
    }
  }

  private spawnRock(x: number, z: number, ore: OreKind): THREE.Group {
    const meta = ORE_META[ore];
    const id = this.rockIdSeq++;
    const radius = 0.7;

    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const rockMat = new THREE.MeshStandardMaterial({
      color: meta.rockColor,
      roughness: 1,
      flatShading: true,
    });
    const oreMat = new THREE.MeshStandardMaterial({
      color: meta.oreColor,
      roughness: 0.5,
      metalness: 0.5,
      emissive: meta.oreColor,
      emissiveIntensity: 0.15,
    });

    const meshes: THREE.Object3D[] = [];
    const userData = { type: 'rock', ore, x, z, radius, rockId: id };

    const body = new THREE.Mesh(new THREE.DodecahedronGeometry(0.62, 0), rockMat);
    body.position.y = 0.42;
    body.rotation.set(0.4, 0.8, 0.2);
    body.castShadow = true;
    body.receiveShadow = true;
    body.userData = userData;
    group.add(body);
    meshes.push(body);
    this.interactive.push(body);

    // ore veins poking out of the rock
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const vein = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), oreMat);
      vein.position.set(Math.cos(a) * 0.4, 0.45 + Math.sin(a) * 0.2, Math.sin(a) * 0.4);
      vein.userData = userData;
      group.add(vein);
      meshes.push(vein);
      this.interactive.push(vein);
    }

    this.scene.add(group);
    this.obstacles.push({ x, z, radius: radius + PLAYER_RADIUS });
    this.rocks.push({ id, group, meshes, oreMat, x, z, ore, radius, depleted: false });
    return group;
  }

  // Mine out a rock: it turns into a bare grey rock and regenerates its ore later.
  private depleteRock(rock: RockInstance) {
    if (rock.depleted) return;
    rock.depleted = true;
    // hide the ore veins (all meshes after the first body mesh), leave bare rock
    for (let i = 1; i < rock.meshes.length; i++) rock.meshes[i].visible = false;

    window.setTimeout(() => {
      for (let i = 1; i < rock.meshes.length; i++) rock.meshes[i].visible = true;
      rock.depleted = false;
    }, ROCK_RESPAWN_MS);
  }

  private buildPond() {
    const bankMat = new THREE.MeshStandardMaterial({ color: 0x9c8a5a, roughness: 1 });
    const bank = new THREE.Mesh(new THREE.CircleGeometry(POND.radius + 0.6, 24), bankMat);
    bank.rotation.x = -Math.PI / 2;
    bank.position.set(POND.x, 0.015, POND.z);
    bank.receiveShadow = true;
    this.scene.add(bank);

    const waterTex = this.makeWaterTexture();
    waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping;
    waterTex.repeat.set(2, 2);
    const waterMat = new THREE.MeshStandardMaterial({
      map: waterTex,
      roughness: 0.15,
      metalness: 0.3,
      transparent: true,
      opacity: 0.9,
    });
    const water = new THREE.Mesh(new THREE.CircleGeometry(POND.radius, 24), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(POND.x, 0.03, POND.z);
    water.userData = { type: 'fishspot', x: POND.x, z: POND.z, radius: POND.radius };
    this.scene.add(water);
    this.interactive.push(water);

    this.obstacles.push({ x: POND.x, z: POND.z, radius: POND.radius + PLAYER_RADIUS });
  }

  private buildGem() {
    const group = new THREE.Group();
    group.position.set(-9, 0.9, 9);

    const gemMat = new THREE.MeshStandardMaterial({
      color: 0xffd94a,
      emissive: 0x997a1a,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.4,
    });
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.35), gemMat);
    gem.castShadow = true;
    group.add(gem);

    const light = new THREE.PointLight(0xffd94a, 1.2, 4);
    group.add(light);

    this.scene.add(group);
    this.gem = group;
  }

  // A simple bed near the house. Clicking it to sleep fast-forwards time to
  // the next morning, which the day/night cycle then reflects.
  private buildBed(x: number, z: number, rotY: number) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotY;

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.9 });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.25, 2.1), frameMat);
    frame.position.y = 0.15;
    frame.castShadow = true;
    frame.receiveShadow = true;
    group.add(frame);

    const mattressMat = new THREE.MeshStandardMaterial({ color: 0xcfc3a6, roughness: 0.95 });
    const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.18, 1.5), mattressMat);
    mattress.position.set(0, 0.33, 0.25);
    group.add(mattress);

    const blanketMat = new THREE.MeshStandardMaterial({ color: 0x8a2222, roughness: 0.9 });
    const blanket = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.1, 0.8), blanketMat);
    blanket.position.set(0, 0.4, 0.5);
    group.add(blanket);

    const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.14, 0.4), mattressMat);
    pillow.position.set(0, 0.42, -0.5);
    group.add(pillow);

    const headboard = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 0.15), frameMat);
    headboard.position.set(0, 0.45, -0.98);
    headboard.castShadow = true;
    group.add(headboard);

    const userData = { type: 'bed', x, z, radius: 1.1 };
    for (const child of group.children) child.userData = userData;
    this.scene.add(group);
    this.interactive.push(...(group.children as THREE.Mesh[]));
    this.obstacles.push({ x, z, radius: 1.3 + PLAYER_RADIUS });
  }

  // A campfire near the pond for cooking raw fish. The flame flickers each frame.
  // Builds a fire at (x, z) and registers it as a temporary, interactive object.
  private makeFireAt(x: number, z: number): Fire {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6b6b66, roughness: 1 });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16), stoneMat);
      stone.position.set(Math.cos(a) * 0.55, 0.1, Math.sin(a) * 0.55);
      stone.castShadow = true;
      group.add(stone);
    }

    const logMat = new THREE.MeshStandardMaterial({ color: 0x4a3018, roughness: 0.95 });
    for (let i = 0; i < 3; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.8, 6), logMat);
      log.rotation.z = Math.PI / 2;
      log.rotation.y = (i / 3) * Math.PI;
      log.position.y = 0.1;
      group.add(log);
    }

    const flameMat = new THREE.MeshStandardMaterial({
      color: 0xff7b1a,
      emissive: 0xff6a00,
      emissiveIntensity: 1.1,
      roughness: 0.6,
    });
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 7), flameMat);
    flame.position.y = 0.5;
    group.add(flame);

    const light = new THREE.PointLight(0xff8a2a, 1.4, 7);
    light.position.y = 0.7;
    group.add(light);

    const hit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 0.8, 1.2, 10),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.y = 0.6;
    hit.userData = { type: 'campfire', x, z, radius: 0.8 };
    group.add(hit);
    this.interactive.push(hit);

    this.scene.add(group);
    this.obstacles.push({ x, z, radius: 0.9 + PLAYER_RADIUS });

    return { group, flame, light, hit, bornAt: this.clock.elapsedTime, x, z };
  }

  // Light a fire from logs in the inventory, placed just in front of the player.
  private lightFire() {
    const logKey = LOG_ITEMS.find((k) => this.sidePanel.hasItem(k));
    if (!logKey) {
      showToast('You need some logs to light a fire.');
      return;
    }

    // place the fire a short step in front of where the player is facing
    const fx = THREE.MathUtils.clamp(
      this.player.position.x + Math.sin(this.player.rotation.y) * 1.2,
      -WORLD_HALF_X + 1,
      WORLD_HALF_X - 1
    );
    const fz = THREE.MathUtils.clamp(
      this.player.position.z + Math.cos(this.player.rotation.y) * 1.2,
      -WORLD_HALF_Z + 1,
      WORLD_HALF_Z - 1
    );

    // don't stack a fire on top of an existing one
    if (this.fires.some((f) => Math.hypot(f.x - fx, f.z - fz) < 1.3)) {
      showToast("There's already a fire here.");
      return;
    }

    // don't light a fire on top of something already dropped on the ground
    if (this.groundItems.some((g) => Math.hypot(g.group.position.x - fx, g.group.position.z - fz) < 1.0)) {
      showToast("You can't light a fire on top of dropped items. Move away first.");
      return;
    }

    // keep clear of standing trees so the fire doesn't overlap a trunk
    if (this.trees.some((t) => t.alive && Math.hypot(t.x - fx, t.z - fz) < t.radius + 0.9)) {
      showToast("There's a tree in the way. Light the fire in the open.");
      return;
    }

    this.sidePanel.removeItem(logKey, 1);
    this.fires.push(this.makeFireAt(fx, fz));
    showToast('You light a fire. Use raw fish on it to cook.');
  }

  private removeFire(fire: Fire) {
    this.scene.remove(fire.group);
    this.interactive = this.interactive.filter((o) => o !== fire.hit);
    this.obstacles = this.obstacles.filter(
      (o) => !(o.x === fire.x && o.z === fire.z && o.radius === 0.9 + PLAYER_RADIUS)
    );
    this.fires = this.fires.filter((f) => f !== fire);
  }

  private makePersonGroup(shirtColor: number): {
    group: THREE.Group;
    shirtMat: THREE.MeshStandardMaterial;
    skinMat: THREE.MeshStandardMaterial;
    rightArmPivot: THREE.Group;
    leftArmPivot: THREE.Group;
    legL: THREE.Group;
    legR: THREE.Group;
    head: THREE.Mesh;
    torso: THREE.Mesh;
  } {
    // Rounded low-poly figure in the Old School RuneScape style: smooth
    // tapered limbs and a rounded head rather than hard cubes. The right arm
    // hinges from the shoulder so held tools can swing.
    const group = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: 0xe0b088, roughness: 0.85 });
    const shirt = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.85 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x3f3a5c, roughness: 0.85 });
    const hair = new THREE.MeshStandardMaterial({ color: 0x402c1c, roughness: 0.9 });
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x3a2818, roughness: 0.85 });
    const beltMat = new THREE.MeshStandardMaterial({ color: 0x4a3420, roughness: 0.8 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x241a12, roughness: 0.6 });

    const legsH = 0.6;

    // Two tapered legs, each hinged at the hip inside a pivot group so they can
    // swing through a walk cycle. The rounded boot rides at the foot of the leg.
    const legGeo = new THREE.CylinderGeometry(0.1, 0.12, legsH, 10);
    const bootGeo = new THREE.SphereGeometry(0.15, 10, 8);
    const makeLeg = (x: number) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, legsH, 0); // hinge at the hip
      const leg = new THREE.Mesh(legGeo, pants);
      leg.position.y = -legsH / 2;
      leg.castShadow = true;
      const boot = new THREE.Mesh(bootGeo, bootMat);
      boot.scale.set(1, 0.6, 1.3);
      boot.position.set(0, -legsH + 0.06, 0.04);
      boot.castShadow = true;
      pivot.add(leg, boot);
      group.add(pivot);
      return pivot;
    };
    const legL = makeLeg(-0.12);
    const legR = makeLeg(0.12);

    // Torso: a smooth cylinder that tapers from broad shoulders to a narrower waist.
    const torsoH = 0.62;
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.19, torsoH, 12), shirt);
    torso.position.y = legsH + torsoH / 2;
    torso.castShadow = true;
    group.add(torso);

    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 12), beltMat);
    belt.position.y = legsH + 0.03;
    group.add(belt);

    // No built-in cape: capes are an equipment slot, so the base body stays bare.

    // Rounded shoulders so the arm join reads smooth.
    const shoulderGeo = new THREE.SphereGeometry(0.11, 10, 8);
    const shoulderL = new THREE.Mesh(shoulderGeo, shirt);
    shoulderL.position.set(-0.3, torso.position.y + torsoH * 0.4, 0);
    const shoulderR = shoulderL.clone();
    shoulderR.position.x = 0.3;
    group.add(shoulderL, shoulderR);

    const armGeo = new THREE.CylinderGeometry(0.075, 0.065, torsoH * 0.92, 10);
    // Left arm on its own shoulder pivot so it can counter-swing while walking.
    const leftArmPivot = new THREE.Group();
    leftArmPivot.position.set(-0.3, torso.position.y + torsoH * 0.4, 0);
    const armL = new THREE.Mesh(armGeo, shirt);
    armL.position.y = -torsoH * 0.44;
    armL.castShadow = true;
    const handL = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), skin);
    handL.position.y = -torsoH * 0.88;
    leftArmPivot.add(armL, handL);
    group.add(leftArmPivot);

    // Right arm: pivot at the shoulder, arm hanging below it, so rotating the
    // pivot swings the whole arm like a hinge for chopping and fishing.
    const rightArmPivot = new THREE.Group();
    rightArmPivot.position.set(0.3, torso.position.y + torsoH * 0.4, 0);
    const armR = new THREE.Mesh(armGeo, shirt);
    armR.position.y = -torsoH * 0.44;
    armR.castShadow = true;
    const handR = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), skin);
    handR.position.y = -torsoH * 0.88;
    rightArmPivot.add(armR, handR);
    group.add(rightArmPivot);

    // Neck.
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.1, 10), skin);
    neck.position.y = legsH + torsoH + 0.03;
    group.add(neck);

    // Rounded head (slightly taller than wide), not a cube.
    const headR = 0.19;
    const head = new THREE.Mesh(new THREE.SphereGeometry(headR, 14, 12), skin);
    head.scale.set(1, 1.1, 1);
    head.position.y = legsH + torsoH + 0.1 + headR;
    head.castShadow = true;
    group.add(head);

    const eyeGeo = new THREE.SphereGeometry(0.028, 8, 6);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.07, head.position.y + 0.03, headR - 0.01);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.07;
    group.add(eyeL, eyeR);

    // Hair as a rounded cap over the top and back of the head.
    const hairCap = new THREE.Mesh(
      new THREE.SphereGeometry(headR + 0.025, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62),
      hair
    );
    hairCap.scale.set(1, 1.1, 1);
    hairCap.position.y = head.position.y + 0.01;
    group.add(hairCap);

    return { group, shirtMat: shirt, skinMat: skin, rightArmPivot, leftArmPivot, legL, legR, head, torso };
  }

  private buildNpc() {
    this.npc = this.makePersonGroup(0x4a90d9).group;
    this.npc.position.copy(this.npcBase);
    const label = this.makeLabelSprite('Villager');
    label.position.y = 2.1;
    this.npc.add(label);
    this.npc.userData = { type: 'npc' };
    this.scene.add(this.npc);

    const hitbox = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.6, 2, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitbox.position.y = 1;
    hitbox.userData = this.npc.userData;
    this.npc.add(hitbox);
    this.interactive.push(hitbox);
  }

  private buildPlayer() {
    const { group, shirtMat, skinMat, rightArmPivot, leftArmPivot, legL, legR, head, torso } =
      this.makePersonGroup(0xe58b3c);
    this.player = group;
    this.playerShirtMat = shirtMat;
    this.playerSkinMat = skinMat;
    this.playerArmPivot = rightArmPivot;
    this.playerArmPivotL = leftArmPivot;
    this.playerLegL = legL;
    this.playerLegR = legR;
    this.playerHead = head;
    this.playerTorso = torso;
    this.player.position.set(0, 0, 8);

    this.playerLabel = this.makeLabelSprite(this.playerName);
    this.playerLabel.scale.set(2.2, 0.55, 1);
    this.playerLabel.position.y = 2.05;
    this.player.add(this.playerLabel);

    this.scene.add(this.player);
  }

  // Apply a saved customization profile to the 3D character on boot.
  applyProfile(p: PlayerProfile) {
    if (p.name) this.setPlayerName(p.name);
    if (p.shirt !== undefined) this.playerShirtMat.color.setHex(p.shirt);
    if (p.skin !== undefined) this.playerSkinMat.color.setHex(p.skin);
    if (p.equipment) {
      for (const [slot, option] of Object.entries(p.equipment)) {
        this.setEquip(slot as EquipSlot, option);
      }
    }
  }

  private setPlayerName(name: string) {
    this.playerName = name;
    this.player.remove(this.playerLabel);
    this.playerLabel = this.makeLabelSprite(name);
    this.playerLabel.scale.set(2.2, 0.55, 1);
    this.playerLabel.position.y = 2.05;
    this.player.add(this.playerLabel);
  }

  // Swap one equipment slot. Each slot owns at most one attached mesh; changing
  // it removes the old piece and builds the new one. Slots are independent so
  // any combination is allowed (a steel body with a cloth skirt, etc.).
  private setEquip(slot: EquipSlot, option: string) {
    if (this.equipment[slot] === option) return;
    this.equipment[slot] = option;

    const old = this.equipMeshes[slot];
    if (old) {
      old.parent?.remove(old);
      delete this.equipMeshes[slot];
    }
    if (option === 'none') return;

    const mesh = this.buildEquipPiece(slot, option);
    if (!mesh) return;
    // weapons are held in the right hand so they swing with the arm
    if (slot === 'weapon') this.playerArmPivot.add(mesh);
    else this.player.add(mesh);
    this.equipMeshes[slot] = mesh;
  }

  private metalMat(id: string): THREE.MeshStandardMaterial {
    const base = Object.keys(METAL_COLORS).find((m) => id.toLowerCase().startsWith(m));
    const color = base ? METAL_COLORS[base] : 0x9a9a9a;
    return new THREE.MeshStandardMaterial({ color, metalness: 0.7, roughness: 0.32 });
  }

  // Original geometry built from primitives, not a copy of any in-game item.
  private buildEquipPiece(slot: EquipSlot, option: string): THREE.Object3D | null {
    const headY = this.playerHead.position.y;
    const headR = 0.19;
    const torsoY = this.playerTorso.position.y;
    const torsoH = 0.62;
    const trimMat = new THREE.MeshStandardMaterial({ color: GOLD_TRIM, metalness: 0.75, roughness: 0.28 });

    if (slot === 'hat') {
      const group = new THREE.Group();
      if (option === 'wizardHat') {
        const hat = new THREE.Mesh(
          new THREE.ConeGeometry(0.26, 0.5, 12),
          new THREE.MeshStandardMaterial({ color: 0x5a3b9c, roughness: 0.8 })
        );
        hat.position.y = headY + headR + 0.14;
        hat.castShadow = true;
        const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 14), hat.material);
        brim.position.y = headY + headR - 0.02;
        group.add(hat, brim);
      } else {
        // metal helm: rounded cap with an open face
        const helm = new THREE.Mesh(new THREE.SphereGeometry(headR + 0.05, 14, 12), this.metalMat(option));
        helm.scale.set(1, 1.12, 1);
        helm.position.y = headY;
        helm.castShadow = true;
        const face = new THREE.Mesh(
          new THREE.SphereGeometry(headR + 0.051, 14, 12, -0.6, 1.2, Math.PI * 0.42, Math.PI * 0.3),
          new THREE.MeshStandardMaterial({ color: 0x15100a, roughness: 0.7 })
        );
        face.scale.set(1, 1.12, 1);
        face.position.y = headY;
        const crest = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8, 0, Math.PI), trimMat);
        crest.scale.set(0.5, 1.6, 1);
        crest.rotation.z = Math.PI / 2;
        crest.position.y = headY + headR + 0.12;
        group.add(helm, face, crest);
      }
      return group;
    }

    if (slot === 'cape') {
      const capeColors: Record<string, number> = {
        red: 0xb23a2a,
        blue: 0x2f5fb0,
        green: 0x3a8a3a,
        gold: GOLD_TRIM,
      };
      const cape = new THREE.Mesh(
        new THREE.CylinderGeometry(0.26, 0.34, torsoH * 1.1, 12, 1, true, 0, Math.PI),
        new THREE.MeshStandardMaterial({
          color: capeColors[option] ?? 0x888888,
          roughness: 0.9,
          side: THREE.DoubleSide,
        })
      );
      cape.position.set(0, torsoY - 0.02, -0.06);
      cape.castShadow = true;
      return cape;
    }

    if (slot === 'body') {
      const group = new THREE.Group();
      const plate = new THREE.Mesh(
        new THREE.CylinderGeometry(0.29, 0.21, torsoH + 0.02, 12),
        this.metalMat(option)
      );
      plate.position.y = torsoY;
      plate.castShadow = true;
      const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.025, 8, 20), trimMat);
      stripe.rotation.x = Math.PI / 2;
      stripe.position.y = torsoY + torsoH * 0.26;
      const pauldronGeo = new THREE.SphereGeometry(0.16, 12, 10);
      const pL = new THREE.Mesh(pauldronGeo, this.metalMat(option));
      pL.scale.set(1, 0.8, 1);
      pL.position.set(-0.32, torsoY + torsoH * 0.42, 0);
      pL.castShadow = true;
      const pR = pL.clone();
      pR.position.x = 0.32;
      group.add(plate, stripe, pL, pR);
      return group;
    }

    if (slot === 'legs') {
      const legsTopY = 0.6; // top of the legs region
      if (option === 'skirt') {
        const skirt = new THREE.Mesh(
          new THREE.CylinderGeometry(0.24, 0.42, 0.55, 12, 1, true),
          new THREE.MeshStandardMaterial({ color: 0x8a5a9c, roughness: 0.9, side: THREE.DoubleSide })
        );
        skirt.position.y = legsTopY - 0.2;
        skirt.castShadow = true;
        return skirt;
      }
      const group = new THREE.Group();
      const mat = this.metalMat(option);
      const legGeo = new THREE.CylinderGeometry(0.13, 0.15, 0.62, 10);
      const lL = new THREE.Mesh(legGeo, mat);
      lL.position.set(-0.12, 0.3, 0);
      lL.castShadow = true;
      const lR = lL.clone();
      lR.position.x = 0.12;
      const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.14, 12), mat);
      waist.position.y = legsTopY - 0.02;
      group.add(lL, lR, waist);
      return group;
    }

    if (slot === 'weapon') return this.buildWeapon(option, trimMat);

    return null;
  }

  // Weapons are children of the right-arm pivot. We grip at the hand (near the
  // bottom of the arm) and build the weapon pointing UP, then tilt the whole
  // thing forward so it reads as "held upright", not dragging on the floor.
  private buildWeapon(option: string, trimMat: THREE.MeshStandardMaterial): THREE.Object3D {
    const group = new THREE.Group();
    group.position.set(0.02, -0.52, 0.12);
    group.rotation.x = 0.35; // lean forward a little

    const gripMat = new THREE.MeshStandardMaterial({ color: 0x3a2818, roughness: 0.9 });

    if (option === 'waterStaff' || option === 'fireStaff') {
      const isFire = option === 'fireStaff';
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.034, 1.05, 8), gripMat);
      shaft.position.y = 0.4;
      group.add(shaft);

      // decorative claw/prongs cradling the orb
      const prongMat = new THREE.MeshStandardMaterial({
        color: isFire ? 0x7a3a1a : 0x2a5a7a,
        metalness: 0.5,
        roughness: 0.4,
      });
      for (let i = 0; i < 3; i++) {
        const prong = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.18, 5), prongMat);
        const a = (i / 3) * Math.PI * 2;
        prong.position.set(Math.cos(a) * 0.08, 0.92, Math.sin(a) * 0.08);
        prong.rotation.z = Math.cos(a) * 0.5;
        prong.rotation.x = -Math.sin(a) * 0.5;
        group.add(prong);
      }

      const orb = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.1, 0),
        new THREE.MeshStandardMaterial({
          color: isFire ? 0xff6a1a : 0x3b9fe0,
          emissive: isFire ? 0xd83a00 : 0x1366a8,
          emissiveIntensity: 0.9,
          roughness: 0.25,
          metalness: 0.2,
        })
      );
      orb.position.y = 1.0;
      group.add(orb);

      const glow = new THREE.PointLight(isFire ? 0xff6a1a : 0x3b9fe0, 0.8, 2.5);
      glow.position.y = 1.0;
      group.add(glow);
      return group;
    }

    if (option === 'whip') {
      // Obey/abyssal-style whip: a dark handle with an orange grip band and a
      // long tail curling down and out in a smooth arc.
      const handle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 0.26, 8),
        new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.6 })
      );
      handle.position.y = 0.13;
      const band = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.06, 8),
        new THREE.MeshStandardMaterial({
          color: 0xe0541a,
          emissive: 0x662200,
          emissiveIntensity: 0.4,
          roughness: 0.5,
        })
      );
      band.position.y = 0.24;
      group.add(handle, band);

      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.27, 0),
        new THREE.Vector3(0.06, 0.5, 0.12),
        new THREE.Vector3(0.02, 0.62, 0.34),
        new THREE.Vector3(-0.1, 0.5, 0.52),
        new THREE.Vector3(-0.18, 0.32, 0.64),
      ]);
      const tail = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 24, 0.022, 6, false),
        new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.5 })
      );
      group.add(tail);

      const tip = new THREE.Mesh(
        new THREE.ConeGeometry(0.03, 0.1, 6),
        new THREE.MeshStandardMaterial({ color: 0xe0541a, roughness: 0.5 })
      );
      tip.position.set(-0.18, 0.3, 0.66);
      group.add(tip);
      return group;
    }

    // metal sword: grip, gold guard, tapered blade pointing up
    const mat = this.metalMat(option);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 6), gripMat);
    grip.position.y = 0.1;
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), trimMat);
    pommel.position.y = -0.01;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.06), trimMat);
    guard.position.y = 0.22;
    const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.06, 0.66, 4), mat);
    blade.position.y = 0.57;
    blade.rotation.y = Math.PI / 4;
    group.add(grip, pommel, guard, blade);
    return group;
  }

  // ---------- input ----------

  private bindPointer() {
    const dom = this.renderer.domElement;
    dom.style.touchAction = 'none';

    dom.addEventListener('pointerdown', (e) => {
      dom.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (this.pointers.size === 1) {
        this.dragStart = { x: e.clientX, y: e.clientY };
        this.dragging = false;
      } else if (this.pointers.size === 2) {
        const pts = [...this.pointers.values()];
        this.pinchStartDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        this.pinchStartCamDist = this.camDistance;
      }
    });

    dom.addEventListener('pointermove', (e) => {
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (this.pointers.size === 2) {
        const pts = [...this.pointers.values()];
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const scale = this.pinchStartDist > 0 ? dist / this.pinchStartDist : 1;
        this.camDistance = THREE.MathUtils.clamp(this.pinchStartCamDist / scale, CAM_MIN_DIST, CAM_MAX_DIST);
        return;
      }

      if (this.pointers.size === 1) {
        const dx = e.clientX - this.dragStart.x;
        const dy = e.clientY - this.dragStart.y;
        if (!this.dragging && Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD) {
          this.dragging = true;
        }
        if (this.dragging) {
          this.azimuth -= dx * 0.005;
          this.dragStart = { x: e.clientX, y: e.clientY };
        } else {
          this.updateHover(e.clientX, e.clientY);
        }
      }
    });

    const endPointer = (e: PointerEvent) => {
      const wasSingle = this.pointers.size === 1;
      const wasDragging = this.dragging;
      this.pointers.delete(e.pointerId);
      if (this.pointers.size === 0) {
        if (wasSingle && !wasDragging) {
          this.handleTap(e.clientX, e.clientY);
        }
        this.dragging = false;
      }
    };
    dom.addEventListener('pointerup', endPointer);
    dom.addEventListener('pointercancel', endPointer);

    dom.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.camDistance = THREE.MathUtils.clamp(
          this.camDistance + e.deltaY * 0.015,
          CAM_MIN_DIST,
          CAM_MAX_DIST
        );
      },
      { passive: false }
    );

    window.addEventListener('keydown', (e) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }
      if (!e.key) return;
      const key = e.key.toLowerCase();
      if (key === 'arrowleft' || key === 'a') this.azimuth += 0.08;
      if (key === 'arrowright' || key === 'd') this.azimuth -= 0.08;
      if (key === 'arrowup' || key === 'w') {
        this.camDistance = THREE.MathUtils.clamp(this.camDistance - 0.6, CAM_MIN_DIST, CAM_MAX_DIST);
      }
      if (key === 'arrowdown' || key === 's') {
        this.camDistance = THREE.MathUtils.clamp(this.camDistance + 0.6, CAM_MIN_DIST, CAM_MAX_DIST);
      }
      if (e.key === 'Escape') {
        if (this.chat.isVisible) this.chat.hide();
        if (this.panel.isOpen) this.panel.close();
      }
    });
  }

  private ndcFromClient(clientX: number, clientY: number): THREE.Vector2 {
    const rect = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
  }

  private updateHover(clientX: number, clientY: number) {
    if (this.uiLocked) return;
    const ndc = this.ndcFromClient(clientX, clientY);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.interactive, false);
    if (hits.length > 0) {
      const data = hits[0].object.userData as {
        type: string;
        label?: string;
        kind?: TreeKind;
        ore?: OreKind;
        groundItem?: GroundItem;
      };
      let text: string;
      if (data.type === 'npc') text = 'Talk to the Villager';
      else if (data.type === 'tree') text = `Chop down ${TREE_KIND_META[data.kind ?? 'normal'].treeLabel}`;
      else if (data.type === 'rock') text = `Mine ${ORE_META[data.ore ?? 'copper'].label}`;
      else if (data.type === 'fishspot') text = 'Fish here';
      else if (data.type === 'bed') text = 'Sleep until morning';
      else if (data.type === 'campfire') text = 'Cook fish on the fire';
      else if (data.type === 'grounditem' && data.groundItem)
        text = `Pick up ${ITEM_LABELS[data.groundItem.key]}`;
      else if (data.type === 'cave-enter') text = 'Enter the cave';
      else if (data.type === 'cave-exit') text = 'Climb back to the surface';
      else text = data.label ?? '';
      this.tooltip.textContent = text;
      this.tooltip.classList.add('visible');
      this.tooltip.style.left = `${clientX}px`;
      this.tooltip.style.top = `${clientY - 20}px`;
      this.tooltip.style.transform = 'translate(-50%, -100%)';
      this.renderer.domElement.style.cursor = 'pointer';
    } else {
      this.tooltip.classList.remove('visible');
      this.renderer.domElement.style.cursor = 'default';
    }
  }

  private handleTap(clientX: number, clientY: number) {
    if (this.uiLocked) return;

    const ndc = this.ndcFromClient(clientX, clientY);
    this.raycaster.setFromCamera(ndc, this.camera);

    const hit = this.raycaster.intersectObjects(this.interactive, false)[0];
    if (hit) {
      const data = hit.object.userData as {
        type: string;
        panel?: PanelType;
        x?: number;
        z?: number;
        radius?: number;
        kind?: TreeKind;
        treeId?: number;
        ore?: OreKind;
        rockId?: number;
        groundItem?: GroundItem;
      };
      // red X on the object you clicked (OSRS-style interaction marker)
      this.showClickMarker(hit.point.x, hit.point.z, 'object');

      if (data.type === 'npc') {
        this.chat.show();
      } else if (data.type === 'building' && data.panel) {
        this.uiLocked = true;
        this.panel.open(data.panel);
      } else if (
        (data.type === 'tree' || data.type === 'fishspot') &&
        data.x !== undefined &&
        data.z !== undefined
      ) {
        this.walkToAndAct(
          data.type === 'tree' ? 'tree' : 'fish',
          data.x,
          data.z,
          data.radius ?? 0.8,
          data.kind,
          data.treeId
        );
      } else if (data.type === 'rock' && data.x !== undefined && data.z !== undefined) {
        this.walkToMine(data.x, data.z, data.radius ?? 0.7, data.ore ?? 'copper', data.rockId);
      } else if (data.type === 'bed' && data.x !== undefined && data.z !== undefined) {
        this.walkThenDo(data.x, data.z, data.radius ?? 1.1, () => this.sleep());
      } else if (data.type === 'campfire' && data.x !== undefined && data.z !== undefined) {
        const fx = data.x;
        const fz = data.z;
        this.walkThenDo(fx, fz, data.radius ?? 0.8, () => this.cookAtFire(fx, fz));
      } else if (data.type === 'grounditem' && data.groundItem) {
        const gi = data.groundItem;
        this.walkThenDo(gi.group.position.x, gi.group.position.z, 0.3, () => this.pickUp(gi));
      } else if (data.type === 'cave-enter' && data.x !== undefined && data.z !== undefined) {
        this.walkThenDo(data.x, data.z + 1.2, data.radius ?? 1.2, () => this.enterCave());
      } else if (data.type === 'cave-exit') {
        this.exitCave();
      }
      return;
    }

    // Movement click. Inside the cave we raycast against the cave floor and skip
    // the village bounds clamp, since the cave sits far outside those bounds.
    const groundMesh = this.inCave && this.caveInteractiveGround ? this.caveInteractiveGround : this.ground;
    const groundHit = this.raycaster.intersectObject(groundMesh, false)[0];
    if (groundHit) {
      let x = groundHit.point.x;
      let z = groundHit.point.z;
      if (!this.inCave) {
        x = THREE.MathUtils.clamp(x, -WORLD_HALF_X + 1, WORLD_HALF_X - 1);
        z = THREE.MathUtils.clamp(z, -WORLD_HALF_Z + 1, WORLD_HALF_Z - 1);
      }
      this.clearAction();
      this.setMoveTarget(x, z);
    }
  }

  // Fade to black, teleport into the cave, and dim the overworld lights so the
  // torches carry the scene. exitCave reverses all of it.
  private enterCave() {
    if (this.inCave || this.transitioning || !this.caveRoot) return;
    const caveRoot = this.caveRoot;
    this.transitioning = true;
    this.clearAction();
    this.fadeTransition(() => {
      this.inCave = true;
      this.caveReturn.copy(this.player.position);
      caveRoot.visible = true;
      // park the player a few steps in from the exit ladder, facing the cavern
      this.player.position.set(CAVE_ORIGIN.x + CAVE_RADIUS - 3.5, 0, CAVE_ORIGIN.z);
      this.moveTarget = null;
      this.scene.background = new THREE.Color(0x0c0a0e);
      if (this.scene.fog) (this.scene.fog as THREE.Fog).color.set(0x0c0a0e);
      this.sunLight.intensity = 0.05;
      this.ambientLight.intensity = 0.18;
      this.ambientLight.color.set(0x5a4a6a);
      showToast('You climb down into the dark cave.');
    });
  }

  private exitCave() {
    if (!this.inCave || this.transitioning) return;
    this.transitioning = true;
    this.clearAction();
    this.fadeTransition(() => {
      this.inCave = false;
      if (this.caveRoot) this.caveRoot.visible = false;
      this.player.position.copy(this.caveReturn);
      this.moveTarget = null;
      this.ambientLight.color.set(0xffffff);
      this.updateDayNight(); // restore sky/lights to match the current time
      showToast('You climb back up to the surface.');
    });
  }

  // Shared fade overlay used by cave transitions: fade in, run the swap at the
  // darkest point, then fade back out.
  private fadeTransition(midpoint: () => void) {
    const overlay = document.createElement('div');
    overlay.className = 'sleep-overlay';
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));
    window.setTimeout(() => {
      midpoint();
      overlay.classList.remove('visible');
      window.setTimeout(() => {
        overlay.remove();
        this.transitioning = false;
      }, 700);
    }, 650);
  }

  // Clamp a destination to the playable area. The village is bounded, but the
  // cave sits far outside those bounds, so skip the clamp while underground.
  private clampToWorld(x: number, z: number): [number, number] {
    if (this.inCave) return [x, z];
    return [
      THREE.MathUtils.clamp(x, -WORLD_HALF_X + 1, WORLD_HALF_X - 1),
      THREE.MathUtils.clamp(z, -WORLD_HALF_Z + 1, WORLD_HALF_Z - 1),
    ];
  }

  private walkToAndAct(
    kind: 'tree' | 'fish',
    ox: number,
    oz: number,
    objRadius: number,
    treeKind?: TreeKind,
    treeId?: number
  ) {
    const dx = this.player.position.x - ox;
    const dz = this.player.position.z - oz;
    const dist = Math.hypot(dx, dz) || 1;
    const standDist = objRadius + 0.6;
    const [tx, tz] = this.clampToWorld(ox + (dx / dist) * standDist, oz + (dz / dist) * standDist);
    this.setMoveTarget(tx, tz, 'none');
    this.pendingAction = { kind, treeKind, treeId, x: ox, z: oz, started: false, swingDuration: 0 };
    this.swingTimer = 0;
  }

  private walkToMine(ox: number, oz: number, objRadius: number, ore: OreKind, rockId?: number) {
    const dx = this.player.position.x - ox;
    const dz = this.player.position.z - oz;
    const dist = Math.hypot(dx, dz) || 1;
    const standDist = objRadius + 0.6;
    const [tx, tz] = this.clampToWorld(ox + (dx / dist) * standDist, oz + (dz / dist) * standDist);
    this.setMoveTarget(tx, tz, 'none');
    this.pendingAction = { kind: 'rock', ore, rockId, x: ox, z: oz, started: false, swingDuration: 0 };
    this.swingTimer = 0;
  }

  // Walk next to a point, then run a one-shot action on arrival (sleep, cook).
  private walkThenDo(ox: number, oz: number, objRadius: number, action: () => void) {
    this.clearAction();
    const dx = this.player.position.x - ox;
    const dz = this.player.position.z - oz;
    const dist = Math.hypot(dx, dz) || 1;
    const standDist = objRadius + 0.7;
    const [tx, tz] = this.clampToWorld(ox + (dx / dist) * standDist, oz + (dz / dist) * standDist);
    this.setMoveTarget(tx, tz, 'none');
    this.onArrive = action;
  }

  // Sleep in the bed: fade to black, jump the clock to 7am the next day, fade back.
  private sleep() {
    if (this.sleeping) return;
    this.sleeping = true;
    const overlay = document.createElement('div');
    overlay.className = 'sleep-overlay';
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));

    window.setTimeout(() => {
      // advance to 7am the following morning
      this.worldDay += 1;
      this.gameMinutes = 7 * 60;
      showToast('You wake up feeling refreshed. A new day begins.');
      overlay.classList.remove('visible');
      window.setTimeout(() => {
        overlay.remove();
        this.sleeping = false;
      }, 800);
    }, 1100);
  }

  // Cook at a fire: turn every raw fish in the inventory into its cooked version.
  private cookAtFire(fx: number, fz: number) {
    this.player.rotation.y = Math.atan2(fx - this.player.position.x, fz - this.player.position.z);
    if (!RAW_FISH_ITEMS.some((k) => this.sidePanel.hasItem(k))) {
      showToast('You have no raw fish to cook. Catch some at the pond first!');
      return;
    }
    const cooked = this.sidePanel.cookRawFish();
    showToast(`You cook your fish: ${cooked.join(', ')}.`);
  }

  // Eat a cooked fish for a short "dev energy" burst: a brief run-speed boost
  // and a cheeky toast. Bigger fish, more energy.
  private eatFish(key: ItemKey) {
    if (!this.sidePanel.hasItem(key)) return;
    const energy: Partial<Record<ItemKey, number>> = {
      cookedShrimp: 3,
      cookedSardine: 4,
      cookedTrout: 7,
      cookedSalmon: 10,
    };
    const gain = energy[key] ?? 5;
    this.sidePanel.removeItem(key, 1);
    this.speedBoostUntil = this.clock.elapsedTime + 12;
    showToast(`You eat the ${ITEM_LABELS[key].toLowerCase()}. +${gain} Dev Energy! You feel ready to ship.`);
  }

  // ---------- dropping / picking up items ----------

  private makeIconTexture(key: ItemKey): THREE.Texture {
    const tex = new THREE.TextureLoader().load(ICONS[key]);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    return tex;
  }

  // Drop one of an item from the inventory onto the ground at the player's feet.
  private dropItem(key: ItemKey) {
    if (!this.sidePanel.hasItem(key)) return;
    this.sidePanel.removeItem(key, 1);

    const group = new THREE.Group();
    const x = this.player.position.x;
    const z = this.player.position.z;
    group.position.set(x, 0.12, z);

    const mat = new THREE.MeshBasicMaterial({
      map: this.makeIconTexture(key),
      transparent: true,
      side: THREE.DoubleSide,
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), mat);
    plane.rotation.x = -Math.PI / 2;
    group.add(plane);

    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.5, 0.6),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.y = 0.2;
    group.add(hit);

    const item: GroundItem = { group, key, qty: 1, hit, bornAt: this.clock.elapsedTime };
    hit.userData = { type: 'grounditem', groundItem: item };
    this.interactive.push(hit);
    this.scene.add(group);
    this.groundItems.push(item);
  }

  private pickUp(item: GroundItem) {
    if (!this.groundItems.includes(item)) return; // already gone
    this.sidePanel.addItem(item.key, item.qty);
    this.removeGroundItem(item);
  }

  private removeGroundItem(item: GroundItem) {
    this.scene.remove(item.group);
    this.interactive = this.interactive.filter((o) => o !== item.hit);
    this.groundItems = this.groundItems.filter((g) => g !== item);
  }

  // Age out dropped items and burnt-out fires, and bob/spin the items a little.
  private updateTemporaries() {
    const now = this.clock.elapsedTime;
    for (const item of [...this.groundItems]) {
      if (now - item.bornAt > GROUND_ITEM_TTL) {
        this.removeGroundItem(item);
        continue;
      }
      if (!this.reducedMotion) {
        item.group.rotation.y += 0.02;
        item.group.position.y = 0.12 + Math.sin(now * 3 + item.bornAt) * 0.04;
      }
    }
    for (const fire of [...this.fires]) {
      if (now - fire.bornAt > FIRE_TTL) {
        this.removeFire(fire);
      }
    }
  }

  private setMoveTarget(x: number, z: number, marker: 'walk' | 'none' = 'walk') {
    this.moveTarget = new THREE.Vector2(x, z);
    if (marker === 'walk') this.showClickMarker(x, z, 'walk');
  }

  // OSRS-style click markers: yellow corner-brackets when you click the ground
  // to walk, a red X when you click an object/NPC to interact with it.
  private markerTexture(kind: 'walk' | 'object'): THREE.Texture {
    const cached = this.clickMarkerTex.get(kind);
    if (cached) return cached;
    const tex = this.makeCanvasTexture((ctx, s) => {
      ctx.clearRect(0, 0, s, s);
      ctx.lineCap = 'round';
      if (kind === 'object') {
        // red X
        ctx.strokeStyle = '#ff3b30';
        ctx.lineWidth = s * 0.1;
        const p = s * 0.26;
        ctx.beginPath();
        ctx.moveTo(p, p);
        ctx.lineTo(s - p, s - p);
        ctx.moveTo(s - p, p);
        ctx.lineTo(p, s - p);
        ctx.stroke();
      } else {
        // yellow corner-brackets
        ctx.strokeStyle = '#ffd95a';
        ctx.lineWidth = s * 0.07;
        const pad = s * 0.12;
        const len = s * 0.22;
        const corners: [number, number, number, number][] = [
          [pad, pad, 1, 1],
          [s - pad, pad, -1, 1],
          [pad, s - pad, 1, -1],
          [s - pad, s - pad, -1, -1],
        ];
        for (const [cx, cy, dx, dy] of corners) {
          ctx.beginPath();
          ctx.moveTo(cx, cy + len * dy);
          ctx.lineTo(cx, cy);
          ctx.lineTo(cx + len * dx, cy);
          ctx.stroke();
        }
      }
    }, 64);
    this.clickMarkerTex.set(kind, tex);
    return tex;
  }

  private showClickMarker(x: number, z: number, kind: 'walk' | 'object') {
    if (this.clickMarker) this.scene.remove(this.clickMarker);

    const mat = new THREE.MeshBasicMaterial({
      map: this.markerTexture(kind),
      transparent: true,
      depthWrite: false,
    });
    const size = kind === 'object' ? 0.8 : 0.9;
    const marker = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(x, 0.04, z);
    marker.renderOrder = 5;
    this.scene.add(marker);
    this.clickMarker = marker;
    this.clickMarkerAge = 0;
  }

  private updateClickMarker(delta: number) {
    if (!this.clickMarker) return;
    this.clickMarkerAge += delta;
    const duration = 0.6;
    if (this.clickMarkerAge >= duration) {
      this.scene.remove(this.clickMarker);
      this.clickMarker = null;
      return;
    }
    const t = this.clickMarkerAge / duration;
    (this.clickMarker.material as THREE.MeshBasicMaterial).opacity = 1 - t;
    const scale = 1 - t * 0.35;
    this.clickMarker.scale.set(scale, scale, 1);
  }

  // ---------- update loop ----------

  private resolveCollisions(pos: THREE.Vector3) {
    for (const o of this.obstacles) {
      const dx = pos.x - o.x;
      const dz = pos.z - o.z;
      const dist = Math.hypot(dx, dz);
      if (dist < o.radius && dist > 0.0001) {
        const push = o.radius - dist;
        pos.x += (dx / dist) * push;
        pos.z += (dz / dist) * push;
      }
    }
    // Axis-aligned wall boxes: push the player (a circle of PLAYER_RADIUS) out
    // along whichever axis it's least penetrated, so they slide along walls.
    for (const w of this.wallBoxes) {
      const slid = slideCircleOutOfBox(pos.x, pos.z, w, PLAYER_RADIUS);
      pos.x = slid.x;
      pos.z = slid.z;
    }
  }

  private updatePlayer(delta: number) {
    const moving = this.updateMovement(delta);
    this.updateWalkAnimation(delta, moving);

    if (this.gem && !this.gemFound) {
      if (!this.reducedMotion) {
        this.gem.rotation.y += delta * 1.5;
        this.gem.position.y = 0.9 + Math.sin(this.clock.elapsedTime * 2) * 0.08;
      }
      const d = this.player.position.distanceTo(this.gem.position);
      if (d < 0.9) {
        this.gemFound = true;
        this.scene.remove(this.gem);
        this.gem = null;
        showToast('You found a hidden gem! Nice exploring.');
        this.sidePanel.addItem('gem');
      }
    }

    const t = this.clock.elapsedTime;
    this.npc.position.x = this.npcBase.x + Math.sin(t * 1.1) * 1.4;
    this.npc.position.z = this.npcBase.z + Math.cos(t * 0.7) * 0.6;

    this.updateAction(delta);
    this.updateClickMarker(delta);
  }

  // Moves the player toward the current target with eased acceleration and
  // deceleration, and turns them smoothly to face the way they're heading.
  // Returns true while actually moving so the walk animation can react.
  private updateMovement(delta: number): boolean {
    if (!this.moveTarget) {
      this.currentSpeed = 0;
      return false;
    }

    const dx = this.moveTarget.x - this.player.position.x;
    const dz = this.moveTarget.y - this.player.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist <= 0.08) {
      this.moveTarget = null;
      this.currentSpeed = 0;
      if (this.onArrive) {
        const fn = this.onArrive;
        this.onArrive = null;
        fn();
      }
      return false;
    }

    const boosted = this.clock.elapsedTime < this.speedBoostUntil;
    const maxSpeed = PLAYER_SPEED * (boosted ? 1.6 : 1);

    // Ease up from a standstill and ease down over the last stretch, so starts
    // and stops read as steps rather than an instant glide on and off.
    const DECEL_RADIUS = 1.3;
    const ACCEL = 22;
    const wantSpeed = maxSpeed * Math.max(0.3, Math.min(1, dist / DECEL_RADIUS));
    if (this.currentSpeed < wantSpeed) {
      this.currentSpeed = Math.min(wantSpeed, this.currentSpeed + ACCEL * delta);
    } else {
      this.currentSpeed = Math.max(wantSpeed, this.currentSpeed - ACCEL * delta);
    }

    const step = Math.min(dist, this.currentSpeed * delta);
    const nx = dx / dist;
    const nz = dz / dist;
    this.player.position.x += nx * step;
    this.player.position.z += nz * step;

    // Turn smoothly toward the heading instead of snapping instantly.
    this.player.rotation.y = this.approachAngle(this.player.rotation.y, Math.atan2(nx, nz), delta);

    this.resolveCollisions(this.player.position);
    return this.currentSpeed > 0.2;
  }

  // Eases an angle toward a target heading, taking the shortest way around.
  private approachAngle(current: number, target: number, delta: number): number {
    let diff = target - current;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // wrap to [-PI, PI]
    return current + diff * (1 - Math.exp(-delta * 14));
  }

  // Grounds the character: swinging legs and counter-swinging arms with a small
  // vertical bob while walking, settling back to a neutral stance when stopped.
  private updateWalkAnimation(delta: number, moving: boolean) {
    const toolBusy = !!this.pendingAction && this.pendingAction.started;

    if (moving && !this.reducedMotion) {
      // step faster the quicker we're moving
      this.walkPhase += delta * (5 + this.currentSpeed * 1.3);
      const swing = Math.sin(this.walkPhase) * 0.55;
      this.playerLegL.rotation.x = swing;
      this.playerLegR.rotation.x = -swing;
      this.playerArmPivotL.rotation.x = -swing * 0.7;
      if (!toolBusy) this.playerArmPivot.rotation.x = swing * 0.7;
      // two foot-falls per stride give a gentle double bob
      this.player.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.045;
      return;
    }

    // Settle limbs and height back to rest. The right arm is left alone while a
    // tool swing owns it (that animation resets it when gathering ends).
    const ease = 1 - Math.exp(-delta * 10);
    this.playerLegL.rotation.x += -this.playerLegL.rotation.x * ease;
    this.playerLegR.rotation.x += -this.playerLegR.rotation.x * ease;
    this.playerArmPivotL.rotation.x += -this.playerArmPivotL.rotation.x * ease;
    if (!toolBusy) this.playerArmPivot.rotation.x += -this.playerArmPivot.rotation.x * ease;
    this.player.position.y += -this.player.position.y * ease;
  }

  // Continuous gathering: the player keeps swinging on their own, landing
  // resources on some swings, until the tree falls (chopping) or the player
  // does something else. It never stops after a single click.
  private updateAction(delta: number) {
    if (!this.pendingAction || this.moveTarget) return;
    const action = this.pendingAction;

    if (!action.started) {
      action.started = true;
      this.player.rotation.y = Math.atan2(
        action.x - this.player.position.x,
        action.z - this.player.position.z
      );
      action.swingDuration = action.kind === 'fish' ? 0.8 : 0.55;
      this.swingTimer = action.swingDuration;
      this.attachHeldTool(action.kind);
      let startMsg: string;
      if (action.kind === 'tree')
        startMsg = `You swing your axe at the ${TREE_KIND_META[action.treeKind ?? 'normal'].treeLabel}...`;
      else if (action.kind === 'rock')
        startMsg = `You swing your pickaxe at the ${ORE_META[action.ore ?? 'copper'].label.replace(' ore', '')} rock...`;
      else startMsg = 'You cast your line into the water...';
      showToast(startMsg, 1200);
      return;
    }

    this.swingTimer -= delta;
    const progress = 1 - Math.max(0, this.swingTimer) / action.swingDuration;
    this.animateSwing(action.kind, progress);

    if (this.swingTimer > 0) return;
    // one swing completed: roll an outcome, then keep going
    this.swingTimer = action.swingDuration;

    if (action.kind === 'tree') this.resolveChopSwing(action.treeKind ?? 'normal', action.treeId);
    else if (action.kind === 'rock') this.resolveMineSwing(action.ore ?? 'copper', action.rockId);
    else this.resolveFishSwing();
  }

  private resolveMineSwing(ore: OreKind, rockId?: number) {
    const meta = ORE_META[ore];
    const rock = rockId !== undefined ? this.rocks.find((r) => r.id === rockId) : undefined;
    if (rock && rock.depleted) {
      // someone already mined it out; stop swinging at a bare rock
      this.stopGathering();
      return;
    }
    if (Math.random() < meta.yieldChance) {
      this.sidePanel.addItem(meta.item, 1);
      showToast(`You mine some ${meta.label}.`, 1400);
      // chance the vein is exhausted for now
      if (rock && Math.random() < 0.4) {
        this.depleteRock(rock);
        showToast('The rock is depleted.', 1400);
        this.stopGathering();
      }
    }
  }

  private resolveChopSwing(treeKind: TreeKind, treeId?: number) {
    const meta = TREE_KIND_META[treeKind];
    // roughly one in three swings yields logs
    if (Math.random() < 0.38) {
      this.sidePanel.addItem(meta.logItem, 1);
      showToast(`You get some ${meta.logName}.`, 1400);
    }
    // and a smaller chance the tree comes down entirely, ending the action
    if (Math.random() < 0.16) {
      showToast(`The ${meta.treeLabel} falls. Timber!`);
      const tree = treeId !== undefined ? this.trees.find((t) => t.id === treeId) : undefined;
      if (tree) this.fellTree(tree);
      this.stopGathering();
    }
  }

  private resolveFishSwing() {
    // the pond is well stocked, but not every cast lands a catch
    if (Math.random() < 0.55) {
      const fish = pickWeighted(FISH_TABLE);
      this.sidePanel.addItem(fish.key, 1);
      showToast(`You catch a ${fish.label}.`, 1400);
    } else if (Math.random() < 0.25) {
      showToast('The fish are not biting right now...', 1400);
    }
  }

  private stopGathering() {
    this.pendingAction = null;
    this.swingTimer = 0;
    this.detachHeldTool();
    this.playerArmPivot.rotation.x = 0;
  }

  private animateSwing(kind: 'tree' | 'fish' | 'rock', progress: number) {
    // strong strike for axe/pickaxe, a gentler lift-and-drop for the rod
    const amplitude = kind === 'fish' ? 0.5 : 1.3;
    this.playerArmPivot.rotation.x = -Math.sin(progress * Math.PI) * amplitude;
  }

  private clearAction() {
    this.pendingAction = null;
    this.onArrive = null;
    this.swingTimer = 0;
    this.detachHeldTool();
    this.playerArmPivot.rotation.x = 0;
  }

  private makeAxeProp(): THREE.Group {
    const group = new THREE.Group();
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.5, 5),
      new THREE.MeshStandardMaterial({ color: 0x6b4226 })
    );
    handle.rotation.z = Math.PI / 2.4;
    group.add(handle);
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.14, 0.03),
      new THREE.MeshStandardMaterial({ color: 0xaab0b8, metalness: 0.6, roughness: 0.3 })
    );
    blade.position.set(0.22, 0.14, 0);
    group.add(blade);
    return group;
  }

  private makeRodProp(): THREE.Group {
    const group = new THREE.Group();
    const rod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.025, 1.1, 5),
      new THREE.MeshStandardMaterial({ color: 0x5a3a1e })
    );
    rod.rotation.z = Math.PI / 2.6;
    rod.position.set(0.25, 0.15, 0);
    group.add(rod);
    return group;
  }

  private makePickaxeProp(): THREE.Group {
    const group = new THREE.Group();
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.028, 0.55, 6),
      new THREE.MeshStandardMaterial({ color: 0x6b4226 })
    );
    handle.rotation.z = Math.PI / 2.4;
    group.add(handle);
    // curved double-ended head
    const head = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.34, 6),
      new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.6, roughness: 0.3 })
    );
    head.position.set(0.24, 0.16, 0);
    head.rotation.x = Math.PI / 2;
    group.add(head);
    return group;
  }

  private attachHeldTool(kind: 'tree' | 'fish' | 'rock') {
    this.detachHeldTool();
    this.heldTool =
      kind === 'tree' ? this.makeAxeProp() : kind === 'rock' ? this.makePickaxeProp() : this.makeRodProp();
    // pivot is at the shoulder, so the hand sits near the bottom of the arm mesh
    this.heldTool.position.set(0, -0.54, 0.08);
    this.playerArmPivot.add(this.heldTool);
  }

  private detachHeldTool() {
    if (this.heldTool) {
      this.playerArmPivot.remove(this.heldTool);
      this.heldTool = null;
    }
  }

  private updateCamera() {
    const target = this.player.position;
    // Follow the player's ground position only; ignore the walk bob (y) so the
    // camera stays steady instead of bouncing with every step.
    const baseY = 0;
    const cx = target.x + this.camDistance * Math.cos(CAM_ELEVATION) * Math.sin(this.azimuth);
    const cz = target.z + this.camDistance * Math.cos(CAM_ELEVATION) * Math.cos(this.azimuth);
    const cy = baseY + this.camDistance * Math.sin(CAM_ELEVATION);
    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(target.x, baseY + 1.1, target.z);
  }

  private tick() {
    const delta = Math.min(this.clock.getDelta(), 0.05);
    if (!this.uiLocked) {
      this.updatePlayer(delta);
    }
    this.updateClock(delta);
    this.updateDayNight();
    this.updateHouseRoof();
    this.updateFires();
    this.updateTemporaries();
    this.updateCamera();
    this.drawMinimap();
    this.renderer.render(this.scene, this.camera);
  }

  // Hide the house roof while the player is standing inside its footprint so
  // the overhead camera can see the interior.
  private updateHouseRoof() {
    if (!this.houseRoof || !this.houseBounds) return;
    const p = this.player.position;
    const b = this.houseBounds;
    const inside = !this.inCave && p.x > b.minX && p.x < b.maxX && p.z > b.minZ && p.z < b.maxZ;
    this.houseRoof.visible = !inside;
  }

  private updateFires() {
    if (this.reducedMotion) return; // keep flames steady, no flicker
    const t = this.clock.elapsedTime;
    const flicker = 0.85 + Math.sin(t * 13) * 0.1 + Math.sin(t * 27) * 0.05;
    for (const fire of this.fires) {
      fire.flame.scale.set(1, flicker, 1);
      fire.light.intensity = 1.2 + flicker * 0.5;
    }
  }

  resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  // Dev/testing helper: start chopping the nearest tree. Called only from the
  // localhost dev bridge in main.ts so automated tests can exercise gathering
  // without pixel-perfect 3D clicks. Harmless if invoked elsewhere.
  devChopNearest() {
    let best: TreeInstance | undefined;
    let bestD = Infinity;
    for (const t of this.trees) {
      const d = Math.hypot(t.x - this.player.position.x, t.z - this.player.position.z);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    if (best) this.walkToAndAct('tree', best.x, best.z, best.radius, best.kind, best.id);
  }

  // Dev/testing helper: start mining the nearest ore rock.
  devMineNearest() {
    let best: RockInstance | undefined;
    let bestD = Infinity;
    for (const r of this.rocks) {
      const d = Math.hypot(r.x - this.player.position.x, r.z - this.player.position.z);
      if (d < bestD) {
        bestD = d;
        best = r;
      }
    }
    if (best) {
      // teleport adjacent so tests don't wait on a long walk across the map
      this.player.position.set(best.x - 1.4, 0, best.z);
      this.walkToMine(best.x, best.z, best.radius, best.ore, best.id);
    }
  }

  // Dev/testing helpers for the cave and house. Drop the player somewhere, step
  // into or out of the cave, and read back a little state snapshot so automated
  // tests can confirm the transitions and roof-hide without 3D clicks.
  devTeleport(x: number, z: number) {
    this.player.position.set(x, 0, z);
    this.moveTarget = null;
    this.clearAction();
  }

  devEnterCave() {
    this.enterCave();
  }

  devExitCave() {
    this.exitCave();
  }

  devState() {
    // Force the per-frame roof check so the snapshot reflects the current spot.
    this.updateHouseRoof();
    return {
      inCave: this.inCave,
      roofVisible: this.houseRoof ? this.houseRoof.visible : null,
      caveVisible: this.caveRoot ? this.caveRoot.visible : null,
      playerX: Math.round(this.player.position.x * 10) / 10,
      playerZ: Math.round(this.player.position.z * 10) / 10,
    };
  }
}
