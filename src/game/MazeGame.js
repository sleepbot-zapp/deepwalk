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
const TORCH_DOWN_TILT = 0.36;
const TORCH_HEIGHT_OFFSET = 0.3;
const TORCH_ANGLE = Math.PI / 17;
const TORCH_THROW = 6;
const PROGRESS_FOLLOW_RATE = 0.35;
const EXIT_LETTERS = 'ABCDEFGH';

const GAME_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

const ANCHOR_POOL_SIZE = EXIT_LETTERS.length;

const SURFACE_TYPES = ['stone', 'grass', 'mud', 'water'];
const STAIN_TYPES = ['blood', 'mud', 'damp'];
const STAIN_CHANCE = 0.1;

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

function makeExitMarkerCanvas(rng = Math.random) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 384;
  const ctx = c.getContext('2d');
  const w = c.width,
    h = c.height;

  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, '#e9e2c9');
  base.addColorStop(1, '#d8cea8');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 22; i++) {
    const x = rng() * w,
      y = rng() * h,
      r = 18 + rng() * 46;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    const shade = rng() < 0.5 ? '30,26,16' : '255,250,230';
    grad.addColorStop(0, `rgba(${shade},${(0.06 + rng() * 0.08).toFixed(2)})`);
    grad.addColorStop(1, `rgba(${shade},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#0d0c08';
  const edgeBites = (from, count) => {
    for (let i = 0; i < count; i++) {
      const t = rng();
      const depth = 4 + rng() * 10;
      const size = 6 + rng() * 14;
      ctx.beginPath();
      if (from === 'top') ctx.arc(t * w, 0, size, 0, Math.PI, false);
      else if (from === 'bottom') ctx.arc(t * w, h, size, Math.PI, 0, false);
      else if (from === 'left') ctx.arc(0, t * h, size, -Math.PI / 2, Math.PI / 2, false);
      else ctx.arc(w, t * h, size, Math.PI / 2, Math.PI * 1.5, false);
      ctx.fill();
      void depth;
    }
  };
  edgeBites('top', 3);
  edgeBites('bottom', 3);
  edgeBites('left', 2);
  edgeBites('right', 2);

  const cx = w / 2 + (rng() - 0.5) * 20;
  const cy = h * 0.38 + (rng() - 0.5) * 20;
  const radius = 34 + rng() * 14;
  ctx.strokeStyle = 'rgba(50,42,28,0.75)';
  ctx.lineWidth = 2 + rng();
  ctx.lineCap = 'round';

  ctx.beginPath();
  const wobblePoints = 28;
  for (let i = 0; i <= wobblePoints; i++) {
    const a = (i / wobblePoints) * Math.PI * 2;
    const rr = radius + (rng() - 0.5) * 4;
    const px = cx + Math.cos(a) * rr;
    const py = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();

  const spokes = 5 + Math.floor(rng() * 4);
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2 + rng() * 0.3;
    const r1 = radius + 4;
    const r2 = radius + 14 + rng() * 10;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
    ctx.stroke();
  }

  const chords = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < chords; i++) {
    const a1 = rng() * Math.PI * 2;
    const a2 = rng() * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a1) * radius * 0.8, cy + Math.sin(a1) * radius * 0.8);
    ctx.lineTo(cx + Math.cos(a2) * radius * 0.8, cy + Math.sin(a2) * radius * 0.8);
    ctx.stroke();
  }

  const lineY = h * 0.62;
  ctx.strokeStyle = 'rgba(40,32,20,0.55)';
  ctx.lineWidth = 1.6;
  let px = w * 0.22;
  const scrawlEnd = w * 0.78;
  while (px < scrawlEnd) {
    const segW = 6 + rng() * 14;
    ctx.beginPath();
    ctx.moveTo(px, lineY + (rng() - 0.5) * 8);
    ctx.lineTo(px + segW, lineY + (rng() - 0.5) * 8);
    ctx.stroke();
    px += segW + 3 + rng() * 6;
  }

  for (let i = 0; i < 2 + Math.floor(rng() * 2); i++) {
    const dx = w * 0.15 + rng() * w * 0.7;
    const dy0 = h * 0.7 + rng() * h * 0.1;
    const dripLen = 20 + rng() * 50;
    const grad = ctx.createLinearGradient(dx, dy0, dx, dy0 + dripLen);
    grad.addColorStop(0, 'rgba(40,30,18,0.35)');
    grad.addColorStop(1, 'rgba(40,30,18,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(dx - 1.5, dy0, 3 + rng() * 2, dripLen);
  }

  return c;
}

function makeRampGeometry(size, ownY, neighborY, dir) {
  const s = size / 2;
  let positions;
  let indices;
  if (dir === 'n') {
    positions = [-s, neighborY, -s, s, neighborY, -s, s, ownY, s, -s, ownY, s];
    indices = [0, 2, 1, 0, 3, 2];
  } else if (dir === 's') {
    positions = [-s, ownY, -s, s, ownY, -s, s, neighborY, s, -s, neighborY, s];
    indices = [0, 2, 1, 0, 3, 2];
  } else if (dir === 'w') {
    positions = [-s, neighborY, -s, -s, neighborY, s, s, ownY, s, s, ownY, -s];
    indices = [0, 1, 2, 0, 2, 3];
  } else {
    positions = [-s, ownY, -s, -s, ownY, s, s, neighborY, s, s, neighborY, -s];
    indices = [0, 1, 2, 0, 2, 3];
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * MazeGame owns the Three.js renderer, scene, maze meshes, input and the
 * render loop. It is intentionally framework-agnostic: the React component
 * just mounts it into a DOM node and forwards callbacks/state.
 */
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

    this._initThree();
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
    this.scene.fog = new THREE.FogExp2(0x000000, 0.09);

    this.camera = new THREE.PerspectiveCamera(70, w / h, 0.1, 100);
    this.camera.position.set(0, EYE_HEIGHT, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.HemisphereLight(0x4a4d55, 0x1a1a1c, 0.9));

    this.torch = new THREE.SpotLight(0xffdca8, 100, 20, TORCH_ANGLE, 0.75, 1.3);
    this.torch.castShadow = true;
    this.torch.shadow.mapSize.set(1024, 1024);
    this.torch.shadow.bias = -0.002;

    this.scene.add(this.torch);
    this.torchTarget = new THREE.Object3D();
    this.scene.add(this.torchTarget);
    this.torch.target = this.torchTarget;
    this.torchYaw = this.yaw;
    this.torchPitch = this.pitch;
    this._torchEuler = new THREE.Euler();
    this._torchForward = new THREE.Vector3();

    this.fillLight = new THREE.PointLight(0xffb37a, 6, 3, 2);
    this.camera.add(this.fillLight);
    this.fillLight.position.set(0, -0.1, 0.3);

    this.scene.add(this.camera);

    this._onResize = () => {
      const clientWidth = this.container.clientWidth || window.innerWidth || 1;
      const clientHeight = this.container.clientHeight || window.innerHeight || 1;
      this.camera.aspect = clientWidth / clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(clientWidth, clientHeight);
    };
    window.addEventListener('resize', this._onResize);
  }

  _bindInput() {
    this._onKeyDown = (e) => {
      this.keys[e.code] = true;

      if (e.code === 'Space' && !e.repeat) this._tryJump();

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
      if (this.running && document.pointerLockElement !== this.renderer.domElement) {
        this.requestPointerLock();
      }
    };

    this._onPointerLockChange = () => {
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
    this.renderer.domElement.requestPointerLock();
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
    if (this.goalMarkers) {
      for (const m of this.goalMarkers) this.scene.remove(m);
    }
    this.goalMarkers = [];
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
    const planeGeo = new THREE.PlaneGeometry(CELL, CELL);
    const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
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
      const mesh = new THREE.InstancedMesh(planeGeo, this._floorMaterials[type], cells.length);
      cells.forEach(([x, y, elevation], i) => {
        const cx = originX + x * CELL + CELL / 2;
        const cz = originZ + y * CELL + CELL / 2;
        matrix.compose(
          new THREE.Vector3(cx, elevation * STEP_HEIGHT, cz),
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

  _buildGoalMarkers(exits) {
    this.goalMarkers = [];
    const rng = this.rng || Math.random;
    for (const exit of exits) {
      const { x, z } = this._cellCenter(exit.x, exit.y);
      const geo = new THREE.PlaneGeometry(1.6, 2.4);
      const tex = new THREE.CanvasTexture(makeExitMarkerCanvas(rng));
      tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
        roughness: 0.85,
        metalness: 0,
        emissive: 0x352816,
        emissiveIntensity: 0.35,
      });
      const marker = new THREE.Mesh(geo, mat);
      const exitFloorY = (this.maze[exit.y][exit.x].elevation || 0) * STEP_HEIGHT;
      marker.position.set(x, exitFloorY + 1.2, z);
      this.scene.add(marker);
      const light = new THREE.PointLight(0xf7dca0, 25, 6, 2);
      light.position.set(x, exitFloorY + 1.6, z);
      marker.add(light);
      this.goalMarkers.push(marker);
      exit.worldX = x;
      exit.worldZ = z;
    }
  }

  _exitIndexForLetter(letter) {
    return EXIT_LETTERS.indexOf((letter || '').toUpperCase());
  }

  setSeed(seed) {
    this.baseSeed = hashSeed(seed);
    this.seedString =
      seed !== undefined && seed !== null && seed !== '' ? String(seed) : String(this.baseSeed);
    return this.seedString;
  }

  loadLevel(n, entryLetter) {
    this.level = n;
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

    this._buildGoalMarkers(this.exits);

    for (const exit of this.exits) {
      exit.distGrid = bfsDistances(this.maze, w, h, exit.x, exit.y);
      exit.totalDist = Math.max(1, exit.distGrid[0][0]);
    }

    let spawnX = 0,
      spawnY = 0;
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
    this.yaw = Math.PI;
    this.pitch = 0;
    this.torchYaw = this.yaw;
    this.torchPitch = this.pitch;
    this.batteryLevel = 1.0;
    this.displayProgress = 0;
    this._strideDist = 0;
    this.currentPlayerSpeed = 0;
    this.currentSurface = (this.surfaceMap[spawnY] && this.surfaceMap[spawnY][spawnX]) || 'stone';
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
    const delay = 13000 + Math.random() * 25000;
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
    if (this.keys['KeyW'] || this.keys['ArrowUp']) mz -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) mz += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) mx -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) mx += 1;
    if (mx === 0 && mz === 0) {
      this.currentPlayerSpeed = 0;
      return;
    }

    const len = Math.hypot(mx, mz);
    mx /= len;
    mz /= len;

    const running = (this.keys['ShiftLeft'] || this.keys['ShiftRight']) && !this.crouching;
    const speedPerSec =
      MOVE_SPEED * (running ? RUN_MULT : 1) * (this.crouching ? CROUCH_SPEED_MULT : 1);
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
    let intensity = 90;
    if (this.batteryLevel < 0.25) {
      intensity *= (0.55 + 0.45 * Math.sin(this.elapsed * 30)) * (0.5 + this.batteryLevel * 2);
    }
    this.torch.intensity = intensity;
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
  }

  _checkGoal() {
    if (!this.exits) return;
    for (const exit of this.exits) {
      if (this.discoveredExits.has(exit.letter)) continue;
      const d = Math.hypot(this.player.x - exit.worldX, this.player.z - exit.worldZ);
      if (d < 1.1) {
        this.discoveredExits.add(exit.letter);
        if (this.callbacks.onExitFound) {
          this.callbacks.onExitFound(exit.letter, {
            level: this.level,
            nextLabel: `${this.level + 1}${exit.letter}`,
            totalDiscovered: this.discoveredExits.size,
          });
        }
      }
    }
  }

  descend(letter) {
    if (!this.discoveredExits || !this.discoveredExits.has(letter)) return false;
    this.stop();
    if (this.callbacks.onDescend) this.callbacks.onDescend(this.level, letter);
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
      this._checkGoal();
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

    this.renderer.render(this.scene, this.camera);
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
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}