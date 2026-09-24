import * as THREE from 'three';
import goldenCases from './data/golden-cases.js';
import system1Cases from './data/system1-cases.js';
import repoRegistry from './data/repo-registry.js';

// --- Knowledge graph: real nodes (this project's own golden cases + fraud-watch System-1 cases,
// real repositories from the Repository Registry) with real edges (which case actually reads which
// repository) -- not decorative. A dim ambient starfield behind it supplies depth, nothing more. ---

const canvas = document.getElementById('orb-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0.6, 7.5);

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const group = new THREE.Group();
scene.add(group);

function circleSprite(soft) {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, soft ? 'rgba(230, 220, 255, 0.35)' : 'rgba(255, 230, 180, 0.7)');
  grad.addColorStop(1, soft ? 'rgba(200, 200, 255, 0)' : 'rgba(255, 200, 120, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

// --- Ambient starfield: ~260 faint, unconnected points for depth. Purely atmospheric, never
// mistaken for real data -- the labeled graph below is the only part that means anything. ---

const STAR_COUNT = 260;
const starPositions = new Float32Array(STAR_COUNT * 3);
const goldenAngle = Math.PI * (3 - Math.sqrt(5));
for (let i = 0; i < STAR_COUNT; i++) {
  const y = 1 - (i / (STAR_COUNT - 1)) * 2;
  const radiusAtY = Math.sqrt(1 - y * y);
  const theta = goldenAngle * i;
  const r = 5.6 + Math.sin(i * 12.9898) * 0.4;
  starPositions[i * 3] = Math.cos(theta) * radiusAtY * r;
  starPositions[i * 3 + 1] = y * r;
  starPositions[i * 3 + 2] = Math.sin(theta) * radiusAtY * r;
}
const starGeometry = new THREE.BufferGeometry();
starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
const starMaterial = new THREE.PointsMaterial({
  size: 0.03, map: circleSprite(true), transparent: true, opacity: 0.35,
  depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, color: 0x8890a8,
});
const stars = new THREE.Points(starGeometry, starMaterial);
group.add(stars);

// --- Real graph: hub (this project) + case nodes (the 4 real replays below) + repository nodes
// (the Repository Registry's real, current connection status for every repo MESH knows about). ---

const STATUS_COLOR = {
  LIVE: 0x6fe0a0,
  SNAPSHOT: 0xf6d68a,
  UNAVAILABLE: 0x8a7a7a,
};
const CASE_COLOR = 0x9fc6ff;
const HUB_COLOR = 0xf6d68a;

const allCases = [...goldenCases.cases, ...system1Cases.cases];
const repos = repoRegistry.repositories;

// case_id -> repository_id, only where a case's own real data actually comes from that repository
// (checked against evaluation/system1-arena/fraud-watch-cases.ts and capture-system1-events.ts,
// which read adapters/fraud-watch's fixture for MO-0001/MO-0002). Golden cases are risk-mesh's own
// ledger scenarios, sourced from no other repository, so they get no repo edge.
const CASE_REPO_EDGES = {
  'case-fraud-watch-demo-MO-0001': ['fraud-watch'],
  'case-fraud-watch-demo-MO-0002': ['fraud-watch'],
};

const nodes = [];
nodes.push({ id: 'hub', label: 'RISK//MESH', role: 'hub', color: HUB_COLOR, ring: 0, angle: 0 });

function shortCaseLabel(title) {
  const parts = title.split(/[:·]/);
  return parts.length > 1 ? parts[parts.length - 1].trim() : title;
}

allCases.forEach((c, i) => {
  nodes.push({
    id: c.case_id,
    label: shortCaseLabel(c.title),
    role: 'case',
    color: CASE_COLOR,
    ring: 1,
    angle: (i / allCases.length) * Math.PI * 2,
  });
});

repos.forEach((r, i) => {
  nodes.push({
    id: r.repository_id,
    label: r.name,
    role: 'repo-' + r.status,
    status: r.status,
    color: STATUS_COLOR[r.status] || STATUS_COLOR.UNAVAILABLE,
    ring: 2,
    angle: (i / repos.length) * Math.PI * 2 + 0.3,
  });
});

const nodeIndexById = new Map();
nodes.forEach((n, i) => nodeIndexById.set(n.id, i));

const RING_RADIUS = [0, 1.7, 3.4];
nodes.forEach((n) => {
  const r = RING_RADIUS[n.ring];
  n.position = new THREE.Vector3(
    Math.cos(n.angle) * r,
    Math.sin(n.angle * 1.7) * (n.ring === 0 ? 0 : 0.45),
    Math.sin(n.angle) * r,
  );
});

const edges = [];
nodes.forEach((n) => {
  if (n.role === 'case' || n.role.indexOf('repo-') === 0) {
    edges.push({ from: 'hub', to: n.id, color: n.color, dim: n.role.indexOf('repo-') === 0 });
  }
});
Object.keys(CASE_REPO_EDGES).forEach((caseId) => {
  CASE_REPO_EDGES[caseId].forEach((repoId) => {
    if (nodeIndexById.has(caseId) && nodeIndexById.has(repoId)) {
      edges.push({ from: caseId, to: repoId, color: STATUS_COLOR.LIVE, dim: false });
    }
  });
});

const nodePositions = new Float32Array(nodes.length * 3);
const nodeColors = new Float32Array(nodes.length * 3);
const nodePulse = new Float32Array(nodes.length);
nodes.forEach((n, i) => {
  nodePositions[i * 3] = n.position.x;
  nodePositions[i * 3 + 1] = n.position.y;
  nodePositions[i * 3 + 2] = n.position.z;
  const c = new THREE.Color(n.color);
  nodeColors[i * 3] = c.r;
  nodeColors[i * 3 + 1] = c.g;
  nodeColors[i * 3 + 2] = c.b;
});

const nodeGeometry = new THREE.BufferGeometry();
nodeGeometry.setAttribute('position', new THREE.BufferAttribute(nodePositions, 3));
nodeGeometry.setAttribute('color', new THREE.BufferAttribute(nodeColors, 3));
const nodeMaterial = new THREE.PointsMaterial({
  size: 0.16, map: circleSprite(false), vertexColors: true, transparent: true,
  depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
});
const nodePoints = new THREE.Points(nodeGeometry, nodeMaterial);
group.add(nodePoints);

const edgePositions = new Float32Array(edges.length * 6);
const edgeColors = new Float32Array(edges.length * 6);
edges.forEach((e, i) => {
  const a = nodes[nodeIndexById.get(e.from)].position;
  const b = nodes[nodeIndexById.get(e.to)].position;
  edgePositions[i * 6] = a.x; edgePositions[i * 6 + 1] = a.y; edgePositions[i * 6 + 2] = a.z;
  edgePositions[i * 6 + 3] = b.x; edgePositions[i * 6 + 4] = b.y; edgePositions[i * 6 + 5] = b.z;
  const c = new THREE.Color(e.color);
  const alpha = e.dim ? 0.4 : 1;
  for (let k = 0; k < 2; k++) {
    edgeColors[i * 6 + k * 3] = c.r * alpha;
    edgeColors[i * 6 + k * 3 + 1] = c.g * alpha;
    edgeColors[i * 6 + k * 3 + 2] = c.b * alpha;
  }
});
const edgeGeometry = new THREE.BufferGeometry();
edgeGeometry.setAttribute('position', new THREE.BufferAttribute(edgePositions, 3));
edgeGeometry.setAttribute('color', new THREE.BufferAttribute(edgeColors, 3));
const edgeMaterial = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.32 });
group.add(new THREE.LineSegments(edgeGeometry, edgeMaterial));

// Faint outer ring, evokes the HUD reference image.
const ringGeo = new THREE.RingGeometry(4.05, 4.07, 128);
const ringMat = new THREE.MeshBasicMaterial({ color: 0xf6d68a, transparent: true, opacity: 0.1, side: THREE.DoubleSide });
const ring = new THREE.Mesh(ringGeo, ringMat);
ring.rotation.x = Math.PI / 2.15;
scene.add(ring);

// --- HTML labels: one per real node, projected from 3D each frame -- real text, not sprites. ---

const labelsRoot = document.getElementById('graph-labels');
const labelEls = nodes.map((n) => {
  const el = document.createElement('div');
  el.className = 'graph-label role-' + n.role;
  el.textContent = n.label;
  labelsRoot.appendChild(el);
  return el;
});

function updateLabels() {
  const w = window.innerWidth, h = window.innerHeight;
  nodes.forEach((n, i) => {
    const p = n.position.clone().applyMatrix4(group.matrixWorld).project(camera);
    const el = labelEls[i];
    if (p.z > 1 || p.z < -1) { el.style.opacity = '0'; return; }
    const x = (p.x * 0.5 + 0.5) * w;
    const y = (-p.y * 0.5 + 0.5) * h;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    const depthFade = n.ring === 0 ? 1 : (0.55 + (p.z + 1) * -0.15);
    el.style.opacity = String(Math.max(0.35, Math.min(1, depthFade)));
  });
}

// --- Investigation-mode pulse: highlights the active case's own node plus the real nodes it is
// actually wired to (hub, and fraud-watch for the two System-1 cases), not a random spray. ---

let blockedFlash = 0;
let starGlow = 0;
let activeCaseId = allCases[0] ? allCases[0].case_id : null;

function connectedNodeIds(caseId) {
  const ids = [caseId, 'hub'];
  if (CASE_REPO_EDGES[caseId]) ids.push(...CASE_REPO_EDGES[caseId]);
  return ids;
}

function pulseRandomPoints(n) {
  const focus = activeCaseId ? connectedNodeIds(activeCaseId) : [];
  focus.forEach((id) => {
    const idx = nodeIndexById.get(id);
    if (idx !== undefined) nodePulse[idx] = 1;
  });
  // A real, minor reactive touch, not fabricated data: the ambient backdrop brightens briefly on
  // every replayed event, scaled by how large that event is (a REPLAY event pulses harder than a
  // single MODEL_CALLED). Decays back down in animate() below.
  starGlow = Math.min(1, starGlow + n / 40);
}
window.__orbPulse = pulseRandomPoints;
window.__orbBlockedFlash = () => { blockedFlash = 1; };
window.__orbSetActiveCase = (caseId) => { activeCaseId = caseId; };

const clock = new THREE.Clock();
function animate() {
  const dt = clock.getDelta();
  group.rotation.y += dt * 0.06;
  ring.rotation.z += dt * 0.04;
  group.updateMatrixWorld();

  const colorAttr = nodeGeometry.attributes.color;
  nodes.forEach((n, i) => {
    if (nodePulse[i] > 0) nodePulse[i] = Math.max(0, nodePulse[i] - dt * 1.2);
    const glow = nodePulse[i];
    const base = new THREE.Color(n.color);
    const r = base.r + glow * (1 - base.r);
    const g = blockedFlash > 0 ? base.g * 0.4 : base.g + glow * (1 - base.g);
    const b = blockedFlash > 0 ? base.b * 0.4 : base.b + glow * (1 - base.b);
    colorAttr.array[i * 3] = blockedFlash > 0 ? Math.min(1, r + blockedFlash * 0.5) : r;
    colorAttr.array[i * 3 + 1] = g;
    colorAttr.array[i * 3 + 2] = b;
  });
  colorAttr.needsUpdate = true;
  if (blockedFlash > 0) blockedFlash = Math.max(0, blockedFlash - dt * 0.8);

  if (starGlow > 0) starGlow = Math.max(0, starGlow - dt * 0.9);
  starMaterial.opacity = 0.35 + starGlow * 0.3;

  updateLabels();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

// --- Runtime status panel: real counts from the same Repository Registry the graph draws above. ---

function renderStatusPanel() {
  const panel = document.getElementById('status-panel');
  if (!panel) return;
  const counts = { LIVE: 0, SNAPSHOT: 0, UNAVAILABLE: 0 };
  repos.forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1; });
  panel.innerHTML = '';
  ['LIVE', 'SNAPSHOT', 'UNAVAILABLE'].forEach((status) => {
    const row = document.createElement('div');
    row.className = 'status-row ' + status;
    const dot = document.createElement('span');
    dot.className = 'dot';
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = status;
    const count = document.createElement('span');
    count.className = 'count';
    count.textContent = String(counts[status] || 0);
    row.appendChild(dot);
    row.appendChild(label);
    row.appendChild(count);
    panel.appendChild(row);
  });
  const note = document.createElement('div');
  note.className = 'status-note';
  note.textContent = repos.length + ' repositories known to MESH; ' + (counts.LIVE || 0) + ' read live today.';
  panel.appendChild(note);
}
renderStatusPanel();

// --- Terminal replay driver: plays back real captured ledger events from golden-cases.json ---

const terminalEl = document.getElementById('terminal');
const summaryEl = document.getElementById('case-summary');
const tabs = [
  document.getElementById('tab-0'),
  document.getElementById('tab-1'),
  document.getElementById('tab-2'),
  document.getElementById('tab-3'),
];
const replayBtn = document.getElementById('tab-replay');

let activeCase = 0;
let playToken = 0;

function load() {
  playCase(0);
}

function lineTypeClass(type) {
  return type;
}

function fmtTime(iso) {
  return iso.replace('T', ' ').replace('.000Z', 'Z');
}

async function playCase(idx) {
  activeCase = idx;
  playToken += 1;
  const myToken = playToken;
  tabs.forEach((t, i) => t.classList.toggle('active', i === idx));
  const c = allCases[idx];
  window.__orbSetActiveCase(c.case_id);
  summaryEl.textContent = `case_id=${c.case_id} — ${c.summary}`;
  terminalEl.innerHTML = '';

  for (const ev of c.events) {
    if (myToken !== playToken) return;
    const line = document.createElement('div');
    line.className = `terminal-line ${lineTypeClass(ev.type)}`;
    line.innerHTML = `<span class="ts">${fmtTime(ev.at)}</span><span class="type">${ev.type}</span><span class="detail">${ev.detail}</span>`;
    terminalEl.appendChild(line);
    terminalEl.scrollTop = terminalEl.scrollHeight;
    window.__orbPulse(ev.type === 'REPLAY' ? 40 : 10);
    await sleep(ev.type === 'CASE_CREATED' ? 250 : 140);
  }

  if (c.blocked_attempt) {
    if (myToken !== playToken) return;
    await sleep(400);
    const line = document.createElement('div');
    line.className = 'terminal-line BLOCKED';
    line.innerHTML = `<span class="ts">${fmtTime(allCases[idx].events.at(-1).at)}</span><span class="type">BLOCKED ${c.blocked_attempt.from} → ${c.blocked_attempt.to}</span><span class="detail">${c.blocked_attempt.message}</span>`;
    terminalEl.appendChild(line);
    terminalEl.scrollTop = terminalEl.scrollHeight;
    window.__orbBlockedFlash();
  }
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

tabs.forEach((tab, i) => tab.addEventListener('click', () => playCase(i)));
replayBtn.addEventListener('click', () => playCase(activeCase));

load();
