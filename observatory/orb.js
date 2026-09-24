import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import goldenCases from './data/golden-cases.js';
import system1Cases from './data/system1-cases.js';
import repoRegistry from './data/repo-registry.js';

// --- RISK//MESH neural graph: a living network of real nodes (this project, its two real model
// nodes LAYA/JEV/SWARM with their real availability, 4 real replayed cases, 10 real repositories)
// and real edges. Nothing here is decoration -- the ambient starfield behind it is the only part
// that is, and it is kept dim and clearly commented as such. ---

const canvas = document.getElementById('orb-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.1, 8.5);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 3;
controls.maxDistance = 16;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.35; // slow idle drift, never aggressive spin
controls.target.set(0, 0, 0);

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
  grad.addColorStop(0.4, soft ? 'rgba(200, 220, 255, 0.3)' : 'rgba(255, 240, 200, 0.65)');
  grad.addColorStop(1, soft ? 'rgba(180, 200, 255, 0)' : 'rgba(255, 200, 120, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

// --- Ambient starfield: faint, unconnected points for depth only. Never mistaken for the real
// graph -- brightens very slightly on real activity (see starGlow below), nothing more. ---

const STAR_COUNT = 420;
const starPositions = new Float32Array(STAR_COUNT * 3);
const goldenAngle = Math.PI * (3 - Math.sqrt(5));
for (let i = 0; i < STAR_COUNT; i++) {
  const y = 1 - (i / (STAR_COUNT - 1)) * 2;
  const radiusAtY = Math.sqrt(1 - y * y);
  const theta = goldenAngle * i;
  const r = 5.8 + Math.sin(i * 12.9898) * 0.5;
  starPositions[i * 3] = Math.cos(theta) * radiusAtY * r;
  starPositions[i * 3 + 1] = y * r;
  starPositions[i * 3 + 2] = Math.sin(theta) * radiusAtY * r;
}
const starGeometry = new THREE.BufferGeometry();
starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
const starMaterial = new THREE.PointsMaterial({
  size: 0.025, map: circleSprite(true), transparent: true, opacity: 0.28,
  depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, color: 0x8aa0c8,
});
group.add(new THREE.Points(starGeometry, starMaterial));

// --- Real graph: the hub (this project) + LAYA/JEV/SWARM (this repo's own real, honest model
// availability -- see core/arbitration-engine.ts: swarmAvailable/jevAvailable are false at every
// real call site today, never fabricated as true; LAYA is REPLAYED, not live, since no inference
// runs from this static page) + 4 real case nodes + 10 real repository nodes. ---

const STATUS_COLOR = {
  LIVE: 0x5fe3b3,
  SNAPSHOT: 0xf6d68a,
  UNAVAILABLE: 0x6a5a8a,
};
const CASE_COLOR = 0x9fc6ff;
const HUB_COLOR = 0xf6d68a;
const LAYA_COLOR = 0x5fd0ff;
const DORMANT_COLOR = 0x5a4a7a;
const CONFLICT_COLOR = new THREE.Color(0xff5d7a);
const AGREE_COLOR = new THREE.Color(0x5fe3b3);

const allCases = [...goldenCases.cases, ...system1Cases.cases];
const repos = repoRegistry.repositories;

function shortCaseLabel(title) {
  const parts = title.split(/[:·]/);
  return parts.length > 1 ? parts[parts.length - 1].trim() : title;
}

// case_id -> repository/model ids a case's own real data actually comes from. Checked against
// evaluation/system1-arena/fraud-watch-cases.ts and capture-system1-events.ts (both MO-0001 and
// MO-0002 read adapters/fraud-watch's fixture and go through the real 3-model Laya arena). Golden
// cases are risk-mesh's own ledger scenarios -- no repo, no Laya arena, so no edge to either.
const CASE_REPO_EDGES = {
  'case-fraud-watch-demo-MO-0001': ['fraud-watch'],
  'case-fraud-watch-demo-MO-0002': ['fraud-watch'],
};
const CASE_LAYA_EDGES = new Set(Object.keys(CASE_REPO_EDGES));

const nodes = [];
nodes.push({ id: 'hub', label: 'RISK//MESH', role: 'hub', color: HUB_COLOR, ring: 0, angle: 0, y: 0, status: null });
nodes.push({ id: 'laya', label: 'LAYA', role: 'model-replayed', color: LAYA_COLOR, ring: 0.62, angle: 0.6, y: 0.35, status: 'REPLAYED' });
nodes.push({ id: 'jev', label: 'JEV', role: 'model-unavailable', color: DORMANT_COLOR, ring: 0.62, angle: 2.7, y: -0.3, status: 'UNAVAILABLE' });
nodes.push({ id: 'swarm', label: 'SWARM', role: 'model-unavailable', color: DORMANT_COLOR, ring: 0.62, angle: 4.7, y: 0.05, status: 'UNAVAILABLE' });

allCases.forEach((c, i) => {
  nodes.push({
    id: c.case_id, label: shortCaseLabel(c.title), role: 'case', color: CASE_COLOR,
    ring: 1.9, angle: (i / allCases.length) * Math.PI * 2, y: (i % 2 === 0 ? 0.2 : -0.2), status: null,
    caseIndex: i,
  });
});

repos.forEach((r, i) => {
  nodes.push({
    id: r.repository_id, label: r.name, role: 'repo-' + r.status, status: r.status,
    color: STATUS_COLOR[r.status] || STATUS_COLOR.UNAVAILABLE,
    ring: 3.6, angle: (i / repos.length) * Math.PI * 2 + 0.3, y: (i % 3 - 1) * 0.3,
  });
});

const nodeIndexById = new Map();
nodes.forEach((n, i) => nodeIndexById.set(n.id, i));
nodes.forEach((n) => {
  n.position = new THREE.Vector3(Math.cos(n.angle) * n.ring, n.y, Math.sin(n.angle) * n.ring);
  n.phase = Math.random() * Math.PI * 2; // per-node breathing offset, so the graph never pulses in lockstep
});

const edges = [];
function addEdge(from, to, color, dim) {
  if (nodeIndexById.has(from) && nodeIndexById.has(to)) edges.push({ from, to, color, dim: !!dim });
}
addEdge('hub', 'laya', LAYA_COLOR, false);
addEdge('hub', 'jev', DORMANT_COLOR, true);
addEdge('hub', 'swarm', DORMANT_COLOR, true);
allCases.forEach((c) => addEdge('hub', c.case_id, CASE_COLOR, false));
repos.forEach((r) => addEdge('hub', r.repository_id, STATUS_COLOR[r.status] || STATUS_COLOR.UNAVAILABLE, true));
Object.keys(CASE_REPO_EDGES).forEach((caseId) => {
  CASE_REPO_EDGES[caseId].forEach((repoId) => addEdge(caseId, repoId, STATUS_COLOR.LIVE, false));
});
CASE_LAYA_EDGES.forEach((caseId) => addEdge(caseId, 'laya', LAYA_COLOR, false));

const nodePositions = new Float32Array(nodes.length * 3);
const nodeColors = new Float32Array(nodes.length * 3);
const nodePulse = new Float32Array(nodes.length);
const nodeConflict = new Float32Array(nodes.length); // >0 = flash red (real disagreement), <0 flash green (real agreement)
nodes.forEach((n, i) => {
  nodePositions[i * 3] = n.position.x; nodePositions[i * 3 + 1] = n.position.y; nodePositions[i * 3 + 2] = n.position.z;
  const c = new THREE.Color(n.color);
  nodeColors[i * 3] = c.r; nodeColors[i * 3 + 1] = c.g; nodeColors[i * 3 + 2] = c.b;
});

const nodeGeometry = new THREE.BufferGeometry();
nodeGeometry.setAttribute('position', new THREE.BufferAttribute(nodePositions, 3));
nodeGeometry.setAttribute('color', new THREE.BufferAttribute(nodeColors, 3));
const nodeMaterial = new THREE.PointsMaterial({
  size: 0.17, map: circleSprite(false), vertexColors: true, transparent: true,
  depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
});
const nodePoints = new THREE.Points(nodeGeometry, nodeMaterial);
group.add(nodePoints);

const edgePositions = new Float32Array(edges.length * 6);
const edgeColors = new Float32Array(edges.length * 6);
function rebuildEdgeGeometry() {
  edges.forEach((e, i) => {
    const a = nodes[nodeIndexById.get(e.from)].position;
    const b = nodes[nodeIndexById.get(e.to)].position;
    edgePositions[i * 6] = a.x; edgePositions[i * 6 + 1] = a.y; edgePositions[i * 6 + 2] = a.z;
    edgePositions[i * 6 + 3] = b.x; edgePositions[i * 6 + 4] = b.y; edgePositions[i * 6 + 5] = b.z;
  });
}
rebuildEdgeGeometry();
edges.forEach((e, i) => {
  const c = new THREE.Color(e.color);
  const alpha = e.dim ? 0.35 : 0.85;
  for (let k = 0; k < 2; k++) {
    edgeColors[i * 6 + k * 3] = c.r * alpha; edgeColors[i * 6 + k * 3 + 1] = c.g * alpha; edgeColors[i * 6 + k * 3 + 2] = c.b * alpha;
  }
});
const edgeGeometry = new THREE.BufferGeometry();
edgeGeometry.setAttribute('position', new THREE.BufferAttribute(edgePositions, 3));
edgeGeometry.setAttribute('color', new THREE.BufferAttribute(edgeColors, 3));
const edgeMaterial = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.4 });
const edgeLines = new THREE.LineSegments(edgeGeometry, edgeMaterial);
group.add(edgeLines);

// Faint outer ring for depth, evokes a HUD horizon.
const ringGeo = new THREE.RingGeometry(4.3, 4.32, 128);
const ringMat = new THREE.MeshBasicMaterial({ color: 0xf6d68a, transparent: true, opacity: 0.08, side: THREE.DoubleSide });
const ring = new THREE.Mesh(ringGeo, ringMat);
ring.rotation.x = Math.PI / 2.15;
scene.add(ring);

// --- Traveling signal particles: real evidence/activity moving along a real edge, spawned only
// by real events below (never a random spray). Fixed pool, capped, cheap. ---

const MAX_SIGNALS = 48;
const signalPositions = new Float32Array(MAX_SIGNALS * 3);
const signalColors = new Float32Array(MAX_SIGNALS * 3);
const signals = []; // { from: Vector3, to: Vector3, t, speed, color }
for (let i = 0; i < MAX_SIGNALS; i++) signals.push({ active: false, from: new THREE.Vector3(), to: new THREE.Vector3(), t: 0, speed: 1, color: new THREE.Color(0, 0, 0) });
const signalGeometry = new THREE.BufferGeometry();
signalGeometry.setAttribute('position', new THREE.BufferAttribute(signalPositions, 3));
signalGeometry.setAttribute('color', new THREE.BufferAttribute(signalColors, 3));
const signalMaterial = new THREE.PointsMaterial({
  size: 0.09, map: circleSprite(false), vertexColors: true, transparent: true,
  depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
});
group.add(new THREE.Points(signalGeometry, signalMaterial));

function spawnSignal(fromId, toId, color, speed) {
  const slot = signals.find((s) => !s.active) || signals[0];
  const a = nodes[nodeIndexById.get(fromId)];
  const b = nodes[nodeIndexById.get(toId)];
  if (!a || !b) return;
  slot.active = true;
  slot.from.copy(a.position);
  slot.to.copy(b.position);
  slot.t = 0;
  slot.speed = speed || 0.7;
  slot.color.set(color || 0xffffff);
}

// --- HTML labels: real text projected from the 3D scene each frame. ---

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
    if (p.z > 1 || p.z < -1 || Math.abs(p.x) > 1.4 || Math.abs(p.y) > 1.4) { el.style.opacity = '0'; return; }
    el.style.left = ((p.x * 0.5 + 0.5) * w) + 'px';
    el.style.top = ((-p.y * 0.5 + 0.5) * h) + 'px';
    const base = n.role === 'hub' ? 1 : 0.75;
    el.style.opacity = String(Math.max(0.3, Math.min(1, base - (p.z + 1) * 0.15)));
  });
}

// --- Hover / click node inspection: real raycast against real node positions. ---

const raycaster = new THREE.Raycaster();
raycaster.params.Points.threshold = 0.22;
const pointer = new THREE.Vector2();
let hoveredIndex = -1;
let selectedIndex = -1;

function pointerToNDC(ev) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
}

function pickNode() {
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(nodePoints);
  return hits.length > 0 ? hits[0].index : -1;
}

function renderNodeInspector(idx) {
  const panel = document.getElementById('node-inspector');
  if (!panel) return;
  if (idx < 0) { panel.hidden = true; return; }
  const n = nodes[idx];
  const lines = [];
  lines.push(n.label);
  if (n.role === 'hub') lines.push('This project. Every real node below connects through here.');
  else if (n.role.indexOf('model-') === 0) lines.push('Status: ' + n.status + (n.status === 'REPLAYED' ? ' (a real captured arena run, not a live call from this page)' : ' (no real call site in this repo enables this today)'));
  else if (n.role === 'case') {
    const c = allCases[n.caseIndex];
    lines.push(c ? c.summary : '');
  } else if (n.role.indexOf('repo-') === 0) {
    const r = repos.find((x) => x.repository_id === n.id);
    if (r) { lines.push(r.purpose); lines.push('Status: ' + r.status + ' -- ' + r.provenance.note); }
  }
  panel.hidden = false;
  panel.innerHTML = '';
  lines.forEach((l) => { if (!l) return; const p = document.createElement('div'); p.textContent = l; panel.appendChild(p); });
}

canvas.addEventListener('pointermove', (ev) => {
  pointerToNDC(ev);
  const idx = pickNode();
  if (idx !== hoveredIndex) {
    hoveredIndex = idx;
    canvas.style.cursor = idx >= 0 ? 'pointer' : 'default';
  }
});
canvas.addEventListener('click', (ev) => {
  pointerToNDC(ev);
  const idx = pickNode();
  selectedIndex = idx === selectedIndex ? -1 : idx;
  renderNodeInspector(selectedIndex);
});

// --- Investigation pulse: real per-node activity tied to real replayed events, never random. ---

let blockedFlash = 0;
let starGlow = 0;
let activeCaseId = allCases[0] ? allCases[0].case_id : null;
let thinking = false; // true while a live Ask MESH question is in flight
let thinkingClock = 0;

function connectedNodeIds(caseId) {
  const ids = [caseId, 'hub'];
  if (CASE_REPO_EDGES[caseId]) ids.push(...CASE_REPO_EDGES[caseId]);
  if (CASE_LAYA_EDGES.has(caseId)) ids.push('laya');
  return ids;
}

function pulseRandomPoints(n) {
  const focus = activeCaseId ? connectedNodeIds(activeCaseId) : [];
  focus.forEach((id) => {
    const idx = nodeIndexById.get(id);
    if (idx !== undefined) nodePulse[idx] = 1;
  });
  starGlow = Math.min(1, starGlow + n / 40);
}
window.__orbPulse = pulseRandomPoints;
window.__orbBlockedFlash = () => { blockedFlash = 1; };
window.__orbSetActiveCase = (caseId) => { activeCaseId = caseId; };

// Real disagreement (3 real Laya models scored the same case differently) vs real agreement --
// driven only by the arena's own already-computed comparison, replayed in the terminal above.
window.__orbArenaCompared = (caseId, agreed) => {
  const idx = nodeIndexById.get(caseId);
  const layaIdx = nodeIndexById.get('laya');
  const val = agreed ? -1 : 1;
  if (idx !== undefined) nodeConflict[idx] = val;
  if (layaIdx !== undefined) nodeConflict[layaIdx] = val;
  if (idx !== undefined) spawnSignal(caseId, 'laya', agreed ? AGREE_COLOR.getHex() : CONFLICT_COLOR.getHex(), 0.9);
};

// A real decision has converged (SYSTEM1_ROUTED / a golden-case ledger event settling) -- activity
// gathers back toward the hub rather than staying spread over the case.
window.__orbConverge = (caseId) => {
  const hubIdx = nodeIndexById.get('hub');
  if (hubIdx !== undefined) nodePulse[hubIdx] = 1;
  spawnSignal(caseId, 'hub', HUB_COLOR, 0.6);
};

// Live Ask MESH question in flight: an honest "querying its own knowledge graph" ripple -- this is
// the ONLY visual for a free-text question, since a real answer here is one BYOK LLM call, not a
// live Laya/Jev/Swarm orchestration (those never run from this static page; see the case replay
// above for the one real multi-model event trace this project actually has).
window.__orbAskStart = () => { thinking = true; thinkingClock = 0; };
window.__orbAskEnd = () => {
  thinking = false;
  const hubIdx = nodeIndexById.get('hub');
  if (hubIdx !== undefined) nodePulse[hubIdx] = 1;
  spawnSignal('hub', 'hub', HUB_COLOR, 1);
};

const clock = new THREE.Clock();
const tmpColor = new THREE.Color();
function animate() {
  const dt = clock.getDelta();
  const t = clock.elapsedTime;
  controls.update();

  const colorAttr = nodeGeometry.attributes.color;
  nodes.forEach((n, i) => {
    if (nodePulse[i] > 0) nodePulse[i] = Math.max(0, nodePulse[i] - dt * 1.1);
    if (nodeConflict[i] !== 0) {
      nodeConflict[i] = nodeConflict[i] > 0 ? Math.max(0, nodeConflict[i] - dt * 0.9) : Math.min(0, nodeConflict[i] + dt * 0.9);
    }
    const breathe = 0.5 + 0.5 * Math.sin(t * 0.8 + n.phase); // idle organic life, never fully still
    const glow = nodePulse[i] + breathe * 0.12;
    const base = tmpColor.set(n.color);
    if (i === hoveredIndex || i === selectedIndex) base.lerp(new THREE.Color(0xffffff), 0.35);
    let r = base.r + glow * (1 - base.r);
    let g = base.g + glow * (1 - base.g);
    let b = base.b + glow * (1 - base.b);
    if (nodeConflict[i] > 0) { const k = nodeConflict[i]; r = r + (CONFLICT_COLOR.r - r) * k; g = g + (CONFLICT_COLOR.g - g) * k; b = b + (CONFLICT_COLOR.b - b) * k; }
    else if (nodeConflict[i] < 0) { const k = -nodeConflict[i]; r = r + (AGREE_COLOR.r - r) * k; g = g + (AGREE_COLOR.g - g) * k; b = b + (AGREE_COLOR.b - b) * k; }
    if (blockedFlash > 0) { r = Math.min(1, r + blockedFlash * 0.5); g *= 0.5; b *= 0.5; }
    colorAttr.array[i * 3] = r; colorAttr.array[i * 3 + 1] = g; colorAttr.array[i * 3 + 2] = b;
  });
  colorAttr.needsUpdate = true;
  if (blockedFlash > 0) blockedFlash = Math.max(0, blockedFlash - dt * 0.8);
  if (starGlow > 0) starGlow = Math.max(0, starGlow - dt * 0.9);
  starMaterial.opacity = 0.28 + starGlow * 0.25;

  if (thinking) {
    thinkingClock += dt;
    if (thinkingClock > 0.45) {
      thinkingClock = 0;
      const targets = ['laya', ...repos.slice(0, 4).map((r) => r.repository_id)];
      spawnSignal('hub', targets[Math.floor(Math.random() * targets.length)], HUB_COLOR, 0.5);
      const hubIdx = nodeIndexById.get('hub');
      if (hubIdx !== undefined) nodePulse[hubIdx] = Math.max(nodePulse[hubIdx], 0.6);
    }
  }

  const sigColorAttr = signalGeometry.attributes.color;
  const sigPosAttr = signalGeometry.attributes.position;
  signals.forEach((s, i) => {
    if (!s.active) { sigColorAttr.array[i * 3] = 0; sigColorAttr.array[i * 3 + 1] = 0; sigColorAttr.array[i * 3 + 2] = 0; return; }
    s.t += dt * s.speed;
    if (s.t >= 1) { s.active = false; sigColorAttr.array[i * 3] = 0; sigColorAttr.array[i * 3 + 1] = 0; sigColorAttr.array[i * 3 + 2] = 0; return; }
    const p = s.from.clone().lerp(s.to, s.t);
    sigPosAttr.array[i * 3] = p.x; sigPosAttr.array[i * 3 + 1] = p.y; sigPosAttr.array[i * 3 + 2] = p.z;
    const fade = 1 - Math.abs(s.t - 0.5) * 1.4;
    sigColorAttr.array[i * 3] = s.color.r * fade; sigColorAttr.array[i * 3 + 1] = s.color.g * fade; sigColorAttr.array[i * 3 + 2] = s.color.b * fade;
  });
  sigColorAttr.needsUpdate = true;
  sigPosAttr.needsUpdate = true;

  updateLabels();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

// --- Minimal HUD: real, honest status only -- never a model or repo shown as running when it
// is not (core/arbitration-engine.ts: swarmAvailable/jevAvailable are false everywhere real). ---

function aggregateKnowledgeStatus() {
  if (repos.some((r) => r.status === 'LIVE')) return 'LIVE';
  if (repos.some((r) => r.status === 'SNAPSHOT')) return 'SNAPSHOT';
  return 'UNAVAILABLE';
}

function renderHud() {
  const hud = document.getElementById('hud-status');
  if (!hud) return;
  const rows = [
    { label: 'KNOWLEDGE', status: aggregateKnowledgeStatus() },
    { label: 'LAYA', status: 'REPLAYED' },
    { label: 'JEV', status: 'UNAVAILABLE' },
    { label: 'SWARM', status: 'UNAVAILABLE' },
  ];
  hud.innerHTML = '';
  rows.forEach((row) => {
    const el = document.createElement('div');
    el.className = 'hud-row status-' + row.status;
    const dot = document.createElement('span');
    dot.className = 'hud-dot';
    const label = document.createElement('span');
    label.textContent = row.label;
    el.appendChild(dot);
    el.appendChild(label);
    hud.appendChild(el);
  });
  const foot = document.getElementById('hud-foot');
  if (foot) {
    const liveCount = repos.filter((r) => r.status === 'LIVE').length;
    foot.textContent = allCases.length + ' investigations replayed \u00b7 ' + repos.length + ' sources known \u00b7 ' + liveCount + ' live';
  }
}
renderHud();

// --- Real registry, evidence and reasoning content for the info panel's tabs (Evidence/Reasoning/
// Provenance). Answer tab is owned by ask-mesh.js (the one live, BYOK part of this page). ---

function renderProvenanceTab() {
  const el = document.getElementById('tab-content-provenance');
  if (!el) return;
  el.innerHTML = '';
  repos.forEach((r) => {
    const row = document.createElement('div');
    row.className = 'prov-row status-' + r.status;
    const head = document.createElement('div');
    head.className = 'prov-head';
    head.textContent = r.name + ' \u2014 ' + r.status;
    const note = document.createElement('div');
    note.className = 'prov-note';
    note.textContent = r.provenance.note;
    row.appendChild(head);
    row.appendChild(note);
    el.appendChild(row);
  });
}
renderProvenanceTab();

function renderEvidenceTab(c) {
  const el = document.getElementById('tab-content-evidence');
  if (!el) return;
  el.innerHTML = '';
  if (!c.ground_truth) {
    const p = document.createElement('div');
    p.className = 'info-empty';
    p.textContent = 'This is one of RISK//MESH\'s own ledger test scenarios -- no external ground truth applies; nothing external was ever queried for it.';
    el.appendChild(p);
    return;
  }
  const gt = c.ground_truth;
  const rows = [
    'status: ' + gt.status + ', classification: ' + gt.classification,
    'confidence: ' + gt.confidence + ' (' + gt.confidenceBand + '), novelty: ' + gt.noveltyScore,
    'signature: ' + gt.signature,
    'timeline: ' + gt.timeline.map((e) => e.type + '@t=' + e.t).join(' \u2192 '),
  ];
  rows.forEach((text) => { const p = document.createElement('div'); p.textContent = text; el.appendChild(p); });
}

function renderReasoningTab(c) {
  const el = document.getElementById('tab-content-reasoning');
  if (!el) return;
  el.innerHTML = '';
  c.events.forEach((ev) => {
    const line = document.createElement('div');
    line.className = 'reasoning-line ' + ev.type;
    line.textContent = ev.type + ': ' + ev.detail;
    el.appendChild(line);
  });
}

// --- Case replay: drives the graph's real pulses/conflict/convergence, and the info panel's
// Evidence/Reasoning tabs, from the same real captured event data as before. ---

const summaryEl = document.getElementById('case-summary');
const casePills = [
  document.getElementById('tab-0'),
  document.getElementById('tab-1'),
  document.getElementById('tab-2'),
  document.getElementById('tab-3'),
];
const replayBtn = document.getElementById('tab-replay');

let activeCase = 0;
let playToken = 0;

function fmtTime(iso) { return iso.replace('T', ' ').replace('.000Z', 'Z'); }

async function playCase(idx) {
  activeCase = idx;
  playToken += 1;
  const myToken = playToken;
  casePills.forEach((t, i) => t && t.classList.toggle('active', i === idx));
  const c = allCases[idx];
  window.__orbSetActiveCase(c.case_id);
  if (summaryEl) summaryEl.textContent = c.summary;
  renderEvidenceTab(c);
  renderReasoningTab({ events: [] });

  const shown = [];
  for (const ev of c.events) {
    if (myToken !== playToken) return;
    shown.push(ev);
    renderReasoningTab({ events: shown });
    if (ev.type === 'ARENA_COMPARED') {
      window.__orbArenaCompared(c.case_id, ev.detail.indexOf('agreed') !== -1);
    } else if (ev.type === 'SYSTEM1_ROUTED') {
      window.__orbConverge(c.case_id);
    } else {
      window.__orbPulse(ev.type === 'REPLAY' ? 40 : 10);
    }
    await sleep(ev.type === 'CASE_CREATED' ? 250 : 140);
  }

  if (c.blocked_attempt) {
    if (myToken !== playToken) return;
    await sleep(400);
    shown.push({ type: 'BLOCKED', detail: 'BLOCKED ' + c.blocked_attempt.from + ' \u2192 ' + c.blocked_attempt.to + ': ' + c.blocked_attempt.message });
    renderReasoningTab({ events: shown });
    window.__orbBlockedFlash();
  }
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

casePills.forEach((pill, i) => pill && pill.addEventListener('click', () => playCase(i)));
if (replayBtn) replayBtn.addEventListener('click', () => playCase(activeCase));

playCase(0);
