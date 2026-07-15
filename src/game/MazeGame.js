import * as THREE from 'three';
import {
  generateMaze,
  sizeForLevel,
  bfsDistances,
  generateSurfaceMap,
  hashSeed,
  levelSeed,
  createRng,
  pickExits,
  pickAnchors,
  assignElevations,
  assignObstacles,
} from './maze.js';
import { AmbientAudio } from './AmbientAudio.js';

const CELL = 4;
const WALL_H = 3.4;
const MOVE_SPEED = 5.2;
const RUN_MULT = 1.8;
const COLLIDE_RADIUS = 0.35;

const STEP_HEIGHT = 0.85;

const EYE_HEIGHT = 1.6;
const CROUCH_EYE_HEIGHT = 0.9;
const STANCE_EASE_RATE = 10;
const CROUCH_SPEED_MULT = 0.5;
const JUMP_SPEED = 5.6;
const CROUCH_JUMP_MULT = 0.3;
const GRAVITY = 15.5;

const HURDLE_HEIGHT = 0.6;
const HURDLE_CLEAR_HEIGHT = 0.55;
const HURDLE_DEPTH = 0.3;

const CRAWL_OPENING_HEIGHT = 1.25;
const CRAWL_OPENING_WIDTH = CELL * 0.55;
// Was 0.36 — the beam aimed noticeably below the camera's actual look
// direction, so you had to tilt your view up toward the ceiling just to
// get the torch pointed level. The torch should aim exactly where you're
// looking, so there's no offset anymore.
const TORCH_DOWN_TILT = 0;
const TORCH_HEIGHT_OFFSET = 0.3;
const TORCH_ANGLE = Math.PI / 8;
const TORCH_THROW = 6;
const TORCH_GLOW_RADIUS = 6.5;
const PROGRESS_FOLLOW_RATE = 0.35;

// First-person hand/torch viewmodel. Rendered in its own scene+camera pass
// on top of the world (depth buffer cleared between passes) so it never
// clips into walls no matter how close the player gets to geometry.
const VIEWMODEL_FOV = 52;
const VIEWMODEL_POS = { x: 0.34, y: -0.4, z: -0.5 };
const VIEWMODEL_ROT = { x: -0.08, y: -0.42, z: 0.16 };
const VIEWMODEL_WALK_BOB_SPEED = 9.2;
const VIEWMODEL_WALK_BOB_AMOUNT = 0.022;
const VIEWMODEL_WALK_SWAY_AMOUNT = 0.014;
const VIEWMODEL_IDLE_SPEED = 1.3;
const VIEWMODEL_IDLE_AMOUNT = 0.008;
const VIEWMODEL_LOOK_SWAY = 0.05;
const VIEWMODEL_EASE_RATE = 10;
const EXIT_LETTERS = 'ABCDEFGH';

const DOOR_WIDTH = 1.6;
const DOOR_HEIGHT = 2.3;
const DOOR_THICKNESS = 0.14;
const DOOR_OPEN_ANGLE = Math.PI * 0.6;
const DOOR_OPEN_DURATION = 0.85;
const DOOR_CLOSE_DURATION = 0.55;
const DOOR_INTERACT_DIST = 2.6;
const DOOR_LOOK_DIST = 3.2;
const DOOR_AUTO_CLOSE_DELAY = 6.5;
const DOOR_LEAVE_DIST = 3.6;
const DOOR_ENTER_RADIUS = 1.1;

const ENTRANCE_YAW_FOR_WALL = { n: Math.PI, s: 0, w: -Math.PI / 2, e: Math.PI / 2 };

const GAME_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

const ANCHOR_POOL_SIZE = EXIT_LETTERS.length;

const SURFACE_TYPES = ['stone', 'grass', 'mud', 'water'];
const STAIN_TYPES = ['blood', 'mud', 'damp'];
const STAIN_CHANCE = 0.45; 

function makeStoneCanvas() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c9cad0';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3000; i++) {
    const g = 170 + Math.random() * 60;
    ctx.fillStyle = `rgba(${g},${g},${g + 4},${0.05 + Math.random() * 0.1})`;
    const s = 1 + Math.random() * 3;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, s, s);
  }
  return c;
}

function makeGrassCanvas() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#28351f';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2200; i++) {
    const g = 40 + Math.random() * 70;
    ctx.strokeStyle = `rgba(${g + 20},${g + 55},${g},${0.15 + Math.random() * 0.25})`;
    ctx.lineWidth = 1 + Math.random();
    const x = Math.random() * 256,
      y = Math.random() * 256;
    const len = 4 + Math.random() * 10;
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * 0.9;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.stroke();
  }
  return c;
}

function makeMudCanvas() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#3a2c1c';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    const g = 25 + Math.random() * 40;
    ctx.fillStyle = `rgba(${g + 32},${g + 20},${g},${0.08 + Math.random() * 0.18})`;
    const s = 4 + Math.random() * 14;
    ctx.beginPath();
    ctx.ellipse(
      Math.random() * 256,
      Math.random() * 256,
      s,
      s * 0.6,
      Math.random() * Math.PI,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  return c;
}

function makeWaterCanvas() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0b1720';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 160; i++) {
    ctx.strokeStyle = `rgba(150,190,210,${0.05 + Math.random() * 0.12})`;
    ctx.lineWidth = 1;
    const y = Math.random() * 256;
    const w = 20 + Math.random() * 60;
    const x = Math.random() * 256;
    ctx.beginPath();
    ctx.ellipse(x, y, w, 3 + Math.random() * 3, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  return c;
}

function makeStainCanvas(type, rng = Math.random) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');

  const palettes = {
    blood: ['rgba(90,10,14,ALPHA)', 'rgba(60,4,8,ALPHA)'],
    mud: ['rgba(70,52,30,ALPHA)', 'rgba(45,32,18,ALPHA)'],
    damp: ['rgba(20,24,22,ALPHA)', 'rgba(10,14,13,ALPHA)'],
  };
  const palette = palettes[type] || palettes.damp;

  const originX = 30 + rng() * 68;
  const originY = 20 + rng() * 60;
  const blobs = 5 + Math.floor(rng() * 6);
  for (let i = 0; i < blobs; i++) {
    const angle = rng() * Math.PI * 2;
    const dist = i === 0 ? 0 : rng() * 26;
    const x = originX + Math.cos(angle) * dist;
    const y = originY + Math.sin(angle) * dist + (type === 'blood' ? i * 2.5 : 0);
    const r = 8 + rng() * 20;
    const alpha = 0.35 + rng() * 0.4;
    const color = palette[Math.floor(rng() * palette.length)].replace('ALPHA', alpha.toFixed(2));
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, color);
    grad.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  if (type === 'blood') {
    const drips = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < drips; i++) {
      const dx = originX + (rng() - 0.5) * 30;
      const dripLen = 20 + rng() * 40;
      const grad = ctx.createLinearGradient(dx, originY, dx, originY + dripLen);
      grad.addColorStop(0, 'rgba(70,8,10,0.55)');
      grad.addColorStop(1, 'rgba(70,8,10,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(dx - 2, originY, 4 + rng() * 2, dripLen);
    }
  }

  return c;
}

function makeObsidianCanvas() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#100c14';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1400; i++) {
    const g = 15 + Math.random() * 45;
    ctx.fillStyle = `rgba(${g + 30},${g + 12},${g + 38},${(0.05 + Math.random() * 0.14).toFixed(2)})`;
    const s = 1 + Math.random() * 3;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, s, s);
  }
  for (let i = 0; i < 40; i++) {
    ctx.strokeStyle = `rgba(255,150,80,${(0.03 + Math.random() * 0.06).toFixed(2)})`;
    ctx.lineWidth = 1;
    const x = Math.random() * 256,
      y = Math.random() * 256;
    const len = 6 + Math.random() * 18;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 10, y + len);
    ctx.stroke();
  }
  return c;
}

function makePortalCanvas(rng = Math.random) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 256, 256);
  const cx = 128,
    cy = 128;

  for (let ring = 0; ring < 46; ring++) {
    const t = ring / 46;
    const radius = 8 + t * 150;
    const wobble = Math.sin(t * 13 + rng() * 4) * 9;
    const hue = 16 + t * 26;
    const alpha = 0.4 * (1 - t) + 0.05;
    ctx.strokeStyle = `hsla(${hue}, 92%, ${58 - t * 22}%, ${alpha.toFixed(2)})`;
    ctx.lineWidth = 2 + (1 - t) * 3;
    ctx.beginPath();
    ctx.ellipse(cx, cy, radius + wobble, radius * 0.92 + wobble, rng() * Math.PI, 0, Math.PI * 2);
    ctx.stroke();
  }

  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 110);
  grad.addColorStop(0, 'rgba(255,224,160,0.95)');
  grad.addColorStop(0.35, 'rgba(255,150,60,0.55)');
  grad.addColorStop(1, 'rgba(255,80,20,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, 118, 0, Math.PI * 2);
  ctx.fill();

  return c;
}

function makeMistCanvas() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  
  grad.addColorStop(0, 'rgba(60, 10, 15, 0.8)');
  grad.addColorStop(0.4, 'rgba(30, 5, 8, 0.4)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  return c;
}

function makeDustCanvas() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  
  grad.addColorStop(0, 'rgba(255, 60, 20, 1.0)');
  grad.addColorStop(0.3, 'rgba(200, 20, 0, 0.8)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 32, 32);
  return c;
}

// --- Flashlight/hand viewmodel textures -----------------------------------
// U wraps around a cylinder's circumference, V runs along its length, so
// these are drawn wide (U) and tall (V) with wrapS repeating so the seam
// isn't visible from any angle.

function makeBrushedMetalCanvas(base = [46, 47, 51], highlight = [235, 238, 245]) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = `rgb(${base.join(',')})`;
  ctx.fillRect(0, 0, 128, 256);

  // Fine vertical brushing (streaks running the length of the barrel).
  for (let x = 0; x < 128; x++) {
    const shade = (Math.random() - 0.5) * 22;
    const g = Math.max(0, Math.min(255, base[0] + shade));
    ctx.strokeStyle = `rgba(${g},${g + 1},${g + 3},${0.12 + Math.random() * 0.18})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const jitter = (Math.random() - 0.5) * 6;
    ctx.moveTo(x, 0);
    ctx.lineTo(x + jitter, 256);
    ctx.stroke();
  }

  // A soft rolling specular highlight band, like light catching the curve
  // of a cylindrical barrel.
  const spec = ctx.createLinearGradient(0, 0, 128, 0);
  spec.addColorStop(0, 'rgba(255,255,255,0)');
  spec.addColorStop(0.28, `rgba(${highlight.join(',')},0.22)`);
  spec.addColorStop(0.38, `rgba(${highlight.join(',')},0.4)`);
  spec.addColorStop(0.48, 'rgba(255,255,255,0)');
  spec.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = spec;
  ctx.fillRect(0, 0, 128, 256);

  // A couple of subtle machined seam rings.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, 40, 128, 3);
  ctx.fillRect(0, 210, 128, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(0, 38, 128, 1);
  ctx.fillRect(0, 208, 128, 1);

  return c;
}

function makeGripCanvas() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#232326';
  ctx.fillRect(0, 0, 128, 256);

  // Diamond-knurl pattern: two sets of diagonal ridges crossing each other,
  // the classic machined-grip look on a flashlight or torch handle.
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 2;
  const step = 12;
  for (let offset = -256; offset < 256; offset += step) {
    ctx.beginPath();
    ctx.moveTo(offset, 0);
    ctx.lineTo(offset + 256, 256);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(offset, 256);
    ctx.lineTo(offset + 256, 0);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let offset = -256 + 4; offset < 256; offset += step) {
    ctx.beginPath();
    ctx.moveTo(offset, 0);
    ctx.lineTo(offset + 256, 256);
    ctx.stroke();
  }
  return c;
}

function makeGripBumpCanvas() {
  // Grayscale companion to makeGripCanvas for a bumpMap — lighter = raised.
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#555555';
  ctx.fillRect(0, 0, 128, 256);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  const step = 12;
  for (let offset = -256; offset < 256; offset += step) {
    ctx.beginPath();
    ctx.moveTo(offset, 0);
    ctx.lineTo(offset + 256, 256);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(offset, 256);
    ctx.lineTo(offset + 256, 0);
    ctx.stroke();
  }
  return c;
}

function makeFabricCanvas(base = [26, 130, 124]) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = `rgb(${base.join(',')})`;
  ctx.fillRect(0, 0, 128, 128);
  // Diagonal knit weave — short crossed strokes for a woven-fabric feel.
  for (let i = 0; i < 900; i++) {
    const shade = (Math.random() - 0.5) * 26;
    const g = [base[0] + shade, base[1] + shade, base[2] + shade];
    ctx.strokeStyle = `rgba(${g[0]},${g[1]},${g[2]},${0.18 + Math.random() * 0.2})`;
    ctx.lineWidth = 1;
    const x = Math.random() * 128,
      y = Math.random() * 128;
    const len = 3 + Math.random() * 3;
    const ang = (Math.random() > 0.5 ? 0.7 : -0.7) + (Math.random() - 0.5) * 0.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.stroke();
  }
  return c;
}

function makeLensCanvas() {
  // A parabolic-reflector look: bright hot filament center, concentric
  // faceted rings falling off toward a warm amber rim.
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const cx = 64,
    cy = 64;
  ctx.fillStyle = '#3a2410';
  ctx.fillRect(0, 0, 128, 128);

  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 62);
  glow.addColorStop(0, 'rgba(255,247,225,1)');
  glow.addColorStop(0.18, 'rgba(255,220,160,1)');
  glow.addColorStop(0.5, 'rgba(255,176,96,0.9)');
  glow.addColorStop(0.85, 'rgba(190,100,40,0.55)');
  glow.addColorStop(1, 'rgba(120,60,20,0.2)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, 62, 0, Math.PI * 2);
  ctx.fill();

  // Faceted reflector rings.
  ctx.globalCompositeOperation = 'overlay';
  for (let r = 8; r < 60; r += 6) {
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';

  return c;
}

function makeRampGeometry(size, ownY, neighborY, dir) {
  const lowY = Math.min(ownY, neighborY) - 0.5; 
  let nwY, neY, swY, seY;
  if (dir === 'n') {
    nwY = neY = neighborY;
    swY = seY = ownY;
  } else if (dir === 's') {
    nwY = neY = ownY;
    swY = seY = neighborY;
  } else if (dir === 'w') {
    nwY = swY = neighborY;
    neY = seY = ownY;
  } else { 
    nwY = swY = ownY;
    neY = seY = neighborY;
  }
  const geo = new THREE.BoxGeometry(size, 1, size);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const isNorth = z < 0;
    const isWest = x < 0;
    if (y > 0) { 
      if (isNorth && isWest) pos.setY(i, nwY);
      else if (isNorth && !isWest) pos.setY(i, neY);
      else if (!isNorth && isWest) pos.setY(i, swY);
      else pos.setY(i, seY);
    } else { 
      pos.setY(i, lowY);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

export class MazeGame {
  constructor(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;
    this.baseSeed = hashSeed(callbacks.seed);
    this.seedString =
      callbacks.seed !== undefined && callbacks.seed !== null && callbacks.seed !== ''
        ? String(callbacks.seed)
        : String(this.baseSeed);

    this.keys = {};
    this.yaw = Math.PI;
    this.pitch = 0;
    this.player = { x: 0, z: 0, y: EYE_HEIGHT };

    // Touch/mobile support: on-screen joystick drives movement instead of
    // WASD, and a full-screen drag surface feeds the same yaw/pitch look
    // that mouse-move drives on desktop. Both are optional — nothing here
    // is used unless the React layer (App.jsx / TouchControls) calls into
    // it, so desktop behavior is untouched.
    this.isTouchDevice =
      typeof window !== 'undefined' &&
      (('ontouchstart' in window) || navigator.maxTouchPoints > 0) &&
      window.matchMedia &&
      window.matchMedia('(pointer: coarse)').matches;
    this._joystickVec = null; 

    this.currentEyeHeight = EYE_HEIGHT;
    this.verticalOffset = 0;
    this.verticalVelocity = 0;
    this.grounded = true;
    this.crouching = false;

    this.crouchToggled = false;
    this.batteryLevel = 1.0;
    this.displayProgress = 0;
    this.running = false;
    this.level = 1;
    this.mazeOrigin = { x: 0, z: 0 };
    this.wallMeshes = [];
    this.floorMeshes = [];
    this.stoneCanvas = makeStoneCanvas();
    this._floorMaterials = this._buildFloorMaterials();

    this.audio = new AmbientAudio();
    this.musicEnabled = callbacks.musicEnabled !== false;

    this.sfxCtx = null;
    this.sfxMaster = null;
    this._strideDist = 0;
    this.currentPlayerSpeed = 0;
    this.currentSurface = 'stone';
    this._ghostTimer = null;

    this.exits = [];
    this.doors = [];
    this.entranceDoor = null;
    this._raycaster = new THREE.Raycaster();
    this._doorLookTarget = null;
    this._lookDir = new THREE.Vector3();

    this._initThree();
    this._buildAtmosphere();
    this._bindInput();
    this._animate = this._animate.bind(this);
    this.clock = new THREE.Clock();
    this._raf = requestAnimationFrame(this._animate);
    this._scheduleGhostFootsteps();
    this._onResize();
    requestAnimationFrame(() => this._onResize());
  }

  _initThree() {
    const w = this.container.clientWidth || window.innerWidth || 1;
    const h = this.container.clientHeight || window.innerHeight || 1;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x020101, 0.18); 

    this.camera = new THREE.PerspectiveCamera(70, w / h, 0.1, 100);
    this.camera.position.set(0, EYE_HEIGHT, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    
    this.container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.HemisphereLight(0x2a2d35, 0x0a0a0c, 0.15));
    
    this.torch = new THREE.SpotLight(0xffc27a, 250, 35, TORCH_ANGLE, 0.3, 1.4);
    this.torch.castShadow = true;
    this.torch.shadow.mapSize.set(1024, 1024);
    this.torch.shadow.bias = -0.0008;
    this.torch.shadow.normalBias = 0.03;

    this.scene.add(this.torch);
    this.torchTarget = new THREE.Object3D();
    this.scene.add(this.torchTarget);
    this.torch.target = this.torchTarget;
    this.torchYaw = this.yaw;
    this.torchPitch = this.pitch;
    this._torchEuler = new THREE.Euler();
    this._torchForward = new THREE.Vector3();
    this.torchGlow = new THREE.PointLight(0xff6020, 14, TORCH_GLOW_RADIUS, 2);
    this.scene.add(this.torchGlow);
    this.fillLight = new THREE.PointLight(0xff4020, 2, 2, 2);
    this.camera.add(this.fillLight);
    this.fillLight.position.set(0, -0.1, 0.3);
    this.scene.add(this.camera);

    // Two-pass rendering: the world renders normally, then we clear only
    // the depth buffer and render the hand/torch viewmodel on top so it
    // always draws in front of maze geometry.
    this.renderer.autoClear = false;
    this._buildHandModel(w, h);

    this._onResize = () => {
      const clientWidth = this.container.clientWidth || window.innerWidth || 1;
      const clientHeight = this.container.clientHeight || window.innerHeight || 1;
      this.camera.aspect = clientWidth / clientHeight;
      this.camera.updateProjectionMatrix();
      if (this.viewCamera) {
        this.viewCamera.aspect = clientWidth / clientHeight;
        this.viewCamera.updateProjectionMatrix();
      }
      this.renderer.setSize(clientWidth, clientHeight);
    };
    window.addEventListener('resize', this._onResize);
  }

  // Builds a stylized first-person hand holding a torch/flashlight, similar
  // in spirit to the block-game reference: a sleeve, a hand gripping a
  // metal flashlight body, and a glowing lens at the tip. Everything is
  // built from primitives so there are no external model assets to load.
  _buildHandModel(w, h) {
    this.viewmodelScene = new THREE.Scene();
    this.viewCamera = new THREE.PerspectiveCamera(VIEWMODEL_FOV, w / h, 0.01, 10);
    this.viewmodelScene.add(this.viewCamera);

    // The viewmodel scene has no access to the world's lights, so give it
    // its own small rig: soft ambient fill plus a warm point light near
    // the lens standing in for the torch bulb glow on the hand/sleeve.
    this.viewmodelScene.add(new THREE.AmbientLight(0x554433, 0.55));
    const rig = new THREE.PointLight(0xffceA0, 1.6, 3, 2);
    rig.position.set(0.1, 0.15, 0.3);
    this.viewCamera.add(rig);
    const rimLight = new THREE.DirectionalLight(0x8899ff, 0.25);
    rimLight.position.set(-1, 1, 1);
    this.viewCamera.add(rimLight);

    this.handGroup = new THREE.Group();
    this.handGroup.position.set(VIEWMODEL_POS.x, VIEWMODEL_POS.y, VIEWMODEL_POS.z);
    this.handGroup.rotation.set(VIEWMODEL_ROT.x, VIEWMODEL_ROT.y, VIEWMODEL_ROT.z);
    this.viewCamera.add(this.handGroup);

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xdb9a67, roughness: 0.85, metalness: 0.02 });

    const sleeveTex = new THREE.CanvasTexture(makeFabricCanvas([26, 130, 124]));
    sleeveTex.wrapS = sleeveTex.wrapT = THREE.RepeatWrapping;
    sleeveTex.repeat.set(2, 2);
    sleeveTex.colorSpace = THREE.SRGBColorSpace;
    const sleeveMat = new THREE.MeshStandardMaterial({ map: sleeveTex, roughness: 0.85, metalness: 0.02 });

    const cuffTex = new THREE.CanvasTexture(makeFabricCanvas([18, 88, 84]));
    cuffTex.wrapS = cuffTex.wrapT = THREE.RepeatWrapping;
    cuffTex.repeat.set(2, 1);
    cuffTex.colorSpace = THREE.SRGBColorSpace;
    const cuffMat = new THREE.MeshStandardMaterial({ map: cuffTex, roughness: 0.85, metalness: 0.02 });

    const bodyMetalCanvas = makeBrushedMetalCanvas([46, 47, 51]);
    const bodyMetalTex = new THREE.CanvasTexture(bodyMetalCanvas);
    bodyMetalTex.wrapS = THREE.RepeatWrapping;
    bodyMetalTex.colorSpace = THREE.SRGBColorSpace;
    const bodyMetalMat = new THREE.MeshStandardMaterial({
      map: bodyMetalTex,
      roughness: 0.4,
      metalness: 0.85,
    });

    const headMetalCanvas = makeBrushedMetalCanvas([24, 24, 27]);
    const headMetalTex = new THREE.CanvasTexture(headMetalCanvas);
    headMetalTex.wrapS = THREE.RepeatWrapping;
    headMetalTex.colorSpace = THREE.SRGBColorSpace;
    const headMetalMat = new THREE.MeshStandardMaterial({
      map: headMetalTex,
      roughness: 0.35,
      metalness: 0.85,
    });

    const gripTex = new THREE.CanvasTexture(makeGripCanvas());
    gripTex.wrapS = THREE.RepeatWrapping;
    gripTex.colorSpace = THREE.SRGBColorSpace;
    const gripBumpTex = new THREE.CanvasTexture(makeGripBumpCanvas());
    gripBumpTex.wrapS = THREE.RepeatWrapping;
    const gripMat = new THREE.MeshStandardMaterial({
      map: gripTex,
      bumpMap: gripBumpTex,
      bumpScale: 0.008,
      roughness: 0.95,
      metalness: 0.1,
    });
    const switchMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.9, metalness: 0.15 });

    const lensTex = new THREE.CanvasTexture(makeLensCanvas());
    lensTex.colorSpace = THREE.SRGBColorSpace;
    this._lensMat = new THREE.MeshStandardMaterial({
      map: lensTex,
      emissiveMap: lensTex,
      emissive: 0xffb060,
      emissiveIntensity: 1.4,
      roughness: 0.25,
      metalness: 0.1,
    });

    // Forearm / sleeve, angled back toward the bottom-right of the screen.
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.55, 0.26), sleeveMat);
    sleeve.position.set(0, -0.32, 0.28);
    sleeve.rotation.x = 0.3;
    this.handGroup.add(sleeve);

    const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.07, 0.28), cuffMat);
    cuff.position.set(0, -0.1, 0.2);
    cuff.rotation.x = 0.3;
    this.handGroup.add(cuff);

    // Fingers wrap the right side of the flashlight body in a vertical
    // column, curling in toward the barrel — a bracket-style wrap (top,
    // bottom, and right side covered) rather than reaching over the top,
    // so the left face of the grip stays exposed.
    // Slightly different lengths (index/middle longest, pinky shortest)
    // and a real gap between each box (0.058 step vs 0.026 height, so a
    // ~0.032 shadowed gap) so these read as four fingers, not one slab.
    const fingerLengths = [0.13, 0.15, 0.14, 0.1];
    const fingers = [];
    for (let i = 0; i < 4; i++) {
      const finger = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.026, fingerLengths[i]), skinMat);
      finger.position.set(0.1, 0.145 - i * 0.058, -0.06);
      finger.rotation.y = -0.35;
      this.handGroup.add(finger);
      fingers.push(finger);
    }
    // Flashlight: rubber grip -> metal body -> flared head -> glowing lens,
    // extending forward (down the local -Z axis) out of the fist.
    const torchGroup = new THREE.Group();
    torchGroup.position.set(0, 0.06, -0.05);
    torchGroup.rotation.x = -Math.PI / 2 + 0.05;
    this.handGroup.add(torchGroup);

    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.22, 12), gripMat);
    grip.position.z = 0.11;
    torchGroup.add(grip);

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.052, 0.3, 12), bodyMetalMat);
    body.position.z = -0.13;
    torchGroup.add(body);

    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.055, 0.14, 12), headMetalMat);
    head.position.z = -0.35;
    torchGroup.add(head);

    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.012, 16), this._lensMat);
    lens.position.z = -0.42;
    torchGroup.add(lens);

    // Small thumb switch on the body for a bit of readable detail.
    const switchBtn = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.05), switchMat);
    switchBtn.position.set(0.05, 0, -0.02);
    torchGroup.add(switchBtn);

    this._handMeshes = [sleeve, cuff, ...fingers, grip, body, head, lens, switchBtn];
    this._handBobPhase = 0;
    this._handLastYaw = this.yaw;
    this._handLastPitch = this.pitch;
    this._handSwayX = 0;
    this._handSwayY = 0;
  }

  // Advances the hand/torch viewmodel each frame: keeps the viewmodel
  // camera locked to the player's look direction, adds a walking bob and a
  // small mouse-look sway, and lets the lens glow track the torch's own
  // battery-driven flicker so the two stay visually in sync.
  _updateHandModel(dt) {
    if (!this.viewCamera) return;
    this.viewCamera.quaternion.copy(this.camera.quaternion);
    this.viewCamera.position.copy(this.camera.position);

    const moving = this.currentPlayerSpeed > 0.01 && this.grounded;
    if (moving) {
      this._handBobPhase += dt * VIEWMODEL_WALK_BOB_SPEED;
    } else {
      this._handBobPhase += dt * VIEWMODEL_IDLE_SPEED;
    }
    const bobAmt = moving ? VIEWMODEL_WALK_BOB_AMOUNT : VIEWMODEL_IDLE_AMOUNT;
    const swayAmt = moving ? VIEWMODEL_WALK_SWAY_AMOUNT : VIEWMODEL_IDLE_AMOUNT * 0.6;
    const bobY = Math.sin(this._handBobPhase) * bobAmt;
    const bobX = Math.cos(this._handBobPhase * 0.5) * swayAmt;

    // Mouse-look sway: the hand lags slightly behind fast look movement,
    // like it has a bit of weight to it.
    let yawDelta = this.yaw - this._handLastYaw;
    yawDelta = ((yawDelta + Math.PI) % (Math.PI * 2)) - Math.PI;
    const pitchDelta = this.pitch - this._handLastPitch;
    this._handLastYaw = this.yaw;
    this._handLastPitch = this.pitch;
    const t = 1 - Math.exp(-dt * VIEWMODEL_EASE_RATE);
    this._handSwayX += (-yawDelta * VIEWMODEL_LOOK_SWAY * 20 - this._handSwayX) * t;
    this._handSwayY += (pitchDelta * VIEWMODEL_LOOK_SWAY * 20 - this._handSwayY) * t;

    this.handGroup.position.set(
      VIEWMODEL_POS.x + bobX + this._handSwayX * 0.02,
      VIEWMODEL_POS.y + bobY + this._handSwayY * 0.02,
      VIEWMODEL_POS.z
    );
    this.handGroup.rotation.set(
      VIEWMODEL_ROT.x + this._handSwayY * 0.15,
      VIEWMODEL_ROT.y + this._handSwayX * 0.15,
      VIEWMODEL_ROT.z - this._handSwayX * 0.1
    );

    // Reuse the world torch's current intensity (already includes the
    // low-battery flicker) to drive the lens glow so both read as the
    // same light source.
    if (this._lensMat && this.torch) {
      const norm = THREE.MathUtils.clamp(this.torch.intensity / 250, 0.15, 1);
      this._lensMat.emissiveIntensity = 0.6 + norm * 1.2;
    }
  }

  _buildAtmosphere() {
    this._mistTex = new THREE.CanvasTexture(makeMistCanvas());
    this._mistCount = 220; 
    this._mistRadius = 10; 
    this._mistMinRadius = 1.5; 
    this._mistData = [];

    const mistGeo = new THREE.BufferGeometry();
    const mistPos = new Float32Array(this._mistCount * 3);
    for (let i = 0; i < this._mistCount; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r = this._mistMinRadius + Math.random() * (this._mistRadius - this._mistMinRadius);
      const x = this.player.x + Math.cos(ang) * r;
      const z = this.player.z + Math.sin(ang) * r;
      const y = 0.05 + Math.random() * 0.3;
      mistPos[i * 3] = x;
      mistPos[i * 3 + 1] = y;
      mistPos[i * 3 + 2] = z;
      this._mistData.push({
        vx: (Math.random() - 0.5) * 0.1,
        vz: (Math.random() - 0.5) * 0.1,
        baseY: y,
        bobSpeed: 0.1 + Math.random() * 0.2,
        bobAmp: 0.03 + Math.random() * 0.05,
        phase: Math.random() * Math.PI * 2,
      });
    }
    mistGeo.setAttribute('position', new THREE.BufferAttribute(mistPos, 3));
    const mistMat = new THREE.PointsMaterial({
      map: this._mistTex,
      size: 2.2, 
      sizeAttenuation: true,
      color: 0x4a1010, 
      transparent: true,
      opacity: 0.35, 
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    this._mistPoints = new THREE.Points(mistGeo, mistMat);
    this.scene.add(this._mistPoints);

    this._dustTex = new THREE.CanvasTexture(makeDustCanvas());
    this._dustCount = 150; 
    this._dustRadius = 6;
    this._dustMinRadius = 1.2;
    this._dustData = [];

    const dustGeo = new THREE.BufferGeometry();
    const dustPos = new Float32Array(this._dustCount * 3);
    for (let i = 0; i < this._dustCount; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r = this._dustMinRadius + Math.random() * (this._dustRadius - this._dustMinRadius);
      const x = this.player.x + Math.cos(ang) * r;
      const z = this.player.z + Math.sin(ang) * r;
      const y = 0.3 + Math.random() * 1.6;
      dustPos[i * 3] = x;
      dustPos[i * 3 + 1] = y;
      dustPos[i * 3 + 2] = z;
      this._dustData.push({
        vy: 0.04 + Math.random() * 0.08,
        driftAmp: (Math.random() - 0.5) * 0.1,
        phase: Math.random() * Math.PI * 2,
      });
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({
      map: this._dustTex,
      size: 0.08, 
      sizeAttenuation: true,
      color: 0xff3300, 
      transparent: true,
      opacity: 0.7, 
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this._dustPoints = new THREE.Points(dustGeo, dustMat);
    this.scene.add(this._dustPoints);
  }

  _updateAtmosphere(dt) {
    const t = this.elapsed || 0;

    if (this._mistPoints) {
      const pos = this._mistPoints.geometry.attributes.position;
      const maxR2 = this._mistRadius * this._mistRadius;
      const minR2 = this._mistMinRadius * this._mistMinRadius;
      for (let i = 0; i < this._mistCount; i++) {
        const d = this._mistData[i];
        let x = pos.getX(i) + d.vx * dt;
        let z = pos.getZ(i) + d.vz * dt;
        const dx = x - this.player.x,
          dz = z - this.player.z;
        const d2 = dx * dx + dz * dz;
        if (d2 > maxR2 || d2 < minR2) {
          const ang = Math.random() * Math.PI * 2;
          const r = this._mistMinRadius + Math.random() * (this._mistRadius - this._mistMinRadius);
          x = this.player.x + Math.cos(ang) * r;
          z = this.player.z + Math.sin(ang) * r;
        }
        const y = d.baseY + Math.sin(t * d.bobSpeed + d.phase) * d.bobAmp;
        pos.setXYZ(i, x, y, z);
      }
      pos.needsUpdate = true;
    }

    if (this._dustPoints) {
      const pos = this._dustPoints.geometry.attributes.position;
      const r2 = this._dustRadius * this._dustRadius;
      for (let i = 0; i < this._dustCount; i++) {
        const d = this._dustData[i];
        let x = pos.getX(i) + Math.sin(t * 0.6 + d.phase) * d.driftAmp * dt;
        let y = pos.getY(i) + d.vy * dt;
        let z = pos.getZ(i) + Math.cos(t * 0.6 + d.phase) * d.driftAmp * dt;
        if (y > 2.2) y = 0.15;
        const dx = x - this.player.x,
          dz = z - this.player.z;
        if (dx * dx + dz * dz > r2) {
          const ang = Math.random() * Math.PI * 2;
          const r = Math.random() * this._dustRadius;
          x = this.player.x + Math.cos(ang) * r;
          z = this.player.z + Math.sin(ang) * r;
        }
        pos.setXYZ(i, x, y, z);
      }
      pos.needsUpdate = true;
    }
  }

  _bindInput() {
    this._onKeyDown = (e) => {
      this.keys[e.code] = true;

      if (e.code === 'Space' && !e.repeat) this._tryJump();
      if (e.code === 'KeyE' && !e.repeat) this._tryInteractDoor();

      if (this.running && GAME_KEYS.has(e.code)) e.preventDefault();

      if (this.running && (e.ctrlKey || e.metaKey)) e.preventDefault();
    };
    this._onKeyUp = (e) => {
      this.keys[e.code] = false;

      if ((e.code === 'ControlLeft' || e.code === 'ControlRight') && this.running) {
        this.crouchToggled = !this.crouchToggled;
      }
    };
    this._onMouseMove = (e) => {
      if (document.pointerLockElement !== this.renderer.domElement) return;
      this.yaw -= e.movementX * 0.0022;
      this.pitch -= e.movementY * 0.0022;
      this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch));
    };

    this._onClick = () => {
      if (this.isTouchDevice) return;
      if (this.running && document.pointerLockElement !== this.renderer.domElement) {
        this.requestPointerLock();
        return;
      }
      if (this.running && document.pointerLockElement === this.renderer.domElement) {
        this._tryInteractDoor();
      }
    };

    this._onPointerLockChange = () => {
      if (this.isTouchDevice) return;
      const locked = document.pointerLockElement === this.renderer.domElement;
      if (!locked && this.running) {
        this.pause();
        if (this.callbacks.onAutoPause) this.callbacks.onAutoPause();
      }
    };
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
    this.renderer.domElement.addEventListener('click', this._onClick);
  }

  requestPointerLock() {
    if (this.isTouchDevice) return;
    this.renderer.domElement.requestPointerLock();
  }

  // ---- Touch control API (called by the React touch-control overlay) ----

  // x and z are each in [-1, 1]: x is strafe (right positive), z matches
  // the sign convention _updateMovement already uses for W/S (forward is
  // negative). Magnitude below 1 means "walk slower"; magnitude above
  // ~0.85 is treated like holding Shift (run).
  setJoystickVector(x, z) {
    this._joystickVec = { x, z };
  }

  clearJoystick() {
    this._joystickVec = null;
  }

  // dx/dy are raw touch-movement pixel deltas, applied with the same
  // sensitivity constant the mouse path uses.
  lookDelta(dx, dy) {
    const TOUCH_LOOK_SENS = 0.0026 * 1.75;
    this.yaw -= dx * TOUCH_LOOK_SENS;
    this.pitch -= dy * TOUCH_LOOK_SENS;
    this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch));
  }

  tryJump() {
    this._tryJump();
  }

  setCrouch(active) {
    this.crouchToggled = active;
  }

  toggleCrouch() {
    this.crouchToggled = !this.crouchToggled;
  }

  interact() {
    this._tryInteractDoor();
  }

  _makeWallMaterial() {
    const tex = new THREE.CanvasTexture(this.stoneCanvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1.5, 1);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.95,
      metalness: 0.02,
      color: 0xe8e9ec,
    });
  }

  _buildFloorMaterials() {
    const build = (canvas, opts) => {
      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(1, 1);
      tex.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshStandardMaterial({ map: tex, ...opts });
    };
    return {
      stone: build(this.stoneCanvas, { roughness: 1, color: 0xb8b9bd }),
      grass: build(makeGrassCanvas(), { roughness: 0.95, color: 0xffffff }),
      mud: build(makeMudCanvas(), { roughness: 0.85, color: 0xffffff }),

      water: build(makeWaterCanvas(), { roughness: 0.12, metalness: 0.35, color: 0xffffff }),
    };
  }

  _clearMazeMeshes() {
    for (const m of this.wallMeshes) this.scene.remove(m);
    this.wallMeshes = [];
    for (const m of this.floorMeshes) this.scene.remove(m);
    this.floorMeshes = [];
    if (this.doors) {
      for (const m of this.doors) this.scene.remove(m);
    }
    this.doors = [];
    this.entranceDoor = null;
    this._doorLookTarget = null;
    if (this.callbacks.onDoorLookAt) this.callbacks.onDoorLookAt(null);
    if (this.ceilMesh) this.scene.remove(this.ceilMesh);
  }

  _maybeAddStain(wallMesh, axis) {
    const rng = this.rng || Math.random;
    if (rng() > STAIN_CHANCE) return;
    const type = STAIN_TYPES[Math.floor(rng() * STAIN_TYPES.length)];
    const tex = new THREE.CanvasTexture(makeStainCanvas(type, rng));
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      roughness: type === 'damp' ? 0.35 : 0.9,
      metalness: 0,
    });
    const sizeW = 1 + rng() * 1.5;
    const sizeH = 1 + rng() * 1.6;
    const stain = new THREE.Mesh(new THREE.PlaneGeometry(sizeW, sizeH), mat);

    const along = (rng() - 0.5) * (CELL - sizeW * 0.6);
    const vertical = (rng() - 0.5) * (WALL_H * 0.6) - WALL_H * 0.08;
    const faceSign = rng() < 0.5 ? 1 : -1;
    const eps = 0.14 * faceSign;

    if (axis === 'z') {
      stain.position.set(along, vertical, eps);
      if (faceSign < 0) stain.rotation.y = Math.PI;
    } else {
      stain.position.set(eps, vertical, along);
      stain.rotation.y = faceSign > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    wallMesh.add(stain);
  }

 _buildFloor(w, h) {
    const FLOOR_THICKNESS = 4.0;
    const floorGeo = new THREE.BoxGeometry(CELL, FLOOR_THICKNESS, CELL);
    const quat = new THREE.Quaternion(); 
    const originX = -(w * CELL) / 2;
    const originZ = -(h * CELL) / 2;
    const groups = { stone: [], grass: [], mud: [], water: [] };
    const rampCells = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const cell = this.maze[y][x];
        const type = (this.surfaceMap[y] && this.surfaceMap[y][x]) || 'stone';
        if (cell.rampDir) {
          rampCells.push({ x, y, type, cell });
        } else {
          (groups[type] || groups.stone).push([x, y, cell.elevation || 0]);
        }
      }
    }
    const matrix = new THREE.Matrix4();
    Object.entries(groups).forEach(([type, cells]) => {
      if (!cells.length) return;
      const mesh = new THREE.InstancedMesh(floorGeo, this._floorMaterials[type], cells.length);
      cells.forEach(([x, y, elevation], i) => {
        const cx = originX + x * CELL + CELL / 2;
        const cz = originZ + y * CELL + CELL / 2;
        const topY = elevation * STEP_HEIGHT;
        const centerY = topY - (FLOOR_THICKNESS / 2);
        matrix.compose(
          new THREE.Vector3(cx, centerY, cz),
          quat,
          new THREE.Vector3(1, 1, 1),
        );
        mesh.setMatrixAt(i, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.floorMeshes.push(mesh);
    });

    
    for (const { x, y, type, cell } of rampCells) {
      const cx = originX + x * CELL + CELL / 2;
      const cz = originZ + y * CELL + CELL / 2;
      const ownY = (cell.elevation || 0) * STEP_HEIGHT;
      const neighborY = this._neighborElevationFor(x, y, cell.rampDir) * STEP_HEIGHT;
      const geo = makeRampGeometry(CELL, ownY, neighborY, cell.rampDir);
      const mesh = new THREE.Mesh(geo, this._floorMaterials[type]);
      mesh.position.set(cx, 0, cz);
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.floorMeshes.push(mesh);
    }
  }

  _jaggedHolePoints(rng, floorLocalY, width, height) {
    const segments = 14;
    const rx = width / 2;
    const ry = height / 2;
    const cy = floorLocalY + ry * 0.9;
    const pts = [];
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const jag = 0.65 + rng() * 0.6;
      const x = Math.cos(angle) * rx * jag;
      let y = cy + Math.sin(angle) * ry * jag;
      if (y < floorLocalY + 0.06) y = floorLocalY + rng() * 0.1;
      pts.push(new THREE.Vector2(x, y));
    }
    return pts;
  }

  _buildCrawlHoleGeometry(width, spanHeight, depth, floorLocalY, rng) {
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, 0);
    shape.lineTo(width / 2, 0);
    shape.lineTo(width / 2, spanHeight);
    shape.lineTo(-width / 2, spanHeight);
    shape.lineTo(-width / 2, 0);

    const holePts = this._jaggedHolePoints(
      rng,
      floorLocalY,
      CRAWL_OPENING_WIDTH,
      CRAWL_OPENING_HEIGHT,
    );
    const holePath = new THREE.Path();
    holePath.moveTo(holePts[0].x, holePts[0].y);
    for (let i = 1; i < holePts.length; i++) holePath.lineTo(holePts[i].x, holePts[i].y);
    holePath.lineTo(holePts[0].x, holePts[0].y);
    shape.holes.push(holePath);

    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 });
    geo.translate(0, 0, -depth / 2);
    return geo;
  }

  _buildHurdleMesh(dir, cx, cz, floorY, mat) {
    const barY = floorY + HURDLE_HEIGHT / 2;
    const along = CELL * 0.8;
    let geo,
      px = cx,
      pz = cz;
    if (dir === 'n' || dir === 's') {
      geo = new THREE.BoxGeometry(along, HURDLE_HEIGHT, HURDLE_DEPTH);
      pz = cz + (dir === 'n' ? -CELL / 2 : CELL / 2);
    } else {
      geo = new THREE.BoxGeometry(HURDLE_DEPTH, HURDLE_HEIGHT, along);
      px = cx + (dir === 'w' ? -CELL / 2 : CELL / 2);
    }
    const m = new THREE.Mesh(geo, mat);
    m.position.set(px, barY, pz);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  _buildMazeMeshes(grid, w, h) {
    this._clearMazeMeshes();
    const wallMat = this._makeWallMaterial();
    const hurdleMat = new THREE.MeshStandardMaterial({
      color: 0x3a3428,
      roughness: 0.85,
      metalness: 0.05,
    });
    const ceilMat = new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 1 });

    let minElev = 0,
      maxElev = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const e = grid[y][x].elevation || 0;
        if (e < minElev) minElev = e;
        if (e > maxElev) maxElev = e;
      }
    }
    const wallBottom = minElev * STEP_HEIGHT - 0.1;
    const wallTop = maxElev * STEP_HEIGHT + WALL_H;
    const wallSpan = wallTop - wallBottom;
    const wallCenterY = (wallBottom + wallTop) / 2;
    this._wallSpan = wallSpan;
    this._wallCenterY = wallCenterY;
    this._wallBottom = wallBottom;
    this._wallTop = wallTop;
    this._wallMat = wallMat;
    const wallGeo = new THREE.BoxGeometry(CELL, wallSpan, 0.25);
    const wallGeoV = new THREE.BoxGeometry(0.25, wallSpan, CELL);
    const buildWallMesh = (crawlFlag, axis, cx, cz, floorY) => {
      if (!crawlFlag) {
        const geo = axis === 'z' ? wallGeo : wallGeoV;
        const m = new THREE.Mesh(geo, wallMat);
        m.position.set(cx, wallCenterY, cz);
        return m;
      }
      const floorLocalY = floorY - wallBottom;
      const geo = this._buildCrawlHoleGeometry(CELL, wallSpan, 0.25, floorLocalY, this.rng);
      const m = new THREE.Mesh(geo, wallMat);
      if (axis === 'z') {
        m.position.set(cx, wallBottom, cz);
      } else {
        m.rotation.y = Math.PI / 2;
        m.position.set(cx, wallBottom, cz);
      }
      return m;
    };

    const originX = -(w * CELL) / 2;
    const originZ = -(h * CELL) / 2;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const cell = grid[y][x];
        const cx = originX + x * CELL + CELL / 2;
        const cz = originZ + y * CELL + CELL / 2;
        const floorY = (cell.elevation || 0) * STEP_HEIGHT;

        if (cell.n) {
          const m = buildWallMesh(cell.crawlN, 'z', cx, cz - CELL / 2, floorY);
          this.scene.add(m);
          this.wallMeshes.push(m);
          if (!cell.crawlN) this._maybeAddStain(m, 'z');
        }
        if (cell.w) {
          const m = buildWallMesh(cell.crawlW, 'x', cx - CELL / 2, cz, floorY);
          this.scene.add(m);
          this.wallMeshes.push(m);
          if (!cell.crawlW) this._maybeAddStain(m, 'x');
        }
        if (y === h - 1 && cell.s) {
          const m = new THREE.Mesh(wallGeo, wallMat);
          m.position.set(cx, wallCenterY, cz + CELL / 2);
          this.scene.add(m);
          this.wallMeshes.push(m);
          this._maybeAddStain(m, 'z');
        }
        if (x === w - 1 && cell.e) {
          const m = new THREE.Mesh(wallGeoV, wallMat);
          m.position.set(cx + CELL / 2, wallCenterY, cz);
          this.scene.add(m);
          this.wallMeshes.push(m);
          this._maybeAddStain(m, 'x');
        }

        if (cell.hurdleDir) {
          const m = this._buildHurdleMesh(cell.hurdleDir, cx, cz, floorY, hurdleMat);
          this.scene.add(m);
          this.wallMeshes.push(m);
        }
      }
    }

    this._buildFloor(w, h);

    this.ceilMesh = new THREE.Mesh(new THREE.PlaneGeometry(w * CELL, h * CELL), ceilMat);
    this.ceilMesh.rotation.x = Math.PI / 2;
    this.ceilMesh.position.set(0, wallTop, 0);
    this.scene.add(this.ceilMesh);

    return { x: originX, z: originZ };
  }

  _cellCenter(cx, cy) {
    return {
      x: this.mazeOrigin.x + cx * CELL + CELL / 2,
      z: this.mazeOrigin.z + cy * CELL + CELL / 2,
    };
  }

  _cellCoordsFor(px, pz) {
    const relX = px - this.mazeOrigin.x;
    const relZ = pz - this.mazeOrigin.z;
    let cx = Math.floor(relX / CELL);
    let cy = Math.floor(relZ / CELL);
    cx = Math.max(0, Math.min(this.mazeW - 1, cx));
    cy = Math.max(0, Math.min(this.mazeH - 1, cy));
    return { cx, cy };
  }

  _neighborElevationFor(cx, cy, dir) {
    const deltas = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
    const d = deltas[dir];
    if (!d) return this.maze[cy][cx].elevation || 0;
    const nx = cx + d[0],
      ny = cy + d[1];
    if (nx < 0 || nx >= this.mazeW || ny < 0 || ny >= this.mazeH)
      return this.maze[cy][cx].elevation || 0;
    return this.maze[ny][nx].elevation || 0;
  }

  _floorHeightAt(px, pz) {
    if (!this.maze) return 0;
    const { cx, cy } = this._cellCoordsFor(px, pz);
    const cell = this.maze[cy][cx];
    const ownElev = cell.elevation || 0;
    if (!cell.rampDir) return ownElev * STEP_HEIGHT;

    const relX = px - this.mazeOrigin.x;
    const relZ = pz - this.mazeOrigin.z;
    const localX = relX - cx * CELL;
    const localZ = relZ - cy * CELL;
    const neighborElev = this._neighborElevationFor(cx, cy, cell.rampDir);

    let t;
    switch (cell.rampDir) {
      case 'n':
        t = 1 - localZ / CELL;
        break;
      case 's':
        t = localZ / CELL;
        break;
      case 'w':
        t = 1 - localX / CELL;
        break;
      case 'e':
        t = localX / CELL;
        break;
      default:
        t = 0;
    }
    t = Math.max(0, Math.min(1, t));
    return (ownElev + (neighborElev - ownElev) * t) * STEP_HEIGHT;
  }

  _buildPortalBackPanel(holeW, holeH, panelBottom, panelTop) {
    const w = CELL;
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, panelBottom);
    shape.lineTo(w / 2, panelBottom);
    shape.lineTo(w / 2, panelTop);
    shape.lineTo(-w / 2, panelTop);
    shape.lineTo(-w / 2, panelBottom);

    const hole = new THREE.Path();
    hole.moveTo(-holeW / 2, 0);
    hole.lineTo(holeW / 2, 0);
    hole.lineTo(holeW / 2, holeH);
    hole.lineTo(-holeW / 2, holeH);
    hole.lineTo(-holeW / 2, 0);
    shape.holes.push(hole);

    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: false, curveSegments: 1 });
    geo.translate(0, 0, -0.11);
    const mesh = new THREE.Mesh(geo, this._floorMaterials.stone);
    mesh.receiveShadow = true;
    return mesh;
  }

  _buildDoors(exits) {
    this.doors = [];
    const rng = this.rng || Math.random;
    const cardinalYaws = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
    const frameMat = new THREE.MeshStandardMaterial({
      map: new THREE.CanvasTexture(makeObsidianCanvas()),
      roughness: 0.7,
      metalness: 0.15,
      color: 0x55505f,
    });

    const frameW = DOOR_WIDTH + 0.6;
    const frameH = DOOR_HEIGHT + 0.3;

    for (const exit of exits) {
      const { x, z } = this._cellCenter(exit.x, exit.y);
      const exitFloorY = (this.maze[exit.y][exit.x].elevation || 0) * STEP_HEIGHT;
      const yaw = cardinalYaws[Math.floor(rng() * cardinalYaws.length)];

      const group = new THREE.Group();
      group.position.set(x, exitFloorY, z);
      group.rotation.y = yaw;
      group.userData.exitLetter = exit.letter;

      const globalBottom = this._wallBottom ?? -0.2;
      const globalTop = this._wallTop ?? WALL_H;
      const backPanel = this._buildPortalBackPanel(
        frameW,
        frameH,
        globalBottom - exitFloorY,
        globalTop - exitFloorY,
      );
      group.add(backPanel);

      const jambGeo = new THREE.BoxGeometry(0.22, frameH, 0.34);
      const leftJamb = new THREE.Mesh(jambGeo, frameMat);
      leftJamb.position.set(-DOOR_WIDTH / 2 - 0.11, frameH / 2, 0);
      leftJamb.castShadow = true;
      leftJamb.receiveShadow = true;
      const rightJamb = leftJamb.clone();
      rightJamb.position.x = DOOR_WIDTH / 2 + 0.11;
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(frameW, 0.26, 0.36), frameMat);
      lintel.position.set(0, frameH, 0);
      lintel.castShadow = true;
      lintel.receiveShadow = true;
      const sill = new THREE.Mesh(new THREE.BoxGeometry(frameW, 0.14, 0.36), frameMat);
      sill.position.set(0, 0.07, 0);
      sill.receiveShadow = true;
      group.add(leftJamb, rightJamb, lintel, sill);
      const portalTex = new THREE.CanvasTexture(makePortalCanvas(rng));
      portalTex.colorSpace = THREE.SRGBColorSpace;
      portalTex.wrapS = portalTex.wrapT = THREE.RepeatWrapping;
      const portalMat = new THREE.MeshBasicMaterial({
        map: portalTex,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const portal = new THREE.Mesh(
        new THREE.PlaneGeometry(DOOR_WIDTH * 0.94, DOOR_HEIGHT * 0.94),
        portalMat,
      );
      portal.position.set(0, DOOR_HEIGHT / 2, 0.02);
      group.add(portal);
      const light = new THREE.PointLight(0xff9a4d, 0, 6, 2);
      light.position.set(0, DOOR_HEIGHT * 0.55, 0.6);
      group.add(light);
      this.scene.add(group);
      exit.worldX = x;
      exit.worldZ = z;
      exit.doorYaw = yaw;
      exit.doorGroup = group;
      exit.portalMesh = portal;
      exit.portalMat = portalMat;
      exit.portalLight = light;
      exit.doorState = 'closed';
      exit.doorAnimT = 0;
      exit.doorOpenAt = 0;
      this.doors.push(group);
    }
  }

  _exitIndexForLetter(letter) {
    return EXIT_LETTERS.indexOf((letter || '').toUpperCase());
  }

  _pickEntranceWallDir(cellX, cellY) {
    const cell = this.maze[cellY] && this.maze[cellY][cellX];
    if (!cell) return null;
    if (cell.n) return 'n';
    if (cell.s) return 's';
    if (cell.e) return 'e';
    if (cell.w) return 'w';
    return null;
  }
  
  _buildEntranceDoor(cellX, cellY, wallDir) {
    const { x: cx, z: cz } = this._cellCenter(cellX, cellY);

    const axis = wallDir === 'n' || wallDir === 's' ? 'z' : 'x';
    let px = cx,
      pz = cz;
    if (wallDir === 'n') pz = cz - CELL / 2;
    else if (wallDir === 's') pz = cz + CELL / 2;
    else if (wallDir === 'w') px = cx - CELL / 2;
    else if (wallDir === 'e') px = cx + CELL / 2;

    const wallSpan = this._wallSpan || WALL_H + 0.1;
    const wallCenterY = this._wallCenterY ?? WALL_H / 2 - 0.1;
    const wallMat = this._wallMat || this._makeWallMaterial();

    const geo =
      axis === 'z' ? new THREE.BoxGeometry(CELL, wallSpan, 0.25) : new THREE.BoxGeometry(0.25, wallSpan, CELL);
    const m = new THREE.Mesh(geo, wallMat);
    m.position.set(px, wallCenterY, pz);
    m.receiveShadow = true;

    this.scene.add(m);
    this.wallMeshes.push(m);
    this.entranceDoor = null;
  }

  setSeed(seed) {
    this.baseSeed = hashSeed(seed);
    this.seedString =
      seed !== undefined && seed !== null && seed !== '' ? String(seed) : String(this.baseSeed);
    return this.seedString;
  }

  loadLevel(n, entryLetter) {
    this.level = n;
    this.floorLabel = entryLetter ? `${n}${entryLetter.toUpperCase()}` : String(n);
    const { w, h } = sizeForLevel(n);
    this.mazeW = w;
    this.mazeH = h;
    this.rng = createRng(levelSeed(this.baseSeed, n));
    this.maze = generateMaze(w, h, this.rng);
    assignElevations(this.maze, w, h, 0, 0, this.rng);
    assignObstacles(this.maze, w, h, 0, 0, this.rng);
    this.surfaceMap = generateSurfaceMap(w, h, this.rng);
    const exitCells = pickExits(this.maze, w, h, 0, 0, this.rng);
    this.exits = exitCells.map((e, i) => ({ ...e, letter: EXIT_LETTERS[i] || String(i + 1) }));
    this.discoveredExits = new Set();
    const origin = this._buildMazeMeshes(this.maze, w, h);
    this.mazeOrigin = origin;
    this._buildDoors(this.exits);
    for (const exit of this.exits) {
      exit.distGrid = bfsDistances(this.maze, w, h, exit.x, exit.y);
      exit.totalDist = Math.max(1, exit.distGrid[0][0]);
    }

    let spawnX = 0,
      spawnY = 0;
    let entranceWallDir = null;
    if (entryLetter) {
      const idx = this._exitIndexForLetter(entryLetter);
      if (idx >= 0) {
        const entranceRng = createRng(hashSeed(`${this.baseSeed}_${n}_entrances`));
        const anchors = pickAnchors(this.maze, w, h, this.exits, entranceRng, ANCHOR_POOL_SIZE);
        const anchor = anchors[idx];
        if (anchor) {
          spawnX = anchor.x;
          spawnY = anchor.y;
        }
      }
      entranceWallDir = this._pickEntranceWallDir(spawnX, spawnY);
      if (entranceWallDir) this._buildEntranceDoor(spawnX, spawnY, entranceWallDir);
    }

    const start = this._cellCenter(spawnX, spawnY);
    this.player.x = start.x;
    this.player.z = start.z;
    this.currentEyeHeight = EYE_HEIGHT;
    this.verticalOffset = 0;
    this.verticalVelocity = 0;
    this.grounded = true;
    this.crouching = false;
    this.crouchToggled = false;
    this.player.y = this._floorHeightAt(start.x, start.z) + EYE_HEIGHT;
    this.yaw = entranceWallDir ? ENTRANCE_YAW_FOR_WALL[entranceWallDir] : Math.PI;
    this.pitch = 0;
    this.torchYaw = this.yaw;
    this.torchPitch = this.pitch;
    this.batteryLevel = 1.0;
    this.displayProgress = 0;
    this._strideDist = 0;
    this.currentPlayerSpeed = 0;
    this.currentSurface = (this.surfaceMap[spawnY] && this.surfaceMap[spawnY][spawnX]) || 'stone';
    if (this.callbacks.onProgress) this.callbacks.onProgress(this.displayProgress);
    if (this.callbacks.onFloorEnter) {
      this.callbacks.onFloorEnter(this.floorLabel, { level: n, entryLetter: entryLetter || null });
    }
  }

  _ensureSfxContext() {
    if (this.sfxCtx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.sfxCtx = new Ctx();
    this.sfxMaster = this.sfxCtx.createGain();
    this.sfxMaster.gain.value = 0.8;
    this.sfxMaster.connect(this.sfxCtx.destination);
  }

  _playFootstepSound(surface, { pan = 0, gain = 0.5, muffled = false } = {}) {
    if (!this.sfxCtx) return;
    const ctx = this.sfxCtx;
    const now = ctx.currentTime;

    let out = this.sfxMaster;
    if (ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      panner.connect(this.sfxMaster);
      out = panner;
    }

    const dur = 0.09 + Math.random() * 0.05;
    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filt = ctx.createBiquadFilter();
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);

    switch (surface) {
      case 'grass':
        filt.type = 'bandpass';
        filt.frequency.value = 150 + Math.random() * 90;
        filt.Q.value = 0.6;
        g.gain.linearRampToValueAtTime(gain * 0.5, now + 0.015);
        g.gain.exponentialRampToValueAtTime(0.001, now + dur * 1.6);
        break;
      case 'mud':
        filt.type = 'lowpass';
        filt.frequency.setValueAtTime(650, now);
        filt.frequency.exponentialRampToValueAtTime(160, now + dur * 1.8);
        filt.Q.value = 1.2;
        g.gain.linearRampToValueAtTime(gain * 0.7, now + 0.015);
        g.gain.exponentialRampToValueAtTime(0.001, now + dur * 2.2);
        break;
      case 'water':
        filt.type = 'bandpass';
        filt.frequency.value = 850 + Math.random() * 350;
        filt.Q.value = 1.2;
        g.gain.linearRampToValueAtTime(gain * 0.6, now + 0.008);
        g.gain.exponentialRampToValueAtTime(0.001, now + dur * 1.2);
        break;
      case 'stone':
      default:
        filt.type = 'bandpass';
        filt.frequency.value = 340 + Math.random() * 170;
        filt.Q.value = 2.5;
        g.gain.linearRampToValueAtTime(gain * 0.55, now + 0.005);
        g.gain.exponentialRampToValueAtTime(0.001, now + dur * 1.1);
    }

    if (muffled) {
      const distFilt = ctx.createBiquadFilter();
      distFilt.type = 'lowpass';
      distFilt.frequency.value = 650;
      src.connect(filt);
      filt.connect(distFilt);
      distFilt.connect(g);
    } else {
      src.connect(filt);
      filt.connect(g);
    }
    g.connect(out);

    src.start(now);
    src.stop(now + dur * 2.5);
  }

  _updateFootsteps(dt) {
    if (this.currentPlayerSpeed <= 0.01) {
      this._strideDist = 0;
      return;
    }
    this._strideDist += this.currentPlayerSpeed * dt;
    const strideLength = this.currentSurface === 'water' ? 1.35 : 1.65;
    if (this._strideDist >= strideLength) {
      this._strideDist = 0;
      this._playFootstepSound(this.currentSurface, { pan: 0, gain: 0.55 });
    }
  }

  _updateCurrentSurface() {
    const { cx, cy } = this._cellCoordsFor(this.player.x, this.player.z);
    const next = (this.surfaceMap[cy] && this.surfaceMap[cy][cx]) || 'stone';

    if (this._lastSurface !== null && next !== this._lastSurface) {
      this._triggerSurfaceJumpscare(next);
    }
    this._lastSurface = next;
    this.currentSurface = next;
  }

  _triggerSurfaceJumpscare(surface) {
    this._shakeTime = this._shakeDuration;
    this._playJumpscareSting();
    if (this.callbacks.onJumpscare) this.callbacks.onJumpscare(surface);
  }

  _playJumpscareSting() {
    if (!this.sfxCtx) return;
    const ctx = this.sfxCtx;
    const now = ctx.currentTime;

    const dur = 0.35;
    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(480, now);
    filt.frequency.exponentialRampToValueAtTime(110, now + dur);
    filt.Q.value = 0.8;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.38, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);

    src.connect(filt);
    filt.connect(g);
    g.connect(this.sfxMaster);
    src.start(now);
    src.stop(now + dur);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(85, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + dur * 0.8);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0, now);
    og.gain.linearRampToValueAtTime(0.45, now + 0.01);
    og.gain.exponentialRampToValueAtTime(0.001, now + dur * 0.9);
    osc.connect(og);
    og.connect(this.sfxMaster);
    osc.start(now);
    osc.stop(now + dur);
  }

  _playGhostFootsteps() {
    if (!this.sfxCtx || !this.running) return;
    const behindBias = Math.random() < 0.6;
    const relativeAngle = behindBias
      ? Math.PI + (Math.random() - 0.5) * 1.0
      : Math.random() * Math.PI * 2;
    const worldAngle = this.yaw + relativeAngle;
    const steps = 2 + Math.floor(Math.random() * 3);
    const surface = SURFACE_TYPES[Math.floor(Math.random() * SURFACE_TYPES.length)];

    for (let i = 0; i < steps; i++) {
      setTimeout(
        () => {
          if (!this.running) return;
          const angleFromFacing = ((worldAngle - this.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
          const pan = Math.max(-1, Math.min(1, Math.sin(angleFromFacing)));
          this._playFootstepSound(surface, {
            pan,
            gain: 0.16 + Math.random() * 0.1,
            muffled: true,
          });
        },
        i * (260 + Math.random() * 140),
      );
    }
  }

  _scheduleGhostFootsteps() {
    const delay = 4000 + Math.random() * 8000; 
    this._ghostTimer = setTimeout(() => {
      if (this.running) this._playGhostFootsteps();
      this._scheduleGhostFootsteps();
    }, delay);
  }

  start() {
    this.running = true;
    this.elapsed = 0;
    this._ensureSfxContext();
    if (this.sfxCtx.state === 'suspended') this.sfxCtx.resume();
    if (this.musicEnabled) this.audio.start();
  }

  pause() {
    this.running = false;
    this.audio.pause();
    this._setDoorLook(null);
    this._joystickVec = null;
    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock();
    }
  }

  resume() {
    this.running = true;
    this._ensureSfxContext();
    if (this.sfxCtx.state === 'suspended') this.sfxCtx.resume();
    if (this.musicEnabled) this.audio.resume();
    this.requestPointerLock();
  }

  stop() {
    this.running = false;
    this.audio.pause();
    this._setDoorLook(null);

    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock();
    }
  }

  setMusicEnabled(enabled) {
    this.musicEnabled = enabled;
    if (enabled) {
      if (this.running) this.audio.resume();
    } else {
      this.audio.pause();
    }
  }

  _computeProgress() {
    const { cx, cy } = this._cellCoordsFor(this.player.x, this.player.z);
    let best = 0;
    for (const exit of this.exits) {
      const dist = exit.distGrid[cy][cx];
      const progress = 1 - dist / exit.totalDist;
      if (progress > best) best = progress;
    }
    return Math.max(0, Math.min(1, best));
  }

  _hurdleAt(cx, cy, dir) {
    const cell = this.maze[cy][cx];
    if (cell.hurdleDir === dir) return true;
    const deltas = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
    const opp = { n: 's', s: 'n', e: 'w', w: 'e' };
    const d = deltas[dir];
    const nx = cx + d[0],
      ny = cy + d[1];
    if (nx < 0 || nx >= this.mazeW || ny < 0 || ny >= this.mazeH) return false;
    return this.maze[ny][nx].hurdleDir === opp[dir];
  }

  _canMove(nx, nz) {
    const relX = nx - this.mazeOrigin.x;
    const relZ = nz - this.mazeOrigin.z;
    const cx = Math.floor(relX / CELL);
    const cy = Math.floor(relZ / CELL);
    if (cx < 0 || cx >= this.mazeW || cy < 0 || cy >= this.mazeH) return false;

    const cell = this.maze[cy][cx];
    const localX = relX - cx * CELL;
    const localZ = relZ - cy * CELL;
    const r = COLLIDE_RADIUS;

    const holeHalf = CRAWL_OPENING_WIDTH / 2;
    const throughN = cell.crawlN && this.crouching && Math.abs(localX - CELL / 2) < holeHalf;
    const throughS = cell.crawlS && this.crouching && Math.abs(localX - CELL / 2) < holeHalf;
    const throughW = cell.crawlW && this.crouching && Math.abs(localZ - CELL / 2) < holeHalf;
    const throughE = cell.crawlE && this.crouching && Math.abs(localZ - CELL / 2) < holeHalf;
    if (cell.n && !throughN && localZ - r < 0.13) return false;
    if (cell.s && !throughS && localZ + r > CELL - 0.13) return false;
    if (cell.w && !throughW && localX - r < 0.13) return false;
    if (cell.e && !throughE && localX + r > CELL - 0.13) return false;

    if (this.verticalOffset < HURDLE_CLEAR_HEIGHT) {
      if (this._hurdleAt(cx, cy, 'n') && localZ - r < 0.13) return false;
      if (this._hurdleAt(cx, cy, 's') && localZ + r > CELL - 0.13) return false;
      if (this._hurdleAt(cx, cy, 'w') && localX - r < 0.13) return false;
      if (this._hurdleAt(cx, cy, 'e') && localX + r > CELL - 0.13) return false;
    }

    return true;
  }

  _updateMovement(dt) {
    let mx = 0,
      mz = 0;
    let magnitude = 1;
    const jv = this._joystickVec;
    const joystickActive = jv && (Math.abs(jv.x) > 0.001 || Math.abs(jv.z) > 0.001);

    if (joystickActive) {
      mx = jv.x;
      mz = jv.z;
      magnitude = Math.min(1, Math.hypot(mx, mz));
      if (magnitude < 0.08) {
        this.currentPlayerSpeed = 0;
        return;
      }
    } else {
      if (this.keys['KeyW'] || this.keys['ArrowUp']) mz -= 1;
      if (this.keys['KeyS'] || this.keys['ArrowDown']) mz += 1;
      if (this.keys['KeyA'] || this.keys['ArrowLeft']) mx -= 1;
      if (this.keys['KeyD'] || this.keys['ArrowRight']) mx += 1;
      if (mx === 0 && mz === 0) {
        this.currentPlayerSpeed = 0;
        return;
      }
    }

    const len = Math.hypot(mx, mz) || 1;
    mx /= len;
    mz /= len;

    // Pushing the stick most of the way to its edge counts as running,
    // same idea as holding Shift on desktop.
    const touchRunning = joystickActive && magnitude > 0.85;
    const running =
      ((this.keys['ShiftLeft'] || this.keys['ShiftRight']) || touchRunning) && !this.crouching;
    const speedPerSec =
      MOVE_SPEED *
      (running ? RUN_MULT : 1) *
      (this.crouching ? CROUCH_SPEED_MULT : 1) *
      (joystickActive ? magnitude : 1);
    this.currentPlayerSpeed = speedPerSec;
    const step = speedPerSec * dt;

    const sinY = Math.sin(this.yaw),
      cosY = Math.cos(this.yaw);
    const forwardX = -sinY,
      forwardZ = -cosY;
    const rightX = cosY,
      rightZ = -sinY;

    const dx = (forwardX * -mz + rightX * mx) * step;
    const dz = (forwardZ * -mz + rightZ * mx) * step;

    const nx = this.player.x + dx;
    const nz = this.player.z + dz;

    let moved = false;
    if (this._canMove(nx, this.player.z)) {
      this.player.x = nx;
      moved = true;
    }
    if (this._canMove(this.player.x, nz)) {
      this.player.z = nz;
      moved = true;
    }

    if (!moved) this.currentPlayerSpeed = 0;
  }

  _tryJump() {
    if (!this.running) return;
    if (!this.grounded) return;
    this.verticalVelocity = JUMP_SPEED * (this.crouching ? CROUCH_JUMP_MULT : 1);
    this.grounded = false;
  }

  _updateJump(dt) {
    if (this.grounded) return;
    this.verticalVelocity -= GRAVITY * dt;
    this.verticalOffset += this.verticalVelocity * dt;
    if (this.verticalOffset <= 0) {
      this.verticalOffset = 0;
      this.verticalVelocity = 0;
      this.grounded = true;
    }
  }

  _updateStance(dt) {
    this.crouching = this.crouchToggled || !!this.keys['KeyC'];
    const target = this.crouching ? CROUCH_EYE_HEIGHT : EYE_HEIGHT;
    const t = 1 - Math.exp(-dt * STANCE_EASE_RATE);
    this.currentEyeHeight += (target - this.currentEyeHeight) * t;
  }

  _updateBattery(dt) {
    this.batteryLevel = Math.max(0, this.batteryLevel - dt * 0.004);
    
    
    let intensity = 250; 
    
    if (this.batteryLevel < 0.25) {
      intensity *= (0.55 + 0.45 * Math.sin(this.elapsed * 30)) * (0.5 + this.batteryLevel * 2);
    }
    
    this.torch.intensity = intensity;
    
    
    this.torchGlow.intensity = (intensity / 100) * 14; 
    
    if (this.callbacks.onBatteryChange) this.callbacks.onBatteryChange(this.batteryLevel);
  }

  _updateTorch(dt) {
    const lagSpeed = 6;
    const t = 1 - Math.exp(-dt * lagSpeed);

    let yawDiff = this.yaw - this.torchYaw;
    yawDiff = ((yawDiff + Math.PI) % (Math.PI * 2)) - Math.PI;
    this.torchYaw += yawDiff * t;
    this.torchPitch += (this.pitch - this.torchPitch) * t;

    const aimPitch = this.torchPitch - TORCH_DOWN_TILT;
    this._torchEuler.set(aimPitch, this.torchYaw, 0, 'YXZ');
    this._torchForward.set(0, 0, -1).applyEuler(this._torchEuler);

    this.torch.position.copy(this.camera.position);
    this.torch.position.y -= TORCH_HEIGHT_OFFSET;
    this.torchTarget.position
      .copy(this.torch.position)
      .addScaledVector(this._torchForward, TORCH_THROW);
    this.torchGlow.position
      .copy(this.torch.position)
      .addScaledVector(this._torchForward, 1.1);
  }

  _easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  _setDoorLook(exit) {
    this._doorLookTarget = exit || null;
  }

  _updateDoorLook() {
    if (!this.exits || !this.exits.length || document.pointerLockElement !== this.renderer.domElement) {
      this._setDoorLook(null);
      return;
    }
    const closedGroups = this.exits
      .filter((e) => e.doorState === 'closed')
      .map((e) => e.doorGroup);
    if (!closedGroups.length) {
      this._setDoorLook(null);
      return;
    }
    this.camera.getWorldDirection(this._lookDir);
    this._raycaster.set(this.camera.position, this._lookDir);
    this._raycaster.far = DOOR_LOOK_DIST;
    const hits = this._raycaster.intersectObjects(closedGroups, true);
    if (!hits.length) {
      this._setDoorLook(null);
      return;
    }
    let obj = hits[0].object;
    while (obj && !obj.userData.exitLetter) obj = obj.parent;
    const letter = obj ? obj.userData.exitLetter : null;
    this._setDoorLook(letter ? this.exits.find((e) => e.letter === letter) : null);
  }

  _tryInteractDoor() {
    if (!this.running) return;
    this._openDoor(this._doorLookTarget);
  }

  _openDoor(exit) {
    if (!exit || exit.doorState !== 'closed') return;
    const dist = Math.hypot(this.player.x - exit.worldX, this.player.z - exit.worldZ);
    if (dist > DOOR_INTERACT_DIST) return;

    exit.doorState = 'opening';
    this._playDoorCreak(false);

    if (this._doorLookTarget === exit) this._setDoorLook(null);

    if (!this.discoveredExits.has(exit.letter)) {
      this.discoveredExits.add(exit.letter);
      if (this.callbacks.onExitFound) {
        this.callbacks.onExitFound(exit.letter, {
          level: this.level,
          nextLabel: `${this.level + 1}${exit.letter.toUpperCase()}`,
          totalDiscovered: this.discoveredExits.size,
        });
      }
    }
  }

  _updateDoorCrossTracking(exit) {
    if (exit.doorState !== 'open') return false;
    const dist = Math.hypot(this.player.x - exit.worldX, this.player.z - exit.worldZ);
    return dist < DOOR_ENTER_RADIUS;
  }

  _enterDoor(exit) {
    if (exit.doorState === 'entered') return;
    exit.doorState = 'entered';
    this._playDoorSlam();
    this.descend(exit.letter);
  }
  
  _applyPortalAnim(exit, dt) {
    const t = this._easeOutCubic(exit.doorAnimT);
    if (exit.portalMat) exit.portalMat.opacity = t;
    if (exit.portalLight) exit.portalLight.intensity = 18 * t;
    if (exit.portalMat && exit.portalMat.map && dt) {
      exit.portalMat.map.offset.y = (exit.portalMat.map.offset.y + dt * 0.06) % 1;
      exit.portalMat.map.offset.x = (exit.portalMat.map.offset.x + dt * 0.017) % 1;
    }
  }

  _updateDoors(dt) {
    if (!this.exits) return;
    for (const exit of this.exits) {
      if (exit.doorState !== 'closed') this._applyPortalAnim(exit, dt);
      if (exit.doorState === 'closed') {
        this._openDoor(exit);
        continue;
      }

      const crossed = this._updateDoorCrossTracking(exit);

      if (exit.doorState === 'opening') {
        exit.doorAnimT = Math.min(1, exit.doorAnimT + dt / DOOR_OPEN_DURATION);
        if (exit.doorAnimT >= 1) {
          exit.doorState = 'open';
          exit.doorOpenAt = this.elapsed;
        }
      } else if (exit.doorState === 'closing') {
        exit.doorAnimT = Math.max(0, exit.doorAnimT - dt / DOOR_CLOSE_DURATION);
        if (exit.doorAnimT <= 0) {
          exit.doorState = 'closed';
        }
      } else if (exit.doorState === 'open') {
        if (crossed) {
          this._enterDoor(exit);
          return;
        }
        const dist = Math.hypot(this.player.x - exit.worldX, this.player.z - exit.worldZ);
        if (dist > DOOR_LEAVE_DIST && this.elapsed - exit.doorOpenAt > DOOR_AUTO_CLOSE_DELAY) {
          exit.doorState = 'closing';
          this._playDoorCreak(true);
        }
      }
    }
  }

  _playDoorCreak(closing) {
    this._ensureSfxContext();
    if (this.sfxCtx.state === 'suspended') this.sfxCtx.resume();
    const ctx = this.sfxCtx;
    const now = ctx.currentTime;
    const dur = 0.8 + Math.random() * 0.5;
    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.Q.value = 9 + Math.random() * 5;
    const startFreq = closing ? 420 : 180;
    const endFreq = closing ? 160 : 460;
    filt.frequency.setValueAtTime(startFreq, now);
    filt.frequency.exponentialRampToValueAtTime(endFreq, now + dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.22, now + dur * 0.25);
    g.gain.linearRampToValueAtTime(0, now + dur);

    src.connect(filt);
    filt.connect(g);
    g.connect(this.sfxMaster);
    src.start(now);
    src.stop(now + dur);
  }

  _playDoorSlam() {
    this._ensureSfxContext();
    if (this.sfxCtx.state === 'suspended') this.sfxCtx.resume();
    const ctx = this.sfxCtx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.35);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.5, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(og);
    og.connect(this.sfxMaster);
    osc.start(now);
    osc.stop(now + 0.35);

    const dur = 0.15;
    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 700;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.4, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(this.sfxMaster);
    src.start(now);
    src.stop(now + dur);
  }

  descend(letter) {
    if (!this.discoveredExits || !this.discoveredExits.has(letter)) return false;
    const fromLevel = this.level;
    this._setDoorLook(null);
    this.loadLevel(fromLevel + 1, letter);
    if (this.callbacks.onDescend) {
      this.callbacks.onDescend(this.level, letter, fromLevel, this.floorLabel);
    }
    return true;
  }

  _animate() {
    this._raf = requestAnimationFrame(this._animate);
    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (this.running) {
      this._updateStance(dt);
      this._updateJump(dt);
      this._updateMovement(dt);
      this._updateCurrentSurface();
      this._updateFootsteps(dt);
      this._updateBattery(dt);
      this._updateDoorLook();
      this._updateDoors(dt);
      this.elapsed += dt;
      if (this.callbacks.onTime) this.callbacks.onTime(this.elapsed);

      const rawProgress = this._computeProgress();
      const followT = 1 - Math.exp(-dt * PROGRESS_FOLLOW_RATE);
      this.displayProgress += (rawProgress - this.displayProgress) * followT;
      if (this.callbacks.onProgress) this.callbacks.onProgress(this.displayProgress);
    }

    this.player.y =
      this._floorHeightAt(this.player.x, this.player.z) +
      this.currentEyeHeight +
      this.verticalOffset;
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.position.set(this.player.x, this.player.y, this.player.z);
    this._updateTorch(dt);
    this._updateAtmosphere(dt);
    this._updateHandModel(dt);

    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    if (this.viewCamera) {
      this.renderer.clearDepth();
      this.renderer.render(this.viewmodelScene, this.viewCamera);
    }
  }

  dispose() {
    cancelAnimationFrame(this._raf);
    if (this._ghostTimer) clearTimeout(this._ghostTimer);
    this.audio.dispose();
    if (this.sfxCtx) this.sfxCtx.close();
    window.removeEventListener('resize', this._onResize);
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
    this.renderer.domElement.removeEventListener('click', this._onClick);
    this._clearMazeMeshes();
    if (this._mistPoints) {
      this.scene.remove(this._mistPoints);
      this._mistPoints.geometry.dispose();
      this._mistPoints.material.dispose();
    }
    if (this._mistTex) this._mistTex.dispose();
    if (this._dustPoints) {
      this.scene.remove(this._dustPoints);
      this._dustPoints.geometry.dispose();
      this._dustPoints.material.dispose();
    }
    if (this._dustTex) this._dustTex.dispose();
    if (this._handMeshes) {
      this._handMeshes.forEach((m) => {
        m.geometry.dispose();
        const mat = m.material;
        if (mat) {
          if (mat.map) mat.map.dispose();
          if (mat.bumpMap) mat.bumpMap.dispose();
          if (mat.emissiveMap) mat.emissiveMap.dispose();
          mat.dispose();
        }
      });
    }
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}