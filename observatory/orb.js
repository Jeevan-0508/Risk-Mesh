import * as THREE from 'three';
import goldenCases from './data/golden-cases.js';

// --- Particle-sphere "orb": a glowing network, pulsing when a real ledger event is revealed ---

const canvas = document.getElementById('orb-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 7);

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const group = new THREE.Group();
scene.add(group);

const POINT_COUNT = 720;
const positions = new Float32Array(POINT_COUNT * 3);
const baseColor = new THREE.Color(0xf6d68a);
const colors = new Float32Array(POINT_COUNT * 3);
const pulse = new Float32Array(POINT_COUNT); // 0..1, decays each frame

// Fibonacci sphere distribution — even coverage without polar clumping.
const golden = Math.PI * (3 - Math.sqrt(5));
for (let i = 0; i < POINT_COUNT; i++) {
  const y = 1 - (i / (POINT_COUNT - 1)) * 2;
  const radiusAtY = Math.sqrt(1 - y * y);
  const theta = golden * i;
  const x = Math.cos(theta) * radiusAtY;
  const z = Math.sin(theta) * radiusAtY;
  const jitter = 1.9 + Math.sin(i * 12.9898) * 0.06;
  positions[i * 3] = x * jitter;
  positions[i * 3 + 1] = y * jitter;
  positions[i * 3 + 2] = z * jitter;
  colors[i * 3] = baseColor.r;
  colors[i * 3 + 1] = baseColor.g;
  colors[i * 3 + 2] = baseColor.b;
}

const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

function circleSprite() {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255, 230, 180, 0.7)');
  grad.addColorStop(1, 'rgba(255, 200, 120, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

const material = new THREE.PointsMaterial({
  size: 0.045, map: circleSprite(), vertexColors: true, transparent: true,
  depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
});
const points = new THREE.Points(geometry, material);
group.add(points);

// Thread network: connect each point to its few nearest neighbours for the "web" look.
const NEIGHBOR_LIMIT = 3;
const linePositions = [];
for (let i = 0; i < POINT_COUNT; i++) {
  const pi = [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]];
  const dists = [];
  for (let j = 0; j < POINT_COUNT; j++) {
    if (i === j) continue;
    const dx = pi[0] - positions[j * 3], dy = pi[1] - positions[j * 3 + 1], dz = pi[2] - positions[j * 3 + 2];
    dists.push([dx * dx + dy * dy + dz * dz, j]);
  }
  dists.sort((a, b) => a[0] - b[0]);
  for (let k = 0; k < NEIGHBOR_LIMIT; k++) {
    const j = dists[k][1];
    if (j > i) {
      linePositions.push(pi[0], pi[1], pi[2], positions[j * 3], positions[j * 3 + 1], positions[j * 3 + 2]);
    }
  }
}
const lineGeometry = new THREE.BufferGeometry();
lineGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePositions), 3));
const lineMaterial = new THREE.LineBasicMaterial({ color: 0x6b5324, transparent: true, opacity: 0.28 });
group.add(new THREE.LineSegments(lineGeometry, lineMaterial));

// Faint outer ring, evokes the HUD reference image.
const ringGeo = new THREE.RingGeometry(2.55, 2.57, 128);
const ringMat = new THREE.MeshBasicMaterial({ color: 0xf6d68a, transparent: true, opacity: 0.12, side: THREE.DoubleSide });
const ring = new THREE.Mesh(ringGeo, ringMat);
ring.rotation.x = Math.PI / 2.15;
scene.add(ring);

let blockedFlash = 0; // set >0 to briefly redden the orb on a guard-blocked event

function pulseRandomPoints(n) {
  for (let k = 0; k < n; k++) {
    pulse[Math.floor(Math.random() * POINT_COUNT)] = 1;
  }
}
window.__orbPulse = pulseRandomPoints;
window.__orbBlockedFlash = () => { blockedFlash = 1; };

const clock = new THREE.Clock();
function animate() {
  const dt = clock.getDelta();
  group.rotation.y += dt * 0.09;
  ring.rotation.z += dt * 0.05;

  const colorAttr = geometry.attributes.color;
  const sizes = [];
  for (let i = 0; i < POINT_COUNT; i++) {
    if (pulse[i] > 0) {
      pulse[i] = Math.max(0, pulse[i] - dt * 1.6);
    }
    const glow = pulse[i];
    const r = baseColor.r + glow * (1 - baseColor.r);
    const g = baseColor.g + glow * (1 - baseColor.g) * (blockedFlash > 0 ? 0.2 : 1);
    const b = baseColor.b + glow * (1 - baseColor.b) * (blockedFlash > 0 ? 0.2 : 1);
    colorAttr.array[i * 3] = blockedFlash > 0 ? Math.min(1, r + blockedFlash * 0.5) : r;
    colorAttr.array[i * 3 + 1] = blockedFlash > 0 ? g * 0.5 : g;
    colorAttr.array[i * 3 + 2] = blockedFlash > 0 ? g * 0.5 : b;
  }
  colorAttr.needsUpdate = true;
  if (blockedFlash > 0) blockedFlash = Math.max(0, blockedFlash - dt * 0.8);

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

// --- Terminal replay driver: plays back real captured ledger events from golden-cases.json ---

const terminalEl = document.getElementById('terminal');
const summaryEl = document.getElementById('case-summary');
const tabs = [document.getElementById('tab-0'), document.getElementById('tab-1')];
const replayBtn = document.getElementById('tab-replay');

let data = goldenCases;
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
  const c = data.cases[idx];
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
    line.innerHTML = `<span class="ts">${fmtTime(data.cases[idx].events.at(-1).at)}</span><span class="type">BLOCKED ${c.blocked_attempt.from} → ${c.blocked_attempt.to}</span><span class="detail">${c.blocked_attempt.message}</span>`;
    terminalEl.appendChild(line);
    terminalEl.scrollTop = terminalEl.scrollHeight;
    window.__orbBlockedFlash();
  }
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

tabs[0].addEventListener('click', () => playCase(0));
tabs[1].addEventListener('click', () => playCase(1));
replayBtn.addEventListener('click', () => playCase(activeCase));

load();
