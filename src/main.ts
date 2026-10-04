import './style.css';
import { ContentPanel } from './ui/panel';
import { VillagerChat } from './ui/villagerChat';
import { SidePanel } from './ui/sidePanel';
import { initPlainSite } from './ui/plainSite';
import { Village } from './three/village';

const panel = new ContentPanel();
const chat = new VillagerChat();
const sidePanel = new SidePanel();

initPlainSite();

const container = document.getElementById('game-container')!;
const village = new Village(container, panel, chat, sidePanel);

// Apply any character customization saved from a previous visit.
village.applyProfile(sidePanel.getProfile());

// Hide the boot loader once the scene has painted, but keep it up for a short
// minimum so a fast load still reads as a deliberate intro rather than a flicker.
const bootLoader = document.getElementById('boot-loader');
if (bootLoader) {
  const MIN_VISIBLE_MS = 1200;
  const hide = () => {
    bootLoader.classList.add('hidden');
    window.setTimeout(() => bootLoader.remove(), 600);
  };
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      // performance.now() here is time since the page started loading.
      const remaining = Math.max(0, MIN_VISIBLE_MS - performance.now());
      window.setTimeout(hide, remaining);
    })
  );
}

// First-visit controls hint, shown once then remembered.
showIntroHintOnce();

function showIntroHintOnce() {
  const SEEN_KEY = 'village-hint-seen';
  try {
    if (localStorage.getItem(SEEN_KEY)) return;
  } catch {
    // if storage is blocked, just show the hint every time rather than erroring
  }

  const hint = document.createElement('div');
  hint.className = 'intro-hint';
  hint.innerHTML =
    '<h4>Welcome to the village</h4>' +
    '<p>Click the ground to walk. Click a tree, the pond or the rocks to gather. ' +
    'Visit the buildings for my CV and projects, and explore to find the cave and a hidden gem.</p>' +
    '<button type="button">Got it</button>';
  document.body.appendChild(hint);

  const dismiss = () => {
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      // ignore storage failures
    }
    hint.classList.add('fade-out');
    window.setTimeout(() => hint.remove(), 350);
  };
  hint.querySelector('button')?.addEventListener('click', dismiss);
}

// Dev-only test bridge, attached on localhost. Automated tests dispatch a
// `village-dev` event on document (which crosses browser isolated worlds) to
// drive the game without clicking 3D objects. No-op in production.
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  const publishState = () => {
    // State read-back lives on a DOM dataset attribute because automated tests
    // run in a separate JS world and can't see page globals, only the DOM.
    document.body.dataset.villageState = JSON.stringify(village.devState());
  };
  document.addEventListener('village-dev', (e) => {
    const detail = (e as CustomEvent).detail as {
      addItem?: { key: string; qty: number };
      chopNearest?: boolean;
      mineNearest?: boolean;
      teleport?: { x: number; z: number };
      enterCave?: boolean;
      exitCave?: boolean;
    };
    if (detail.addItem) sidePanel.addItem(detail.addItem.key as never, detail.addItem.qty);
    if (detail.chopNearest) village.devChopNearest();
    if (detail.mineNearest) village.devMineNearest();
    if (detail.teleport) village.devTeleport(detail.teleport.x, detail.teleport.z);
    if (detail.enterCave) village.devEnterCave();
    if (detail.exitCave) village.devExitCave();
    publishState();
  });
  publishState();
}
