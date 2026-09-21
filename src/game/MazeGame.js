import * as THREE from 'three';
import {
  generateMaze,
  sizeForLevel,
  roomDensityForLevel,
  bfsDistances,
  generateSurfaceMap,
  hashSeed,
  levelSeed,
  createRng,
  pickExits,
  pickAnchors,
  assignElevations,
  assignObstacles,
  assignDoors,
  clearHurdlesNearExits,
  clearHurdlesNearAllDoors,
  assignRoomFurniture,
  assignRooms,
  pickMazeShift,
} from './maze.js';
import { AmbientAudio } from './AmbientAudio.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import data from './scenes.json' with { type: 'json' };
import doorStylesData from './doorStyles.json' with { type: 'json' };

const DOOR_STYLES = doorStylesData.DOOR_STYLES.map(style => ({
  ...style,
  handle: parseInt(style.handle, 16),
}));
const PAINTING_SCENES = data.PAINTING_SCENES;
const CREEPY_CAPTIONS = data.CREEPY_CAPTIONS;
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
const HURDLE_DEPTH = 0.3;
const CRAWL_OPENING_HEIGHT = 1.25;
const CRAWL_OPENING_WIDTH = CELL * 0.55;
const CRAWL_PASS_MIN_WIDTH = COLLIDE_RADIUS * 2 + 0.15;
const CRAWL_PASS_MAX_WIDTH = Math.min(CRAWL_OPENING_WIDTH * 0.75, CRAWL_PASS_MIN_WIDTH + 0.6);
import furnitureData from './furnitureSupport.json' with { type: 'json' };
import environmentData from './environmentStyles.json' with { type: 'json' };

const FURNITURE_SUPPORT = furnitureData.FURNITURE_SUPPORT;
const FURNITURE_COLLIDE_RADIUS = furnitureData.FURNITURE_COLLIDE_RADIUS;

const MAX_STAND_HEIGHT = 1.0;
const TORCH_DOWN_TILT = 0;
const TORCH_HEIGHT_OFFSET = 0.3;
const TORCH_ANGLE = Math.PI / 8;
const TORCH_THROW = 6;
const TORCH_GLOW_RADIUS = 6.5;
const TORCH_NEAR_REF_DIST = 3.2;
const TORCH_NEAR_MIN_FACTOR = 0.015;
const PROGRESS_FOLLOW_RATE = 0.35;
const VIEWMODEL_FOV = 52;
const VIEWMODEL_WALK_BOB_SPEED = 9.2;
const VIEWMODEL_WALK_BOB_AMOUNT = 0.022;
const VIEWMODEL_WALK_SWAY_AMOUNT = 0.014;
const VIEWMODEL_IDLE_SPEED = 1.3;
const VIEWMODEL_IDLE_AMOUNT = 0.008;
const FLASHLIGHT_MODEL_URL = `${import.meta.env.BASE_URL}models/Flashlight.glb`;
const VIEWMODEL_POS = {
  x: 0.34,
  y: -0.4,
  z: -0.55,
};
const VIEWMODEL_ROT = {
  x: -0.08,
  y: -0.42,
  z: 0.16,
};
const FLASHLIGHT_TARGET_SIZE = 0.55;
const FLASHLIGHT_ROTATION = {
  x: Math.PI,
  y: 0,
  z: 0,
};
const FLASHLIGHT_OFFSET = {
  x: 0,
  y: 0.06,
  z: -0.05,
};
const FLASHLIGHT_LENS_MATERIAL_NAME = '1.ReflectiveTransparentMaterial';
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
const SHORTCUT_DOOR_WIDTH = 0.98;
const SHORTCUT_DOOR_HEIGHT = 2.05;
const SHORTCUT_DOOR_THICKNESS = 0.06;
const SHORTCUT_DOOR_OPEN_ANGLE = Math.PI * 0.72;
const SHORTCUT_DOOR_OPEN_DURATION = 0.6;
const SHORTCUT_DOOR_CLOSE_DURATION = 0.45;
const SHORTCUT_DOOR_INTERACT_DIST = 2.4;
const SHORTCUT_DOOR_LOOK_DIST = 3.0;
const SHORTCUT_DOOR_SEAL = 0.035; 
const DOOR_HEAD_CLEARANCE = 0.12;
const ENTRANCE_YAW_FOR_WALL = {
  n: Math.PI,
  s: 0,
  w: -Math.PI / 2,
  e: Math.PI / 2,
};
const GAME_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
const ANCHOR_POOL_SIZE = EXIT_LETTERS.length;
const WALL_SHIFT_MIN_DELAY = 18;
const WALL_SHIFT_MAX_DELAY = 32;
const WALL_RISE_DURATION = 1.1;
const WALL_SINK_DURATION = 0.85;
const WALL_SHIFT_PROTECT_RADIUS = 1;
const WALL_SHIFT_NEAR_RADIUS = 4;
const WALL_SHIFT_STAGGER = 0.14;
const WALL_SHIFT_STAGGER_JITTER = 0.22;
const WALL_SHIFT_SOUND_MAX_DIST = 26;
const WALL_SHIFT_DEBRIS_COUNT = 12;
const WALL_SHIFT_DEBRIS_LIFE = 0.85;
const {
  SURFACE_TYPES,
  STAIN_TYPES,
  STAIN_CHANCE,
  WALL_STYLE_WEIGHTS,
} = environmentData;
const PAINTING_CHANCE = 0.09;
const PAINTING_MAX_PER_MAZE_BASE = 5;
const PAINTING_MAX_PER_MAZE_PER_CELL = 0.018;

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
function makeEerieStoneCanvas(rng = Math.random) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#585349';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3200; i++) {
    const g = 50 + rng() * 55;
    const sick = rng() < 0.3;
    const r = sick ? g + 18 : g;
    const gr = sick ? g + 22 : g;
    const b = sick ? g - 10 : g + 4;
    ctx.fillStyle = `rgba(${r},${gr},${b},${(0.05 + rng() * 0.14).toFixed(2)})`;
    const s = 1 + rng() * 3;
    ctx.fillRect(rng() * 256, rng() * 256, s, s);
  }
  const veins = 6 + Math.floor(rng() * 6);
  for (let i = 0; i < veins; i++) {
    let x = rng() * 256,
      y = rng() * 256;
    ctx.strokeStyle = `rgba(20,16,14,${(0.25 + rng() * 0.3).toFixed(2)})`;
    ctx.lineWidth = 0.6 + rng() * 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const segs = 5 + Math.floor(rng() * 6);
    for (let s = 0; s < segs; s++) {
      x += (rng() - 0.5) * 30;
      y += (rng() - 0.5) * 30;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  for (let i = 0; i < 5; i++) {
    const x = rng() * 256,
      y = rng() * 256,
      r = 10 + rng() * 26;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(70,90,60,${(0.08 + rng() * 0.1).toFixed(2)})`);
    grad.addColorStop(1, 'rgba(70,90,60,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}
function makeCrackedStoneCanvas(rng = Math.random) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#a9a49a';
  ctx.fillRect(0, 0, 256, 256);
  const blockW = 64,
    blockH = 32;
  for (let y = 0; y < 256; y += blockH) {
    const offset = (y / blockH) % 2 === 0 ? 0 : blockW / 2;
    for (let x = -blockW; x < 256 + blockW; x += blockW) {
      const g = 150 + rng() * 40;
      ctx.fillStyle = `rgba(${g},${g - 4},${g - 10},${(0.06 + rng() * 0.08).toFixed(2)})`;
      ctx.fillRect(x + offset, y, blockW - 3, blockH - 3);
    }
  }
  ctx.strokeStyle = 'rgba(40,36,32,0.5)';
  ctx.lineWidth = 2;
  for (let y = 0; y <= 256; y += blockH) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }
  const cracks = 10 + Math.floor(rng() * 10);
  for (let i = 0; i < cracks; i++) {
    let x = rng() * 256,
      y = rng() * 256;
    ctx.strokeStyle = `rgba(15,13,12,${(0.3 + rng() * 0.35).toFixed(2)})`;
    ctx.lineWidth = 0.8 + rng() * 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const segs = 4 + Math.floor(rng() * 5);
    for (let s = 0; s < segs; s++) {
      x += (rng() - 0.5) * 22;
      y += (rng() - 0.5) * 22;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return c;
}
function makeStainedStoneCanvas(rng = Math.random) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#b4afa4';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3000; i++) {
    const g = 150 + rng() * 55;
    ctx.fillStyle = `rgba(${g},${g - 4},${g - 12},${(0.05 + rng() * 0.1).toFixed(2)})`;
    const s = 1 + rng() * 3;
    ctx.fillRect(rng() * 256, rng() * 256, s, s);
  }
  const streaks = 4 + Math.floor(rng() * 4);
  for (let i = 0; i < streaks; i++) {
    const x0 = rng() * 256;
    const y0 = rng() * 90;
    const len = 60 + rng() * 130;
    const w0 = 3 + rng() * 6;
    const dark = rng() < 0.5;
    const grad = ctx.createLinearGradient(x0, y0, x0, y0 + len);
    if (dark) {
      grad.addColorStop(0, 'rgba(30,15,12,0.5)');
      grad.addColorStop(1, 'rgba(30,15,12,0)');
    } else {
      grad.addColorStop(0, 'rgba(60,10,10,0.4)');
      grad.addColorStop(1, 'rgba(60,10,10,0)');
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x0 - w0 / 2, y0);
    let x = x0;
    let y = y0;
    const segs = 6 + Math.floor(rng() * 5);
    const pts = [[x0 - w0 / 2, y0]];
    for (let s = 0; s < segs; s++) {
      x += (rng() - 0.5) * 4;
      y += len / segs;
      pts.push([x - w0 / 2, y]);
    }
    for (let s = pts.length - 1; s >= 0; s--) {
      ctx.lineTo(pts[s][0] + w0, pts[s][1]);
    }
    ctx.closePath();
    ctx.fill();
  }
  if (rng() < 0.6) {
    const hx = 40 + rng() * 176,
      hy = 100 + rng() * 100;
    const scale = (0.7 + rng() * 0.5) * 3;
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate((rng() - 0.5) * 1.4);
    ctx.fillStyle = 'rgba(55,12,12,0.42)';
    ctx.beginPath();
    ctx.ellipse(0, 10 * scale, 9 * scale, 12 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let f = -2; f <= 2; f++) {
      ctx.beginPath();
      ctx.ellipse(
        f * 4 * scale,
        -6 * scale - Math.abs(f) * 1.5 * scale,
        2.2 * scale,
        8 * scale,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.restore();
  }
  return c;
}
function _shakyText(ctx, text, cx, cy, opts = {}) {
  const {
    rng = Math.random,
    size = 13,
    color = 'rgba(25,18,14,0.88)',
    maxWidth = 160,
    lineHeight = 1.3,
    font = 'Georgia, "Times New Roman", serif',
  } = opts;
  ctx.save();
  ctx.font = `${size}px ${font}`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'alphabetic';
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  const totalH = lines.length * size * lineHeight;
  let ly = cy - totalH / 2 + size;
  for (const ln of lines) {
    const lw = ctx.measureText(ln).width;
    let lx = cx - lw / 2;
    for (const ch of ln) {
      const cw = ctx.measureText(ch).width;
      ctx.save();
      ctx.translate(lx + (rng() - 0.5) * 1.1, ly + (rng() - 0.5) * 1.6);
      ctx.rotate((rng() - 0.5) * 0.07);
      ctx.fillText(ch, 0, 0);
      ctx.restore();
      lx += cw;
    }
    ly += size * lineHeight;
  }
  ctx.restore();
}
function _sketchStroke(ctx, pts, opts = {}) {
  const {
    rng = Math.random,
    color = 'rgba(20,16,14,0.8)',
    width = 1.3,
    passes = 2,
    jitter = 1.4,
  } = opts;
  for (let p = 0; p < passes; p++) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width * (0.7 + rng() * 0.6);
    ctx.beginPath();
    pts.forEach(([x, y], i) => {
      const jx = x + (rng() - 0.5) * jitter;
      const jy = y + (rng() - 0.5) * jitter;
      if (i === 0) ctx.moveTo(jx, jy);
      else ctx.lineTo(jx, jy);
    });
    ctx.stroke();
  }
}
function _paperTexture(ctx, w, h, rng) {
  const base = 172 + rng() * 22;
  ctx.fillStyle = `rgb(${base},${base - 10},${base - 30})`;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 50; i++) {
    const x = rng() * w,
      y = rng() * h,
      r = 8 + rng() * 40;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(95,72,40,${(0.04 + rng() * 0.08).toFixed(2)})`);
    grad.addColorStop(1, 'rgba(95,72,40,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(60,45,25,${(0.02 + rng() * 0.05).toFixed(2)})`;
    ctx.fillRect(rng() * w, rng() * h, 1, 1);
  }
  const vg = ctx.createRadialGradient(
    w / 2,
    h / 2,
    Math.min(w, h) * 0.3,
    w / 2,
    h / 2,
    Math.max(w, h) * 0.7,
  );
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(15,10,6,0.5)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}
function _crayonPaperTexture(ctx, w, h, rng) {
  const base = 220 + rng() * 16;
  ctx.fillStyle = `rgb(${base},${base - 4},${base - 16})`;
  ctx.fillRect(0, 0, w, h);
  if (rng() < 0.55) {
    const hue = Math.floor(rng() * 360);
    ctx.strokeStyle = `hsla(${hue},70%,45%,0.3)`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 130; i++) {
      const x = rng() * w,
        y = rng() * h;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rng() - 0.5) * 14, y + (rng() - 0.5) * 14);
      ctx.stroke();
    }
  }
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = `rgba(100,80,50,${(0.02 + rng() * 0.05).toFixed(2)})`;
    ctx.fillRect(rng() * w, rng() * h, 1, 1);
  }
}
function _sceneTallFigure(ctx, ix, iy, iw, ih, rng, pal) {
  const cx = ix + iw / 2 + (rng() - 0.5) * iw * 0.08;
  const headR = iw * 0.11;
  const headY = iy + ih * 0.16;
  if (pal.ink) {
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 1;
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.arc(cx, headY, headR * (1.8 + i * 0.35), 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  const shoulderY = headY + headR * 1.3;
  const hipY = iy + ih * 0.6;
  const footY = iy + ih * 0.92;
  const shoulderW = iw * 0.15;
  const hipW = iw * 0.075;
  ctx.fillStyle = pal.fill;
  ctx.beginPath();
  ctx.ellipse(cx, headY, headR * 0.82, headR, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - shoulderW, shoulderY);
  ctx.lineTo(cx - hipW, hipY);
  ctx.lineTo(cx - hipW * 0.55, footY);
  ctx.lineTo(cx + hipW * 0.55, footY);
  ctx.lineTo(cx + hipW, hipY);
  ctx.lineTo(cx + shoulderW, shoulderY);
  ctx.closePath();
  ctx.fill();
  for (const side of [-1, 1]) {
    const sx = cx + side * shoulderW * 0.85;
    const bendY = shoulderY + ih * (0.22 + rng() * 0.08);
    const ex = sx + side * (iw * 0.05 + rng() * iw * 0.05);
    const ey = shoulderY + ih * (0.42 + rng() * 0.08);
    _sketchStroke(
      ctx,
      [
        [sx, shoulderY + 2],
        [sx + side * 3, bendY],
        [ex, ey],
      ],
      {
        rng,
        color: pal.stroke,
        passes: pal.ink ? 2 : 1,
        width: pal.ink ? 1.3 : 2.4,
        jitter: pal.ink ? 1.6 : 0.5,
      },
    );
    for (let f = 0; f < 3; f++) {
      _sketchStroke(
        ctx,
        [
          [ex, ey],
          [ex + side * (2 + rng() * 4), ey + 6 + rng() * 6],
        ],
        { rng, color: pal.stroke, passes: 1, width: 0.9, jitter: 0.8 },
      );
    }
  }
}
function _sceneCrouchedFigure(ctx, ix, iy, iw, ih, rng, pal) {
  const cx = ix + iw / 2 + (rng() - 0.5) * iw * 0.1;
  const baseY = iy + ih * 0.86;
  const w = iw * 0.34;
  const h = ih * 0.4;
  ctx.fillStyle = pal.fill;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.5, baseY);
  ctx.quadraticCurveTo(cx - w * 0.65, baseY - h * 0.6, cx - w * 0.15, baseY - h);
  ctx.quadraticCurveTo(cx, baseY - h * 1.12, cx + w * 0.15, baseY - h);
  ctx.quadraticCurveTo(cx + w * 0.65, baseY - h * 0.6, cx + w * 0.5, baseY);
  ctx.closePath();
  ctx.fill();
  const headR = iw * 0.09;
  ctx.beginPath();
  ctx.ellipse(cx, baseY - h - headR * 0.5, headR * 0.8, headR, 0, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 3; i++) {
    _sketchStroke(
      ctx,
      [
        [cx - w * 0.3, baseY - h * (0.3 + i * 0.15)],
        [cx, baseY - h * (0.45 + i * 0.1)],
        [cx + w * 0.3, baseY - h * (0.3 + i * 0.15)],
      ],
      { rng, color: pal.stroke, passes: pal.ink ? 2 : 1, width: pal.ink ? 1 : 2, jitter: 1.4 },
    );
  }
  ctx.fillStyle = pal.accent;
  ctx.beginPath();
  ctx.ellipse(cx, baseY + 3, w * 0.65, 5, 0, 0, Math.PI * 2);
  ctx.fill();
}
function _sceneAntlerFigure(ctx, ix, iy, iw, ih, rng, pal) {
  _sceneTallFigure(ctx, ix, iy, iw, ih, rng, pal);
  const cx = ix + iw / 2;
  const headY = iy + ih * 0.16;
  const headR = iw * 0.11;
  for (const side of [-1, 1]) {
    let x = cx + side * headR * 0.4,
      y = headY - headR * 0.6;
    const branches = 3 + Math.floor(rng() * 2);
    for (let b = 0; b < branches; b++) {
      const nx = x + side * (4 + rng() * 8);
      const ny = y - (8 + rng() * 10);
      _sketchStroke(ctx, [[x, y], [nx, ny]], {
        rng,
        color: pal.stroke,
        passes: 1,
        width: 1.1,
        jitter: 0.6,
      });
      if (rng() < 0.7) {
        _sketchStroke(
          ctx,
          [
            [x + side * 2, y - 4],
            [x + side * (7 + rng() * 5), y - 8 - rng() * 6],
          ],
          { rng, color: pal.stroke, passes: 1, width: 0.9, jitter: 0.6 },
        );
      }
      x = nx;
      y = ny;
    }
  }
}
function _sceneEye(ctx, ix, iy, iw, ih, rng, pal) {
  const cx = ix + iw / 2,
    cy = iy + ih * 0.42;
  const w = iw * 0.7,
    h = ih * 0.26;
  ctx.fillStyle = pal.fill;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, cy);
  ctx.quadraticCurveTo(cx - w * 0.2, cy - h, cx, cy - h * 0.15);
  ctx.quadraticCurveTo(cx + w * 0.2, cy - h, cx + w / 2, cy);
  ctx.quadraticCurveTo(cx + w * 0.2, cy + h, cx, cy + h * 0.15);
  ctx.quadraticCurveTo(cx - w * 0.2, cy + h, cx - w / 2, cy);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = pal.bg;
  ctx.beginPath();
  ctx.arc(cx, cy, h * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = pal.stroke;
  ctx.beginPath();
  ctx.arc(cx, cy, h * 0.28, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI - Math.PI / 2 + (rng() - 0.5) * 0.1;
    const x1 = cx + Math.cos(a) * w * 0.5;
    const y1 = cy - Math.sin(a) * h * 0.9;
    const len = 8 + rng() * 22;
    _sketchStroke(
      ctx,
      [
        [x1, y1],
        [x1 + (rng() - 0.5) * 6, y1 - len],
      ],
      { rng, color: pal.stroke, passes: 1, width: 1, jitter: 1 },
    );
  }
}
function _sceneHallway(ctx, ix, iy, iw, ih, rng, pal) {
  const vx = ix + iw * (0.45 + rng() * 0.1),
    vy = iy + ih * 0.42;
  ctx.fillStyle = pal.fill;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.moveTo(ix, iy + ih);
  ctx.lineTo(vx - 6, vy);
  ctx.lineTo(vx + 6, vy);
  ctx.lineTo(ix + iw, iy + ih);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  for (let i = 1; i < 5; i++) {
    const t = i / 5;
    _sketchStroke(
      ctx,
      [
        [ix + (vx - ix) * t * 0.6, iy + ih - (iy + ih - vy) * t * 0.9],
        [ix + iw - (ix + iw - vx) * t * 0.6, iy + ih - (iy + ih - vy) * t * 0.9],
      ],
      { rng, color: pal.stroke, passes: 1, width: 0.8, jitter: 1 },
    );
  }
  const fH = ih * 0.1;
  ctx.fillStyle = pal.stroke;
  ctx.beginPath();
  ctx.ellipse(vx + (rng() - 0.5) * 10, vy + fH * 0.9, fH * 0.15, fH * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
}
function _sceneMoonFigure(ctx, ix, iy, iw, ih, rng, pal) {
  const cx = ix + iw / 2,
    moonY = iy + ih * 0.28,
    moonR = iw * 0.14;
  const grad = ctx.createRadialGradient(cx, moonY, 0, cx, moonY, moonR * 3);
  grad.addColorStop(0, pal.ink ? 'rgba(210,205,190,0.5)' : 'rgba(255,240,180,0.55)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, moonY, moonR * 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = pal.stroke;
  ctx.beginPath();
  ctx.arc(cx, moonY, moonR, 0, Math.PI * 2);
  ctx.fill();
  const horizon = iy + ih * 0.68;
  ctx.fillStyle = pal.fill;
  ctx.beginPath();
  ctx.moveTo(ix, horizon);
  let x = ix;
  while (x < ix + iw) {
    ctx.lineTo(x, horizon - rng() * ih * 0.08);
    x += 6 + rng() * 10;
  }
  ctx.lineTo(ix + iw, iy + ih);
  ctx.lineTo(ix, iy + ih);
  ctx.closePath();
  ctx.fill();
  const figH = ih * 0.18;
  ctx.beginPath();
  ctx.ellipse(
    cx + (rng() - 0.5) * iw * 0.2,
    horizon - figH * 0.45,
    figH * 0.12,
    figH * 0.5,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
}
function _sceneHoodedFigure(ctx, ix, iy, iw, ih, rng, pal) {
  const cx = ix + iw / 2 + (rng() - 0.5) * iw * 0.1;
  const topY = iy + ih * 0.14,
    baseY = iy + ih * 0.92;
  ctx.fillStyle = pal.fill;
  ctx.beginPath();
  ctx.moveTo(cx, topY);
  ctx.quadraticCurveTo(cx - iw * 0.22, topY + (baseY - topY) * 0.3, cx - iw * 0.16, baseY);
  ctx.lineTo(cx + iw * 0.16, baseY);
  ctx.quadraticCurveTo(cx + iw * 0.22, topY + (baseY - topY) * 0.3, cx, topY);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = pal.bg;
  const eyeY = topY + (baseY - topY) * 0.18;
  ctx.beginPath();
  ctx.arc(cx - iw * 0.045, eyeY, iw * 0.018, 0, Math.PI * 2);
  ctx.arc(cx + iw * 0.045, eyeY, iw * 0.018, 0, Math.PI * 2);
  ctx.fill();
}
function _sceneSmiley(ctx, ix, iy, iw, ih, rng, pal) {
  const cx = ix + iw / 2,
    cy = iy + ih * 0.42,
    r = iw * 0.28;
  ctx.fillStyle = pal.bg;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = pal.stroke;
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.35, cy - r * 0.1, r * 0.16, r * 0.22, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + r * 0.35, cy - r * 0.1, r * 0.16, r * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = r * 0.1;
  ctx.strokeStyle = pal.stroke;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.55, cy + r * 0.25);
  ctx.quadraticCurveTo(cx, cy + r * 0.75, cx + r * 0.55, cy + r * 0.25);
  ctx.stroke();
  if (rng() < 0.5) {
    const bloodColor = pal.ink ? 'rgba(120,20,20,0.5)' : '#7a1414';
    for (const side of [-1, 1]) {
      _sketchStroke(
        ctx,
        [
          [cx + side * r * 0.35, cy + r * 0.1],
          [cx + side * r * 0.3, cy + r * 0.5],
        ],
        { rng, color: bloodColor, passes: 1, width: 1.4, jitter: 1 },
      );
    }
  }
}
function _sceneSymbol(ctx, ix, iy, iw, ih, rng, pal) {
  const cx = ix + iw / 2,
    cy = iy + ih * 0.42;
  ctx.strokeStyle = pal.stroke;
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(cx, cy, iw * 0.12 + i * iw * 0.06, 0, Math.PI * 2);
    ctx.stroke();
  }
  const spikes = 8;
  for (let i = 0; i < spikes; i++) {
    const a = (i / spikes) * Math.PI * 2;
    const r1 = iw * 0.3,
      r2 = iw * 0.38 + rng() * iw * 0.06;
    _sketchStroke(
      ctx,
      [
        [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1],
        [cx + Math.cos(a) * r2, cy + Math.sin(a) * r2],
      ],
      { rng, color: pal.stroke, passes: 1, width: 1, jitter: 0.6 },
    );
  }
  _sketchStroke(
    ctx,
    [
      [cx, cy - iw * 0.4],
      [cx, cy + iw * 0.4],
    ],
    { rng, color: pal.stroke, passes: 1, width: 1, jitter: 0.6 },
  );
  _sketchStroke(
    ctx,
    [
      [cx - iw * 0.4, cy],
      [cx + iw * 0.4, cy],
    ],
    { rng, color: pal.stroke, passes: 1, width: 1, jitter: 0.6 },
  );
}
function _sceneTallyMarks(ctx, ix, iy, iw, ih, rng, pal) {
  const rows = 3 + Math.floor(rng() * 3);
  const startY = iy + ih * 0.25;
  const rowGap = ih * 0.14;
  for (let r = 0; r < rows; r++) {
    const y = startY + r * rowGap;
    const groups = 2 + Math.floor(rng() * 3);
    let x = ix + iw * 0.12;
    for (let g = 0; g < groups; g++) {
      for (let i = 0; i < 4; i++) {
        _sketchStroke(
          ctx,
          [
            [x + i * 4, y],
            [x + i * 4 + (rng() - 0.5) * 2, y + ih * 0.09],
          ],
          { rng, color: pal.stroke, passes: 1, width: pal.ink ? 1.2 : 2, jitter: 0.8 },
        );
      }
      _sketchStroke(
        ctx,
        [
          [x - 2, y + ih * 0.09],
          [x + 4 * 4 + 2, y],
        ],
        { rng, color: pal.stroke, passes: 1, width: pal.ink ? 1.2 : 2, jitter: 0.8 },
      );
      x += 4 * 4 + 10;
    }
  }
}
function _sceneHandprints(ctx, ix, iy, iw, ih, rng, pal) {
  const color = pal.ink ? 'rgba(110,20,20,0.5)' : '#7a1414';
  const count = 4 + Math.floor(rng() * 4);
  for (let i = 0; i < count; i++) {
    const cx = ix + rng() * iw,
      cy = iy + rng() * ih;
    const scale = (0.5 + rng() * 0.5) * iw * 0.012;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((rng() - 0.5) * 1.2);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 10 * scale, 9 * scale, 12 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let f = -2; f <= 2; f++) {
      ctx.beginPath();
      ctx.ellipse(
        f * 4 * scale,
        -6 * scale - Math.abs(f) * 1.5 * scale,
        2.2 * scale,
        8 * scale,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.restore();
  }
}
function _sceneSpiral(ctx, ix, iy, iw, ih, rng, pal) {
  const cx = ix + iw / 2,
    cy = iy + ih * 0.42;
  const maxR = Math.min(iw, ih) * 0.42;
  ctx.strokeStyle = pal.stroke;
  ctx.lineWidth = pal.ink ? 1.2 : 2.2;
  ctx.beginPath();
  const turns = 5.5;
  const steps = 160;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * Math.PI * 2 * turns;
    const r = t * maxR;
    const x = cx + Math.cos(a) * r + (rng() - 0.5) * 0.6;
    const y = cy + Math.sin(a) * r + (rng() - 0.5) * 0.6;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}
function _sceneMask(ctx, ix, iy, iw, ih, rng, pal) {
  const cx = ix + iw / 2,
    cy = iy + ih * 0.4,
    r = iw * 0.26;
  ctx.fillStyle = pal.bg;
  ctx.beginPath();
  ctx.ellipse(cx, cy, r * 0.82, r, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = pal.stroke;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = pal.stroke;
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.32, cy - r * 0.05, r * 0.09, r * 0.14, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + r * 0.32, cy - r * 0.05, r * 0.09, r * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  const my = cy + r * 0.4;
  _sketchStroke(
    ctx,
    [
      [cx - r * 0.3, my],
      [cx + r * 0.3, my],
    ],
    { rng, color: pal.stroke, passes: 1, width: 1, jitter: 0.5 },
  );
  for (let i = -2; i <= 2; i++) {
    _sketchStroke(
      ctx,
      [
        [cx + i * r * 0.1, my - 3],
        [cx + i * r * 0.1, my + 3],
      ],
      { rng, color: pal.stroke, passes: 1, width: 0.8, jitter: 0.4 },
    );
  }
}
function _sceneDoorAjar(ctx, ix, iy, iw, ih, rng, pal) {
  const dW = iw * 0.5,
    dH = ih * 0.62;
  const dx = ix + iw * 0.25,
    dy = iy + ih * 0.22;
  ctx.fillStyle = pal.fill;
  ctx.fillRect(dx, dy, dW, dH);
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  const gapW = dW * (0.18 + rng() * 0.12);
  ctx.fillRect(dx + dW - gapW, dy, gapW, dH);
  ctx.strokeStyle = pal.stroke;
  ctx.lineWidth = 1;
  ctx.strokeRect(dx, dy, dW, dH);
  if (rng() < 0.6) {
    ctx.fillStyle = pal.stroke;
    ctx.beginPath();
    ctx.ellipse(dx + dW - gapW * 0.5, dy + dH * 0.35, gapW * 0.28, gapW * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
function _sceneStaircase(ctx, ix, iy, iw, ih, rng, pal) {
  const steps = 7;
  const topW = iw * 0.7,
    cx = ix + iw / 2;
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const y = iy + ih * 0.2 + t * ih * 0.65;
    const w = topW * (1 - t * 0.7);
    const shade = pal.ink ? `rgba(20,16,14,${0.15 + t * 0.5})` : `rgba(10,8,8,${0.2 + t * 0.55})`;
    ctx.fillStyle = shade;
    ctx.fillRect(cx - w / 2, y, w, ih * 0.07);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.9)';
  ctx.beginPath();
  ctx.ellipse(cx, iy + ih * 0.86, topW * 0.16, ih * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
}
function _sceneTeeth(ctx, ix, iy, iw, ih, rng, pal) {
  const cx = ix + iw / 2,
    cy = iy + ih * 0.45;
  const w = iw * 0.6,
    h = ih * 0.32;
  ctx.fillStyle = 'rgba(20,4,4,0.75)';
  ctx.beginPath();
  ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = pal.bg;
  const teeth = 8;
  for (let i = 0; i < teeth; i++) {
    const t = i / (teeth - 1);
    const x = cx - w / 2 + t * w;
    const th = h * 0.3 + rng() * h * 0.15;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.03, cy - h * 0.4);
    ctx.lineTo(x + w * 0.03, cy - h * 0.4);
    ctx.lineTo(x, cy - h * 0.4 + th);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - w * 0.03, cy + h * 0.4);
    ctx.lineTo(x + w * 0.03, cy + h * 0.4);
    ctx.lineTo(x, cy + h * 0.4 - th);
    ctx.closePath();
    ctx.fill();
  }
}
function _sceneFamilyWrong(ctx, ix, iy, iw, ih, rng, pal) {
  const baseY = iy + ih * 0.82;
  const people = 3;
  const spacing = iw * 0.16;
  const startX = ix + iw * 0.28;
  for (let i = 0; i < people; i++) {
    const x = startX + i * spacing;
    const h2 = ih * (0.16 + (i % 2) * 0.03);
    ctx.strokeStyle = pal.stroke;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(x, baseY - h2 - h2 * 0.22, h2 * 0.18, 0, Math.PI * 2);
    ctx.stroke();
    _sketchStroke(
      ctx,
      [
        [x, baseY - h2],
        [x, baseY],
      ],
      { rng, color: pal.stroke, passes: 1, width: 1.4, jitter: 0.6 },
    );
    _sketchStroke(
      ctx,
      [
        [x - h2 * 0.22, baseY - h2 * 0.6],
        [x + h2 * 0.22, baseY - h2 * 0.6],
      ],
      { rng, color: pal.stroke, passes: 1, width: 1.2, jitter: 0.6 },
    );
    _sketchStroke(
      ctx,
      [
        [x, baseY],
        [x - h2 * 0.18, baseY + h2 * 0.28],
      ],
      { rng, color: pal.stroke, passes: 1, width: 1.2, jitter: 0.6 },
    );
    _sketchStroke(
      ctx,
      [
        [x, baseY],
        [x + h2 * 0.18, baseY + h2 * 0.28],
      ],
      { rng, color: pal.stroke, passes: 1, width: 1.2, jitter: 0.6 },
    );
  }
  const dx = startX + (rng() < 0.5 ? -1 : people) * spacing * 0.55 + spacing * 0.5;
  const dh = ih * 0.34;
  ctx.fillStyle = pal.fill;
  ctx.beginPath();
  ctx.ellipse(dx, baseY - dh * 0.92, dh * 0.09, dh * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(dx - dh * 0.12, baseY - dh * 0.8);
  ctx.lineTo(dx - dh * 0.05, baseY);
  ctx.lineTo(dx + dh * 0.05, baseY);
  ctx.lineTo(dx + dh * 0.12, baseY - dh * 0.8);
  ctx.closePath();
  ctx.fill();
}
function _sceneCrackedMirror(ctx, ix, iy, iw, ih, rng, pal) {
  const cx = ix + iw / 2,
    cy = iy + ih * 0.42;
  const rW = iw * 0.34,
    rH = ih * 0.4;
  ctx.fillStyle = pal.ink ? 'rgba(60,58,54,0.35)' : 'rgba(40,40,45,0.5)';
  ctx.beginPath();
  ctx.ellipse(cx, cy, rW, rH, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = pal.stroke;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  const shards = 6 + Math.floor(rng() * 4);
  for (let i = 0; i < shards; i++) {
    const a = rng() * Math.PI * 2;
    const r0 = rW * (0.1 + rng() * 0.15);
    const r1 = Math.max(rW, rH) * (0.75 + rng() * 0.3);
    _sketchStroke(
      ctx,
      [
        [cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * (rH / rW)],
        [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * (rH / rW)],
      ],
      { rng, color: pal.stroke, passes: 1, width: 1, jitter: 1.2 },
    );
  }
  if (rng() < 0.6) {
    const eyeY = cy - rH * 0.1;
    ctx.fillStyle = pal.fill;
    ctx.beginPath();
    ctx.arc(cx - rW * 0.18, eyeY, rW * 0.05, 0, Math.PI * 2);
    ctx.arc(cx + rW * 0.18, eyeY, rW * 0.05, 0, Math.PI * 2);
    ctx.fill();
  }
}
function _sceneWatchingWindow(ctx, ix, iy, iw, ih, rng, pal) {
  const wW = iw * 0.5,
    wH = ih * 0.5;
  const wx = ix + (iw - wW) / 2,
    wy = iy + ih * 0.16;
  ctx.fillStyle = 'rgba(6,6,10,0.9)';
  ctx.fillRect(wx, wy, wW, wH);
  ctx.strokeStyle = pal.stroke;
  ctx.lineWidth = 2;
  ctx.strokeRect(wx, wy, wW, wH);
  ctx.beginPath();
  ctx.moveTo(wx + wW / 2, wy);
  ctx.lineTo(wx + wW / 2, wy + wH);
  ctx.moveTo(wx, wy + wH / 2);
  ctx.lineTo(wx + wW, wy + wH / 2);
  ctx.stroke();
  const eyeY = wy + wH * (0.4 + rng() * 0.15);
  ctx.fillStyle = pal.ink ? 'rgba(210,205,190,0.9)' : '#e8e2c8';
  ctx.beginPath();
  ctx.ellipse(wx + wW * 0.5, eyeY, wW * 0.09, wH * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = pal.stroke;
  ctx.beginPath();
  ctx.arc(wx + wW * 0.5, eyeY, wW * 0.03, 0, Math.PI * 2);
  ctx.fill();
  const sillY = wy + wH;
  ctx.fillStyle = pal.fill;
  ctx.fillRect(wx - 6, sillY, wW + 12, ih * 0.03);
}
function _sceneScreamingMouth(ctx, ix, iy, iw, ih, rng, pal) {
  const cx = ix + iw / 2,
    cy = iy + ih * 0.5;
  const w = iw * 0.4,
    h = ih * 0.5;
  ctx.fillStyle = pal.ink ? 'rgba(30,10,10,0.65)' : '#2a0a0a';
  ctx.beginPath();
  ctx.moveTo(cx, cy - h / 2);
  ctx.quadraticCurveTo(cx - w / 2, cy - h * 0.1, cx - w * 0.28, cy + h / 2);
  ctx.quadraticCurveTo(cx, cy + h * 0.62, cx + w * 0.28, cy + h / 2);
  ctx.quadraticCurveTo(cx + w / 2, cy - h * 0.1, cx, cy - h / 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = pal.bg;
  const rows = 3;
  for (let r = 0; r < rows; r++) {
    const ty = cy - h * 0.28 + r * h * 0.22;
    const tw = w * (0.66 - r * 0.1);
    const count = 5 - r;
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const x = cx - tw / 2 + t * tw;
      ctx.beginPath();
      ctx.moveTo(x - w * 0.02, ty);
      ctx.lineTo(x + w * 0.02, ty);
      ctx.lineTo(x, ty + h * 0.09);
      ctx.closePath();
      ctx.fill();
    }
  }
}
const PAINTING_SCENE_FNS = {
  tall_figure: _sceneTallFigure,
  crouched_figure: _sceneCrouchedFigure,
  antler_figure: _sceneAntlerFigure,
  hollow_eye: _sceneEye,
  hallway: _sceneHallway,
  moon_figure: _sceneMoonFigure,
  hooded_figure: _sceneHoodedFigure,
  smiley_face: _sceneSmiley,
  symbol: _sceneSymbol,
  tally_marks: _sceneTallyMarks,
  handprints: _sceneHandprints,
  spiral: _sceneSpiral,
  mask: _sceneMask,
  door_ajar: _sceneDoorAjar,
  staircase: _sceneStaircase,
  teeth: _sceneTeeth,
  family_wrong: _sceneFamilyWrong,
  cracked_mirror: _sceneCrackedMirror,
  watching_window: _sceneWatchingWindow,
  screaming_mouth: _sceneScreamingMouth,
};
function makePaintingCanvas(rng = Math.random) {
  const c = document.createElement('canvas');
  c.width = 200;
  c.height = 256;
  const ctx = c.getContext('2d');
  const ink = rng() < 0.55;
  const pal = ink
    ? {
        ink: true,
        bg: 'rgb(196,188,170)',
        stroke: 'rgba(20,15,12,0.85)',
        fill: 'rgba(18,14,12,0.88)',
        accent: 'rgba(40,32,26,0.4)',
        textColor: 'rgba(25,18,14,0.85)',
      }
    : {
        ink: false,
        bg: '#f2ead6',
        stroke: '#161311',
        fill: '#141210',
        accent: 'rgba(0,0,0,0.5)',
        textColor: '#7a1414',
      };
  if (ink) _paperTexture(ctx, c.width, c.height, rng);
  else _crayonPaperTexture(ctx, c.width, c.height, rng);
  const margin = 14;
  const ix = margin,
    iy = margin,
    iw = c.width - margin * 2,
    ih = c.height - margin * 2;
  const scene = PAINTING_SCENES[Math.floor(rng() * PAINTING_SCENES.length)];
  const sceneFn = PAINTING_SCENE_FNS[scene] || _sceneSymbol;
  sceneFn(ctx, ix, iy, iw, ih, rng, pal);
  if (rng() < 0.55) {
    const caption = CREEPY_CAPTIONS[Math.floor(rng() * CREEPY_CAPTIONS.length)];
    const atTop = rng() < 0.5;
    _shakyText(ctx, caption, c.width / 2, atTop ? iy + 14 : iy + ih - 10, {
      rng,
      size: 11 + rng() * 3,
      color: pal.textColor,
      maxWidth: iw - 12,
    });
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, c.width - 4, c.height - 4);
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
function makeDoorWoodCanvas(rng = Math.random) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#3c2a1c';
  ctx.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 5000; i++) {
    const g = 25 + rng() * 45;
    ctx.fillStyle = `rgba(${g + 45},${g + 24},${g + 10},${(0.04 + rng() * 0.09).toFixed(2)})`;
    const w = 1 + rng() * 2;
    const h = 5 + rng() * 34;
    ctx.fillRect(rng() * 256, rng() * 512, w, h);
  }
  for (let i = 1; i < 4; i++) {
    const x = (256 / 4) * i;
    ctx.strokeStyle = 'rgba(14,9,6,0.4)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }
  const drawPanel = (px, py, pw, ph) => {
    ctx.strokeStyle = 'rgba(10,6,4,0.55)';
    ctx.lineWidth = 7;
    ctx.strokeRect(px, py, pw, ph);
    ctx.strokeStyle = 'rgba(90,62,38,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 7, py + 7, pw - 14, ph - 14);
  };
  drawPanel(26, 32, 204, 232);
  drawPanel(26, 300, 204, 178);
  return c;
}
function makeDoorPanelCanvas(rng = Math.random, opts = {}) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const ctx = c.getContext('2d');
  const base = opts.base || '#3c2a1c';
  const grain = opts.grain || [45, 24, 10];
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 5000; i++) {
    const g = 25 + rng() * 45;
    ctx.fillStyle = `rgba(${grain[0] + g},${grain[1] + g},${grain[2] + g},${(0.04 + rng() * 0.09).toFixed(2)})`;
    const w = 1 + rng() * 2;
    const h = 5 + rng() * 34;
    ctx.fillRect(rng() * 256, rng() * 512, w, h);
  }
  for (let i = 1; i < 4; i++) {
    const x = (256 / 4) * i;
    ctx.strokeStyle = 'rgba(14,9,6,0.4)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }
  const drawPanel = (px, py, pw, ph) => {
    ctx.strokeStyle = 'rgba(10,6,4,0.55)';
    ctx.lineWidth = 7;
    ctx.strokeRect(px, py, pw, ph);
    ctx.strokeStyle = 'rgba(90,62,38,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 7, py + 7, pw - 14, ph - 14);
  };
  if (opts.pane) {
    const px = 26,
      py = 32,
      pw = 204,
      ph = 190;
    ctx.strokeStyle = 'rgba(10,6,4,0.55)';
    ctx.lineWidth = 7;
    ctx.strokeRect(px, py, pw, ph);
    ctx.fillStyle = opts.paneColor || 'rgba(120,135,145,0.28)';
    ctx.fillRect(px + 8, py + 8, pw - 16, ph - 16);
    ctx.strokeStyle = 'rgba(18,13,8,0.6)';
    ctx.lineWidth = 4;
    if (opts.pane === 'cross') {
      ctx.beginPath();
      ctx.moveTo(px + pw / 2, py + 8);
      ctx.lineTo(px + pw / 2, py + ph - 8);
      ctx.moveTo(px + 8, py + ph / 2);
      ctx.lineTo(px + pw - 8, py + ph / 2);
      ctx.stroke();
    } else if (opts.pane === 'diamond') {
      for (let gx = 1; gx < 3; gx++) {
        const x = px + (pw / 3) * gx;
        ctx.beginPath();
        ctx.moveTo(x, py + 8);
        ctx.lineTo(x, py + ph - 8);
        ctx.stroke();
      }
      for (let gy = 1; gy < 3; gy++) {
        const y = py + (ph / 3) * gy;
        ctx.beginPath();
        ctx.moveTo(px + 8, y);
        ctx.lineTo(px + pw - 8, y);
        ctx.stroke();
      }
    } else if (opts.pane === 'small') {
      ctx.strokeRect(px + pw * 0.28, py + ph * 0.15, pw * 0.44, ph * 0.32);
    }
    drawPanel(26, 300, 204, 178);
  } else if (opts.ornate) {
    drawPanel(26, 30, 204, 138);
    drawPanel(26, 186, 204, 138);
    drawPanel(26, 342, 204, 138);
    ctx.strokeStyle = 'rgba(90,62,38,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(128, 60);
    ctx.lineTo(178, 100);
    ctx.lineTo(128, 140);
    ctx.lineTo(78, 100);
    ctx.closePath();
    ctx.stroke();
  } else {
    drawPanel(26, 32, 204, 232);
    drawPanel(26, 300, 204, 178);
  }
  return c;
}

function makeHurdleWoodCanvas(rng = Math.random, opts = {}) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');
  const base = opts.base || '#332a1e';
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 128);
  const grain = opts.grain || [40, 32, 20];
  for (let i = 0; i < 1600; i++) {
    const g = 15 + rng() * 35;
    ctx.fillStyle = `rgba(${grain[0] + g},${grain[1] + g},${grain[2] + g},${(0.04 + rng() * 0.08).toFixed(2)})`;
    const w = 6 + rng() * 30;
    const h = 1 + rng() * 1.6;
    ctx.fillRect(rng() * 256, rng() * 128, w, h);
  }
  
  for (let i = 1; i < 3; i++) {
    const y = (128 / 3) * i;
    ctx.strokeStyle = 'rgba(10,7,4,0.5)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }
  
  
  const scuffs = 4 + Math.floor(rng() * 6);
  for (let i = 0; i < scuffs; i++) {
    ctx.strokeStyle = `rgba(6,4,2,${(0.15 + rng() * 0.2).toFixed(2)})`;
    ctx.lineWidth = 0.8 + rng() * 1.6;
    const x0 = rng() * 256,
      y0 = rng() * 128;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + (rng() - 0.5) * 40, y0 + (rng() - 0.5) * 20);
    ctx.stroke();
  }
  if (opts.moss) {
    const patches = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < patches; i++) {
      const x = rng() * 256,
        y = rng() * 128,
        r = 5 + rng() * 12;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(50,60,36,0.35)');
      grad.addColorStop(1, 'rgba(50,60,36,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return c;
}
const HURDLE_STYLES = [
  { key: 'plainPlank', base: '#332a1e', grain: [40, 32, 20] },
  { key: 'ashenPlank', base: '#2c2a24', grain: [42, 40, 34] },
  { key: 'mossyPlank', base: '#302a1c', grain: [38, 34, 22], moss: true },
];
function makeFurnitureWoodCanvas(rng = Math.random) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const tones = ['#3f2c1d', '#4a3624', '#372515'];
  ctx.fillStyle = tones[Math.floor(rng() * tones.length)];
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2200; i++) {
    const g = 20 + rng() * 40;
    ctx.fillStyle = `rgba(${g + 45},${g + 24},${g + 8},${(0.03 + rng() * 0.08).toFixed(2)})`;
    const w = 1 + rng() * 1.5;
    const h = 8 + rng() * 40;
    ctx.fillRect(rng() * 256, rng() * 256, w, h);
  }
  
  const scuffs = 3 + Math.floor(rng() * 5);
  for (let i = 0; i < scuffs; i++) {
    ctx.strokeStyle = `rgba(8,5,3,${(0.15 + rng() * 0.2).toFixed(2)})`;
    ctx.lineWidth = 0.6 + rng() * 1.4;
    const x0 = rng() * 256,
      y0 = rng() * 256;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + (rng() - 0.5) * 60, y0 + (rng() - 0.5) * 60);
    ctx.stroke();
  }
  return c;
}
function makeFabricCanvas(rng = Math.random) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#4a463c';
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 1400; i++) {
    const g = 55 + rng() * 30;
    ctx.fillStyle = `rgba(${g},${g - 4},${g - 14},${(0.03 + rng() * 0.07).toFixed(2)})`;
    ctx.fillRect(rng() * 128, rng() * 128, 1, 1);
  }
  
  const blotches = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < blotches; i++) {
    const x = rng() * 128,
      y = rng() * 128,
      r = 6 + rng() * 16;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(20,16,12,${(0.2 + rng() * 0.25).toFixed(2)})`);
    grad.addColorStop(1, 'rgba(20,16,12,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
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
function makeDebrisCanvas() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(210, 205, 195, 0.9)');
  grad.addColorStop(0.4, 'rgba(150, 140, 130, 0.5)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 32, 32);
  return c;
}
function makeBrushedMetalCanvas(base = [46, 47, 51], highlight = [235, 238, 245]) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = `rgb(${base.join(',')})`;
  ctx.fillRect(0, 0, 128, 256);
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
  const spec = ctx.createLinearGradient(0, 0, 128, 0);
  spec.addColorStop(0, 'rgba(255,255,255,0)');
  spec.addColorStop(0.28, `rgba(${highlight.join(',')},0.22)`);
  spec.addColorStop(0.38, `rgba(${highlight.join(',')},0.4)`);
  spec.addColorStop(0.48, 'rgba(255,255,255,0)');
  spec.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = spec;
  ctx.fillRect(0, 0, 128, 256);
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
function makeLensCanvas() {
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

const REGION_WEIGHTS = {
  house: 0.34, office: 0.26, cave: 0.22, maintenance: 0.18,
  library: 0.16, pool: 0.1, sewer: 0.12, crypt: 0.1,
};
const REGION_FOG = {
  house: 0x020101, office: 0x0b0a03, cave: 0x010204, maintenance: 0x020603, deepcave: 0x000000,
  library: 0x0a0402, pool: 0x04181a, sewer: 0x030b04, crypt: 0x060409,
};



const REGION_COMPAT = {
  house: ['office', 'maintenance', 'library'],
  office: ['house', 'maintenance', 'library', 'pool'],
  library: ['house', 'office', 'crypt'],
  maintenance: ['house', 'office', 'cave', 'sewer', 'pool'],
  sewer: ['maintenance', 'cave', 'crypt'],
  pool: ['office', 'maintenance'],
  crypt: ['cave', 'library', 'sewer'],
  cave: ['maintenance', 'sewer', 'crypt'],
};

const REGION_BUFFERED = new Set(['cave', 'sewer', 'crypt', 'pool']);
const BLEND_WIDTH = 8; 
const CAVE_CEIL = 1.4; 
const BLEND_CH = { wall: 0, floor: 1, ceil: 2, light: 3, decor: 4 };


const POOL_SIZE = 5; 
const LIGHT_INTENSITY = 18;
const LIGHT_DISTANCE = 9;

const LANTERN_BODY_H = 0.36;
const LANTERN_MAX_DROP = 4.0; 
const LANTERN_MIN_CHAIN = 0.25; 
const PANEL_W = 1.3;
const PANEL_D = 0.45;

const LIGHT_CFG = {
  house: { kind: 'lantern', lattice: 0.5, room: 0.45, stray: 0.03, dead: 0.18, flicker: 0.14 },
  office: { kind: 'panel', lattice: 0.6, room: 0.5, stray: 0.06, dead: 0.22, flicker: 0.3 },
  maintenance: { kind: 'bulb', lattice: 0.5, room: 0.5, stray: 0.05, dead: 0.2, flicker: 0.35 },
  cave: { kind: 'torch', wall: 0.3 },
  library: { kind: 'lantern', lattice: 0.4, room: 0.55, stray: 0.05, dead: 0.25, flicker: 0.2 },
  pool: { kind: 'panel', lattice: 0.7, room: 0.6, stray: 0.1, dead: 0.12, flicker: 0.25 },
  sewer: { kind: 'bulb', lattice: 0.4, room: 0.4, stray: 0.05, dead: 0.35, flicker: 0.5 },
  crypt: { kind: 'torch', wall: 0.2 },
  deepcave: null, 
};

const DIRS = {
  n: { dx: 0, dy: -1, opp: 's', ix: 0, iz: 1, ex: 0, ez: -1 },
  s: { dx: 0, dy: 1, opp: 'n', ix: 0, iz: -1, ex: 0, ez: 1 },
  w: { dx: -1, dy: 0, opp: 'e', ix: 1, iz: 0, ex: -1, ez: 0 },
  e: { dx: 1, dy: 0, opp: 'w', ix: -1, iz: 0, ex: 1, ez: 0 },
};
const DIR_KEYS = ['n', 's', 'w', 'e'];
const cap = (d) => d.toUpperCase();

const ZERO_MATRIX = new THREE.Matrix4().makeScale(0, 0, 0);


function mkCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}
function speckle(ctx, w, h, rng, count, minL, maxL, alpha) {
  for (let i = 0; i < count; i++) {
    const l = Math.floor(minL + rng() * (maxL - minL));
    ctx.fillStyle = `rgba(${l},${l},${l},${alpha * (0.4 + rng() * 0.6)})`;
    ctx.fillRect(rng() * w, rng() * h, 1 + rng() * 2, 1 + rng() * 2);
  }
}
function stain(ctx, x, y, r, rgb, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
function makeOfficeWallCanvas(rng, dirty) {
  const [c, ctx] = mkCanvas(256, 256);
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#a7a06a');
  g.addColorStop(1, '#b8b17b');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#9a935f';
  ctx.fillRect(0, 150, 256, 106); 
  ctx.fillStyle = '#7c7649';
  ctx.fillRect(0, 146, 256, 5); 
  ctx.fillStyle = '#5f5a38';
  ctx.fillRect(0, 240, 256, 16); 
  speckle(ctx, 256, 256, rng, 900, 60, 200, 0.08);
  const stains = dirty ? 9 : 4;
  for (let i = 0; i < stains; i++) {
    stain(ctx, rng() * 256, rng() * 200, 20 + rng() * 45, dirty && rng() < 0.4 ? '40,45,25' : '80,62,25', 0.12 + rng() * 0.18);
  }
  for (let i = 0; i < 6; i++) {
    const x = rng() * 256;
    const lg = ctx.createLinearGradient(0, 0, 0, 200);
    lg.addColorStop(0, 'rgba(70,55,25,0.22)');
    lg.addColorStop(1, 'rgba(70,55,25,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(x, 0, 2 + rng() * 5, 200);
  }
  return c;
}
function makeCaveRockCanvas(rng, dark) {
  const [c, ctx] = mkCanvas(256, 256);
  ctx.fillStyle = dark ? '#1d1a18' : '#2c2825';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 280; i++) {
    const l = Math.floor(10 + rng() * (dark ? 40 : 65));
    ctx.fillStyle = `rgba(${l + 6},${l + 3},${l},${0.15 + rng() * 0.35})`;
    ctx.beginPath();
    ctx.ellipse(rng() * 256, rng() * 256, 5 + rng() * 34, 3 + rng() * 22, rng() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  for (let i = 0; i < 12; i++) {
    ctx.lineWidth = 1 + rng() * 1.5;
    ctx.beginPath();
    let x = rng() * 256;
    let y = rng() * 256;
    ctx.moveTo(x, y);
    for (let k = 0; k < 6; k++) {
      x += (rng() - 0.5) * 40;
      y += (rng() - 0.3) * 40;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  speckle(ctx, 256, 256, rng, 700, 20, 120, 0.12);
  return c;
}
function makeConcreteCanvas(rng, hazard, dark) {
  const [c, ctx] = mkCanvas(256, 256);
  ctx.fillStyle = dark ? '#33352f' : '#4b4d48';
  ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 256, 256, rng, 1400, 30, 150, 0.1);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 126, 256, 2);
  ctx.fillRect(127, 0, 2, 126);
  for (let i = 0; i < 12; i++) {
    const x = rng() * 256;
    const lg = ctx.createLinearGradient(0, 0, 0, 120 + rng() * 120);
    lg.addColorStop(0, 'rgba(125,62,28,0.4)');
    lg.addColorStop(1, 'rgba(125,62,28,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(x, rng() * 60, 3 + rng() * 14, 240);
  }
  for (let i = 0; i < 4; i++) stain(ctx, rng() * 256, rng() * 256, 25 + rng() * 40, '15,18,14', 0.3);
  if (hazard) {
    const y0 = 218;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y0, 256, 26);
    ctx.clip();
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(0, y0, 256, 26);
    ctx.fillStyle = '#141414';
    for (let x = -40; x < 300; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.lineTo(x + 16, y0);
      ctx.lineTo(x + 16 - 26, y0 + 26);
      ctx.lineTo(x - 26, y0 + 26);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, y0, 256, 26);
  }
  return c;
}
function makeCarpetCanvas(rng) {
  const [c, ctx] = mkCanvas(256, 256);
  for (let ty = 0; ty < 4; ty++) {
    for (let tx = 0; tx < 4; tx++) {
      const l = 52 + Math.floor(rng() * 14);
      ctx.fillStyle = `rgb(${l - 6},${l + 8},${l + 6})`;
      ctx.fillRect(tx * 64, ty * 64, 64, 64);
    }
  }
  speckle(ctx, 256, 256, rng, 3500, 20, 110, 0.14);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 64, 0);
    ctx.lineTo(i * 64, 256);
    ctx.moveTo(0, i * 64);
    ctx.lineTo(256, i * 64);
    ctx.stroke();
  }
  for (let i = 0; i < 4; i++) stain(ctx, rng() * 256, rng() * 256, 14 + rng() * 26, '20,16,10', 0.35);
  return c;
}
function makeRockFloorCanvas(rng) {
  const [c, ctx] = mkCanvas(256, 256);
  ctx.fillStyle = '#211f1c';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 160; i++) {
    const l = 20 + Math.floor(rng() * 40);
    ctx.fillStyle = `rgba(${l + 5},${l + 2},${l},${0.25 + rng() * 0.4})`;
    ctx.beginPath();
    ctx.ellipse(rng() * 256, rng() * 256, 2 + rng() * 14, 2 + rng() * 9, rng() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  speckle(ctx, 256, 256, rng, 1200, 10, 110, 0.15);
  return c;
}
function makeConcreteFloorCanvas(rng) {
  const c = makeConcreteCanvas(rng, false, true);
  const ctx = c.getContext('2d');
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    let x = rng() * 256;
    let y = rng() * 256;
    ctx.moveTo(x, y);
    for (let k = 0; k < 5; k++) {
      x += (rng() - 0.5) * 60;
      y += (rng() - 0.5) * 60;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return c;
}
function makePlankFloorCanvas(rng) {
  const [c, ctx] = mkCanvas(256, 256);
  for (let i = 0; i < 8; i++) {
    const l = 46 + Math.floor(rng() * 22);
    ctx.fillStyle = `rgb(${l + 14},${l},${l - 14})`;
    ctx.fillRect(0, i * 32, 256, 32);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, i * 32);
    ctx.lineTo(256, i * 32);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.16)';
    ctx.lineWidth = 1;
    for (let k = 0; k < 5; k++) {
      const y = i * 32 + 4 + rng() * 24;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y + (rng() - 0.5) * 4);
      ctx.stroke();
    }
    const jx = rng() * 256;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(jx, i * 32, 2, 32);
  }
  for (let i = 0; i < 5; i++) stain(ctx, rng() * 256, rng() * 256, 20 + rng() * 30, '10,8,5', 0.35);
  speckle(ctx, 256, 256, rng, 600, 10, 90, 0.12);
  return c;
}
function makeCeilingTileCanvas(rng) {
  const [c, ctx] = mkCanvas(128, 128);
  ctx.fillStyle = '#9a977f';
  ctx.fillRect(0, 0, 128, 128);
  speckle(ctx, 128, 128, rng, 700, 60, 170, 0.15);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = 'rgba(60,58,44,0.35)';
    ctx.fillRect(rng() * 128, rng() * 128, 1, 1 + rng() * 3);
  }
  ctx.strokeStyle = '#4f4d3d';
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, 128, 128);
  return c;
}
function makeRugCanvas(rng) {
  const [c, ctx] = mkCanvas(128, 80);
  ctx.fillStyle = '#b9b0a0';
  ctx.fillRect(0, 0, 128, 80);
  ctx.strokeStyle = '#f0e6d0';
  ctx.lineWidth = 3;
  ctx.strokeRect(7, 7, 114, 66);
  ctx.strokeStyle = '#8f8676';
  ctx.lineWidth = 2;
  ctx.strokeRect(14, 14, 100, 52);
  ctx.fillStyle = '#d9cfb8';
  for (let i = 0; i < 5; i++) {
    const cx = 24 + i * 20;
    ctx.beginPath();
    ctx.moveTo(cx, 40 - 14);
    ctx.lineTo(cx + 9, 40);
    ctx.lineTo(cx, 40 + 14);
    ctx.lineTo(cx - 9, 40);
    ctx.closePath();
    ctx.fill();
  }
  speckle(ctx, 128, 80, rng, 300, 60, 200, 0.12);
  return c;
}
function makeLibraryWallCanvas(rng, dirty) {
  const [c, ctx] = mkCanvas(256, 256);
  ctx.fillStyle = '#4b2c27';
  ctx.fillRect(0, 0, 256, 256);
  
  ctx.strokeStyle = 'rgba(120,70,55,0.35)';
  ctx.lineWidth = 2;
  for (let i = -256; i < 512; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 256, 256);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(i, 256);
    ctx.lineTo(i + 256, 0);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(160,105,72,0.3)';
  for (let b = 0; b < 10; b++) {
    for (let a = 0; a < 16; a++) {
      if ((a + b) % 2) continue;
      const x = a * 16;
      const y = b * 16;
      ctx.beginPath();
      ctx.moveTo(x, y - 6);
      ctx.lineTo(x + 4, y);
      ctx.lineTo(x, y + 6);
      ctx.lineTo(x - 4, y);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.fillStyle = '#2a1b14'; 
  ctx.fillRect(0, 150, 256, 106);
  ctx.fillStyle = '#170f0a';
  ctx.fillRect(0, 146, 256, 6);
  ctx.fillRect(0, 0, 256, 10); 
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) ctx.strokeRect(8 + i * 64, 164, 48, 68);
  speckle(ctx, 256, 256, rng, 800, 40, 150, 0.08);
  const n = dirty ? 9 : 4;
  for (let i = 0; i < n; i++) stain(ctx, rng() * 256, rng() * 200, 20 + rng() * 45, '20,12,8', 0.16 + rng() * 0.2);
  if (dirty) {
    for (let i = 0; i < 7; i++) {
      const x = rng() * 256;
      const lg = ctx.createLinearGradient(0, 10, 0, 160);
      lg.addColorStop(0, 'rgba(25,14,8,0.4)');
      lg.addColorStop(1, 'rgba(25,14,8,0)');
      ctx.fillStyle = lg;
      ctx.fillRect(x, 10, 2 + rng() * 6, 150);
    }
  }
  return c;
}
function makeLibraryFloorCanvas(rng) {
  const [c, ctx] = mkCanvas(256, 256);
  for (let ty = 0; ty < 4; ty++) {
    for (let tx = 0; tx < 4; tx++) {
      const horiz = (tx + ty) % 2 === 0;
      for (let k = 0; k < 8; k++) {
        const l = 30 + Math.floor(rng() * 16);
        ctx.fillStyle = `rgb(${l + 18},${l + 5},${l - 6})`;
        if (horiz) ctx.fillRect(tx * 64, ty * 64 + k * 8, 64, 8);
        else ctx.fillRect(tx * 64 + k * 8, ty * 64, 8, 64);
      }
    }
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 32; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 8, 0);
    ctx.lineTo(i * 8, 256);
    ctx.moveTo(0, i * 8);
    ctx.lineTo(256, i * 8);
    ctx.stroke();
  }
  ctx.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 64, 0);
    ctx.lineTo(i * 64, 256);
    ctx.moveTo(0, i * 64);
    ctx.lineTo(256, i * 64);
    ctx.stroke();
  }
  for (let i = 0; i < 5; i++) stain(ctx, rng() * 256, rng() * 256, 20 + rng() * 34, '8,5,3', 0.35);
  speckle(ctx, 256, 256, rng, 700, 10, 90, 0.12);
  return c;
}
function makeLibraryCeilingCanvas(rng) {
  const [c, ctx] = mkCanvas(128, 128);
  ctx.fillStyle = '#20140e';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#120a06'; 
  ctx.fillRect(0, 0, 128, 10);
  ctx.fillRect(0, 0, 10, 128);
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 3;
  ctx.strokeRect(20, 20, 98, 98);
  speckle(ctx, 128, 128, rng, 500, 10, 80, 0.15);
  stain(ctx, rng() * 128, rng() * 128, 30, '6,4,2', 0.4);
  return c;
}

function makePoolWallCanvas(rng, dirty) {
  const [c, ctx] = mkCanvas(256, 256);
  for (let ty = 0; ty < 16; ty++) {
    for (let tx = 0; tx < 16; tx++) {
      const v = Math.floor(rng() * 16) - 8;
      ctx.fillStyle = `rgb(${142 + v},${184 + v},${182 + v})`;
      ctx.fillRect(tx * 16, ty * 16, 16, 16);
    }
  }
  ctx.fillStyle = '#2b6f7a'; 
  ctx.fillRect(0, 96, 256, 32);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(0, 96, 256, 32);
  ctx.strokeStyle = 'rgba(55,78,78,0.65)'; 
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= 16; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 16, 0);
    ctx.lineTo(i * 16, 256);
    ctx.moveTo(0, i * 16);
    ctx.lineTo(256, i * 16);
    ctx.stroke();
  }
  const n = dirty ? 9 : 4;
  for (let i = 0; i < n; i++) stain(ctx, rng() * 256, 140 + rng() * 116, 20 + rng() * 40, '30,80,50', 0.22 + rng() * 0.15);
  ctx.strokeStyle = 'rgba(15,25,25,0.6)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < (dirty ? 5 : 2); i++) {
    ctx.beginPath();
    let x = rng() * 256;
    let y = rng() * 256;
    ctx.moveTo(x, y);
    for (let k = 0; k < 5; k++) {
      x += (rng() - 0.5) * 30;
      y += rng() * 30;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  speckle(ctx, 256, 256, rng, 700, 40, 170, 0.08);
  return c;
}
function makePoolFloorCanvas(rng) {
  const [c, ctx] = mkCanvas(256, 256);
  for (let ty = 0; ty < 16; ty++) {
    for (let tx = 0; tx < 16; tx++) {
      const v = Math.floor(rng() * 18) - 9;
      const dark = (tx + ty) % 2 === 0 ? 0 : 10;
      ctx.fillStyle = `rgb(${112 + v - dark},${160 + v - dark},${162 + v - dark})`;
      ctx.fillRect(tx * 16, ty * 16, 16, 16);
    }
  }
  ctx.strokeStyle = 'rgba(40,58,58,0.7)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= 16; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 16, 0);
    ctx.lineTo(i * 16, 256);
    ctx.moveTo(0, i * 16);
    ctx.lineTo(256, i * 16);
    ctx.stroke();
  }
  for (let i = 0; i < 6; i++) stain(ctx, rng() * 256, rng() * 256, 18 + rng() * 36, '25,70,45', 0.28);
  speckle(ctx, 256, 256, rng, 800, 20, 130, 0.1);
  return c;
}
function makePoolCeilingCanvas(rng) {
  const [c, ctx] = mkCanvas(128, 128);
  ctx.fillStyle = '#a9b8b4';
  ctx.fillRect(0, 0, 128, 128);
  speckle(ctx, 128, 128, rng, 500, 80, 190, 0.12);
  ctx.strokeStyle = 'rgba(40,60,60,0.55)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 32, 0);
    ctx.lineTo(i * 32, 128);
    ctx.moveTo(0, i * 32);
    ctx.lineTo(128, i * 32);
    ctx.stroke();
  }
  stain(ctx, rng() * 128, rng() * 128, 26, '40,80,60', 0.25);
  return c;
}

function makeSewerWallCanvas(rng, dark) {
  const [c, ctx] = mkCanvas(256, 256);
  ctx.fillStyle = dark ? '#111210' : '#1a1b16'; 
  ctx.fillRect(0, 0, 256, 256);
  const rowH = 21;
  for (let r = 0; r * rowH < 256; r++) {
    const off = r % 2 ? 16 : 0;
    for (let x = -off; x < 256; x += 32) {
      const l = 38 + Math.floor(rng() * (dark ? 20 : 32));
      ctx.fillStyle = `rgb(${l + 9},${l + 4},${l - 3})`;
      ctx.fillRect(x + 1, r * rowH + 1, 30, rowH - 2);
    }
  }
  for (let i = 0; i < 16; i++) {
    const y0 = rng() * 90;
    const lg = ctx.createLinearGradient(0, y0, 0, y0 + 90 + rng() * 120);
    lg.addColorStop(0, 'rgba(70,125,50,0.5)');
    lg.addColorStop(1, 'rgba(70,125,50,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(rng() * 256, y0, 2 + rng() * 10, 220);
  }
  const wl = ctx.createLinearGradient(0, 170, 0, 256); 
  wl.addColorStop(0, 'rgba(20,55,28,0)');
  wl.addColorStop(1, 'rgba(20,62,32,0.7)');
  ctx.fillStyle = wl;
  ctx.fillRect(0, 170, 256, 86);
  for (let i = 0; i < 4; i++) stain(ctx, rng() * 256, rng() * 256, 25 + rng() * 40, '8,12,8', 0.35);
  speckle(ctx, 256, 256, rng, 900, 20, 110, 0.1);
  return c;
}
function makeSewerFloorCanvas(rng) {
  const [c, ctx] = mkCanvas(256, 256);
  ctx.fillStyle = '#121410';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 150; i++) {
    const l = 30 + Math.floor(rng() * 34);
    ctx.fillStyle = `rgba(${l + 5},${l + 4},${l - 2},${0.6 + rng() * 0.4})`;
    ctx.beginPath();
    ctx.ellipse(rng() * 256, rng() * 256, 6 + rng() * 14, 5 + rng() * 10, rng() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = `rgba(50,95,40,${0.1 + rng() * 0.2})`;
    ctx.beginPath();
    ctx.ellipse(rng() * 256, rng() * 256, 3 + rng() * 10, 2 + rng() * 7, rng() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 4; i++) stain(ctx, rng() * 256, rng() * 256, 22 + rng() * 34, '6,10,6', 0.4);
  speckle(ctx, 256, 256, rng, 900, 10, 100, 0.12);
  return c;
}

function makeCryptWallCanvas(rng, dark) {
  const [c, ctx] = mkCanvas(256, 256);
  ctx.fillStyle = '#110f0d'; 
  ctx.fillRect(0, 0, 256, 256);
  let y = 0;
  while (y < 256) {
    const h = 22 + Math.floor(rng() * 20);
    let x = -rng() * 30;
    while (x < 256) {
      const w = 30 + Math.floor(rng() * 40);
      const l = (dark ? 28 : 40) + Math.floor(rng() * (dark ? 22 : 30));
      ctx.fillStyle = `rgb(${l + 7},${l + 4},${l - 1})`;
      ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
      x += w;
    }
    y += h;
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  for (let i = 0; i < 8; i++) {
    ctx.lineWidth = 1 + rng() * 1.2;
    ctx.beginPath();
    let x = rng() * 256;
    let yy = rng() * 256;
    ctx.moveTo(x, yy);
    for (let k = 0; k < 5; k++) {
      x += (rng() - 0.5) * 24;
      yy += rng() * 30;
      ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  for (let i = 0; i < 6; i++) {
    const lg = ctx.createLinearGradient(0, 0, 0, 200);
    lg.addColorStop(0, 'rgba(18,22,20,0.45)');
    lg.addColorStop(1, 'rgba(18,22,20,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(rng() * 256, rng() * 40, 3 + rng() * 10, 210);
  }
  for (let i = 0; i < 4; i++) stain(ctx, rng() * 256, rng() * 256, 25 + rng() * 40, '8,8,10', 0.32);
  speckle(ctx, 256, 256, rng, 900, 20, 130, 0.1);
  return c;
}
function makeCryptFloorCanvas(rng) {
  const [c, ctx] = mkCanvas(256, 256);
  ctx.fillStyle = '#0e0d0b';
  ctx.fillRect(0, 0, 256, 256);
  for (let r = 0; r < 4; r++) {
    let x = -rng() * 40;
    while (x < 256) {
      const w = 50 + Math.floor(rng() * 40);
      const l = 34 + Math.floor(rng() * 22);
      ctx.fillStyle = `rgb(${l + 6},${l + 3},${l - 2})`;
      ctx.fillRect(x + 1.5, r * 64 + 1.5, w - 3, 61);
      x += w;
    }
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    let x = rng() * 256;
    let y = rng() * 256;
    ctx.moveTo(x, y);
    for (let k = 0; k < 4; k++) {
      x += (rng() - 0.5) * 50;
      y += (rng() - 0.5) * 50;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  for (let i = 0; i < 5; i++) stain(ctx, rng() * 256, rng() * 256, 20 + rng() * 36, '6,6,6', 0.4);
  speckle(ctx, 256, 256, rng, 1100, 20, 140, 0.13);
  return c;
}

function makeWebCanvas() {
  const [c, ctx] = mkCanvas(128, 128);
  ctx.strokeStyle = 'rgba(232,232,222,0.8)';
  ctx.lineWidth = 1;
  const R = 126;
  for (let a = 0; a <= 6; a++) {
    const ang = (a / 6) * (Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(ang) * R, Math.sin(ang) * R);
    ctx.stroke();
  }
  [22, 40, 60, 82, 106].forEach((r) => {
    ctx.beginPath();
    for (let a = 0; a <= 6; a++) {
      const ang = (a / 6) * (Math.PI / 2);
      const rr = r - (a % 2 === 1 ? 5 : 0);
      const px = Math.cos(ang) * rr;
      const py = Math.sin(ang) * rr;
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  });
  return c;
}

function makeFormationGeometry(seed, kind) {
  const RINGS = 14;
  const SEG = 10;
  const kindSalt = kind === 'spire' ? 1 : kind === 'tusk' ? 2 : kind === 'stump' ? 3 : 4;
  const hash = (a, b = 0, c = 0) => {
    const v = Math.sin(a * 127.1 + b * 311.7 + c * 74.7 + seed * 19.19 + kindSalt * 3.3) * 43758.5453;
    return v - Math.floor(v);
  };
  const isColumn = kind === 'column';
  const p = kind === 'spire' ? 1.35 + hash(1) : kind === 'tusk' ? 1.0 + hash(1) * 0.5 : kind === 'stump' ? 0.5 + hash(1) * 0.45 : 1;
  const bend = kind === 'spire' ? 0.6 + hash(2) * 1.8 : kind === 'tusk' ? 2 + hash(2) * 2.4 : kind === 'stump' ? 0.2 + hash(2) * 0.5 : 0;
  const bendAng = hash(3) * Math.PI * 2;
  const ovalA = 0.72 + hash(4) * 0.6;
  const ovalB = 0.72 + hash(5) * 0.6;
  const ovalRot = hash(6) * Math.PI;
  const lobe2 = 0.1 + hash(7) * 0.16;
  const lobe3 = 0.06 + hash(8) * 0.14;
  const ph2 = hash(9) * 6.283;
  const ph3 = hash(10) * 6.283;
  const nodAt = [0.12 + hash(11) * 0.4, 0.3 + hash(12) * 0.4];
  const nodAmp = [0.18 + hash(13) * 0.3, 0.12 + hash(14) * 0.25];
  const tipR = kind === 'stump' ? 0.34 + hash(15) * 0.22 : 0;
  const ledgeFreq = 9 + hash(17) * 8;
  const pos = [];
  for (let r = 0; r <= RINGS; r++) {
    const t = r / RINGS;
    let rad;
    if (isColumn) {
      const u = Math.abs(t - 0.5) * 2;
      rad = 0.42 + 0.9 * Math.pow(u, 2.3);
    } else {
      rad = tipR + (1 - tipR) * Math.pow(1 - t, p);
      rad *= 1 + 0.16 * Math.exp(-t * 9) * (0.5 + hash(16)); 
      if (kind === 'stump') rad *= 1 + 0.1 * Math.sin(t * ledgeFreq); 
    }
    for (let i = 0; i < 2; i++) {
      rad *= 1 + nodAmp[i] * Math.exp(-Math.pow((t - nodAt[i]) / 0.07, 2)) * (isColumn ? 0.6 : 1);
    }
    const off = bend * Math.pow(t, 1.6);
    const cx = Math.cos(bendAng) * off + (isColumn ? Math.sin(t * 6 + seed) * 0.06 : 0);
    const cz = Math.sin(bendAng) * off + (isColumn ? Math.cos(t * 5 + seed) * 0.06 : 0);
    let y = t - 0.5;
    if (r > 0 && r < RINGS) y += (hash(20, r) - 0.5) * 0.02;
    for (let s = 0; s < SEG; s++) {
      const a = (s / SEG) * Math.PI * 2;
      const ex = Math.cos(a) * ovalA;
      const ez = Math.sin(a) * ovalB;
      const px = ex * Math.cos(ovalRot) - ez * Math.sin(ovalRot);
      const pz = ex * Math.sin(ovalRot) + ez * Math.cos(ovalRot);
      const lobes =
        1 + lobe2 * Math.sin(2 * a + ph2 + t * 2) + lobe3 * Math.sin(3 * a + ph3) +
        (hash(r, s, 1) - 0.5) * 0.28 * (1 - t * 0.5);
      let vy = y;
      if (r === RINGS && kind === 'stump') vy += (hash(r, s, 2) - 0.5) * 0.09; 
      pos.push(cx + px * rad * lobes, vy, cz + pz * rad * lobes);
    }
  }
  const idx = [];
  for (let r = 0; r < RINGS; r++) {
    for (let s = 0; s < SEG; s++) {
      const s1 = (s + 1) % SEG;
      const a = r * SEG + s;
      const a1 = r * SEG + s1;
      const b = (r + 1) * SEG + s;
      const b1 = (r + 1) * SEG + s1;
      idx.push(a, b, a1, a1, b, b1);
    }
  }
  const bottom = pos.length / 3;
  pos.push(pos[0] * 0 + (pos[0] + pos[3 * (SEG >> 1)]) / 2, -0.5, (pos[2] + pos[3 * (SEG >> 1) + 2]) / 2);
  for (let s = 0; s < SEG; s++) idx.push(bottom, s, (s + 1) % SEG);
  if (tipR > 0 || isColumn) {
    const last = RINGS * SEG;
    let mx = 0;
    let mz = 0;
    for (let s = 0; s < SEG; s++) {
      mx += pos[3 * (last + s)] / SEG;
      mz += pos[3 * (last + s) + 2] / SEG;
    }
    const top = pos.length / 3;
    pos.push(mx, 0.5 + (kind === 'stump' ? 0.02 : 0), mz);
    for (let s = 0; s < SEG; s++) idx.push(top, last + ((s + 1) % SEG), last + s);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function makeBoulderGeometry(seed) {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const pos = g.attributes.position;
  const frac = (v) => v - Math.floor(v);
  const noise = (x, y, z) =>
    frac(Math.sin(Math.round(x * 50) * 12.9898 + Math.round(y * 50) * 78.233 + Math.round(z * 50) * 37.719 + seed * 4.1) * 43758.5453);
  const ax = 0.8 + frac(Math.sin(seed * 91.7) * 9999) * 0.5;
  const az = 0.8 + frac(Math.sin(seed * 33.1) * 9999) * 0.5;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const r = 1 + (noise(x, y, z) - 0.5) * 0.5 + 0.16 * Math.sin(x * 3.1 + seed) * Math.cos(z * 2.7 - seed);
    x *= r * ax;
    y *= r * 0.85;
    z *= r * az;
    if (y < -0.4) y = -0.4 + (y + 0.4) * 0.15;
    pos.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

const FORMATION_VARIANTS = { spire: 6, tusk: 4, stump: 4, column: 3, boulder: 6 };

class Batch {
  constructor(manager, group) {
    this.mgr = manager;
    this.group = group;
    this.map = new Map();
    
    this.cur = null;
  }
  add(geoKey, matKey, x, y, z, o = {}) {
    if (geoKey === 'stalag') geoKey = 'spire'; 
    if (FORMATION_VARIANTS[geoKey]) {
      geoKey = `${geoKey}${Math.floor(Math.abs(x * 12.9898 + z * 78.233 + (o.sy || 0) * 31.7)) % FORMATION_VARIANTS[geoKey]}`;
    }
    const key = `${geoKey}|${matKey}`;
    let b = this.map.get(key);
    if (!b) {
      b = { geoKey, matKey, items: [], hasColor: false, mesh: null };
      this.map.set(key, b);
    }
    b.items.push({
      x, y, z,
      rx: o.rx || 0, ry: o.ry || 0, rz: o.rz || 0,
      sx: o.sx ?? 1, sy: o.sy ?? 1, sz: o.sz ?? 1,
      color: o.color ?? null,
      matrix: o.matrix ?? null,
      edges: o.edges ?? null,
      
      
      cell: this.cur ? { x: this.cur.x, y: this.cur.y } : null,
      floorY: this.cur ? this.cur.floorY : 0,
      anchor: o.anchor ?? 'floor',
      top: o.top ?? 0,
    });
    if (o.color != null) b.hasColor = true;
  }
  finalize() {
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const col = new THREE.Color();
    for (const b of this.map.values()) {
      const mesh = new THREE.InstancedMesh(this.mgr.geo(b.geoKey), this.mgr.mat(b.matKey), b.items.length);
      b.items.forEach((it, i) => {
        if (it.matrix) {
          m4.copy(it.matrix);
        } else {
          q.setFromEuler(e.set(it.rx, it.ry, it.rz, 'YXZ'));
          m4.compose(p.set(it.x, it.y, it.z), q, s.set(it.sx, it.sy, it.sz));
        }
        mesh.setMatrixAt(i, m4);
        if (b.hasColor) mesh.setColorAt(i, col.set(it.color ?? 0xffffff));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.frustumCulled = false;
      b.mesh = mesh;
      this.group.add(mesh);
    }
  }

  refreshHeights(floorOf) {
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    for (const b of this.map.values()) {
      if (!b.mesh) continue;
      let dirty = false;
      b.items.forEach((it, i) => {
        if (!it.cell || it.matrix || it.anchor === 'top') return;
        const fy = floorOf(it.cell.x, it.cell.y);
        if (fy === it.floorY) return;
        if (it.anchor === 'span') {
          const hh = Math.max(0.05, it.top - fy);
          it.sy = hh;
          it.y = fy + hh / 2;
        } else {
          it.y += fy - it.floorY;
        }
        it.floorY = fy;
        if (it.hidden) return;
        q.setFromEuler(e.set(it.rx, it.ry, it.rz, 'YXZ'));
        m4.compose(p.set(it.x, it.y, it.z), q, s.set(it.sx, it.sy, it.sz));
        b.mesh.setMatrixAt(i, m4);
        dirty = true;
      });
      if (dirty) b.mesh.instanceMatrix.needsUpdate = true;
    }
  }
  hideEdge(key) {
    for (const b of this.map.values()) {
      if (!b.mesh) continue;
      let dirty = false;
      b.items.forEach((it, i) => {
        if (it.edges && !it.hidden && it.edges.includes(key)) {
          it.hidden = true;
          b.mesh.setMatrixAt(i, ZERO_MATRIX);
          dirty = true;
        }
      });
      if (dirty) b.mesh.instanceMatrix.needsUpdate = true;
    }
  }
}


class RegionManager {
  constructor({ scene, CELL, STEP_HEIGHT, edgeKey, onRegionChange }) {
    this.scene = scene;
    this.CELL = CELL;
    this.STEP = STEP_HEIGHT;
    this.edgeKey = edgeKey;
    this.onRegionChange = onRegionChange || null;
    this.regionMap = null;
    this.currentRegion = null;
    this._geos = {};
    this._mats = {};
    this._texs = {};
    this._wallSets = {};
    this._floorMats = {};
    this._ceilMats = {};
    this._lights = null;
    this._decor = null;
    this._ceil = null;
    this._levelGeos = [];
    this._origin = { x: 0, z: 0 };
    this._w = 0;
    this._h = 0;
    this._baseSeed = '';
    this._level = 1;
    this._fogTarget = new THREE.Color(REGION_FOG.house);
  }

  geo(key) {
    if (this._geos[key]) return this._geos[key];
    let g;
    const formation = /^(spire|tusk|stump|column|boulder)(\d+)$/.exec(key);
    if (formation) {
      const variant = Number(formation[2]) + 1;
      this._geos[key] = formation[1] === 'boulder' ? makeBoulderGeometry(variant) : makeFormationGeometry(variant, formation[1]);
      return this._geos[key];
    }
    switch (key) {
      case 'box': g = new THREE.BoxGeometry(1, 1, 1); break;
      case 'cyl': g = new THREE.CylinderGeometry(1, 1, 1, 10); break;
      case 'cyl6': g = new THREE.CylinderGeometry(1, 1, 1, 6); break;
      case 'cone': g = new THREE.ConeGeometry(1, 1, 6); break;
      case 'sphere': g = new THREE.SphereGeometry(1, 10, 8); break;
      case 'cage': g = new THREE.SphereGeometry(1, 7, 5); break;
      case 'ico': g = new THREE.IcosahedronGeometry(1, 0); break;
      case 'plane': g = new THREE.PlaneGeometry(1, 1); break;
      default: throw new Error(`unknown geo ${key}`);
    }
    this._geos[key] = g;
    return g;
  }
  tex(key, canvas, opts = {}) {
    if (this._texs[key]) return this._texs[key];
    const t = new THREE.CanvasTexture(canvas());
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(opts.rx ?? 1, opts.ry ?? 1);
    t.colorSpace = THREE.SRGBColorSpace;
    this._texs[key] = t;
    return t;
  }
  mat(key) {
    if (this._mats[key]) return this._mats[key];
    const std = (o) => new THREE.MeshStandardMaterial(o);
    let m;
    switch (key) {
      case 'basic': m = new THREE.MeshBasicMaterial({ color: 0xffffff }); break;
      case 'wire': m = new THREE.MeshBasicMaterial({ color: 0x0c0c0c, wireframe: true }); break;
      case 'iron': m = std({ color: 0x1b1613, roughness: 0.55, metalness: 0.7 }); break;
      case 'panelFrame': m = std({ color: 0x2b2a25, roughness: 0.8 }); break;
      case 'woodDark': m = std({ color: 0x3b2a1e, roughness: 0.9 }); break;
      case 'torchWood': m = std({ color: 0x4a3423, roughness: 0.9 }); break;
      case 'char': m = std({ color: 0x0e0c0a, roughness: 1 }); break;
      case 'desk': m = std({ color: 0x6d675a, roughness: 0.7 }); break;
      case 'metalGrey': m = std({ color: 0x5b6062, roughness: 0.55, metalness: 0.5 }); break;
      case 'fabric': m = std({ color: 0x53626b, roughness: 1 }); break;
      case 'dark': m = std({ color: 0x101112, roughness: 0.6 }); break;
      case 'chair': m = std({ color: 0x23272b, roughness: 0.8 }); break;
      case 'paper': m = std({ color: 0xffffff, roughness: 1, side: THREE.DoubleSide }); break;
      case 'rock': m = std({ color: 0x3d3935, roughness: 1, flatShading: true }); break;
      case 'crystal': m = new THREE.MeshBasicMaterial({ color: 0xffffff }); break;
      case 'tinted': m = std({ color: 0xffffff, roughness: 0.6, metalness: 0.45 }); break; 
      case 'crate': m = std({ color: 0x6a5030, roughness: 0.9 }); break;
      case 'bone': m = std({ color: 0xb9b19f, roughness: 0.9 }); break;
      case 'panelBox': m = std({ color: 0x3b3e3c, roughness: 0.6, metalness: 0.4 }); break;
      case 'matte': m = std({ color: 0xffffff, roughness: 1 }); break; 
      case 'tile': m = std({ color: 0xbfd0cd, roughness: 0.35 }); break; 
      case 'stone': m = std({ color: 0x57544d, roughness: 1, flatShading: true }); break; 
      case 'slime': m = std({ color: 0x2c4a28, roughness: 0.25, metalness: 0.1 }); break;
      case 'puddle': m = std({ color: 0x0e1719, roughness: 0.06, metalness: 0.75 }); break;
      case 'rug':
        m = std({
          map: this.tex('rug', () => makeRugCanvas(createRng(hashSeed('rugtex')))),
          roughness: 1,
          side: THREE.DoubleSide,
        });
        break;
      case 'web':
        m = std({
          map: this.tex('web', () => makeWebCanvas()),
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
          roughness: 1,
          color: 0xd6d6cc,
        });
        break;
      default: throw new Error(`unknown material ${key}`);
    }
    this._mats[key] = m;
    return m;
  }
  _texMat(key, canvasFn, matOpts, texOpts = {}) {
    const map = this.tex(key, canvasFn, texOpts);
    return new THREE.MeshStandardMaterial({ map, ...matOpts });
  }

  haloTexture() {
    return this.tex('halo', () => {
      const [c, ctx] = mkCanvas(64, 64);
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.25, 'rgba(255,255,255,0.35)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
      return c;
    });
  }

  wallMaterial(region, rng) {
    if (region === 'house' || !(REGION_WEIGHTS[region] || region === 'deepcave')) return null;
    let set = this._wallSets[region];
    if (!set) {
      const R = (s) => createRng(hashSeed(`wall_${region}_${s}`));
      if (region === 'office') {
        set = [
          { w: 3, m: this._texMat('ow1', () => makeOfficeWallCanvas(R(1), false), { roughness: 0.95 }, { rx: 1.5 }) },
          { w: 1.2, m: this._texMat('ow2', () => makeOfficeWallCanvas(R(2), true), { roughness: 0.97 }, { rx: 1.5 }) },
        ];
      } else if (region === 'deepcave') {
        set = [
          { w: 2, m: this._rockWall('dw1', R(1), true) },
          { w: 1, m: this._rockWall('dw2', R(2), true) },
        ];
      } else if (region === 'library') {
        set = [
          { w: 3, m: this._texMat('lw1', () => makeLibraryWallCanvas(R(1), false), { roughness: 0.92 }, { rx: 1.5 }) },
          { w: 1.2, m: this._texMat('lw2', () => makeLibraryWallCanvas(R(2), true), { roughness: 0.95 }, { rx: 1.5 }) },
        ];
      } else if (region === 'pool') {
        set = [
          { w: 3, m: this._texMat('pw1', () => makePoolWallCanvas(R(1), false), { roughness: 0.3 }, { rx: 1.5 }) },
          { w: 1.4, m: this._texMat('pw2', () => makePoolWallCanvas(R(2), true), { roughness: 0.4 }, { rx: 1.5 }) },
        ];
      } else if (region === 'sewer') {
        set = [
          { w: 3, m: this._texMat('sw1', () => makeSewerWallCanvas(R(1), false), { roughness: 0.6 }, { rx: 1.5 }) },
          { w: 1.5, m: this._texMat('sw2', () => makeSewerWallCanvas(R(2), true), { roughness: 0.7 }, { rx: 1.5 }) },
        ];
      } else if (region === 'crypt') {
        set = [
          { w: 3, m: this._texMat('xw1', () => makeCryptWallCanvas(R(1), false), { roughness: 1 }, { rx: 1.5 }) },
          { w: 1.5, m: this._texMat('xw2', () => makeCryptWallCanvas(R(2), true), { roughness: 1 }, { rx: 1.5 }) },
        ];
      } else if (region === 'cave') {
        set = [
          { w: 2, m: this._rockWall('cw1', R(1), false) },
          { w: 2, m: this._rockWall('cw2', R(2), true) },
        ];
      } else {
        set = [
          { w: 3, m: this._texMat('mw1', () => makeConcreteCanvas(R(1), false, false), { roughness: 0.95 }, { rx: 1.5 }) },
          { w: 1.4, m: this._texMat('mw2', () => makeConcreteCanvas(R(2), true, false), { roughness: 0.9 }, { rx: 1.5 }) },
        ];
      }
      this._wallSets[region] = set;
    }
    const total = set.reduce((a, s) => a + s.w, 0);
    let r = rng() * total;
    for (const s of set) {
      r -= s.w;
      if (r <= 0) return s.m;
    }
    return set[0].m;
  }
  _rockWall(key, rng, dark) {
    const map = this.tex(key, () => makeCaveRockCanvas(rng, dark), { rx: 1.5 });
    return new THREE.MeshStandardMaterial({ map, bumpMap: map, bumpScale: 3, roughness: 1 });
  }
  floorKey(region, surface, isRoom) {
    if (surface !== 'stone') return surface;
    switch (region) {
      case 'office': return 'carpet';
      case 'cave': return 'rock';
      case 'deepcave': return 'rock';
      case 'maintenance': return 'concrete';
      case 'library': return 'parquet';
      case 'pool': return 'tile';
      case 'sewer': return 'cobble';
      case 'crypt': return 'flagstone';
      default: return isRoom ? 'planks' : 'stone';
    }
  }
  floorMaterial(key) {
    if (this._floorMats[key]) return this._floorMats[key];
    const R = createRng(hashSeed(`floor_${key}`));
    let m;
    switch (key) {
      case 'carpet': m = this._texMat('f_carpet', () => makeCarpetCanvas(R), { roughness: 1 }); break;
      case 'rock': m = this._texMat('f_rock', () => makeRockFloorCanvas(R), { roughness: 1 }); break;
      case 'concrete': m = this._texMat('f_conc', () => makeConcreteFloorCanvas(R), { roughness: 0.95 }); break;
      case 'planks': m = this._texMat('f_planks', () => makePlankFloorCanvas(R), { roughness: 0.9 }); break;
      case 'parquet': m = this._texMat('f_parquet', () => makeLibraryFloorCanvas(R), { roughness: 0.8 }); break;
      case 'tile': m = this._texMat('f_tile', () => makePoolFloorCanvas(R), { roughness: 0.3 }); break;
      case 'cobble': m = this._texMat('f_cobble', () => makeSewerFloorCanvas(R), { roughness: 0.5 }); break;
      case 'flagstone': m = this._texMat('f_flag', () => makeCryptFloorCanvas(R), { roughness: 1 }); break;
      default: return null;
    }
    this._floorMats[key] = m;
    return m;
  }
  _ceilingMaterial(region) {
    if (this._ceilMats[region]) return this._ceilMats[region];
    const R = createRng(hashSeed(`ceil_${region}`));
    let m;
    if (region === 'office') {
      m = this._texMat('c_office', () => makeCeilingTileCanvas(R), { roughness: 1 }, { rx: 6, ry: 6 });
    } else if (region === 'deepcave') {
      const map = this.tex('c_deep', () => makeCaveRockCanvas(R, true), { rx: 2, ry: 2 });
      m = new THREE.MeshStandardMaterial({ map, bumpMap: map, bumpScale: 3, roughness: 1, color: 0x8a8580 });
    } else if (region === 'cave') {
      const map = this.tex('c_cave', () => makeCaveRockCanvas(R, true), { rx: 2, ry: 2 });
      m = new THREE.MeshStandardMaterial({ map, bumpMap: map, bumpScale: 3, roughness: 1 });
    } else if (region === 'library') {
      m = this._texMat('c_lib', () => makeLibraryCeilingCanvas(R), { roughness: 1 }, { rx: 3, ry: 3 });
    } else if (region === 'pool') {
      m = this._texMat('c_pool', () => makePoolCeilingCanvas(R), { roughness: 0.6 }, { rx: 5, ry: 5 });
    } else if (region === 'sewer') {
      m = this._texMat('c_sewer', () => makeSewerWallCanvas(R, true), { roughness: 0.8 }, { rx: 2, ry: 2 });
    } else if (region === 'crypt') {
      m = this._texMat('c_crypt', () => makeCryptWallCanvas(R, true), { roughness: 1 }, { rx: 2, ry: 2 });
    } else if (region === 'maintenance') {
      m = this._texMat('c_maint', () => makeConcreteCanvas(R, false, true), { roughness: 1 }, { rx: 2, ry: 2 });
    } else {
      m = new THREE.MeshStandardMaterial({ color: 0x121214, roughness: 1 });
    }
    this._ceilMats[region] = m;
    return m;
  }

  generate(w, h, baseSeed, level) {
    this._w = w;
    this._h = h;
    this._baseSeed = baseSeed;
    this._level = level;
    this._pockets = null;
    this._pocketSet = new Set();
    this._ceilHoles = new Set();
    const rng = createRng(hashSeed(`${baseSeed}_${level}_regions`));
    
    const count = Math.max(3, Math.min(7, Math.round((w * h) / 90)));
    const types = Object.keys(REGION_WEIGHTS);
    const weightedPick = (pool, weightOf) => {
      const total = pool.reduce((a, t) => a + weightOf(t), 0);
      let r = rng() * total;
      for (const t of pool) {
        r -= weightOf(t);
        if (r <= 0) return t;
      }
      return pool[0];
    };
    const seeds = [];
    for (let i = 0; i < count; i++) {
      const sx = level === 1 && i === 0 ? 1.2 : rng() * w;
      const sy = level === 1 && i === 0 ? 1.2 : rng() * h;
      let type;
      if (i === 0) {
        type = level === 1 ? 'house' : weightedPick(types, (t) => REGION_WEIGHTS[t]);
      } else {
        
        let near = seeds[0];
        let nd = Infinity;
        for (const s of seeds) {
          const d = Math.hypot(s.x - sx, s.y - sy);
          if (d < nd) {
            nd = d;
            near = s;
          }
        }
        const used = new Set(seeds.map((s) => s.type));
        const pool = [near.type, ...REGION_COMPAT[near.type]];
        type = weightedPick(pool, (t) => (t === near.type ? 0.8 : used.has(t) ? 1 : 2.2));
      }
      seeds.push({ x: sx, y: sy, type });
    }
    
    for (let i = 1; i < seeds.length; i++) {
      const nearest = seeds
        .map((s, j) => ({ j, d: Math.hypot(s.x - seeds[i].x, s.y - seeds[i].y) }))
        .filter((o) => o.j !== i)
        .sort((a, b) => a.d - b.d)
        .slice(0, 2);
      for (const o of nearest) {
        const a = seeds[i].type;
        const b = seeds[o.j].type;
        if (a !== b && !REGION_COMPAT[a].includes(b)) {
          seeds[i].type = 'maintenance';
          break;
        }
      }
    }
    const jitter = [];
    for (let y = 0; y < h; y++) {
      const row = [];
      for (let x = 0; x < w; x++) row.push(rng());
      jitter.push(row);
    }
    let map = [];
    for (let y = 0; y < h; y++) {
      const row = [];
      for (let x = 0; x < w; x++) {
        let best = null;
        let bestD = Infinity;
        for (const s of seeds) {
          const d = (Math.hypot(x + 0.5 - s.x, y + 0.5 - s.y) + jitter[y][x] * 0.7) * (s.type === 'house' ? 0.85 : 1);
          if (d < bestD) {
            bestD = d;
            best = s;
          }
        }
        row.push(best.type);
      }
      map.push(row);
    }
    
    for (let pass = 0; pass < 2; pass++) {
      const next = map.map((r) => r.slice());
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const own = map[y][x];
          const counts = {};
          for (const d of DIR_KEYS) {
            const nx = x + DIRS[d].dx;
            const ny = y + DIRS[d].dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const t = map[ny][nx];
            counts[t] = (counts[t] || 0) + 1;
          }
          for (const t of Object.keys(counts)) {
            if (t !== own && counts[t] >= 3 && !(level === 1 && x === 0 && y === 0)) next[y][x] = t;
          }
        }
      }
      map = next;
    }
    
    
    const buffer = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const own = map[y][x];
        if (!REGION_BUFFERED.has(own)) continue;
        for (const d of DIR_KEYS) {
          const nx = x + DIRS[d].dx;
          const ny = y + DIRS[d].dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const t = map[ny][nx];
          if (t !== own && t !== 'maintenance' && !REGION_COMPAT[own].includes(t)) {
            buffer.push([x, y]);
            break;
          }
        }
      }
    }
    for (const [x, y] of buffer) map[y][x] = 'maintenance';
    
    
    const other = [];
    const prob = [];
    const roll = [];
    for (let y = 0; y < h; y++) {
      const oRow = [];
      const pRow = [];
      const rRow = [];
      for (let x = 0; x < w; x++) {
        const own = map[y][x];
        let dOwn = Infinity;
        let dOth = Infinity;
        let oth = null;
        for (const s of seeds) {
          const d = Math.hypot(x + 0.5 - s.x, y + 0.5 - s.y);
          if (s.type === own) dOwn = Math.min(dOwn, d);
          else if (d < dOth) {
            dOth = d;
            oth = s.type;
          }
        }
        const gap = Math.max(0, dOth - dOwn);
        oRow.push(oth);
        pRow.push(oth ? 0.5 * Math.max(0, 1 - gap / BLEND_WIDTH) : 0);
        rRow.push([rng(), rng(), rng(), rng(), rng()]);
      }
      other.push(oRow);
      prob.push(pRow);
      roll.push(rRow);
    }
    this._blend = { other, p: prob, roll };
    this.regionMap = map;
    return map;
  }
  visual(x, y, channel) {
    const own = this.regionMap[y][x];
    const b = this._blend;
    if (!b || own === 'deepcave') return own;
    return b.roll[y][x][BLEND_CH[channel]] < b.p[y][x] ? b.other[y][x] : own;
  }
  wallRegionAt(x, y, rng) {
    const own = this.regionMap[y][x];
    const b = this._blend;
    if (!b || own === 'deepcave') return own;
    const p = b.p[y][x];
    return p > 0 && rng() < p ? b.other[y][x] : own;
  }
  setPockets(pockets) {
    this._pockets = pockets && pockets.cells.length ? pockets : null;
    this._pocketSet = new Set();
    if (!this._pockets) return;
    for (const [x, y] of this._pockets.cells) {
      this._pocketSet.add(`${x},${y}`);
      this.regionMap[y][x] = 'deepcave';
    }
  }
  isPocket(x, y) {
    return this._pocketSet.has(`${x},${y}`);
  }
  hasPockets() {
    return !!this._pockets;
  }
  protectedCells() {
    if (!this._pockets) return [];
    const out = this._pockets.cells.map(([x, y]) => [x, y]);
    for (const e of this._pockets.entrances) out.push([e.ox, e.oy]);
    return out;
  }
  adjustSurfaces(surfaceMap) {
    if (!surfaceMap || !this.regionMap) return;
    for (let y = 0; y < this._h; y++) {
      for (let x = 0; x < this._w; x++) {
        const r = this.regionMap[y][x];
        const sf = surfaceMap[y][x];
        if (r === 'office') surfaceMap[y][x] = 'stone';
        else if (r === 'deepcave' && sf !== 'water') surfaceMap[y][x] = 'mud';
        else if (r === 'cave' && sf === 'grass') surfaceMap[y][x] = 'mud';
        else if (r === 'maintenance' && (sf === 'grass' || sf === 'mud')) surfaceMap[y][x] = 'stone';
        else if (r === 'library') surfaceMap[y][x] = 'stone';
        else if (r === 'crypt' && (sf === 'grass' || sf === 'mud')) surfaceMap[y][x] = 'stone';
        else if (r === 'pool') {
          
          const wet = Math.sin(x * 0.8 + this._level * 1.7) + Math.cos(y * 0.7 - this._level) + Math.sin((x + y) * 0.45) > 1.0;
          surfaceMap[y][x] = wet ? 'water' : 'stone';
        } else if (r === 'sewer') {
          
          const chan = Math.sin(x * 0.55 + this._level) * Math.cos(y * 0.9 + this._level * 2.1) > 0.5;
          surfaceMap[y][x] = chan ? 'water' : sf === 'grass' ? 'mud' : sf === 'water' ? 'water' : 'stone';
        }
      }
    }
  }
  regionAt(px, pz) {
    if (!this.regionMap) return null;
    const cx = Math.max(0, Math.min(this._w - 1, Math.floor((px - this._origin.x) / this.CELL)));
    const cy = Math.max(0, Math.min(this._h - 1, Math.floor((pz - this._origin.z) / this.CELL)));
    return this.regionMap[cy][cx];
  }


  setCeilingHoles(keys) {
    this._ceilHoles = new Set(keys);
  }
  buildCeiling(grid, w, h, originX, originZ, wallTop) {
    this._origin = { x: originX, z: originZ };
    const group = new THREE.Group();
    const cells = {};
    const low = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (this._ceilHoles && this._ceilHoles.has(`${x},${y}`)) continue;
        if (this.regionMap[y][x] === 'deepcave') low.push([x, y]);
        else (cells[this.visual(x, y, 'ceil')] ||= []).push([x, y]);
      }
    }
    const geo = new THREE.PlaneGeometry(this.CELL, this.CELL);
    this._levelGeos.push(geo);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
    const one = new THREE.Vector3(1, 1, 1);
    const p = new THREE.Vector3();
    const make = (region, list, heightOf) => {
      if (!list.length) return;
      const mesh = new THREE.InstancedMesh(geo, this._ceilingMaterial(region), list.length);
      list.forEach(([x, y], i) => {
        m4.compose(p.set(originX + x * this.CELL + this.CELL / 2, heightOf(x, y), originZ + y * this.CELL + this.CELL / 2), q, one);
        mesh.setMatrixAt(i, m4);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = false;
      group.add(mesh);
    };
    for (const [region, list] of Object.entries(cells)) make(region, list, () => wallTop);
    
    make('deepcave', low, (x, y) => (grid[y][x].elevation || 0) * this.STEP + CAVE_CEIL);
    this._ceil = group;
    return group;
  }

  buildLights(grid, w, h, originX, originZ, wallTop, avoid) {
    this._disposeLights();
    const rng = createRng(hashSeed(`${this._baseSeed}_${this._level}_lamps`));
    const CELL = this.CELL;
    const lamps = [];

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const cell = grid[y][x];
        const region = this.visual(x, y, 'light');
        const cfg = LIGHT_CFG[region];
        if (!cfg) continue;
        const cx = originX + x * CELL + CELL / 2;
        const cz = originZ + y * CELL + CELL / 2;
        const floorY = (cell.elevation || 0) * this.STEP;

        if (cfg.kind === 'torch') {
          if (cell.rampDir || (avoid && avoid.has(`${x},${y}`)) || rng() > cfg.wall) continue;
          const dirs = DIR_KEYS.filter((d) => this._wallUsable(cell, d));
          if (!dirs.length) continue;
          const d = dirs[Math.floor(rng() * dirs.length)];
          const D = DIRS[d];
          const edgeX = cx + D.ex * (CELL / 2);
          const edgeZ = cz + D.ez * (CELL / 2);
          const hx = edgeX + D.ix * 0.3 + (D.ix === 0 ? (rng() - 0.5) * 1.2 : 0);
          const hz = edgeZ + D.iz * 0.3 + (D.iz === 0 ? (rng() - 0.5) * 1.2 : 0);
          const y0 = floorY + 1.75;
          lamps.push({
            kind: 'torch', x: hx, y: y0 + 0.48, z: hz, y0, dir: d,
            edgeX: hx - D.ix * 0.3, edgeZ: hz - D.iz * 0.3,
            lightX: hx + D.ix * 0.25, lightZ: hz + D.iz * 0.25, lightY: y0 + 0.5,
            edges: this._edgeKeys(x, y, d),
            dead: false, flicker: true, phase: rng() * 100, tint: rng(), level: 1, power: 1.4,
          });
          continue;
        }

        const isRoom = cell.roomId != null;
        const onLattice = x % 2 === 0 && y % 2 === 0;
        const chance = isRoom ? cfg.room : onLattice ? cfg.lattice : cfg.stray;
        if (rng() > chance) continue;
        const dead = rng() < cfg.dead;
        const flicker = !dead && rng() < cfg.flicker;
        const jitter = cfg.kind === 'lantern' && !isRoom ? 0.25 : 0;
        const px = cx + (rng() - 0.5) * 2 * jitter;
        const pz = cz + (rng() - 0.5) * 2 * jitter;
        const phase = rng() * 100;
        const tint = rng();
        const alongX = rng() < 0.5;
        const drop = wallTop - floorY;
        const far = Math.min(3, Math.pow(drop / 3.4, 2));
        const lamp = { kind: cfg.kind, region, x: px, z: pz, dead, flicker, phase, tint, level: 1, alongX, cellX: x, cellY: y };
        if (cfg.kind === 'lantern') {
          lamp.y = Math.min(wallTop - (LANTERN_MIN_CHAIN + LANTERN_BODY_H / 2 + 0.06), floorY + LANTERN_MAX_DROP);
          lamp.lightY = lamp.y - 0.05;
          lamp.power = 1;
        } else if (cfg.kind === 'panel') {
          lamp.y = wallTop - 0.05;
          lamp.lightY = wallTop - 0.4;
          lamp.power = 1.25 * far;
        } else {
          lamp.y = wallTop - 0.2;
          lamp.lightY = wallTop - 0.3;
          lamp.red = tint < 0.3;
          lamp.power = 1.2 * far;
        }
        lamps.push(lamp);
      }
    }
    if (!lamps.length) return;

    const group = new THREE.Group();
    const batch = new Batch(this, group);
    const col = (hex) => new THREE.Color(hex);
    const warm = col(0xff8a3d);

    const byKind = { lantern: [], panel: [], bulb: [], torch: [] };
    lamps.forEach((l) => byKind[l.kind].push(l));

    
    byKind.lantern.forEach((l) => {
      l.baseColor = l.dead ? col(0x140c07) : col(0xffb45a).lerp(warm, l.tint * 0.6);
      l.lightColor = col(0xffb45a);
    });
    byKind.panel.forEach((l) => {
      const cool = l.region === 'pool'; 
      l.baseColor = l.dead ? col(0x1c1b16) : col(cool ? 0xb8f0ff : 0xfff0a8).multiplyScalar(1.5);
      l.lightColor = col(cool ? 0xa8e8ff : 0xfff0b0);
    });
    byKind.bulb.forEach((l) => {
      const hex = l.region === 'sewer' ? 0xb0ff80 : l.red ? 0xff3a28 : 0xe4ffd0; 
      l.baseColor = l.dead ? col(0x121410) : col(hex).multiplyScalar(1.3);
      l.lightColor = col(hex);
    });
    byKind.torch.forEach((l) => {
      l.baseColor = col(0xff6a1a);
      l.baseColor2 = col(0xffd27a);
      l.lightColor = col(0xff7a30);
    });

    const makeCore = (list, geoKey, matKey) => {
      if (!list.length) return null;
      const mesh = new THREE.InstancedMesh(this.geo(geoKey), this.mat(matKey), list.length);
      mesh.frustumCulled = false;
      group.add(mesh);
      return mesh;
    };
    const m4 = new THREE.Matrix4();
    const q0 = new THREE.Quaternion();
    const v = new THREE.Vector3();
    const s = new THREE.Vector3();
    const eul = new THREE.Euler();

    
    const lanternCores = makeCore(byKind.lantern, 'sphere', 'basic');
    byKind.lantern.forEach((l, i) => {
      l.index = i;
      l.mesh = lanternCores;
      const topY = l.y + LANTERN_BODY_H / 2 + 0.06;
      const chainLen = wallTop - topY;
      batch.add('cyl', 'iron', l.x, wallTop - chainLen / 2, l.z, { sx: 0.012, sy: chainLen, sz: 0.012 });
      batch.add('cyl', 'iron', l.x, wallTop - 0.015, l.z, { sx: 0.09, sy: 0.03, sz: 0.09 });
      batch.add('cone', 'iron', l.x, l.y + LANTERN_BODY_H / 2 + 0.06, l.z, { sx: 0.17, sy: 0.12, sz: 0.17 });
      batch.add('cyl6', 'iron', l.x, l.y - LANTERN_BODY_H / 2, l.z, { sx: 0.1, sy: 0.04, sz: 0.1 });
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
        batch.add('box', 'iron', l.x + sx * 0.095, l.y, l.z + sz * 0.095, { sx: 0.02, sy: LANTERN_BODY_H, sz: 0.02 });
      });
      m4.compose(v.set(l.x, l.y, l.z), q0, s.set(0.085, 0.085, 0.085));
      lanternCores.setMatrixAt(i, m4);
      lanternCores.setColorAt(i, l.baseColor);
    });

    
    const panelFaces = makeCore(byKind.panel, 'plane', 'basic');
    byKind.panel.forEach((l, i) => {
      l.index = i;
      l.mesh = panelFaces;
      const ry = l.alongX ? 0 : Math.PI / 2;
      batch.add('box', 'panelFrame', l.x, wallTop - 0.015, l.z, { ry, sx: PANEL_W + 0.1, sy: 0.03, sz: PANEL_D + 0.1 });
      m4.compose(v.set(l.x, wallTop - 0.032, l.z), q0.setFromEuler(eul.set(Math.PI / 2, ry, 0, 'YXZ')), s.set(PANEL_W, PANEL_D, 1));
      panelFaces.setMatrixAt(i, m4);
      panelFaces.setColorAt(i, l.baseColor);
    });

    
    const bulbCores = makeCore(byKind.bulb, 'sphere', 'basic');
    byKind.bulb.forEach((l, i) => {
      l.index = i;
      l.mesh = bulbCores;
      batch.add('cyl', 'iron', l.x, wallTop - 0.05, l.z, { sx: 0.06, sy: 0.1, sz: 0.06 });
      batch.add('cage', 'wire', l.x, l.y, l.z, { sx: 0.15, sy: 0.15, sz: 0.15 });
      m4.compose(v.set(l.x, l.y, l.z), q0.identity(), s.set(0.085, 0.085, 0.085));
      bulbCores.setMatrixAt(i, m4);
      bulbCores.setColorAt(i, l.baseColor);
    });

    
    const flameOuter = makeCore(byKind.torch, 'cone', 'basic');
    const flameInner = makeCore(byKind.torch, 'cone', 'basic');
    byKind.torch.forEach((l, i) => {
      l.index = i;
      l.mesh = flameOuter;
      l.mesh2 = flameInner;
      const D = DIRS[l.dir];
      const tag = { edges: l.edges };
      batch.add('cyl', 'torchWood', l.x, l.y0, l.z, { sx: 0.035, sy: 0.5, sz: 0.035, ...tag });
      batch.add('cyl', 'char', l.x, l.y0 + 0.29, l.z, { sx: 0.065, sy: 0.12, sz: 0.065, ...tag });
      
      batch.add(
        'box', 'iron',
        l.edgeX + D.ix * 0.2, l.y0 - 0.05, l.edgeZ + D.iz * 0.2,
        { sx: D.ix === 0 ? 0.05 : 0.2, sy: 0.05, sz: D.iz === 0 ? 0.05 : 0.2, ...tag },
      );
      batch.add('cyl6', 'iron', l.x, l.y0 - 0.15, l.z, { sx: 0.05, sy: 0.03, sz: 0.05, ...tag });
      this._setFlame(l, 1, 1);
      flameOuter.setColorAt(i, l.baseColor);
      flameInner.setColorAt(i, l.baseColor2);
    });

    batch.finalize();

    
    const halos = [];
    const haloTex = this.haloTexture();
    const makeHalo = (list, size, mult) => {
      const lit = list.filter((l) => !l.dead);
      if (!lit.length) return;
      const pos = new Float32Array(lit.length * 3);
      const colArr = new Float32Array(lit.length * 3);
      const geo = new THREE.BufferGeometry();
      lit.forEach((l, i) => {
        pos.set([l.x, l.kind === 'panel' ? wallTop - 0.3 : l.y, l.z], i * 3);
        colArr.set([l.baseColor.r * mult, l.baseColor.g * mult, l.baseColor.b * mult], i * 3);
        l.halo = { arr: colArr, i: i * 3, mult, geo };
      });
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
      const mat = new THREE.PointsMaterial({
        size, map: haloTex, vertexColors: true, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
      });
      const pts = new THREE.Points(geo, mat);
      pts.frustumCulled = false;
      group.add(pts);
      halos.push({ geo, mat });
    };
    makeHalo(byKind.lantern, 1.0, 0.55);
    makeHalo(byKind.panel, 2.6, 0.18);
    makeHalo(byKind.bulb, 1.5, 0.4);
    makeHalo(byKind.torch, 1.7, 0.6);

    
    const pool = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      const light = new THREE.PointLight(0xffb45a, 0, LIGHT_DISTANCE, 2);
      light.castShadow = false;
      group.add(light);
      pool.push({ light, lamp: null, fade: 0 });
    }

    for (const m of [lanternCores, panelFaces, bulbCores, flameOuter, flameInner]) {
      if (!m) continue;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }

    this.scene.add(group);
    const lit = lamps.filter((l) => !l.dead);
    this._lights = {
      group, batch, lamps, lit, halos, pool, byKind,
      cores: [lanternCores, panelFaces, bulbCores, flameOuter, flameInner].filter(Boolean),
      flickerers: lit.filter((l) => l.flicker && l.kind !== 'torch'),
      torches: byKind.torch,
      time: 0, reassignIn: 0,
    };
  }
  _wallUsable(cell, d) {
    const D = cap(d);
    return !!cell[d] && !cell[`door${D}`] && !cell[`crawl${D}`];
  }
  _edgeKeys(x, y, d) {
    const D = DIRS[d];
    const keys = [this.edgeKey(x, y, d)];
    const nx = x + D.dx;
    const ny = y + D.dy;
    if (nx >= 0 && ny >= 0 && nx < this._w && ny < this._h) keys.push(this.edgeKey(nx, ny, D.opp));
    return keys;
  }
  _setFlame(l, sy, sx) {
    const outer = l.mesh;
    const inner = l.mesh2;
    const m4 = this._m4 || (this._m4 = new THREE.Matrix4());
    const q = this._q0 || (this._q0 = new THREE.Quaternion());
    const p = this._p || (this._p = new THREE.Vector3());
    const s = this._s || (this._s = new THREE.Vector3());
    m4.compose(p.set(l.x, l.y0 + 0.35 + 0.13 * sy, l.z), q, s.set(0.075 * sx, 0.26 * sy, 0.075 * sx));
    outer.setMatrixAt(l.index, m4);
    m4.compose(p.set(l.x, l.y0 + 0.35 + 0.08 * sy, l.z), q, s.set(0.04 * sx, 0.16 * sy, 0.04 * sx));
    inner.setMatrixAt(l.index, m4);
  }
  _disposeLights() {
    const L = this._lights;
    if (!L) return;
    this.scene.remove(L.group);
    L.group.traverse((o) => {
      if (o.isInstancedMesh) o.dispose();
    });
    L.halos.forEach(({ geo, mat }) => {
      geo.dispose();
      mat.dispose();
    });
    this._lights = null;
  }

  onWallFall(key) {
    if (this._lights) {
      this._lights.batch.hideEdge(key);
      for (const l of this._lights.torches) {
        if (l.removed || !l.edges.includes(key)) continue;
        l.removed = true;
        l.mesh.setMatrixAt(l.index, ZERO_MATRIX);
        l.mesh2.setMatrixAt(l.index, ZERO_MATRIX);
        l.mesh.instanceMatrix.needsUpdate = true;
        l.mesh2.instanceMatrix.needsUpdate = true;
        if (l.halo) {
          l.halo.arr[l.halo.i] = l.halo.arr[l.halo.i + 1] = l.halo.arr[l.halo.i + 2] = 0;
          l.halo.geo.attributes.color.needsUpdate = true;
        }
      }
    }
    if (this._decor) this._decor.batch.hideEdge(key);
  }

  buildDecor({ grid, w, h, originX, originZ, wallTop, avoid, addCollider }) {
    this._disposeDecor();
    const rng = createRng(hashSeed(`${this._baseSeed}_${this._level}_decor`));
    const CELL = this.CELL;
    const group = new THREE.Group();
    const batch = new Batch(this, group);
    const crystals = [];
    const rnd = (a, b) => a + rng() * (b - a);
    const pick = (arr) => arr[Math.floor(rng() * arr.length)];
    const rot = (lx, lz, yaw) => [lx * Math.cos(yaw) + lz * Math.sin(yaw), -lx * Math.sin(yaw) + lz * Math.cos(yaw)];
    
    const part = (geo, mat, base, lx, ly, lz, o = {}) => {
      const [wx, wz] = rot(lx, lz, base.yaw);
      batch.add(geo, mat, base.x + wx, base.y + ly, base.z + wz, { ...o, ry: base.yaw + (o.ry || 0) });
    };
    
    const cornerWebs = (x, y, cx, cz, usable, anyDoor, chance) => {
      if (anyDoor) return;
      for (const [a, b] of [['n', 'w'], ['n', 'e'], ['s', 'w'], ['s', 'e']]) {
        if (!usable.includes(a) || !usable.includes(b) || rng() > chance) continue;
        for (const [A, B] of [[a, b], [b, a]]) {
          const DA = DIRS[A];
          const DB = DIRS[B];
          const Px = cx + DA.ex * (CELL / 2) + DB.ex * (CELL / 2);
          const Pz = cz + DA.ez * (CELL / 2) + DB.ez * (CELL / 2);
          const size = rnd(0.7, 1.15);
          const Cx = Px + DA.ix * 0.14 + DB.ix * 0.14;
          const Cz = Pz + DA.iz * 0.14 + DB.iz * 0.14;
          const xa = new THREE.Vector3(DB.ix, 0, DB.iz);
          const ya = new THREE.Vector3(0, 1, 0);
          const za = new THREE.Vector3().crossVectors(xa, ya);
          const m = new THREE.Matrix4().makeBasis(xa, ya, za);
          m.scale(new THREE.Vector3(size, size, 1));
          m.setPosition(Cx + DB.ix * (size / 2), wallTop - size / 2, Cz + DB.iz * (size / 2));
          batch.add('plane', 'web', 0, 0, 0, { matrix: m, edges: this._edgeKeys(x, y, A) });
        }
      }
    };

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const cell = grid[y][x];
        const region = this.visual(x, y, 'decor');
        const cx = originX + x * CELL + CELL / 2;
        const cz = originZ + y * CELL + CELL / 2;
        const floorY = (cell.elevation || 0) * this.STEP;
        const isRoom = cell.roomId != null;
        const anyDoor = cell.doorN || cell.doorS || cell.doorE || cell.doorW;
        const anyCrawl = cell.crawlN || cell.crawlS || cell.crawlE || cell.crawlW;
        const free = !cell.rampDir && !cell.hurdleDir && !anyDoor && !anyCrawl && !(avoid && avoid.has(`${x},${y}`));
        const usable = DIR_KEYS.filter((d) => this._wallUsable(cell, d));
        const collide = (px, pz, r, o) => addCollider && addCollider(x, y, px, pz, r, o);
        batch.cur = { x, y, floorY };

        
        const ringPoint = (rMin, rMax) => {
          const a = rng() * Math.PI * 2;
          const r = rnd(rMin, rMax);
          return [cx + Math.cos(a) * r, cz + Math.sin(a) * r];
        };
        
        const wallSpot = (d, inset, along = 0) => {
          const D = DIRS[d];
          const off = CELL / 2 - 0.125 - inset;
          const px = cx + D.ex * off + (D.ix === 0 ? along : 0);
          const pz = cz + D.ez * off + (D.iz === 0 ? along : 0);
          return [px, pz];
        };
        
        const wallBox = (d, along, inset, py, alongLen, deep, sy, mat, color) => {
          const [qx, qz] = wallSpot(d, inset, along);
          const ns = DIRS[d].ix === 0;
          batch.add('box', mat, qx, py, qz, {
            sx: ns ? alongLen : deep, sy, sz: ns ? deep : alongLen, ...(color != null ? { color } : {}),
          });
        };

        
        const SINK = 0.14; 
        const boulderY = (sy) => floorY + sy * 0.4 - 0.03;
        const mound = (px, pz, mr) => {
          const sy = mr * rnd(0.3, 0.5);
          batch.add('boulder', 'rock', px + rnd(-0.05, 0.05), boulderY(sy), pz + rnd(-0.05, 0.05), {
            sx: mr, sy, sz: mr * rnd(0.8, 1.2), ry: rng() * 6.28,
          });
        };
        const stalagmite = (px, pz, r, hgt, kind) => {
          batch.add(kind, 'rock', px, floorY + hgt / 2 - hgt * SINK, pz, {
            sx: r, sy: hgt, sz: r * rnd(0.8, 1.25), ry: rng() * 6.28, rx: rnd(-0.1, 0.1), rz: rnd(-0.1, 0.1),
          });
        };
        
        const stalagmiteCluster = (px, pz, scale, block) => {
          const r = rnd(0.13, 0.32) * scale;
          const hgt = rnd(0.6, 1.9) * scale;
          stalagmite(px, pz, r, hgt, pick(['spire', 'spire', 'spire', 'tusk', 'stump']));
          const sat = Math.floor(rng() * 4);
          for (let i = 0; i < sat; i++) {
            const a = rng() * 6.28;
            const d = r * rnd(0.9, 1.9);
            stalagmite(px + Math.cos(a) * d, pz + Math.sin(a) * d, r * rnd(0.3, 0.7), hgt * rnd(0.2, 0.6), pick(['spire', 'tusk']));
          }
          if (rng() < 0.7) mound(px, pz, r * rnd(1.5, 2.3));
          if (block && r > 0.2) collide(px, pz, r * 0.95);
        };
        const stalactite = (px, pz, ceilY, r, hgt, kind, matKey, anchorTop) => {
          batch.add(kind, matKey, px, ceilY - hgt / 2 + hgt * SINK, pz, {
            sx: r, sy: hgt, sz: r * rnd(0.8, 1.25), rx: Math.PI + rnd(-0.1, 0.1), ry: rng() * 6.28, rz: rnd(-0.1, 0.1),
            ...(anchorTop ? { anchor: 'top' } : {}),
          });
        };

        if (region === 'deepcave') {
          const ceilY = floorY + CAVE_CEIL;
          const nTites = 3 + Math.floor(rng() * 5);
          for (let i = 0; i < nTites; i++) {
            stalactite(cx + rnd(-1.8, 1.8), cz + rnd(-1.8, 1.8), ceilY, rnd(0.05, 0.16), rnd(0.15, 0.38), pick(['spire', 'tusk']), 'rock', false);
          }
          if (free && rng() < 0.4) {
            const [px, pz] = ringPoint(0.9, 1.7);
            stalagmiteCluster(px, pz, 0.45, true);
          }
          if (free && rng() < 0.35) {
            const [px, pz] = ringPoint(0.5, 1.6);
            const sx = rnd(0.3, 0.55);
            const sy = rnd(0.2, 0.4);
            batch.add('boulder', 'rock', px, boulderY(sy), pz, { sx, sy, sz: rnd(0.3, 0.55), ry: rng() * 6.28 });
            collide(px, pz, sx * 0.9);
          }
          if (rng() < 0.12) {
            const bx = cx + rnd(-1.5, 1.5);
            const bz = cz + rnd(-1.5, 1.5);
            for (let k = 0; k < 3; k++) {
              batch.add('cyl', 'bone', bx + rnd(-0.25, 0.25), floorY + 0.03, bz + rnd(-0.25, 0.25), {
                sx: 0.025, sy: rnd(0.25, 0.4), sz: 0.025, rz: Math.PI / 2, ry: rng() * 3,
              });
            }
          }
          if (rng() < 0.14) {
            const [px, pz] = ringPoint(0.6, 1.6);
            const tint = pick([0x5ff0d0, 0x60c0ff, 0x8a7bff]);
            for (let i = 0; i < 3; i++) {
              const hgt = rnd(0.2, 0.45);
              batch.add('cone', 'crystal', px + rnd(-0.15, 0.15), floorY + hgt / 2 - 0.02, pz + rnd(-0.15, 0.15), {
                sx: rnd(0.04, 0.08), sy: hgt, sz: rnd(0.04, 0.08), rx: rnd(-0.3, 0.3), rz: rnd(-0.3, 0.3),
                color: new THREE.Color(tint).multiplyScalar(rnd(0.5, 0.8)),
              });
            }
            crystals.push({ x: px, y: floorY + 0.25, z: pz, c: new THREE.Color(tint).multiplyScalar(0.7), cx: x, cy: y, floorY });
          }
        }

        if (region === 'house') {
          if (isRoom && free && rng() < 0.55) {
            const [dx, dz] = [rnd(-0.3, 0.3), rnd(-0.3, 0.3)];
            batch.add('plane', 'rug', cx + dx, floorY + 0.012, cz + dz, {
              rx: -Math.PI / 2, ry: rng() * Math.PI, sx: rnd(1.8, 2.6), sy: rnd(1.2, 1.7), sz: 1,
              color: pick([0x7a2f2a, 0x2f4a3a, 0x3a3a5a, 0x6a5228, 0x5a2a4a]),
            });
          }
          if (!isRoom && free && rng() < 0.1) {
            const n = 2 + Math.floor(rng() * 2);
            for (let i = 0; i < n; i++) {
              batch.add('box', 'woodDark', cx + rnd(-1.1, 1.1), floorY + 0.03, cz + rnd(-1.1, 1.1), {
                ry: rng() * Math.PI, rz: rnd(-0.1, 0.1), sx: rnd(0.5, 1.1), sy: 0.04, sz: 0.12,
              });
            }
          }
          
          if (!anyDoor) {
            for (const [a, b] of [['n', 'w'], ['n', 'e'], ['s', 'w'], ['s', 'e']]) {
              if (!usable.includes(a) || !usable.includes(b) || rng() > 0.13) continue;
              for (const [A, B] of [[a, b], [b, a]]) {
                const DA = DIRS[A];
                const DB = DIRS[B];
                const Px = cx + DA.ex * (CELL / 2) + DB.ex * (CELL / 2);
                const Pz = cz + DA.ez * (CELL / 2) + DB.ez * (CELL / 2);
                const size = rnd(0.7, 1.15);
                const Cx = Px + DA.ix * 0.14 + DB.ix * 0.14;
                const Cz = Pz + DA.iz * 0.14 + DB.iz * 0.14;
                const xa = new THREE.Vector3(DB.ix, 0, DB.iz);
                const ya = new THREE.Vector3(0, 1, 0);
                const za = new THREE.Vector3().crossVectors(xa, ya);
                const m = new THREE.Matrix4().makeBasis(xa, ya, za);
                m.scale(new THREE.Vector3(size, size, 1));
                m.setPosition(Cx + DB.ix * (size / 2), wallTop - size / 2, Cz + DB.iz * (size / 2));
                batch.add('plane', 'web', 0, 0, 0, { matrix: m, edges: this._edgeKeys(x, y, A) });
              }
            }
          }
        }

        if (region === 'office') {
          if (free && rng() < (isRoom ? 0.5 : 0.11)) {
            const yaw = pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]) + rnd(-0.12, 0.12);
            const base = { x: cx + rnd(-0.3, 0.3), y: floorY, z: cz + rnd(-0.3, 0.3), yaw };
            part('box', 'desk', base, 0, 0.74, 0, { sx: 1.4, sy: 0.05, sz: 0.7 });
            part('box', 'metalGrey', base, -0.5, 0.36, 0, { sx: 0.4, sy: 0.72, sz: 0.62 });
            part('box', 'metalGrey', base, 0.66, 0.36, 0, { sx: 0.04, sy: 0.72, sz: 0.62 });
            part('box', 'dark', base, 0.1, 0.87, -0.15, { sx: 0.06, sy: 0.2, sz: 0.06 });
            part('box', 'dark', base, 0.1, 1.05, -0.15, { sx: 0.52, sy: 0.34, sz: 0.05 });
            const on = rng() < 0.65;
            part('box', 'basic', base, 0.1, 1.05, -0.122, {
              sx: 0.46, sy: 0.28, sz: 0.01,
              color: on ? pick([0x7fd0b0, 0x8fb0ff, 0xb8e8a0]) : 0x040504,
            });
            part('box', 'dark', base, 0.1, 0.77, 0.15, { sx: 0.4, sy: 0.02, sz: 0.14 });
            if (rng() < 0.4) part('box', 'paper', base, -0.35, 0.78, 0.1, { sx: 0.22, sy: 0.05, sz: 0.3, ry: rnd(-0.4, 0.4), color: 0xd8d3c0 });
            
            const cb = { x: base.x, y: floorY, z: base.z, yaw: yaw + rnd(-0.6, 0.6) };
            const chairOff = rot(0.1, 0.8, yaw);
            cb.x += chairOff[0];
            cb.z += chairOff[1];
            part('box', 'chair', cb, 0, 0.48, 0, { sx: 0.45, sy: 0.06, sz: 0.45 });
            part('box', 'chair', cb, 0, 0.78, 0.22, { sx: 0.45, sy: 0.5, sz: 0.05 });
            part('cyl', 'dark', cb, 0, 0.25, 0, { sx: 0.035, sy: 0.4, sz: 0.035 });
            part('cyl', 'dark', cb, 0, 0.03, 0, { sx: 0.24, sy: 0.04, sz: 0.24 });
            collide(cb.x, cb.z, 0.28, { hgt: 0.51, hx: 0.225, hz: 0.225, yaw: cb.yaw });
            collide(base.x, base.z, 0.72, { hgt: 0.77, hx: 0.7, hz: 0.35, yaw: base.yaw });
          } else if (free && usable.length && rng() < 0.11) {
            const d = pick(usable);
            const ns = DIRS[d].ix === 0;
            const [px, pz] = wallSpot(d, 0.3, rnd(-0.9, 0.9));
            batch.add('box', 'metalGrey', px, floorY + 0.675, pz, {
              sx: ns ? 0.5 : 0.6, sy: 1.35, sz: ns ? 0.6 : 0.5, edges: null,
            });
            for (const hy of [0.35, 0.75, 1.15]) {
              batch.add('box', 'dark', px + DIRS[d].ix * 0.305, floorY + hy, pz + DIRS[d].iz * 0.305, {
                sx: ns ? 0.16 : 0.02, sy: 0.03, sz: ns ? 0.02 : 0.16,
              });
            }
            collide(px, pz, 0.36);
          } else if (free && rng() < 0.08) {
            const yaw = pick([0, Math.PI / 2]);
            const base = { x: cx + rnd(-0.2, 0.2), y: floorY, z: cz + rnd(-0.2, 0.2), yaw };
            part('box', 'fabric', base, 0, 0.7, -0.5, { sx: 1.6, sy: 1.4, sz: 0.06 });
            part('box', 'fabric', base, -0.8, 0.7, 0, { sx: 0.06, sy: 1.4, sz: 1.0 });
            part('box', 'dark', base, 0, 0.02, -0.5, { sx: 1.62, sy: 0.04, sz: 0.09 });
            for (const [lx, lz] of [[-0.55, -0.5], [0.55, -0.5], [-0.8, 0.05]]) {
              const [wx, wz] = rot(lx, lz, yaw);
              collide(base.x + wx, base.z + wz, 0.33);
            }
          }
          if (!cell.rampDir && rng() < 0.22) {
            const n = 4 + Math.floor(rng() * 5);
            const px = cx + rnd(-1.4, 1.4);
            const pz = cz + rnd(-1.4, 1.4);
            for (let i = 0; i < n; i++) {
              batch.add('plane', 'paper', px + rnd(-0.6, 0.6), floorY + 0.006 + i * 0.0006, pz + rnd(-0.6, 0.6), {
                rx: -Math.PI / 2, ry: rng() * Math.PI * 2, sx: 0.21, sy: 0.3, sz: 1,
                color: pick([0xd8d3c0, 0xcfc7a8, 0xe2ded0]),
              });
            }
          }
        }

        if (region === 'cave') {
          if (!cell.rampDir && !cell.hurdleDir) {
            if (rng() < 0.35) {
              const n = 1 + Math.floor(rng() * 2);
              for (let i = 0; i < n; i++) {
                const [px, pz] = ringPoint(1.1, 1.7);
                stalagmiteCluster(px, pz, rnd(0.8, 1.25), free);
              }
            }
            if (rng() < 0.18) {
              const [px, pz] = ringPoint(0.9, 1.7);
              const sx = rnd(0.3, 0.7);
              const sy = rnd(0.25, 0.55);
              batch.add('boulder', 'rock', px, boulderY(sy), pz, { sx, sy, sz: rnd(0.3, 0.7), ry: rng() * 6.28 });
              if (free && sx > 0.4) collide(px, pz, sx * 0.85);
            }
            if (free && rng() < 0.05) {
              
              const [px, pz] = ringPoint(0.7, 1.5);
              const hh = wallTop - floorY;
              const r = rnd(0.16, 0.26);
              batch.add('column', 'rock', px, floorY + hh / 2, pz, { sx: r, sy: hh, sz: r * rnd(0.85, 1.2), ry: rng() * 6.28, anchor: 'span', top: wallTop });
              collide(px, pz, r * 1.2);
            }
            if (rng() < (isRoom ? 0.3 : 0.07)) {
              const [px, pz] = ringPoint(0.6, 1.6);
              const tint = pick([0x5ff0d0, 0x60c0ff, 0x8a7bff]);
              const n = 3 + Math.floor(rng() * 3);
              for (let i = 0; i < n; i++) {
                const hgt = rnd(0.25, 0.7);
                batch.add('cone', 'crystal', px + rnd(-0.18, 0.18), floorY + hgt / 2 - 0.02, pz + rnd(-0.18, 0.18), {
                  sx: rnd(0.04, 0.09), sy: hgt, sz: rnd(0.04, 0.09), rx: rnd(-0.3, 0.3), rz: rnd(-0.3, 0.3),
                  color: new THREE.Color(tint).multiplyScalar(rnd(0.7, 1.2)),
                });
              }
              crystals.push({ x: px, y: floorY + 0.35, z: pz, c: new THREE.Color(tint), cx: x, cy: y, floorY });
            }
          }
          if (rng() < 0.4) {
            const n = 2 + Math.floor(rng() * 4);
            for (let i = 0; i < n; i++) {
              const tx = cx + rnd(-1.7, 1.7);
              const tz = cz + rnd(-1.7, 1.7);
              stalactite(tx, tz, wallTop, rnd(0.08, 0.26), rnd(0.3, 1.5), pick(['spire', 'spire', 'tusk']), 'rock', true);
              if (rng() < 0.3) stalactite(tx + rnd(-0.3, 0.3), tz + rnd(-0.3, 0.3), wallTop, rnd(0.03, 0.06), rnd(0.4, 1.1), 'spire', 'rock', true); 
            }
          }
        }

        if (region === 'maintenance') {
          
          for (const d of usable) {
            if (rng() > 0.3) continue;
            const D = DIRS[d];
            const alongX = D.ix === 0;
            const edges = this._edgeKeys(x, y, d);
            const [px, pz] = wallSpot(d, 0.1, 0);
            const py = wallTop - 0.45;
            const color = pick([0x6b4a34, 0x4c4f4a, 0x2f4a3a, 0x7a6a30]);
            batch.add('cyl', 'tinted', px, py, pz, {
              sx: 0.08, sy: CELL, sz: 0.08, color, edges, anchor: 'top', ...(alongX ? { rz: Math.PI / 2 } : { rx: Math.PI / 2 }),
            });
            if (rng() < 0.6) {
              batch.add('cyl', 'tinted', px, py - 0.2, pz, {
                sx: 0.05, sy: CELL, sz: 0.05, color: pick([0x4c4f4a, 0x6b4a34]), edges, anchor: 'top',
                ...(alongX ? { rz: Math.PI / 2 } : { rx: Math.PI / 2 }),
              });
            }
          }
          
          if (!anyDoor) {
            for (const [a, b] of [['n', 'w'], ['n', 'e'], ['s', 'w'], ['s', 'e']]) {
              if (!usable.includes(a) || !usable.includes(b) || rng() > 0.12) continue;
              const DA = DIRS[a];
              const DB = DIRS[b];
              const px = cx + DA.ex * (CELL / 2) + DB.ex * (CELL / 2) + DA.ix * 0.2 + DB.ix * 0.2;
              const pz = cz + DA.ez * (CELL / 2) + DB.ez * (CELL / 2) + DA.iz * 0.2 + DB.iz * 0.2;
              const hh = wallTop - floorY;
              batch.add('cyl', 'tinted', px, floorY + hh / 2, pz, {
                sx: 0.1, sy: hh, sz: 0.1, color: pick([0x6b4a34, 0x4c4f4a, 0x2f4a3a]),
                edges: [...this._edgeKeys(x, y, a), ...this._edgeKeys(x, y, b)],
                anchor: 'span', top: wallTop,
              });
            }
          }
          if (free && rng() < (isRoom ? 0.35 : 0.1)) {
            const [px, pz] = ringPoint(0.9, 1.6);
            batch.add('cyl', 'tinted', px, floorY + 0.425, pz, {
              sx: 0.28, sy: 0.85, sz: 0.28, color: pick([0x6e3b26, 0x2f4a5c, 0x3a5a3a, 0x7a6a30]),
            });
            batch.add('cyl', 'dark', px, floorY + 0.86, pz, { sx: 0.24, sy: 0.03, sz: 0.24 });
            collide(px, pz, 0.32, { hgt: 0.88 });
          } else if (free && rng() < (isRoom ? 0.3 : 0.08)) {
            const [px, pz] = ringPoint(0.8, 1.5);
            const yaw = rng() * Math.PI;
            const sz = rnd(0.6, 0.85);
            batch.add('box', 'crate', px, floorY + sz / 2, pz, { sx: sz, sy: sz, sz, ry: yaw });
            const stacked = rng() < 0.4;
            if (stacked) batch.add('box', 'crate', px, floorY + sz + 0.2, pz, { sx: 0.5, sy: 0.4, sz: 0.5, ry: yaw + 0.4 });
            collide(px, pz, sz * 0.72, stacked ? undefined : { hgt: sz, hx: sz / 2, hz: sz / 2, yaw });
          }
          if (usable.length && rng() < 0.06) {
            const d = pick(usable);
            const D = DIRS[d];
            const [px, pz] = wallSpot(d, 0.06, rnd(-0.8, 0.8));
            const edges = this._edgeKeys(x, y, d);
            batch.add('box', 'panelBox', px, floorY + 1.5, pz, {
              sx: D.ix === 0 ? 0.6 : 0.12, sy: 0.8, sz: D.iz === 0 ? 0.6 : 0.12, edges,
            });
            batch.add('box', 'basic', px + D.ix * 0.065, floorY + 1.7, pz + D.iz * 0.065, {
              sx: D.ix === 0 ? 0.06 : 0.02, sy: 0.06, sz: D.iz === 0 ? 0.06 : 0.02, edges,
              color: rng() < 0.5 ? 0xff3020 : 0x40ff70,
            });
          }
        }

        if (region === 'library') {
          const BOOKS = [0x5a2a22, 0x2f3a2c, 0x2a2f4a, 0x4a3a22, 0x3a2a3a, 0x6a5a3a, 0x22302f, 0x502222];
          const bookColor = () => new THREE.Color(pick(BOOKS)).multiplyScalar(rnd(0.7, 1.25));
          if (free && usable.length && rng() < (isRoom ? 0.8 : 0.34)) {
            
            const d = pick(usable);
            const H = rnd(2.0, 2.6);
            const levels = Math.floor(H / 0.5);
            const step = (H - 0.05) / levels;
            const shift = rnd(-0.5, 0.5);
            const depth = 0.38;
            const mid = depth / 2 + 0.02;
            wallBox(d, shift, 0.03, floorY + H / 2, 1.75, 0.04, H, 'woodDark');
            for (const sgn of [-1, 1]) wallBox(d, shift + sgn * 0.86, mid, floorY + H / 2, 0.05, depth, H, 'woodDark');
            for (let k = 0; k <= levels; k++) {
              const py = floorY + 0.05 + k * step;
              wallBox(d, shift, mid, py, 1.75, depth, 0.04, 'woodDark');
              if (k === levels) break;
              let a = -0.8;
              while (a < 0.8) {
                if (rng() < 0.07) {
                  a += rnd(0.1, 0.3); 
                  continue;
                }
                const bw = rnd(0.035, 0.085);
                const bh = rnd(0.22, step - 0.07);
                wallBox(d, shift + a + bw / 2, mid, py + 0.02 + bh / 2, bw, depth * 0.78, bh, 'matte', bookColor());
                a += bw + 0.004;
              }
            }
            for (const sgn of [-1, 1]) {
              const [qx, qz] = wallSpot(d, mid, shift + sgn * 0.5);
              collide(qx, qz, 0.42);
            }
          } else if (free && rng() < (isRoom ? 0.3 : 0.06)) {
            
            const yaw = pick([0, Math.PI / 2]) + rnd(-0.1, 0.1);
            const base = { x: cx + rnd(-0.3, 0.3), y: floorY, z: cz + rnd(-0.3, 0.3), yaw };
            part('box', 'woodDark', base, 0, 0.74, 0, { sx: 1.5, sy: 0.06, sz: 0.8 });
            for (const [lx, lz] of [[-0.65, -0.32], [0.65, -0.32], [-0.65, 0.32], [0.65, 0.32]]) {
              part('box', 'woodDark', base, lx, 0.355, lz, { sx: 0.07, sy: 0.71, sz: 0.07 });
            }
            const br = rnd(-0.4, 0.4);
            part('box', 'matte', base, -0.2, 0.785, 0.05, { sx: 0.3, sy: 0.03, sz: 0.22, ry: br, color: bookColor() });
            part('box', 'paper', base, -0.2, 0.803, 0.05, { sx: 0.27, sy: 0.01, sz: 0.19, ry: br, color: 0xd8d0b8 });
            for (let i = 0; i < 3; i++) {
              part('box', 'matte', base, 0.4, 0.785 + i * 0.05, 0.2, {
                sx: 0.26 - i * 0.02, sy: 0.05, sz: 0.19, ry: rnd(-0.3, 0.3), color: bookColor(),
              });
            }
            if (rng() < 0.6) {
              part('cyl', 'bone', base, 0.45, 0.85, -0.2, { sx: 0.03, sy: 0.16, sz: 0.03 });
              part('cone', 'basic', base, 0.45, 0.96, -0.2, { sx: 0.02, sy: 0.06, sz: 0.02, color: 0xffb060 });
              const [gx, gz] = rot(0.45, -0.2, base.yaw);
              crystals.push({
                x: base.x + gx, y: floorY + 1.0, z: base.z + gz,
                c: new THREE.Color(0xff9a3c).multiplyScalar(0.5), cx: x, cy: y, floorY,
              });
            }
            const cb = { x: base.x, y: floorY, z: base.z, yaw: yaw + rnd(-0.5, 0.5) };
            const [ox, oz] = rot(0, 0.85, yaw);
            cb.x += ox;
            cb.z += oz;
            part('box', 'woodDark', cb, 0, 0.45, 0, { sx: 0.42, sy: 0.05, sz: 0.42 });
            part('box', 'woodDark', cb, 0, 0.75, 0.2, { sx: 0.42, sy: 0.6, sz: 0.04 });
            for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) {
              part('box', 'woodDark', cb, lx, 0.215, lz, { sx: 0.04, sy: 0.43, sz: 0.04 });
            }
            collide(cb.x, cb.z, 0.3, { hgt: 0.47, hx: 0.21, hz: 0.21, yaw: cb.yaw });
            collide(base.x, base.z, 0.75, { hgt: 0.77, hx: 0.75, hz: 0.4, yaw: base.yaw });
          }
          if (free && rng() < 0.16) {
            
            const px = cx + rnd(-1.3, 1.3);
            const pz = cz + rnd(-1.3, 1.3);
            const n = 3 + Math.floor(rng() * 4);
            for (let i = 0; i < n; i++) {
              batch.add('box', 'matte', px + rnd(-0.5, 0.5), floorY + 0.025, pz + rnd(-0.5, 0.5), {
                sx: 0.2, sy: 0.05, sz: 0.28, ry: rng() * Math.PI * 2, color: bookColor(),
              });
            }
            for (let i = 0; i < 3; i++) {
              batch.add('plane', 'paper', px + rnd(-0.7, 0.7), floorY + 0.007 + i * 0.0006, pz + rnd(-0.7, 0.7), {
                rx: -Math.PI / 2, ry: rng() * Math.PI * 2, sx: 0.21, sy: 0.3, sz: 1, color: 0xcfc7a8,
              });
            }
          }
          cornerWebs(x, y, cx, cz, usable, anyDoor, 0.16);
        }

        if (region === 'pool') {
          if (free && rng() < (isRoom ? 0.3 : 0.07)) {
            
            const [px, pz] = ringPoint(0.7, 1.4);
            const s = rnd(0.5, 0.7);
            const hh = wallTop - floorY;
            batch.add('box', 'tile', px, floorY + hh / 2, pz, { sx: s, sy: hh, sz: s, anchor: 'span', top: wallTop });
            batch.add('box', 'matte', px, floorY + 1.1, pz, { sx: s + 0.02, sy: 0.3, sz: s + 0.02, color: 0x2b6f7a });
            collide(px, pz, s * 0.78);
          } else if (free && rng() < 0.06) {
            
            const [px, pz] = ringPoint(0.8, 1.6);
            const base = { x: px, y: floorY, z: pz, yaw: pick([0, Math.PI / 2]) };
            part('box', 'tile', base, 0, 0.42, 0, { sx: 1.3, sy: 0.08, sz: 0.4 });
            for (const s of [-0.5, 0.5]) part('box', 'metalGrey', base, s, 0.19, 0, { sx: 0.06, sy: 0.38, sz: 0.36 });
            collide(px, pz, 0.6, { hgt: 0.46, hx: 0.65, hz: 0.2, yaw: base.yaw });
          } else if (free && rng() < 0.05) {
            
            const [px, pz] = ringPoint(0.5, 1.6);
            batch.add('sphere', 'matte', px, floorY + 0.26, pz, {
              sx: 0.26, sy: 0.26, sz: 0.26, color: pick([0xd23030, 0xe8e8e0, 0x2a6fd2]),
            });
            collide(px, pz, 0.28);
          }
          if (free && usable.length && rng() < 0.08) {
            
            const d = pick(usable);
            const ns = DIRS[d].ix === 0;
            const along = rnd(-1.2, 1.2);
            const edges = this._edgeKeys(x, y, d);
            for (const s of [-0.22, 0.22]) {
              const [px, pz] = wallSpot(d, 0.14, along + s);
              batch.add('cyl', 'metalGrey', px, floorY + 0.95, pz, { sx: 0.022, sy: 1.9, sz: 0.022, edges });
            }
            for (let k = 0; k < 5; k++) {
              const [px, pz] = wallSpot(d, 0.14, along);
              batch.add('cyl', 'metalGrey', px, floorY + 0.35 + k * 0.32, pz, {
                sx: 0.015, sy: 0.44, sz: 0.015, edges, ...(ns ? { rz: Math.PI / 2 } : { rx: Math.PI / 2 }),
              });
            }
          }
          if (free && rng() < 0.1) {
            
            const [px, pz] = ringPoint(0, 1.2);
            const gb = { x: px, y: floorY, z: pz, yaw: rng() * 0.6 };
            part('box', 'dark', gb, 0, 0.012, 0, { sx: 0.5, sy: 0.024, sz: 0.5 });
            for (let k = -2; k <= 2; k++) part('box', 'iron', gb, k * 0.09, 0.03, 0, { sx: 0.025, sy: 0.02, sz: 0.46 });
          }
          if (free && rng() < 0.3) {
            batch.add('sphere', 'puddle', cx + rnd(-1.2, 1.2), floorY, cz + rnd(-1.2, 1.2), {
              sx: rnd(0.4, 0.9), sy: 0.012, sz: rnd(0.3, 0.7), ry: rng() * Math.PI,
            });
          }
        }

        if (region === 'sewer') {
          
          for (const d of usable) {
            if (rng() > 0.26) continue;
            const alongX = DIRS[d].ix === 0;
            const edges = this._edgeKeys(x, y, d);
            const [px, pz] = wallSpot(d, 0.2, 0);
            const py = wallTop - 0.75;
            const color = pick([0x4a5a3a, 0x5a3a2a, 0x3a4a4a, 0x6b4a34]);
            const rotO = alongX ? { rz: Math.PI / 2 } : { rx: Math.PI / 2 };
            batch.add('cyl', 'tinted', px, py, pz, { sx: 0.17, sy: CELL, sz: 0.17, color, edges, anchor: 'top', ...rotO });
            for (const off of [-1.1, 1.1]) {
              batch.add('cyl', 'iron', px + (alongX ? off : 0), py, pz + (alongX ? 0 : off), {
                sx: 0.21, sy: 0.1, sz: 0.21, edges, anchor: 'top', ...rotO,
              });
            }
          }
          if (rng() < 0.35) {
            
            const n = 1 + Math.floor(rng() * 3);
            for (let i = 0; i < n; i++) {
              const r = rnd(0.05, 0.13);
              const hgt = rnd(0.25, 0.9);
              batch.add('stalag', 'slime', cx + rnd(-1.7, 1.7), wallTop - hgt / 2 + 0.02, cz + rnd(-1.7, 1.7), {
                sx: r, sy: hgt, sz: r, rx: Math.PI, ry: rng() * 3, anchor: 'top',
              });
            }
          }
          if (free && rng() < (isRoom ? 0.3 : 0.07)) {
            
            const [px, pz] = ringPoint(0.8, 1.6);
            batch.add('cyl', 'tinted', px, floorY + 0.28, pz, {
              sx: 0.28, sy: 0.85, sz: 0.28, rz: Math.PI / 2, ry: rng() * Math.PI,
              color: pick([0x6e3b26, 0x3a4a3a, 0x4a4438]),
            });
            collide(px, pz, 0.45);
          }
          if (free && rng() < 0.12) {
            
            const [px, pz] = ringPoint(0, 1.2);
            const gb = { x: px, y: floorY, z: pz, yaw: pick([0, 0.3]) };
            part('box', 'dark', gb, 0, 0.02, 0, { sx: 0.9, sy: 0.04, sz: 0.9 });
            for (let k = -2; k <= 2; k++) part('box', 'iron', gb, k * 0.17, 0.05, 0, { sx: 0.04, sy: 0.03, sz: 0.86 });
          }
          if (free && rng() < 0.35) {
            batch.add('sphere', 'slime', cx + rnd(-1.3, 1.3), floorY, cz + rnd(-1.3, 1.3), {
              sx: rnd(0.4, 1.0), sy: 0.012, sz: rnd(0.3, 0.8), ry: rng() * Math.PI,
            });
          }
          if (free && rng() < 0.06) {
            
            const [px, pz] = ringPoint(0.3, 1.6);
            const rb = { x: px, y: floorY, z: pz, yaw: rng() * Math.PI * 2 };
            part('sphere', 'char', rb, 0, 0.07, 0, { sx: 0.13, sy: 0.07, sz: 0.07 });
            part('sphere', 'char', rb, 0.13, 0.075, 0, { sx: 0.06, sy: 0.05, sz: 0.05 });
            part('cyl', 'char', rb, -0.24, 0.03, 0, { sx: 0.008, sy: 0.24, sz: 0.008, rz: Math.PI / 2 });
            for (const s of [-0.025, 0.025]) part('sphere', 'basic', rb, 0.17, 0.09, s, { sx: 0.008, sy: 0.008, sz: 0.008, color: 0xff2010 });
          }
        }

        if (region === 'crypt') {
          if (free && rng() < (isRoom ? 0.35 : 0.08)) {
            
            const yaw = pick([0, Math.PI / 2]) + rnd(-0.1, 0.1);
            const base = { x: cx + rnd(-0.2, 0.2), y: floorY, z: cz + rnd(-0.2, 0.2), yaw };
            const ajar = rng() < 0.4;
            part('box', 'stone', base, 0, 0.3, 0, { sx: 1.9, sy: 0.6, sz: 0.85 });
            part('box', 'stone', base, ajar ? 0.3 : 0, 0.66, ajar ? 0.08 : 0, { sx: 2.0, sy: 0.12, sz: 0.95, ry: ajar ? rnd(0.08, 0.2) : 0 });
            part('box', 'bone', base, ajar ? 0.4 : 0.1, 0.73, ajar ? 0.08 : 0, { sx: 0.5, sy: 0.02, sz: 0.06 });
            part('box', 'bone', base, ajar ? 0.3 : 0, 0.73, ajar ? 0.08 : 0, { sx: 0.06, sy: 0.02, sz: 0.4 });
            collide(base.x, base.z, 1.05, { hgt: 0.72, hx: 1.0, hz: 0.475, yaw });
          } else if (free && rng() < (isRoom ? 0.3 : 0.1)) {
            
            const [px, pz] = ringPoint(0.7, 1.6);
            const n = 4 + Math.floor(rng() * 4);
            for (let i = 0; i < n; i++) {
              const layer = i > 3 ? 0.13 : 0;
              const sx = px + rnd(-0.22, 0.22);
              const sz = pz + rnd(-0.22, 0.22);
              const yaw = rng() * Math.PI * 2;
              const sb = { x: sx, y: floorY, z: sz, yaw };
              part('sphere', 'bone', sb, 0, 0.075 + layer, 0, { sx: 0.075, sy: 0.08, sz: 0.085 });
              for (const s of [-0.03, 0.03]) part('sphere', 'char', sb, 0.06, 0.09 + layer, s, { sx: 0.02, sy: 0.025, sz: 0.02 });
            }
            for (let k = 0; k < 4; k++) {
              batch.add('cyl', 'bone', px + rnd(-0.4, 0.4), floorY + 0.02, pz + rnd(-0.4, 0.4), {
                sx: 0.02, sy: rnd(0.25, 0.4), sz: 0.02, rz: Math.PI / 2, ry: rng() * 3,
              });
            }
            collide(px, pz, 0.3);
          }
          if (free && rng() < (isRoom ? 0.35 : 0.14)) {
            
            const [px, pz] = ringPoint(0.5, 1.6);
            const n = 3 + Math.floor(rng() * 3);
            for (let i = 0; i < n; i++) {
              const h = rnd(0.08, 0.25);
              const qx = px + rnd(-0.14, 0.14);
              const qz = pz + rnd(-0.14, 0.14);
              batch.add('cyl', 'bone', qx, floorY + h / 2, qz, { sx: 0.025, sy: h, sz: 0.025 });
              batch.add('cone', 'basic', qx, floorY + h + 0.03, qz, { sx: 0.018, sy: 0.06, sz: 0.018, color: 0xffb060 });
            }
            crystals.push({
              x: px, y: floorY + 0.3, z: pz,
              c: new THREE.Color(0xff9a3c).multiplyScalar(0.55), cx: x, cy: y, floorY,
            });
          }
          if (free && rng() < (isRoom ? 0.25 : 0.07)) {
            
            const [px, pz] = ringPoint(0.8, 1.5);
            const hh = wallTop - floorY;
            batch.add('cyl', 'stone', px, floorY + hh / 2, pz, { sx: 0.3, sy: hh, sz: 0.3, anchor: 'span', top: wallTop });
            batch.add('cyl', 'stone', px, floorY + 0.12, pz, { sx: 0.44, sy: 0.24, sz: 0.44 });
            batch.add('cyl', 'stone', px, wallTop - 0.12, pz, { sx: 0.44, sy: 0.24, sz: 0.44, anchor: 'top' });
            collide(px, pz, 0.4);
          }
          if (free && usable.length && rng() < (isRoom ? 0.5 : 0.14)) {
            
            const d = pick(usable);
            const shift = rnd(-0.4, 0.4);
            wallBox(d, shift, 0.06, floorY + 0.95, 1.8, 0.1, 1.9, 'stone');
            for (const py of [0.55, 1.35]) {
              wallBox(d, shift, 0.28, floorY + py, 1.7, 0.5, 0.1, 'stone');
              wallBox(d, shift - 0.05, 0.28, floorY + py + 0.14, 1.25, 0.28, 0.18, 'bone', 0xa39c8a);
              const [qx, qz] = wallSpot(d, 0.28, shift + 0.72);
              batch.add('sphere', 'bone', qx, floorY + py + 0.19, qz, { sx: 0.09, sy: 0.1, sz: 0.09 });
            }
            for (const sgn of [-1, 1]) {
              const [qx, qz] = wallSpot(d, 0.28, shift + sgn * 0.5);
              collide(qx, qz, 0.4);
            }
          }
          if (rng() < 0.1) {
            
            const len = rnd(0.5, 1.2);
            const qx = cx + rnd(-1.5, 1.5);
            const qz = cz + rnd(-1.5, 1.5);
            batch.add('cyl', 'iron', qx, wallTop - len / 2, qz, { sx: 0.012, sy: len, sz: 0.012, anchor: 'top' });
            batch.add('cyl6', 'iron', qx, wallTop - len, qz, { sx: 0.06, sy: 0.03, sz: 0.06, anchor: 'top' });
          }
          cornerWebs(x, y, cx, cz, usable, anyDoor, 0.14);
        }
      }
    }

    
    if (this._pockets) {
      for (const ent of this._pockets.entrances) {
        const D = DIRS[ent.dir];
        const pc = grid[ent.py][ent.px];
        const floorY = (pc.elevation || 0) * this.STEP;
        batch.cur = { x: ent.px, y: ent.py, floorY };
        const wx = originX + ent.px * CELL + CELL / 2 + D.ex * (CELL / 2);
        const wz = originZ + ent.py * CELL + CELL / 2 + D.ez * (CELL / 2);
        for (const side of [1, -1]) {
          const n = 4 + Math.floor(rng() * 3);
          for (let i = 0; i < n; i++) {
            const along = rnd(-1.3, 1.3);
            const off = side * rnd(0.28, 0.6);
            const size = rnd(0.06, 0.2);
            const rubbleH = size * rnd(0.6, 1);
            batch.add('boulder', 'rock',
              wx + D.ex * off + (D.ex === 0 ? along : 0),
              floorY + rubbleH * 0.4 - 0.02,
              wz + D.ez * off + (D.ez === 0 ? along : 0),
              { sx: size, sy: rubbleH, sz: size, ry: rng() * 6.28 });
          }
        }
      }
    }

    batch.cur = null;
    batch.finalize();

    
    if (crystals.length) {
      const pos = new Float32Array(crystals.length * 3);
      const colArr = new Float32Array(crystals.length * 3);
      crystals.forEach((c, i) => {
        pos.set([c.x, c.y, c.z], i * 3);
        colArr.set([c.c.r * 0.5, c.c.g * 0.5, c.c.b * 0.5], i * 3);
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
      const mat = new THREE.PointsMaterial({
        size: 1.6, map: this.haloTexture(), vertexColors: true,
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
      });
      const pts = new THREE.Points(geo, mat);
      pts.frustumCulled = false;
      group.add(pts);
      this._levelGeos.push(geo);
      this._decorMats = [mat];
      this._crystalGlow = { geo, list: crystals };
    } else {
      this._crystalGlow = null;
    }

    this.scene.add(group);
    this._decor = { group, batch };
  }
  refreshDecorHeights(grid) {
    if (!this._decor || !grid) return;
    const floorOf = (x, y) => ((grid[y] && grid[y][x] && grid[y][x].elevation) || 0) * this.STEP;
    this._decor.batch.refreshHeights(floorOf);
    const glow = this._crystalGlow;
    if (glow) {
      const attr = glow.geo.attributes.position;
      glow.list.forEach((c, i) => {
        const fy = floorOf(c.cx, c.cy);
        if (fy === c.floorY) return;
        c.y += fy - c.floorY;
        c.floorY = fy;
        attr.setY(i, c.y);
      });
      attr.needsUpdate = true;
    }
  }
  _disposeDecor() {
    const D = this._decor;
    if (!D) return;
    this.scene.remove(D.group);
    D.group.traverse((o) => {
      if (o.isInstancedMesh) o.dispose();
    });
    if (this._decorMats) this._decorMats.forEach((m) => m.dispose());
    this._decorMats = null;
    this._decor = null;
  }

  update(dt, player) {
    
    const region = this.regionAt(player.x, player.z);
    if (region) {
      if (region !== this.currentRegion) {
        this.currentRegion = region;
        if (this.onRegionChange) this.onRegionChange(region);
      }
      this._fogTarget.set(REGION_FOG[region] ?? REGION_FOG.house);
      const fog = this.scene.fog;
      if (fog && fog.color) fog.color.lerp(this._fogTarget, Math.min(1, dt * 1.5));
    }

    const L = this._lights;
    if (!L) return;
    L.time += dt;
    const t = L.time;
    const tmp = this._tmpColor || (this._tmpColor = new THREE.Color());
    const dirtyColor = new Set();
    const dirtyMatrix = new Set();

    
    for (const l of L.flickerers) {
      let lvl;
      if (l.kind === 'panel') {
        lvl = 0.92 + 0.08 * Math.sin(t * 55 + l.phase);
        if (((t * 0.21 + l.phase) % 1) < 0.05) lvl = Math.sin(t * 70 + l.phase) > 0 ? 0.9 : 0.08;
      } else if (l.kind === 'bulb') {
        lvl = 0.9 + 0.1 * Math.sin(t * 40 + l.phase);
        if (((t * 0.19 + l.phase) % 1) < 0.06) lvl = Math.sin(t * 45 + l.phase * 2) > 0.2 ? 0.7 : 0.05;
      } else {
        lvl = 0.8 + 0.2 * Math.sin(t * 21 + l.phase) * Math.sin(t * 6.7 + l.phase * 2);
        if (((t * 0.17 + l.phase) % 1) < 0.035) lvl = 0.05 + Math.random() * 0.2;
      }
      l.level = lvl;
      tmp.copy(l.baseColor).multiplyScalar(lvl);
      l.mesh.setColorAt(l.index, tmp);
      dirtyColor.add(l.mesh);
      if (l.halo) {
        l.halo.arr[l.halo.i] = tmp.r * l.halo.mult;
        l.halo.arr[l.halo.i + 1] = tmp.g * l.halo.mult;
        l.halo.arr[l.halo.i + 2] = tmp.b * l.halo.mult;
      }
    }
    
    for (const l of L.torches) {
      if (l.removed) continue;
      const sy = 0.85 + 0.15 * Math.sin(t * 13 + l.phase) + 0.1 * Math.sin(t * 31.7 + l.phase * 1.7);
      const sx = 0.92 + 0.12 * Math.sin(t * 17 + l.phase * 3);
      this._setFlame(l, sy, sx);
      dirtyMatrix.add(l.mesh).add(l.mesh2);
      dirtyColor.add(l.mesh).add(l.mesh2);
      const lvl = Math.max(0.35, sy);
      l.level = lvl;
      tmp.copy(l.baseColor).multiplyScalar(0.8 + lvl * 0.4);
      l.mesh.setColorAt(l.index, tmp);
      tmp.copy(l.baseColor2).multiplyScalar(0.8 + lvl * 0.4);
      l.mesh2.setColorAt(l.index, tmp);
      if (l.halo) {
        l.halo.arr[l.halo.i] = l.baseColor.r * l.halo.mult * lvl;
        l.halo.arr[l.halo.i + 1] = l.baseColor.g * l.halo.mult * lvl;
        l.halo.arr[l.halo.i + 2] = l.baseColor.b * l.halo.mult * lvl;
      }
    }
    dirtyColor.forEach((m) => { m.instanceColor.needsUpdate = true; });
    dirtyMatrix.forEach((m) => { m.instanceMatrix.needsUpdate = true; });
    for (const { geo } of L.halos) geo.attributes.color.needsUpdate = true;

    
    L.reassignIn -= dt;
    if (L.reassignIn <= 0) {
      L.reassignIn = 0.12;
      const maxD2 = LIGHT_DISTANCE * LIGHT_DISTANCE;
      const best = [];
      for (const l of L.lit) {
        if (l.removed) continue;
        const dx = l.x - player.x;
        const dy = l.y - player.y;
        const dz = l.z - player.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > maxD2) continue;
        if (best.length < POOL_SIZE) {
          best.push({ l, d2 });
          best.sort((a, b) => a.d2 - b.d2);
        } else if (d2 < best[best.length - 1].d2) {
          best[best.length - 1] = { l, d2 };
          best.sort((a, b) => a.d2 - b.d2);
        }
      }
      const wanted = new Set(best.map((b) => b.l));
      const free = [];
      for (const p of L.pool) {
        if (p.lamp && !p.lamp.removed && wanted.has(p.lamp)) wanted.delete(p.lamp);
        else free.push(p);
      }
      for (const p of free) {
        const next = wanted.values().next().value;
        if (next) {
          wanted.delete(next);
          p.lamp = next;
          p.fade = 0;
          p.light.color.copy(next.lightColor);
          p.light.position.set(next.lightX ?? next.x, next.lightY, next.lightZ ?? next.z);
        } else {
          p.lamp = null;
        }
      }
    }
    for (const p of L.pool) {
      const alive = p.lamp && !p.lamp.removed;
      p.fade += ((alive ? 1 : 0) - p.fade) * Math.min(1, dt * 6);
      p.light.intensity = alive
        ? LIGHT_INTENSITY * p.lamp.power * p.lamp.level * p.fade
        : p.fade > 0.01 ? p.light.intensity * 0.8 : 0;
    }
  }

  clear() {
    this._disposeLights();
    this._disposeDecor();
    if (this._ceil) {
      this.scene.remove(this._ceil);
      this._ceil.traverse((o) => {
        if (o.isInstancedMesh) o.dispose();
      });
      this._ceil = null;
    }
    this._levelGeos.forEach((g) => g.dispose());
    this._levelGeos = [];
    this.currentRegion = null;
  }
  dispose() {
    this.clear();
    Object.values(this._geos).forEach((g) => g.dispose());
    Object.values(this._mats).forEach((m) => m.dispose());
    Object.values(this._texs).forEach((t) => t.dispose());
    Object.values(this._floorMats).forEach((m) => m && m.dispose());
    Object.values(this._ceilMats).forEach((m) => m.dispose());
    Object.values(this._wallSets).forEach((set) => set.forEach((s) => s.m.dispose()));
    this._geos = {};
    this._mats = {};
    this._texs = {};
    this._floorMats = {};
    this._ceilMats = {};
    this._wallSets = {};
  }
}

function carveCavePockets(grid, w, h, rng, { forbidden, count, minSize, maxSize }) {
  const DELTA = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
  const OPP = { n: 's', s: 'n', e: 'w', w: 'e' };
  const inB = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
  const hasDoor = (c) =>
    c.doorN || c.doorS || c.doorE || c.doorW || c.hatchN || c.hatchS || c.hatchE || c.hatchW;
  const hasCrawl = (c) => c.crawlN || c.crawlS || c.crawlE || c.crawlW;
  const passable = (c, d) => !c[d] || c[`door${d.toUpperCase()}`] || c[`hatch${d.toUpperCase()}`];
  const taken = new Set();
  const cells = [];
  const entrances = [];

  const collect = (sx, sy, ax, ay, elev) => {
    const seen = new Set([`${sx},${sy}`]);
    const queue = [[sx, sy]];
    const out = [];
    while (queue.length) {
      const [x, y] = queue.shift();
      const c = grid[y][x];
      const k = `${x},${y}`;
      if (
        (forbidden && forbidden.has(k)) || taken.has(k) || c.roomId != null || c.rampDir ||
        (c.elevation || 0) !== elev || hasDoor(c) || hasCrawl(c)
      ) return null;
      out.push([x, y]);
      if (out.length > maxSize) return null;
      for (const d of ['n', 's', 'e', 'w']) {
        if (!passable(c, d)) continue;
        const nx = x + DELTA[d][0];
        const ny = y + DELTA[d][1];
        if (!inB(nx, ny)) continue;
        if (x === sx && y === sy && nx === ax && ny === ay) continue; 
        if (nx === ax && ny === ay) return null; 
        const nk = `${nx},${ny}`;
        if (!seen.has(nk)) {
          seen.add(nk);
          queue.push([nx, ny]);
        }
      }
    }
    return out.length >= minSize ? out : null;
  };

  for (let attempt = 0; attempt < count; attempt++) {
    const cands = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        for (const d of ['e', 's']) {
          const a = grid[y][x];
          if (a[d]) continue; 
          const bx = x + DELTA[d][0];
          const by = y + DELTA[d][1];
          if (!inB(bx, by)) continue;
          const b = grid[by][bx];
          for (const [outX, outY, inX, inY, dirOutToIn] of [
            [x, y, bx, by, d],
            [bx, by, x, y, OPP[d]],
          ]) {
            const outside = grid[outY][outX];
            if (taken.has(`${outX},${outY}`) || outside.roomId != null || outside.rampDir || hasDoor(outside)) continue;
            const comp = collect(inX, inY, outX, outY, outside.elevation || 0);
            if (comp) cands.push({ comp, outX, outY, inX, inY, dirOutToIn });
          }
          void b;
        }
      }
    }
    if (!cands.length) break;
    const pick = cands[Math.floor(rng() * cands.length)];
    const outside = grid[pick.outY][pick.outX];
    const inside = grid[pick.inY][pick.inX];
    const dIn = pick.dirOutToIn;
    const dOut = OPP[dIn];
    outside[dIn] = true;
    inside[dOut] = true;
    outside[`crawl${dIn.toUpperCase()}`] = true;
    inside[`crawl${dOut.toUpperCase()}`] = true;
    if (outside.hurdleDir === dIn) outside.hurdleDir = null;
    const inSet = new Set(pick.comp.map(([x, y]) => `${x},${y}`));
    for (const [x, y] of pick.comp) {
      grid[y][x].hurdleDir = null;
      taken.add(`${x},${y}`);
      cells.push([x, y]);
    }
    entrances.push({ px: pick.inX, py: pick.inY, ox: pick.outX, oy: pick.outY, dir: dOut });
    
    if (rng() < 0.5) {
      const extra = [];
      for (const [x, y] of pick.comp) {
        const c = grid[y][x];
        for (const d of ['n', 's', 'e', 'w']) {
          if (!c[d] || c[`door${d.toUpperCase()}`] || c[`hatch${d.toUpperCase()}`] || c[`crawl${d.toUpperCase()}`]) continue;
          const nx = x + DELTA[d][0];
          const ny = y + DELTA[d][1];
          if (!inB(nx, ny) || inSet.has(`${nx},${ny}`) || taken.has(`${nx},${ny}`)) continue;
          const n = grid[ny][nx];
          if (n.roomId != null || n.rampDir || hasDoor(n) || hasCrawl(n)) continue;
          if ((n.elevation || 0) !== (c.elevation || 0)) continue;
          extra.push({ x, y, d, nx, ny });
        }
      }
      if (extra.length) {
        const e = extra[Math.floor(rng() * extra.length)];
        grid[e.y][e.x][`crawl${e.d.toUpperCase()}`] = true;
        grid[e.ny][e.nx][`crawl${OPP[e.d].toUpperCase()}`] = true;
        entrances.push({ px: e.x, py: e.y, ox: e.nx, oy: e.ny, dir: e.d });
      }
    }
  }
  return { cells, entrances };
}

const STAIR_RISE_DEFAULT = 2.2; 
const STAIR_A0 = 0.8; 
const STAIR_A1 = 3.6; 
const STAIR_STEP_RISE = 0.21; 
const STAIR_TRIGGER = 0.93; 
const STAIR_SWAP_FRAMES = 2; 


const STAIR_UP_MIN_RISE = 1.35;
const STAIR_UP_MAX_RISE = 2.4;
const STAIR_UP_HEADROOM = 2.05; 
const STAIR_LID_T = 0.3; 
const STAIR_STUB_H = 2.5; 
const STAIR_DOWN_MIN_RISE = 2.2;
const STAIR_FACE_YAW = { n: 0, s: Math.PI, w: Math.PI / 2, e: -Math.PI / 2 };


function floorsForLevel(level, baseSeed) {
  if (level <= 2) return 2; 
  return 2 + (hashSeed(`${baseSeed}_${level}_floors`) % 3); 
}
function exitCountForLevel(level, baseSeed) {
  const roll = createRng(hashSeed(`${baseSeed}_${level}_exitcount`))();
  return roll > 0.97 ? 5 : roll > 0.9 ? 4 : roll > 0.75 ? 3 : roll > 0.5 ? 2 : 1;
}
function assignPortalFloors(level, baseSeed, floorCount, exitCount) {
  const rng = createRng(hashSeed(`${baseSeed}_${level}_portalfloors`));
  const floors = [];
  for (let i = 0; i < exitCount; i++) {
    floors.push(floorCount === 1 ? 0 : rng() < 0.3 ? 0 : 1 + Math.floor(rng() * (floorCount - 1)));
  }
  if (floorCount > 1 && !floors.some((f) => f > 0)) floors[floors.length - 1] = floorCount - 1;
  return floors;
}
function pickExitCellsOn(grid, w, h, count, rng) {
  const out = [];
  const seen = new Set();
  for (let attempt = 0; attempt < 10 && out.length < count; attempt++) {
    for (const c of pickExits(grid, w, h, 0, 0, rng)) {
      const k = `${c.x},${c.y}`;
      if (!seen.has(k) && out.length < count) {
        seen.add(k);
        out.push(c);
      }
    }
  }
  return out;
}

function pickStairCells(grid, w, h, { needUp, needDown, avoid, rng }) {
  const DL = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
  const special = (c) =>
    c.doorN || c.doorS || c.doorE || c.doorW || c.hatchN || c.hatchS || c.hatchE || c.hatchW ||
    c.crawlN || c.crawlS || c.crawlE || c.crawlW;
  const leaves = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (avoid.has(`${x},${y}`)) continue;
      const c = grid[y][x];
      if (c.roomId != null || c.rampDir || special(c)) continue;
      const open = ['n', 's', 'e', 'w'].filter((d) => !c[d]);
      if (open.length !== 1) continue;
      const nx = x + DL[open[0]][0];
      const ny = y + DL[open[0]][1];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || grid[ny][nx].rampDir) continue;
      const fx = x - DL[open[0]][0];
      const fy = y - DL[open[0]][1];
      let vista = false;
      if (fx >= 0 && fy >= 0 && fx < w && fy < h && !avoid.has(`${fx},${fy}`)) {
        const fc = grid[fy][fx];
        vista =
          !fc.rampDir && fc.roomId == null && !fc.hurdleDir && !special(fc) &&
          Math.abs((fc.elevation || 0) - (c.elevation || 0)) <= 2;
      }
      leaves.push({ x, y, dir: open[0], fx, fy, vista });
    }
  }
  if (!leaves.length) return null;
  const key = (l) => `${l.x},${l.y}`;
  const fkey = (l) => `${l.fx},${l.fy}`;
  const clash = (a, b) => key(a) === key(b) || fkey(a) === fkey(b) || fkey(a) === key(b) || fkey(b) === key(a);
  const strict = leaves.filter((l) => l.vista);
  const source = strict.length >= (needUp ? 1 : 0) + (needDown ? 1 : 0) ? strict : leaves;
  let down = null;
  let up = null;
  if (needDown) down = source[Math.floor(rng() * source.length)];
  if (needUp) {
    let pool = source.filter((l) => l !== down && (!down || !clash(l, down)));
    if (!pool.length) pool = leaves.filter((l) => l !== down);
    const list = pool.length ? pool : leaves;
    const from = down || { x: 0, y: 0 };
    const dist = bfsDistances(grid, w, h, from.x, from.y);
    const far = list.filter((l) => dist[l.y][l.x] >= 0).sort((a, b) => dist[b.y][b.x] - dist[a.y][a.x]);
    const top = far.slice(0, Math.max(1, Math.ceil(far.length * 0.4)));
    up = (top.length ? top : list)[Math.floor(rng() * (top.length || list.length))];
  }
  
  const upVista = up && !(down && clash(up, down)) ? up.vista : false;
  return {
    up: up && { ...up, vista: upVista, kind: 'up' },
    down: down && { ...down, kind: 'down' },
  };
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
    this.player = {
      x: 0,
      z: 0,
      y: EYE_HEIGHT,
    };
    this.isTouchDevice =
      typeof window !== 'undefined' &&
      ('ontouchstart' in window || navigator.maxTouchPoints > 0) &&
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
    this.mazeOrigin = {
      x: 0,
      z: 0,
    };
    this.wallMeshes = [];
    this.floorMeshes = [];
    this.hurdleMeshes = [];
    this._wallMeshByEdge = new Map();
    this._crawlGapByEdge = new Map();
    this._wallAnims = [];
    this._wallDebrisBursts = [];
    this._debrisTex = null;
    this._nextShiftIn = null;
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
    this.shortcutDoors = [];
    this._shortcutDoorByEdge = new Map();
    this._shortcutDoorLookTarget = null;
    this._raycaster = new THREE.Raycaster();
    this._doorLookTarget = null;
    this._lastInteractPromptLabel = null;
    this._lookDir = new THREE.Vector3();
    this._torchRaycaster = new THREE.Raycaster();
    this._torchNearFactor = 1;
    this._initThree();
    this._wallCtxRegion = null;
    this.regionMap = null;
    this.regions = new RegionManager({
      scene: this.scene,
      CELL,
      STEP_HEIGHT,
      edgeKey: (x, y, d) => this._edgeKey(x, y, d),
      onRegionChange: (r) => {
        if (this.callbacks.onRegionChange) this.callbacks.onRegionChange(r);
      },
    });
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
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
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
    this.renderer.autoClear = false;
    this._buildViewmodel(w, h);
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
  _buildViewmodel(w, h) {
    this.viewmodelScene = new THREE.Scene();
    this.viewCamera = new THREE.PerspectiveCamera(VIEWMODEL_FOV, w / h, 0.01, 10);
    this.viewmodelScene.add(this.viewCamera);
    const envScene = new THREE.Scene();
    envScene.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(4, 12, 8),
        new THREE.MeshBasicMaterial({
          color: 0x4a3420,
          side: THREE.BackSide,
        }),
      ),
    );
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this._viewmodelEnvTex = pmremGenerator.fromScene(envScene, 0.15).texture;
    pmremGenerator.dispose();
    this.viewmodelScene.environment = this._viewmodelEnvTex;
    this.viewmodelScene.add(new THREE.AmbientLight(0x554433, 2.2));
    const rig = new THREE.PointLight(0xffcea0, 7, 4, 2);
    rig.position.set(0.1, 0.15, 0.3);
    this.viewCamera.add(rig);
    const rimLight = new THREE.DirectionalLight(0x8899ff, 0.7);
    rimLight.position.set(-1, 1, 1);
    this.viewCamera.add(rimLight);
    this.viewmodelGroup = new THREE.Group();
    this.viewmodelGroup.position.set(VIEWMODEL_POS.x, VIEWMODEL_POS.y, VIEWMODEL_POS.z);
    this.viewmodelGroup.rotation.set(VIEWMODEL_ROT.x, VIEWMODEL_ROT.y, VIEWMODEL_ROT.z);
    this.viewCamera.add(this.viewmodelGroup);
    this._gltfRoots = [];
    this._bobPhase = 0;
    this._lastYaw = this.yaw;
    this._lastPitch = this.pitch;
    this._swayX = 0;
    this._swayY = 0;
    this._loadViewmodelGltfs();
  }
  async _loadViewmodelGltfs() {
    const loader = new GLTFLoader();
    const load = (url) =>
      new Promise((resolve, reject) => {
        loader.load(url, resolve, undefined, reject);
      });
    const fitToPivot = (object, targetSize, rotation) => {
      const box = new THREE.Box3().setFromObject(object);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const scale = targetSize / maxDim;
      object.position.set(-center.x, -center.y, -center.z);
      const inner = new THREE.Group();
      inner.rotation.set(rotation.x, rotation.y, rotation.z);
      inner.add(object);
      const pivot = new THREE.Group();
      pivot.scale.setScalar(scale);
      pivot.add(inner);
      return pivot;
    };
    try {
      const flashlightGltf = await load(FLASHLIGHT_MODEL_URL);
      const flashlightPivot = fitToPivot(
        flashlightGltf.scene,
        FLASHLIGHT_TARGET_SIZE,
        FLASHLIGHT_ROTATION,
      );
      flashlightPivot.position.set(FLASHLIGHT_OFFSET.x, FLASHLIGHT_OFFSET.y, FLASHLIGHT_OFFSET.z);
      this.viewmodelGroup.add(flashlightPivot);
      this._gltfRoots.push(flashlightGltf.scene);
      flashlightGltf.scene.traverse((obj) => {
        if (obj.isMesh && obj.material && obj.material.name === FLASHLIGHT_LENS_MATERIAL_NAME) {
          obj.material.emissive = new THREE.Color(0xffb060);
          obj.material.emissiveIntensity = 1.4;
          this._lensMat = obj.material;
        }
      });
      if (!this._lensMat) {
        console.warn(
          'No material named "' +
            FLASHLIGHT_LENS_MATERIAL_NAME +
            '" found in ' +
            FLASHLIGHT_MODEL_URL +
            " -- lens glow won't sync with the torch. Check the material names in the file and update " +
            'FLASHLIGHT_LENS_MATERIAL_NAME.',
        );
      }
    } catch (err) {
      console.error('Failed to load flashlight viewmodel (' + FLASHLIGHT_MODEL_URL + '):', err);
    }
  }
  _updateViewmodel(dt) {
    if (!this.viewCamera) return;
    this.viewCamera.quaternion.copy(this.camera.quaternion);
    this.viewCamera.position.copy(this.camera.position);
    const moving = this.currentPlayerSpeed > 0.01 && this.grounded;
    if (moving) {
      this._bobPhase += dt * VIEWMODEL_WALK_BOB_SPEED;
    } else {
      this._bobPhase += dt * VIEWMODEL_IDLE_SPEED;
    }
    const bobAmt = moving ? VIEWMODEL_WALK_BOB_AMOUNT : VIEWMODEL_IDLE_AMOUNT;
    const swayAmt = moving ? VIEWMODEL_WALK_SWAY_AMOUNT : VIEWMODEL_IDLE_AMOUNT * 0.6;
    const bobY = Math.sin(this._bobPhase) * bobAmt;
    const bobX = Math.cos(this._bobPhase * 0.5) * swayAmt;
    let yawDelta = this.yaw - this._lastYaw;
    yawDelta = ((yawDelta + Math.PI) % (Math.PI * 2)) - Math.PI;
    const pitchDelta = this.pitch - this._lastPitch;
    this._lastYaw = this.yaw;
    this._lastPitch = this.pitch;
    const t = 1 - Math.exp(-dt * VIEWMODEL_EASE_RATE);
    this._swayX += (-yawDelta * VIEWMODEL_LOOK_SWAY * 20 - this._swayX) * t;
    this._swayY += (pitchDelta * VIEWMODEL_LOOK_SWAY * 20 - this._swayY) * t;
    this.viewmodelGroup.position.set(
      VIEWMODEL_POS.x + bobX + this._swayX * 0.02,
      VIEWMODEL_POS.y + bobY + this._swayY * 0.02,
      VIEWMODEL_POS.z,
    );
    this.viewmodelGroup.rotation.set(
      VIEWMODEL_ROT.x + this._swayY * 0.15,
      VIEWMODEL_ROT.y + this._swayX * 0.15,
      VIEWMODEL_ROT.z - this._swayX * 0.1,
    );
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
  setJoystickVector(x, z) {
    this._joystickVec = {
      x,
      z,
    };
  }
  clearJoystick() {
    this._joystickVec = null;
  }
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
  tapInteract(clientX, clientY) {
    if (!this.running) return false;
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    const exitGroups = (this.exits || [])
      .filter((e) => e.doorState === 'closed')
      .map((e) => e.doorGroup);
    const shortcutLeaves = (this.shortcutDoors || []).map((d) => d.leaf);
    const targets = [...exitGroups, ...shortcutLeaves];
    if (!targets.length) return false;
    this._raycaster.setFromCamera(ndc, this.camera);
    this._raycaster.far = Math.max(DOOR_LOOK_DIST, SHORTCUT_DOOR_LOOK_DIST);
    const hits = this._raycaster.intersectObjects(targets, true);
    if (!hits.length) return false;
    const wallHits = this._raycaster.intersectObjects(this.wallMeshes, true);
    if (wallHits.length && wallHits[0].distance < hits[0].distance - 0.05) return false;
    let node = hits[0].object;
    while (node && !node.userData.exitLetter) node = node.parent;
    if (node && node.userData.exitLetter) {
      const exit = this.exits.find((e) => e.letter === node.userData.exitLetter);
      if (exit) {
        this._openDoor(exit);
        return true;
      }
    }
    const shortcutDoor = this.shortcutDoors.find((d) => d.leaf === hits[0].object);
    if (shortcutDoor) {
      this._toggleShortcutDoor(shortcutDoor);
      return true;
    }
    return false;
  }
  _makeWallMaterial(canvas, opts = {}) {
    const tex = new THREE.CanvasTexture(canvas || this.stoneCanvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(opts.repeatX ?? 1.5, opts.repeatY ?? 1);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({
      map: tex,
      roughness: opts.roughness ?? 0.95,
      metalness: opts.metalness ?? 0.02,
      color: opts.color ?? 0xe8e9ec,
    });
  }
  _buildWallMaterialPalette() {
    const rng = this.rng || Math.random;
    return {
      normal: this._makeWallMaterial(this.stoneCanvas),
      eerie1: this._makeWallMaterial(makeEerieStoneCanvas(rng), {
        roughness: 1,
        metalness: 0,
        color: 0x9096a0,
        repeatX: 1.5,
      }),
      eerie2: this._makeWallMaterial(makeEerieStoneCanvas(rng), {
        roughness: 1,
        metalness: 0,
        color: 0x7d8288,
        repeatX: 1.2,
      }),
      cracked: this._makeWallMaterial(makeCrackedStoneCanvas(rng), {
        roughness: 0.98,
        metalness: 0.01,
        color: 0xc9c4ba,
        repeatX: 1.5,
      }),
      stained: this._makeWallMaterial(makeStainedStoneCanvas(rng), {
        roughness: 0.97,
        metalness: 0.01,
        color: 0xcac5b8,
        repeatX: 1.5,
      }),
    };
  }
  _pickWallMaterial() {
    const rng = this.rng || Math.random;
    if (this.regions && this._wallCtxRegion) {
      const rr = this._regionRng || (this._regionRng = createRng(hashSeed(`${this.baseSeed}_wallpick`)));
      const cellCtx = this._wallCtxCell;
      const region = cellCtx ? this.regions.wallRegionAt(cellCtx[0], cellCtx[1], rr) : this._wallCtxRegion;
      if (region && region !== 'house') {
        const m = this.regions.wallMaterial(region, rr);
        if (m) return m;
      }
    }
    const palette = this._wallPalette;
    if (!palette) return this._wallMat;
    const total = WALL_STYLE_WEIGHTS.reduce((sum, w) => sum + w.weight, 0);
    let r = rng() * total;
    for (const { style, weight } of WALL_STYLE_WEIGHTS) {
      r -= weight;
      if (r <= 0) return palette[style] || palette.normal;
    }
    return palette.normal;
  }
  _buildFloorMaterials() {
    const build = (canvas, opts) => {
      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(1, 1);
      tex.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshStandardMaterial({
        map: tex,
        ...opts,
      });
    };
    return {
      stone: build(this.stoneCanvas, {
        roughness: 1,
        color: 0xb8b9bd,
      }),
      grass: build(makeGrassCanvas(), {
        roughness: 0.95,
        color: 0xffffff,
      }),
      mud: build(makeMudCanvas(), {
        roughness: 0.85,
        color: 0xffffff,
      }),
      water: build(makeWaterCanvas(), {
        roughness: 0.12,
        metalness: 0.35,
        color: 0xffffff,
      }),
    };
  }
  _clearMazeMeshes() {
    for (const m of this.wallMeshes) this.scene.remove(m);
    this.wallMeshes = [];
    this.hurdleMeshes = [];
    this._wallMeshByEdge.clear();
    this._crawlGapByEdge.clear();
    this._wallAnims = [];
    if (this._wallDebrisBursts) {
      for (const b of this._wallDebrisBursts) {
        this.scene.remove(b.points);
        b.points.geometry.dispose();
        b.points.material.dispose();
      }
    }
    this._wallDebrisBursts = [];
    this._nextShiftIn = null;
    for (const m of this.floorMeshes) this.scene.remove(m);
    this.floorMeshes = [];
    if (this.doors) {
      for (const m of this.doors) this.scene.remove(m);
    }
    this.doors = [];
    this.entranceDoor = null;
    this._doorLookTarget = null;
    this._lastInteractPromptLabel = null;
    if (this.callbacks.onDoorLookAt) this.callbacks.onDoorLookAt(null);
    if (this.shortcutDoors) {
      for (const d of this.shortcutDoors) this.scene.remove(d.group);
    }
    this.shortcutDoors = [];
    this._shortcutDoorByEdge = new Map();
    this._shortcutDoorLookTarget = null;
    if (this.ceilMesh) this.scene.remove(this.ceilMesh);
    if (this.regions) this.regions.clear();
    if (this.furnitureMeshes) {
      for (const m of this.furnitureMeshes) this.scene.remove(m);
    }
    this.furnitureMeshes = [];
    this._furnitureColliders = new Map();
    if (this._stairMeshes) {
      for (const g of this._stairMeshes) {
        this.scene.remove(g);
        g.traverse((o) => {
          if (o.geometry) o.geometry.dispose();
        });
      }
    }
    this._stairMeshes = [];
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
  _maybeAddPainting(wallMesh, axis) {
    if (this._wallCtxRegion && this._wallCtxRegion !== 'house') return;
    const rng = this.rng || Math.random;
    if ((this._paintingCount || 0) >= (this._paintingCap ?? PAINTING_MAX_PER_MAZE_BASE)) return;
    if (rng() > PAINTING_CHANCE) return;
    const tex = new THREE.CanvasTexture(makePaintingCanvas(rng));
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.7,
      metalness: 0.05,
      emissive: 0xffffff,
      emissiveMap: tex,
      emissiveIntensity: 0.35,
    });
    const sizeH = 0.85 + rng() * 0.55;
    const sizeW = sizeH * (200 / 256);
    const painting = new THREE.Mesh(new THREE.PlaneGeometry(sizeW, sizeH), mat);
    const along = (rng() - 0.5) * (CELL - sizeW * 1.2);
    const vertical = WALL_H * 0.12 + rng() * (WALL_H * 0.18);
    const faceSign = rng() < 0.5 ? 1 : -1;
    const eps = 0.135 * faceSign;
    if (axis === 'z') {
      painting.position.set(along, vertical, eps);
      if (faceSign < 0) painting.rotation.y = Math.PI;
    } else {
      painting.position.set(eps, vertical, along);
      painting.rotation.y = faceSign > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    wallMesh.add(painting);
    this._paintingCount = (this._paintingCount || 0) + 1;
  }
  _rebuildFloor() {
    for (const m of this.floorMeshes) {
      this.scene.remove(m);
      if (m.geometry) m.geometry.dispose();
    }
    this.floorMeshes = [];
    this._buildFloor(this.mazeW, this.mazeH);
  }
  _rebuildHurdles() {
    for (const m of this.hurdleMeshes) {
      this.scene.remove(m);
      if (m.geometry) m.geometry.dispose();
      const idx = this.wallMeshes.indexOf(m);
      if (idx >= 0) this.wallMeshes.splice(idx, 1);
    }
    this.hurdleMeshes = [];
    const originX = -(this.mazeW * CELL) / 2;
    const originZ = -(this.mazeH * CELL) / 2;
    for (let y = 0; y < this.mazeH; y++) {
      for (let x = 0; x < this.mazeW; x++) {
        const cell = this.maze[y][x];
        if (!cell.hurdleDir) continue;
        const cx = originX + x * CELL + CELL / 2;
        const cz = originZ + y * CELL + CELL / 2;
        const floorY = (cell.elevation || 0) * STEP_HEIGHT;
        const m = this._buildHurdleMesh(cell.hurdleDir, cx, cz, floorY, this._pickHurdleMaterial());
        this.scene.add(m);
        this.wallMeshes.push(m);
        this.hurdleMeshes.push(m);
      }
    }
  }
  _floorMat(key) {
    return this._floorMaterials[key] || (this.regions && this.regions.floorMaterial(key)) || this._floorMaterials.stone;
  }
  _buildFloor(w, h) {
    const FLOOR_THICKNESS = 4.0;
    const floorGeo = new THREE.BoxGeometry(CELL, FLOOR_THICKNESS, CELL);
    const quat = new THREE.Quaternion();
    const originX = -(w * CELL) / 2;
    const originZ = -(h * CELL) / 2;
    const groups = {
      stone: [],
      grass: [],
      mud: [],
      water: [],
    };
    const rampCells = [];
    const lids = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (this._downStairKeys && this._downStairKeys.has(`${x},${y}`)) continue; 
        const cell = this.maze[y][x];
        const surface = (this.surfaceMap[y] && this.surfaceMap[y][x]) || 'stone';
        const type = this.regions && this.regionMap
          ? this.regions.floorKey(this.regions.visual(x, y, 'floor'), surface, cell.roomId != null)
          : surface;
        if (this._lidKeys && this._lidKeys.has(`${x},${y}`) && !cell.rampDir) {
          
          lids.push({ x, y, type, topY: (cell.elevation || 0) * STEP_HEIGHT });
          continue;
        }
        if (cell.rampDir) {
          rampCells.push({
            x,
            y,
            type,
            cell,
          });
        } else {
          (groups[type] || (groups[type] = [])).push([x, y, cell.elevation || 0]);
        }
      }
    }
    const matrix = new THREE.Matrix4();
    Object.entries(groups).forEach(([type, cells]) => {
      if (!cells.length) return;
      const mesh = new THREE.InstancedMesh(floorGeo, this._floorMat(type), cells.length);
      cells.forEach(([x, y, elevation], i) => {
        const cx = originX + x * CELL + CELL / 2;
        const cz = originZ + y * CELL + CELL / 2;
        const topY = elevation * STEP_HEIGHT;
        const centerY = topY - FLOOR_THICKNESS / 2;
        matrix.compose(new THREE.Vector3(cx, centerY, cz), quat, new THREE.Vector3(1, 1, 1));
        mesh.setMatrixAt(i, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.floorMeshes.push(mesh);
    });
    for (const { x, y, type, topY } of lids) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(CELL, STAIR_LID_T, CELL), this._floorMat(type));
      mesh.position.set(originX + x * CELL + CELL / 2, topY - STAIR_LID_T / 2, originZ + y * CELL + CELL / 2);
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.floorMeshes.push(mesh);
    }
    for (const { x, y, type, cell } of rampCells) {
      const cx = originX + x * CELL + CELL / 2;
      const cz = originZ + y * CELL + CELL / 2;
      const ownY = (cell.elevation || 0) * STEP_HEIGHT;
      const neighborY = this._neighborElevationFor(x, y, cell.rampDir) * STEP_HEIGHT;
      const geo = makeRampGeometry(CELL, ownY, neighborY, cell.rampDir);
      const mesh = new THREE.Mesh(geo, this._floorMat(type));
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
    const passWidth =
      CRAWL_PASS_MIN_WIDTH + rng() * (CRAWL_PASS_MAX_WIDTH - CRAWL_PASS_MIN_WIDTH);
    const maxCenterAbs = Math.max(0, rx - passWidth / 2 - 0.1);
    const gapCenter = (rng() * 2 - 1) * maxCenterAbs;
    const gapHalf = passWidth / 2;
    const pts = [];
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const nominalX = Math.cos(angle) * rx;
      const inGap = Math.abs(nominalX - gapCenter) < gapHalf + rx * 0.12;
      const jagX = inGap ? 1.05 + rng() * 0.15 : 0.65 + rng() * 0.6;
      const jagY = inGap ? 0.98 + rng() * 0.1 : 0.92 + rng() * 0.16;
      const x = Math.cos(angle) * rx * jagX;
      let y = cy + Math.sin(angle) * ry * jagY;
      if (y < floorLocalY + 0.06) y = floorLocalY + rng() * 0.1;
      pts.push(new THREE.Vector2(x, y));
    }
    return { points: pts, gapCenter, gapHalf };
  }
  _buildCrawlHoleGeometry(width, spanHeight, depth, floorLocalY, rng) {
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, 0);
    shape.lineTo(width / 2, 0);
    shape.lineTo(width / 2, spanHeight);
    shape.lineTo(-width / 2, spanHeight);
    shape.lineTo(-width / 2, 0);
    const {
      points: holePts,
      gapCenter,
      gapHalf,
    } = this._jaggedHolePoints(rng, floorLocalY, CRAWL_OPENING_WIDTH, CRAWL_OPENING_HEIGHT);
    const holePath = new THREE.Path();
    holePath.moveTo(holePts[0].x, holePts[0].y);
    for (let i = 1; i < holePts.length; i++) holePath.lineTo(holePts[i].x, holePts[i].y);
    holePath.lineTo(holePts[0].x, holePts[0].y);
    shape.holes.push(holePath);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: false,
      curveSegments: 1,
    });
    geo.translate(0, 0, -depth / 2);
    return { geo, gapCenter, gapHalf };
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
  _buildHurdleMaterialPalette() {
    if (this._hurdlePalette) return this._hurdlePalette;
    const rng = this.rng || Math.random;
    this._hurdlePalette = HURDLE_STYLES.map((style) =>
      this._makeWallMaterial(makeHurdleWoodCanvas(rng, style), {
        roughness: 0.88,
        metalness: 0.04,
        color: 0xffffff,
        repeatX: 2.2,
        repeatY: 1,
      }),
    );
    return this._hurdlePalette;
  }
  _pickHurdleMaterial() {
    const palette = this._buildHurdleMaterialPalette();
    const rng = this.rng || Math.random;
    return palette[Math.floor(rng() * palette.length)];
  }
  _buildFurnitureMaterials() {
    if (this._furnitureMats) return this._furnitureMats;
    const rng = this.rng || Math.random;
    const woodTints = [0x8a7658, 0x7d6a4d, 0x6f5c42];
    const wood = woodTints.map((color) =>
      this._makeWallMaterial(makeFurnitureWoodCanvas(rng), {
        roughness: 0.92,
        metalness: 0.02,
        color,
        repeatX: 1,
        repeatY: 1,
      }),
    );
    this._furnitureMats = { wood };
    return this._furnitureMats;
  }
  _buildRoomFurniture(rooms) {
    if (!rooms || !rooms.length) return;
    if (!this.furnitureMeshes) this.furnitureMeshes = [];
    if (!this._furnitureColliders) this._furnitureColliders = new Map();
    const rng = this.rng || Math.random;
    const { x: ox, z: oz } = this.mazeOrigin;
    for (const room of rooms) {
      if (!room.furniture || !room.furniture.length) continue;
      for (const item of room.furniture) {
        if (this.regionMap && this.regionMap[item.y][item.x] !== 'house') continue;
        const cell = this.maze[item.y][item.x];
        const floorY = (cell.elevation || 0) * STEP_HEIGHT;
        const cx = ox + item.x * CELL + CELL / 2 + item.localX * CELL;
        const cz = oz + item.y * CELL + CELL / 2 + item.localZ * CELL;
        const mesh = this._buildFurnitureMesh(item.kind, item.overturned, rng);
        if (!mesh) continue;
        mesh.position.set(cx, floorY, cz);
        mesh.rotation.y = item.yaw || 0;
        this.scene.add(mesh);
        this.furnitureMeshes.push(mesh);
        
        
        
        const collideRadius = !item.overturned ? FURNITURE_COLLIDE_RADIUS[item.kind] : null;
        if (collideRadius) {
          const key = `${item.x},${item.y}`;
          if (!this._furnitureColliders.has(key)) this._furnitureColliders.set(key, []);
          this._furnitureColliders.get(key).push({
            x: cx, z: cz, radius: collideRadius, yaw: item.yaw || 0, ...(FURNITURE_SUPPORT[item.kind] || {}),
          });
        }
      }
    }
  }
  _pickFurnitureWood() {
    const mats = this._buildFurnitureMaterials();
    const rng = this.rng || Math.random;
    return mats.wood[Math.floor(rng() * mats.wood.length)];
  }
  _buildFurnitureMesh(kind, overturned, rng) {
    const wood = this._pickFurnitureWood();
    switch (kind) {
      case 'bed':
        return this._buildBedMesh(wood);
      case 'cupboard':
        return this._buildCupboardMesh(wood, rng);
      case 'bedsideTable':
        return this._buildBedsideTableMesh(wood);
      case 'table':
        return this._buildTableMesh(wood, overturned, rng);
      case 'chair':
        return this._buildChairMesh(wood, overturned, rng);
      default:
        return null;
    }
  }
  _fabricMaterial() {
    if (this._fabricMat) return this._fabricMat;
    const rng = this.rng || Math.random;
    this._fabricMat = this._makeWallMaterial(makeFabricCanvas(rng), {
      roughness: 1,
      metalness: 0,
      color: 0x555049,
      repeatX: 1,
      repeatY: 1,
    });
    return this._fabricMat;
  }
  _buildBedMesh(wood) {
    const g = new THREE.Group();
    const fabric = this._fabricMaterial();
    const frameH = 0.32;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.85, frameH, 1.15), wood);
    frame.position.set(0, frameH / 2, 0);
    const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.22, 1.0), fabric);
    mattress.position.set(0, frameH + 0.11, 0.03);
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.32), fabric);
    pillow.position.set(0, frameH + 0.22 + 0.07, -0.34);
    const headboard = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.55, 0.08), wood);
    headboard.position.set(0, frameH / 2 + 0.55 / 2, -1.15 / 2 - 0.02);
    for (const m of [frame, mattress, pillow, headboard]) {
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    }
    return g;
  }
  _buildCupboardMesh(wood, rng) {
    const r = rng || this.rng || Math.random;
    const g = new THREE.Group();
    const w = 0.95,
      hgt = 1.9,
      d = 0.5;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d), wood);
    body.position.set(0, hgt / 2, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    if (r() < 0.6) {
      const doorW = w * 0.48;
      const door = new THREE.Mesh(new THREE.BoxGeometry(doorW, hgt * 0.82, 0.045), wood);
      door.position.set(-w / 2 + doorW / 2 + 0.02, hgt * 0.48, d / 2 + 0.03);
      door.rotation.y = 0.16 + r() * 0.18;
      door.castShadow = true;
      g.add(door);
    }
    return g;
  }
  _buildBedsideTableMesh(wood) {
    const g = new THREE.Group();
    const w = 0.5,
      hgt = 0.55,
      d = 0.42;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d), wood);
    body.position.set(0, hgt / 2, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    const lampMat = new THREE.MeshStandardMaterial({
      color: 0x2c2a26,
      roughness: 0.4,
      metalness: 0.6,
    });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.22, 8), lampMat);
    base.position.set(0, hgt + 0.11, 0);
    g.add(base);
    
    
    const shadeMat = new THREE.MeshStandardMaterial({
      color: 0xcbb583,
      emissive: 0x4a3510,
      emissiveIntensity: 0.6,
      roughness: 0.65,
      side: THREE.DoubleSide,
    });
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.18, 10, 1, true), shadeMat);
    shade.position.set(0, hgt + 0.22 + 0.09, 0);
    g.add(shade);
    return g;
  }
  _buildTableMesh(wood, overturned, rng) {
    const r = rng || this.rng || Math.random;
    const g = new THREE.Group();
    const topW = 1.15,
      topD = 0.75,
      topH = 0.06,
      legH = 0.68,
      legT = 0.06;
    const top = new THREE.Mesh(new THREE.BoxGeometry(topW, topH, topD), wood);
    top.position.set(0, legH + topH / 2, 0);
    top.castShadow = true;
    top.receiveShadow = true;
    g.add(top);
    const legOffX = topW / 2 - 0.08,
      legOffZ = topD / 2 - 0.08;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(legT, legH, legT), wood);
        leg.position.set(sx * legOffX, legH / 2, sz * legOffZ);
        leg.castShadow = true;
        g.add(leg);
      }
    }
    if (!overturned) return g;
    const wrapper = new THREE.Group();
    g.position.set(0, -(legH + topH) / 2, 0);
    wrapper.add(g);
    wrapper.rotation.z = Math.PI / 2 + (r() - 0.5) * 0.4;
    wrapper.rotation.y = r() * Math.PI * 2;
    wrapper.position.y = topW / 2 + 0.03;
    return wrapper;
  }
  _buildChairMesh(wood, overturned, rng) {
    const r = rng || this.rng || Math.random;
    const g = new THREE.Group();
    const seatW = 0.42,
      seatD = 0.42,
      seatH = 0.45,
      legT = 0.05,
      backH = 0.5;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(seatW, 0.05, seatD), wood);
    seat.position.set(0, seatH, 0);
    seat.castShadow = true;
    seat.receiveShadow = true;
    g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(seatW, backH, 0.05), wood);
    back.position.set(0, seatH + backH / 2, -seatD / 2 + 0.02);
    back.castShadow = true;
    g.add(back);
    const legOffX = seatW / 2 - 0.05,
      legOffZ = seatD / 2 - 0.05;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(legT, seatH, legT), wood);
        leg.position.set(sx * legOffX, seatH / 2, sz * legOffZ);
        leg.castShadow = true;
        g.add(leg);
      }
    }
    if (!overturned) return g;
    const wrapper = new THREE.Group();
    g.position.set(0, -(seatH + backH / 2) * 0.55, 0);
    wrapper.add(g);
    wrapper.rotation.x = (r() < 0.5 ? 1 : -1) * (Math.PI / 2 + (r() - 0.5) * 0.4);
    wrapper.rotation.y = r() * Math.PI * 2;
    wrapper.position.y = seatW / 2 + 0.12;
    return wrapper;
  }
  _buildShortcutHoleGeometry(spanHeight, depth, floorLocalY) {
    const width = CELL;
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, 0);
    shape.lineTo(width / 2, 0);
    shape.lineTo(width / 2, spanHeight);
    shape.lineTo(-width / 2, spanHeight);
    shape.lineTo(-width / 2, 0);
    const holeW = SHORTCUT_DOOR_WIDTH;
    const holeH = SHORTCUT_DOOR_HEIGHT;
    const hole = new THREE.Path();
    hole.moveTo(-holeW / 2, floorLocalY);
    hole.lineTo(holeW / 2, floorLocalY);
    hole.lineTo(holeW / 2, floorLocalY + holeH);
    hole.lineTo(-holeW / 2, floorLocalY + holeH);
    hole.lineTo(-holeW / 2, floorLocalY);
    shape.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: false,
      curveSegments: 1,
    });
    geo.translate(0, 0, -depth / 2);
    return geo;
  }
  _buildShortcutDoorMaterialPalette() {
    if (this._shortcutDoorPalette) return this._shortcutDoorPalette;
    const rng = this.rng || Math.random;
    this._shortcutDoorPalette = DOOR_STYLES.map((style) => {
      const canvas = style.metal
        ? makeBrushedMetalCanvas([58, 59, 63], [190, 195, 202])
        : makeDoorPanelCanvas(rng, style);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      const woodMat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: style.metal ? 0.45 : 0.78,
        metalness: style.metal ? 0.55 : 0.06,
      });
      const handleMat = new THREE.MeshStandardMaterial({
        color: style.handle ?? 0x2b2b2e,
        roughness: 0.35,
        metalness: 0.75,
      });
      return { woodMat, handleMat };
    });
    return this._shortcutDoorPalette;
  }
  _pickShortcutDoorMaterials() {
    const palette = this._buildShortcutDoorMaterialPalette();
    const rng = this.rng || Math.random;
    return palette[Math.floor(rng() * palette.length)];
  }
  _buildShortcutDoorGroup(axis, cx, cz, floorY) {
    const { woodMat, handleMat } = this._pickShortcutDoorMaterials();
    const group = new THREE.Group();
    group.position.set(cx, floorY, cz);
    if (axis === 'x') group.rotation.y = Math.PI / 2;

    const pivot = new THREE.Group();
    pivot.position.set(-SHORTCUT_DOOR_WIDTH / 2, 0, 0);
    const leafW = SHORTCUT_DOOR_WIDTH + SHORTCUT_DOOR_SEAL * 2;
    const leafH = SHORTCUT_DOOR_HEIGHT + SHORTCUT_DOOR_SEAL;
    const leaf = new THREE.Mesh(
      new THREE.BoxGeometry(leafW, leafH, SHORTCUT_DOOR_THICKNESS),
      woodMat,
    );
    leaf.position.set(SHORTCUT_DOOR_WIDTH / 2, leafH / 2, 0);
    leaf.castShadow = true;
    leaf.receiveShadow = true;
    pivot.add(leaf);
    const handleGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.16, 8);
    const handleA = new THREE.Mesh(handleGeo, handleMat);
    handleA.rotation.z = Math.PI / 2;
    handleA.position.set(
      SHORTCUT_DOOR_WIDTH - 0.12,
      SHORTCUT_DOOR_HEIGHT * 0.48,
      SHORTCUT_DOOR_THICKNESS / 2 + 0.04,
    );
    const handleB = handleA.clone();
    handleB.position.z = -(SHORTCUT_DOOR_THICKNESS / 2 + 0.04);
    pivot.add(handleA, handleB);
    group.add(pivot);
    return {
      group,
      pivot,
      leaf,
    };
  }
  _buildShortcutDoorAt(x, y, nx, ny, dir, opp, axis, cx, cz, floorY, startOpen) {
    const wallBottom = this._wallBottom ?? -0.2;
    const wallSpan = this._wallSpan ?? WALL_H + 0.1;
    const floorLocalY = floorY - wallBottom;
    const holeGeo = this._buildShortcutHoleGeometry(wallSpan, 0.25, floorLocalY);
    const wallMesh = new THREE.Mesh(holeGeo, this._pickWallMaterial());
    if (axis === 'z') {
      wallMesh.position.set(cx, wallBottom, cz);
    } else {
      wallMesh.rotation.y = Math.PI / 2;
      wallMesh.position.set(cx, wallBottom, cz);
    }
    wallMesh.receiveShadow = true;
    this.scene.add(wallMesh);
    this.wallMeshes.push(wallMesh);

    const { group, pivot, leaf } = this._buildShortcutDoorGroup(axis, cx, cz, floorY);
    this.scene.add(group);

    const doorMeta = {
      x,
      y,
      nx,
      ny,
      dir,
      opp,
      axis,
      group,
      pivot,
      leaf,
      worldX: cx,
      worldZ: cz,
      doorState: startOpen ? 'open' : 'closed',
      animT: startOpen ? 1 : 0,
      openSign: 1,
    };
    pivot.rotation.y = startOpen ? SHORTCUT_DOOR_OPEN_ANGLE * doorMeta.openSign : 0;
    this.shortcutDoors.push(doorMeta);
    this._shortcutDoorByEdge.set(this._edgeKey(x, y, dir), doorMeta);
    this._shortcutDoorByEdge.set(this._edgeKey(nx, ny, opp), doorMeta);
  }
  _buildMazeMeshes(grid, w, h) {
    this._clearMazeMeshes();
    this._wallPalette = this._buildWallMaterialPalette();
    const wallMat = this._wallPalette.normal;
    this._paintingCount = 0;
    this._paintingCap = Math.round(
      PAINTING_MAX_PER_MAZE_BASE + w * h * PAINTING_MAX_PER_MAZE_PER_CELL,
    );
    this._buildHurdleMaterialPalette();
        let minElev = 0,
      maxElev = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const e = grid[y][x].elevation || 0;
        if (e < minElev) minElev = e;
        if (e > maxElev) maxElev = e;
      }
    }
    let wallBottom = minElev * STEP_HEIGHT - 0.1;
    
    for (const st of this._stairs || []) {
      if (st.kind === 'down') wallBottom = Math.min(wallBottom, st.baseY - st.rise - 0.7);
    }
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
    this._wallGeo = wallGeo;
    this._wallGeoV = wallGeoV;
    const buildWallMesh = (crawlFlag, axis, cx, cz, floorY) => {
      if (!crawlFlag) {
        const geo = axis === 'z' ? wallGeo : wallGeoV;
        const m = new THREE.Mesh(geo, this._pickWallMaterial());
        m.position.set(cx, wallCenterY, cz);
        return { mesh: m, gap: null };
      }
      const floorLocalY = floorY - wallBottom;
      const { geo, gapCenter, gapHalf } = this._buildCrawlHoleGeometry(
        CELL,
        wallSpan,
        0.25,
        floorLocalY,
        this.rng,
      );
      const m = new THREE.Mesh(geo, this._pickWallMaterial());
      if (axis === 'z') {
        m.position.set(cx, wallBottom, cz);
      } else {
        m.rotation.y = Math.PI / 2;
        m.position.set(cx, wallBottom, cz);
      }
      return { mesh: m, gap: { center: gapCenter, half: gapHalf } };
    };
    const originX = -(w * CELL) / 2;
    const originZ = -(h * CELL) / 2;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const cell = grid[y][x];
        this._wallCtxRegion = this.regionMap ? this.regionMap[y][x] : null;
        this._wallCtxCell = [x, y];
        const cx = originX + x * CELL + CELL / 2;
        const cz = originZ + y * CELL + CELL / 2;
        const floorY = (cell.elevation || 0) * STEP_HEIGHT;
        if (cell.n) {
          if (cell.doorN) {
            this._buildShortcutDoorAt(
              x,
              y,
              x,
              y - 1,
              'n',
              's',
              'z',
              cx,
              cz - CELL / 2,
              floorY,
              !!cell.doorOpenN,
            );
          } else {
            const { mesh: m, gap } = buildWallMesh(cell.crawlN, 'z', cx, cz - CELL / 2, floorY);
            this.scene.add(m);
            this.wallMeshes.push(m);
            if (y > 0) this._wallMeshByEdge.set(this._edgeKey(x, y - 1, 's'), m);
            if (!cell.crawlN) {
              this._maybeAddStain(m, 'z');
              this._maybeAddPainting(m, 'z');
            } else {
              this._crawlGapByEdge.set(this._edgeKey(x, y, 'n'), gap);
              if (y > 0) this._crawlGapByEdge.set(this._edgeKey(x, y - 1, 's'), gap);
            }
          }
        }
        if (cell.w) {
          if (cell.doorW) {
            this._buildShortcutDoorAt(
              x,
              y,
              x - 1,
              y,
              'w',
              'e',
              'x',
              cx - CELL / 2,
              cz,
              floorY,
              !!cell.doorOpenW,
            );
          } else {
            const { mesh: m, gap } = buildWallMesh(cell.crawlW, 'x', cx - CELL / 2, cz, floorY);
            this.scene.add(m);
            this.wallMeshes.push(m);
            if (x > 0) this._wallMeshByEdge.set(this._edgeKey(x - 1, y, 'e'), m);
            if (!cell.crawlW) {
              this._maybeAddStain(m, 'x');
              this._maybeAddPainting(m, 'x');
            } else {
              this._crawlGapByEdge.set(this._edgeKey(x, y, 'w'), gap);
              if (x > 0) this._crawlGapByEdge.set(this._edgeKey(x - 1, y, 'e'), gap);
            }
          }
        }
        if (y === h - 1 && cell.s) {
          const m = new THREE.Mesh(wallGeo, this._pickWallMaterial());
          m.position.set(cx, wallCenterY, cz + CELL / 2);
          this.scene.add(m);
          this.wallMeshes.push(m);
          this._maybeAddStain(m, 'z');
          this._maybeAddPainting(m, 'z');
        }
        if (x === w - 1 && cell.e) {
          const m = new THREE.Mesh(wallGeoV, this._pickWallMaterial());
          m.position.set(cx + CELL / 2, wallCenterY, cz);
          this.scene.add(m);
          this.wallMeshes.push(m);
          this._maybeAddStain(m, 'x');
          this._maybeAddPainting(m, 'x');
        }
        if (cell.hurdleDir) {
          const m = this._buildHurdleMesh(cell.hurdleDir, cx, cz, floorY, this._pickHurdleMaterial());
          this.scene.add(m);
          this.wallMeshes.push(m);
          this.hurdleMeshes.push(m);
        }
      }
    }
    this._buildFloor(w, h);
    this._wallCtxRegion = null;
    this._wallCtxCell = null;
    this.regions.setCeilingHoles([]); 
    this.ceilMesh = this.regions.buildCeiling(grid, w, h, originX, originZ, wallTop);
    this.scene.add(this.ceilMesh);
    {
      const avoidLights = new Set();
      if (this.exits) for (const ex of this.exits) avoidLights.add(`${ex.x},${ex.y}`);
      for (const st of this._stairs || []) {
        avoidLights.add(`${st.x},${st.y}`);
        if (st.vista) avoidLights.add(`${st.fx},${st.fy}`);
      }
      this.regions.buildLights(grid, w, h, originX, originZ, wallTop, avoidLights);
    }
    return {
      x: originX,
      z: originZ,
    };
  }
  _stairWorldPos(st, a, lateral = 0) {
    const c = this._cellCenter(st.x, st.y);
    const half = CELL / 2;
    switch (st.dir) {
      case 'n': return { x: c.x + lateral, z: c.z - half + a };
      case 's': return { x: c.x + lateral, z: c.z + half - a };
      case 'w': return { x: c.x - half + a, z: c.z + lateral };
      default: return { x: c.x + half - a, z: c.z + lateral };
    }
  }
  _stairAlong(st, px, pz) {
    const c = this._cellCenter(st.x, st.y);
    const half = CELL / 2;
    switch (st.dir) {
      case 'n': return pz - (c.z - half);
      case 's': return c.z + half - pz;
      case 'w': return px - (c.x - half);
      default: return c.x + half - px;
    }
  }
  _stairHeight(st, px, pz) {
    const t = Math.max(0, Math.min(1, (this._stairAlong(st, px, pz) - STAIR_A0) / (STAIR_A1 - STAIR_A0)));
    return st.kind === 'up' ? st.baseY + st.rise * t : st.baseY - st.rise * t;
  }
  _computeWallTop(grid, w, h) {
    let maxElev = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) maxElev = Math.max(maxElev, grid[y][x].elevation || 0);
    }
    return maxElev * STEP_HEIGHT + WALL_H;
  }
  _buildStairMeshes() {
    this._stairMeshes = [];
    const wallMat = (this._wallPalette && this._wallPalette.normal) || this._wallMat;
    const LAT = CELL / 2 - 0.125 - 0.005; 
    for (const st of this._stairs || []) {
      const group = new THREE.Group();
      const region = this.regionMap ? this.regionMap[st.y][st.x] : 'house';
      const mat = this._floorMat(this.regions.floorKey(region, 'stone', false));
      const up = st.kind === 'up';
      const alongZ = st.dir === 'n' || st.dir === 's';
      const W = CELL - 0.24;
      const steps = st.steps;
      const run = (STAIR_A1 - STAIR_A0) / steps;
      const floorY = st.baseY;
      const rise = st.rise;
      const solidBot = floorY - 0.08;
      const shaftBottom = floorY - rise - 0.68;

      
      const box = (a0, a1, l0, l1, y0, y1, material, parent = group) => {
        const hgt = y1 - y0;
        if (hgt < 0.001) return null;
        const p = this._stairWorldPos(st, (a0 + a1) / 2, (l0 + l1) / 2);
        const depth = a1 - a0;
        const wid = l1 - l0;
        const m = new THREE.Mesh(new THREE.BoxGeometry(alongZ ? wid : depth, hgt, alongZ ? depth : wid), material);
        m.position.set(p.x, y0 + hgt / 2, p.z);
        m.receiveShadow = true;
        parent.add(m);
        return m;
      };
      const box1 = (a0, a1, topY, botY) => box(a0, a1, -W / 2, W / 2, botY, topY, mat);
      if (!up) box1(0, STAIR_A0, floorY, shaftBottom);
      for (let k = 0; k < steps; k++) {
        const t = (k + 0.5) / steps;
        const a0 = STAIR_A0 + k * run;
        if (up) box1(a0, a0 + run, floorY + rise * t, solidBot);
        else box1(a0, a0 + run, floorY - rise * t, shaftBottom);
      }
      if (up) box1(STAIR_A1, CELL, floorY + rise, solidBot);
      else box1(STAIR_A1, CELL, floorY - rise, shaftBottom);
      st.vistaGroup = null;
      st.vistaOn = false;
      st.farWallMesh = null;
      if (st.vista) {
        const far = this._stairWorldPos(st, CELL);
        const wantGeo = alongZ ? this._wallGeo : this._wallGeoV;
        st.farWallMesh =
          this.wallMeshes.find(
            (m) => m.geometry === wantGeo && Math.abs(m.position.x - far.x) < 0.06 && Math.abs(m.position.z - far.z) < 0.06,
          ) || null;
        if (!st.farWallMesh) st.vista = false;
      }
      let lightPos = this._cellCenter(st.x, st.y);
      let lightY = up ? floorY + rise + 1.2 : floorY + 1.2;
      if (st.vista && up) {
        const vg = new THREE.Group();
        const L = floorY + rise;
        const top = this._wallTop;
        box(CELL, 2 * CELL, -(CELL / 2 - 0.125), CELL / 2 - 0.125, L - STAIR_LID_T, L, mat, vg);
        box(CELL, 2 * CELL, -LAT - 0.1, -LAT, L - STAIR_LID_T, top, wallMat, vg);
        box(CELL, 2 * CELL, LAT, LAT + 0.1, L - STAIR_LID_T, top, wallMat, vg);
        box(2 * CELL - 0.125 - 0.105, 2 * CELL - 0.125 - 0.005, -LAT, LAT, L - STAIR_LID_T, top, wallMat, vg);
        vg.visible = false;
        group.add(vg);
        st.vistaGroup = vg;
        lightPos = this._stairWorldPos(st, 3.1);
        lightY = L + 1.25;
      } else if (st.vista && !up) {
        const stubFloor = floorY - rise;
        const lidBottom = st.lidTop - STAIR_LID_T;
        box(CELL, 2 * CELL, -(CELL / 2 - 0.125), CELL / 2 - 0.125, stubFloor - STAIR_LID_T, stubFloor, mat);
        box(CELL, 2 * CELL, -LAT - 0.1, -LAT, stubFloor, lidBottom, wallMat);
        box(CELL, 2 * CELL, LAT, LAT + 0.1, stubFloor, lidBottom, wallMat);
        box(2 * CELL - 0.125 - 0.105, 2 * CELL - 0.125 - 0.005, -LAT, LAT, stubFloor, lidBottom, wallMat);
        st.farWallMesh.visible = false;
        box(CELL - 0.125, CELL + 0.125, -CELL / 2, CELL / 2, lidBottom, this._wallTop, st.farWallMesh.material);
        const p = this._stairWorldPos(st, 5.6);
        const glow = new THREE.PointLight(0xffd8a0, 6, 8, 2);
        glow.position.set(p.x, stubFloor + 1.7, p.z);
        group.add(glow);
      }

      
      const light = new THREE.PointLight(up ? 0xfff2d0 : 0x6a86c8, up ? 14 : 7, 9, 2);
      light.position.set(lightPos.x, lightY, lightPos.z);
      group.add(light);
      this.scene.add(group);
      this._stairMeshes.push(group);
    }
  }
  _updateStairVistas() {
    if (!this._stairs || !this._stairs.length || !this.maze) return;
    const { cx, cy } = this._cellCoordsFor(this.player.x, this.player.z);
    for (const st of this._stairs) {
      if (!st.vistaGroup) continue;
      const inside = st.x === cx && st.y === cy;
      if (st.vistaOn === inside) continue;
      st.vistaOn = inside;
      st.vistaGroup.visible = inside;
      if (st.farWallMesh) st.farWallMesh.visible = !inside;
    }
  }
  _updateStairs(dt) {
    this._updateStairVistas();
    const tr = this._floorTransition;
    if (tr) {
      tr.frames += 1;
      if (tr.frames >= STAIR_SWAP_FRAMES) {
        const kind = tr.stair.kind;
        this._floorTransition = null;
        const to = kind === 'up' ? this.floor + 1 : this.floor - 1;
        this.loadLevel(this.level, null, { floor: to, arrive: kind === 'up' ? 'down' : 'up' });
      }
      return;
    }
    if (!this._stairs || !this._stairs.length) return;
    const { cx, cy } = this._cellCoordsFor(this.player.x, this.player.z);
    const st = this._stairByCell.get(`${cx},${cy}`);
    if (!st) return;
    const progress = (this._stairAlong(st, this.player.x, this.player.z) - STAIR_A0) / (STAIR_A1 - STAIR_A0);
    if (progress >= STAIR_TRIGGER) this._floorTransition = { stair: st, frames: 0 };
  }
  _edgeKey(x, y, dir) {
    return `${x},${y},${dir}`;
  }
  _shortcutDoorAt(cx, cy, dir) {
    return this._shortcutDoorByEdge.get(this._edgeKey(cx, cy, dir)) || null;
  }
  _crawlGapAt(cx, cy, dir) {
    return this._crawlGapByEdge.get(this._edgeKey(cx, cy, dir)) || null;
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
    return {
      cx,
      cy,
    };
  }
  _neighborElevationFor(cx, cy, dir) {
    const deltas = {
      n: [0, -1],
      s: [0, 1],
      e: [1, 0],
      w: [-1, 0],
    };
    const d = deltas[dir];
    if (!d) return this.maze[cy][cx].elevation || 0;
    const nx = cx + d[0],
      ny = cy + d[1];
    if (nx < 0 || nx >= this.mazeW || ny < 0 || ny >= this.mazeH)
      return this.maze[cy][cx].elevation || 0;
    return this.maze[ny][nx].elevation || 0;
  }
  _hurdleTopSupportAt(px, pz) {
    if (!this.maze) return null;
    const { cx, cy } = this._cellCoordsFor(px, pz);
    const relX = px - this.mazeOrigin.x;
    const relZ = pz - this.mazeOrigin.z;
    const localX = relX - cx * CELL;
    const localZ = relZ - cy * CELL;
    const halfAlong = (CELL * 0.8) / 2;
    const halfDepth = HURDLE_DEPTH / 2 + COLLIDE_RADIUS;
    const dirs = ['n', 's', 'w', 'e'];
    for (const dir of dirs) {
      const info = this._hurdleInfoAt(cx, cy, dir);
      if (!info) continue;
      if (dir === 'n' || dir === 's') {
        const borderLocalZ = dir === 'n' ? 0 : CELL;
        if (Math.abs(localZ - borderLocalZ) > halfDepth) continue;
        if (Math.abs(localX - CELL / 2) > halfAlong) continue;
      } else {
        const borderLocalX = dir === 'w' ? 0 : CELL;
        if (Math.abs(localX - borderLocalX) > halfDepth) continue;
        if (Math.abs(localZ - CELL / 2) > halfAlong) continue;
      }
      return info.floorY + HURDLE_HEIGHT;
    }
    return null;
  }
  _floorHeightAt(px, pz) {
    if (!this.maze) return 0;
    const { cx, cy } = this._cellCoordsFor(px, pz);
    const cell = this.maze[cy][cx];
    const stair = this._stairByCell && this._stairByCell.get(`${cx},${cy}`);
    if (stair) return this._stairHeight(stair, px, pz);
    const ownElev = cell.elevation || 0;
    let floor;
    if (!cell.rampDir) {
      floor = ownElev * STEP_HEIGHT;
    } else {
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
      floor = (ownElev + (neighborElev - ownElev) * t) * STEP_HEIGHT;
    }
    return floor;
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
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.22,
      bevelEnabled: false,
      curveSegments: 1,
    });
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
      axis === 'z'
        ? new THREE.BoxGeometry(CELL, wallSpan, 0.25)
        : new THREE.BoxGeometry(0.25, wallSpan, CELL);
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
  loadLevel(n, entryLetter, opts = {}) {
    const floor = opts.floor || 0;
    this.floor = floor;
    this.floorCount = floorsForLevel(n, this.baseSeed);
    const seedTag = floor ? `${this.baseSeed}_f${floor}` : `${this.baseSeed}`;
    this.level = n;
    this.floorLabel = entryLetter ? `${n}${entryLetter.toUpperCase()}` : String(n);
    const { w, h } = sizeForLevel(n);
    this.mazeW = w;
    this.mazeH = h;
    this.rng = floor ? createRng(hashSeed(`${this.baseSeed}_${n}_floor${floor}`)) : createRng(levelSeed(this.baseSeed, n));
    const density = roomDensityForLevel(n);
    this.maze = generateMaze(w, h, this.rng);
    assignElevations(this.maze, w, h, 0, 0, this.rng);
    assignObstacles(this.maze, w, h, 0, 0, this.rng);
    assignDoors(this.maze, w, h, this.rng, { density });
    this.surfaceMap = generateSurfaceMap(w, h, this.rng);
    this.regionMap = this.regions.generate(w, h, seedTag, n);
    let exitCells;
    let portalLetters = null;
    this._portalFloors = null;
    if (this.floorCount === 1) {
      exitCells = pickExits(this.maze, w, h, 0, 0, this.rng);
    } else {
      this._portalFloors = assignPortalFloors(n, this.baseSeed, this.floorCount, exitCountForLevel(n, this.baseSeed));
      portalLetters = this._portalFloors.map((f, i) => (f === floor ? i : -1)).filter((i) => i >= 0);
      exitCells = pickExitCellsOn(this.maze, w, h, portalLetters.length, createRng(hashSeed(`${seedTag}_exits`)));
    }
    this.exits = exitCells.map((e, i) => ({
      ...e,
      letter: portalLetters ? EXIT_LETTERS[portalLetters[i]] : EXIT_LETTERS[i] || String(i + 1),
    }));
    
    
    
    clearHurdlesNearExits(this.maze, w, h, this.exits);
    const rooms = assignRooms(this.maze, w, h, this.rng, {
      avoidCells: [[0, 0], ...this.exits.map((e) => [e.x, e.y])],
      density,
    });
    assignRoomFurniture(this.maze, w, h, rooms, this.rng);
    this.rooms = rooms;
    
    
    
    clearHurdlesNearAllDoors(this.maze, w, h);
    this._stairs = [];
    this._stairByCell = new Map();
    this._downStairKeys = new Set();
    this._lidKeys = new Set();
    if (this.floorCount > 1) {
      const picked = pickStairCells(this.maze, w, h, {
        needUp: floor < this.floorCount - 1,
        needDown: floor > 0,
        avoid: new Set(['0,0', ...this.exits.map((e) => `${e.x},${e.y}`)]),
        rng: createRng(hashSeed(`${seedTag}_stairs`)),
      });
      if (picked) {
        const wallTop = this._computeWallTop(this.maze, w, h);
        for (const st of [picked.down, picked.up]) {
          if (!st) continue;
          const stair = { ...st, baseY: (this.maze[st.y][st.x].elevation || 0) * STEP_HEIGHT };
          if (stair.kind === 'up') {
            stair.rise = Math.max(STAIR_UP_MIN_RISE, Math.min(STAIR_UP_MAX_RISE, wallTop - stair.baseY - STAIR_UP_HEADROOM));
          } else if (stair.vista) {
            stair.lidTop = (this.maze[stair.fy][stair.fx].elevation || 0) * STEP_HEIGHT;
            stair.rise = Math.max(STAIR_DOWN_MIN_RISE, stair.baseY - stair.lidTop + STAIR_LID_T + STAIR_STUB_H);
          } else {
            stair.rise = STAIR_RISE_DEFAULT;
          }
          stair.steps = Math.max(8, Math.round(stair.rise / STAIR_STEP_RISE));
          this._stairs.push(stair);
          this._stairByCell.set(`${st.x},${st.y}`, stair);
          if (stair.kind === 'down') this._downStairKeys.add(`${st.x},${st.y}`);
          if (stair.kind === 'down' && stair.vista) this._lidKeys.add(`${stair.fx},${stair.fy}`);
        }
        clearHurdlesNearExits(this.maze, w, h, this._stairs);
      }
    }
    {
      
      const pockets = carveCavePockets(
        this.maze, w, h,
        createRng(hashSeed(`${this.baseSeed}_${n}_pockets`)),
        {
          forbidden: new Set(['0,0', ...this.exits.map((e) => `${e.x},${e.y}`), ...this._stairs.map((st) => `${st.x},${st.y}`), ...this._stairs.filter((st) => st.vista).map((st) => `${st.fx},${st.fy}`)]),
          count: w * h >= 200 ? 2 : 1,
          minSize: 5,
          maxSize: Math.max(8, Math.min(28, Math.round(w * h * 0.12))),
        },
      );
      this.regions.setPockets(pockets);
      this.regions.adjustSurfaces(this.surfaceMap);
    }
    this._roomCells = [];
    for (let ry = 0; ry < h; ry++) {
      for (let rx = 0; rx < w; rx++) {
        if (this.maze[ry][rx].roomId != null) this._roomCells.push([rx, ry]);
      }
    }
    if (!opts.arrive) this.discoveredExits = new Set();
    const origin = this._buildMazeMeshes(this.maze, w, h);
    this.mazeOrigin = origin;
    this._buildStairMeshes();
    this._buildRoomFurniture(this.rooms);
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
        const stairKeys = new Set(this._stairs.flatMap((st) => (st.vista ? [`${st.x},${st.y}`, `${st.fx},${st.fy}`] : [`${st.x},${st.y}`])));
        const anchor = anchors[idx] && stairKeys.has(`${anchors[idx].x},${anchors[idx].y}`)
          ? anchors.find((a) => !stairKeys.has(`${a.x},${a.y}`))
          : anchors[idx];
        if (anchor) {
          spawnX = anchor.x;
          spawnY = anchor.y;
        }
      }
      entranceWallDir = this._pickEntranceWallDir(spawnX, spawnY);
      if (entranceWallDir) this._buildEntranceDoor(spawnX, spawnY, entranceWallDir);
    }
    const arrivalStair = opts.arrive ? this._stairs.find((st) => st.kind === opts.arrive) : null;
    if (arrivalStair) {
      spawnX = arrivalStair.x;
      spawnY = arrivalStair.y;
    }
    this._spawnCell = [spawnX, spawnY];
    this._progressTargets = null;
    if (this.floorCount > 1 && !this.exits.length && this._portalFloors) {
      let best = null;
      for (const pf of this._portalFloors) {
        if (best === null || Math.abs(pf - floor) < Math.abs(best - floor)) best = pf;
      }
      const target = this._stairs.find((st) => st.kind === (best > floor ? 'up' : 'down'));
      if (target) {
        const distGrid = bfsDistances(this.maze, w, h, target.x, target.y);
        this._progressTargets = [{ x: target.x, y: target.y, distGrid, totalDist: Math.max(1, distGrid[spawnY][spawnX]) }];
      }
    }
    {
      const avoid = new Set([`${spawnX},${spawnY}`, '0,0']);
      for (const ex of this.exits) avoid.add(`${ex.x},${ex.y}`);
      for (const st of this._stairs) {
        avoid.add(`${st.x},${st.y}`);
        if (st.vista) avoid.add(`${st.fx},${st.fy}`);
      }
      this.regions.buildDecor({
        grid: this.maze, w, h,
        originX: this.mazeOrigin.x, originZ: this.mazeOrigin.z,
        wallTop: this._wallTop,
        avoid,
        addCollider: (cx, cy, x, z, radius, extra) => {
          const key = `${cx},${cy}`;
          if (!this._furnitureColliders.has(key)) this._furnitureColliders.set(key, []);
          this._furnitureColliders.get(key).push({ x, z, radius, ...(extra || {}) });
        },
      });
    }
    this._nextShiftIn = null;
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
    if (arrivalStair) {
      const p = this._stairWorldPos(arrivalStair, 0.5);
      this.player.x = p.x;
      this.player.z = p.z;
      this.yaw = STAIR_FACE_YAW[arrivalStair.dir];
    }
    this.pitch = 0;
    this._updateStairVistas();
    this.torchYaw = this.yaw;
    this.torchPitch = this.pitch;
    if (!opts.arrive) this.batteryLevel = 1.0;
    this.displayProgress = 0;
    this._strideDist = 0;
    this.currentPlayerSpeed = 0;
    this.currentSurface = (this.surfaceMap[spawnY] && this.surfaceMap[spawnY][spawnX]) || 'stone';
    if (this.callbacks.onProgress) this.callbacks.onProgress(this.displayProgress);
    if (this.callbacks.onFloorEnter) {
      this.callbacks.onFloorEnter(this.floorLabel, {
        level: n,
        entryLetter: entryLetter || null,
      });
    }
    if (this.callbacks.onFloorChange) this.callbacks.onFloorChange(this.floor + 1, this.floorCount);
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
      this._playFootstepSound(this.currentSurface, {
        pan: 0,
        gain: 0.55,
      });
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
    this._shortcutDoorLookTarget = null;
    this._updateInteractPrompt();
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
    this._shortcutDoorLookTarget = null;
    this._updateInteractPrompt();
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
    let reachable = false;
    for (const exit of this._progressTargets || this.exits) {
      const dist = exit.distGrid[cy][cx];
      if (dist < 0) continue; 
      reachable = true;
      const progress = 1 - dist / exit.totalDist;
      if (progress > best) best = progress;
    }
    if (!reachable) return this._lastProgress ?? 0;
    this._lastProgress = Math.max(0, Math.min(1, best));
    return this._lastProgress;
  }
  _hurdleInfoAt(cx, cy, dir) {
    const cell = this.maze[cy][cx];
    if (cell.hurdleDir === dir) {
      return { floorY: (cell.elevation || 0) * STEP_HEIGHT };
    }
    const deltas = {
      n: [0, -1],
      s: [0, 1],
      e: [1, 0],
      w: [-1, 0],
    };
    const opp = {
      n: 's',
      s: 'n',
      e: 'w',
      w: 'e',
    };
    const d = deltas[dir];
    const nx = cx + d[0],
      ny = cy + d[1];
    if (nx < 0 || nx >= this.mazeW || ny < 0 || ny >= this.mazeH) return null;
    const ncell = this.maze[ny][nx];
    if (ncell.hurdleDir === opp[dir]) {
      return { floorY: (ncell.elevation || 0) * STEP_HEIGHT };
    }
    return null;
  }
  _hurdleBlocks(cx, cy, dir) {
    const info = this._hurdleInfoAt(cx, cy, dir);
    if (!info) return false;
    const barTopY = info.floorY + HURDLE_HEIGHT;
    const feetY = this._floorHeightAt(this.player.x, this.player.z) + this.verticalOffset;
    return feetY < barTopY - 0.02;
  }
  _doorHeightClear(doorMeta) {
    if (!doorMeta) return true;
    const cell = this.maze[doorMeta.y] && this.maze[doorMeta.y][doorMeta.x];
    const floorY = ((cell && cell.elevation) || 0) * STEP_HEIGHT;
    const lintelY = floorY + SHORTCUT_DOOR_HEIGHT;
    const headTopY =
      this._floorHeightAt(this.player.x, this.player.z) +
      this.currentEyeHeight +
      this.verticalOffset +
      DOOR_HEAD_CLEARANCE;
    return headTopY < lintelY;
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
    const crawlGapN = cell.crawlN ? this._crawlGapAt(cx, cy, 'n') : null;
    const crawlGapS = cell.crawlS ? this._crawlGapAt(cx, cy, 's') : null;
    const crawlGapW = cell.crawlW ? this._crawlGapAt(cx, cy, 'w') : null;
    const crawlGapE = cell.crawlE ? this._crawlGapAt(cx, cy, 'e') : null;
    const throughN =
      cell.crawlN &&
      this.crouching &&
      !!crawlGapN &&
      Math.abs(localX - CELL / 2 - crawlGapN.center) < crawlGapN.half;
    const throughS =
      cell.crawlS &&
      this.crouching &&
      !!crawlGapS &&
      Math.abs(localX - CELL / 2 - crawlGapS.center) < crawlGapS.half;
    const throughW =
      cell.crawlW &&
      this.crouching &&
      !!crawlGapW &&
      Math.abs(localZ - CELL / 2 - crawlGapW.center) < crawlGapW.half;
    const throughE =
      cell.crawlE &&
      this.crouching &&
      !!crawlGapE &&
      Math.abs(localZ - CELL / 2 - crawlGapE.center) < crawlGapE.half;
    const doorHalf = SHORTCUT_DOOR_WIDTH / 2;
    const doorN = cell.doorN ? this._shortcutDoorAt(cx, cy, 'n') : null;
    const doorS = cell.doorS ? this._shortcutDoorAt(cx, cy, 's') : null;
    const doorW = cell.doorW ? this._shortcutDoorAt(cx, cy, 'w') : null;
    const doorE = cell.doorE ? this._shortcutDoorAt(cx, cy, 'e') : null;
    const throughDoorN =
      doorN &&
      doorN.doorState !== 'closed' &&
      this._doorHeightClear(doorN) &&
      Math.abs(localX - CELL / 2) < doorHalf;
    const throughDoorS =
      doorS &&
      doorS.doorState !== 'closed' &&
      this._doorHeightClear(doorS) &&
      Math.abs(localX - CELL / 2) < doorHalf;
    const throughDoorW =
      doorW &&
      doorW.doorState !== 'closed' &&
      this._doorHeightClear(doorW) &&
      Math.abs(localZ - CELL / 2) < doorHalf;
    const throughDoorE =
      doorE &&
      doorE.doorState !== 'closed' &&
      this._doorHeightClear(doorE) &&
      Math.abs(localZ - CELL / 2) < doorHalf;
    if (cell.n && !throughN && !throughDoorN && localZ - r < 0.13) return false;
    if (cell.s && !throughS && !throughDoorS && localZ + r > CELL - 0.13) return false;
    if (cell.w && !throughW && !throughDoorW && localX - r < 0.13) return false;
    if (cell.e && !throughE && !throughDoorE && localX + r > CELL - 0.13) return false;
    if (this._hurdleBlocks(cx, cy, 'n') && localZ - r < 0.13) return false;
    if (this._hurdleBlocks(cx, cy, 's') && localZ + r > CELL - 0.13) return false;
    if (this._hurdleBlocks(cx, cy, 'w') && localX - r < 0.13) return false;
    if (this._hurdleBlocks(cx, cy, 'e') && localX + r > CELL - 0.13) return false;
    if (this._furnitureColliders) {
      const furn = this._furnitureColliders.get(`${cx},${cy}`);
      if (furn) {
        
        
        const ox = this.player.x;
        const oz = this.player.z;
        const cellFloor = (cell.elevation || 0) * STEP_HEIGHT;
        const feetAbs = this._floorHeightAt(ox, oz) + this.verticalOffset;
        for (const f of furn) {
          const R = f.radius + r;
          const d = Math.hypot(nx - f.x, nz - f.z);
          if (d >= R) continue;
          const top = f.hgt === undefined ? Infinity : cellFloor + f.hgt;
          if (feetAbs >= top - 0.02) continue;
          if (d < Math.hypot(ox - f.x, oz - f.z)) return false;
        }
      }
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
    const touchRunning = joystickActive && magnitude > 0.85;
    const running =
      (this.keys['ShiftLeft'] || this.keys['ShiftRight'] || touchRunning) && !this.crouching;
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
    if (this._forcedCrouch()) return;
    if (!this.grounded) return;
    this.verticalVelocity = JUMP_SPEED * (this.crouching ? CROUCH_JUMP_MULT : 1);
    this.grounded = false;
  }
  _furnitureTopAt(px, pz, feetAbs, prevFeetAbs) {
    if (!this._furnitureColliders || !this.maze) return null;
    const { cx, cy } = this._cellCoordsFor(px, pz);
    const furn = this._furnitureColliders.get(`${cx},${cy}`);
    if (!furn) return null;
    const cellFloor = (this.maze[cy][cx].elevation || 0) * STEP_HEIGHT;
    let best = null;
    for (const f of furn) {
      if (f.hgt === undefined || f.hgt > MAX_STAND_HEIGHT) continue;
      const top = cellFloor + f.hgt;
      
      if (Math.max(feetAbs, prevFeetAbs) < top - 0.03) continue;
      let inside;
      if (f.hx !== undefined) {
        const dx = px - f.x;
        const dz = pz - f.z;
        const c = Math.cos(f.yaw || 0);
        const s = Math.sin(f.yaw || 0);
        inside = Math.abs(dx * c - dz * s) <= f.hx + 0.05 && Math.abs(dx * s + dz * c) <= f.hz + 0.05;
      } else {
        inside = Math.hypot(px - f.x, pz - f.z) <= f.radius * 0.9;
      }
      if (inside && (best === null || top > best)) best = top;
    }
    return best;
  }
  _updateJump(dt) {
    const baseFloor = this._floorHeightAt(this.player.x, this.player.z);
    const hurdleTop = this._hurdleTopSupportAt(this.player.x, this.player.z);
    const feetNow = baseFloor + this.verticalOffset;
    const furnTop = this._furnitureTopAt(this.player.x, this.player.z, feetNow, this._prevFeetAbs ?? feetNow);
    let groundAbs = baseFloor;
    if (hurdleTop !== null && hurdleTop > groundAbs) groundAbs = hurdleTop;
    if (furnTop !== null && furnTop > groundAbs) groundAbs = furnTop;
    const groundOffset = groundAbs - baseFloor;
    if (this.grounded) {
      if (this.verticalOffset > groundOffset + 0.001) {
        this.grounded = false; 
      } else {
        this.verticalOffset = groundOffset;
        this._prevFeetAbs = baseFloor + groundOffset;
        return;
      }
    }
    this.verticalVelocity -= GRAVITY * dt;
    this.verticalOffset += this.verticalVelocity * dt;
    if (this.verticalOffset <= groundOffset) {
      this.verticalOffset = groundOffset;
      this.verticalVelocity = 0;
      this.grounded = true;
    }
    this._prevFeetAbs = baseFloor + this.verticalOffset;
  }
  _forcedCrouch() {
    const R = this.regions;
    if (!R || !R.hasPockets() || !this.maze) return false;
    const { cx, cy } = this._cellCoordsFor(this.player.x, this.player.z);
    if (R.isPocket(cx, cy)) return true;
    const cell = this.maze[cy] && this.maze[cy][cx];
    if (!cell) return false;
    const c = this._cellCenter(cx, cy);
    const dx = this.player.x - c.x;
    const dz = this.player.z - c.z;
    const near = CELL / 2 - 1.3;
    if (cell.crawlN && R.isPocket(cx, cy - 1) && dz < -near) return true;
    if (cell.crawlS && R.isPocket(cx, cy + 1) && dz > near) return true;
    if (cell.crawlW && R.isPocket(cx - 1, cy) && dx < -near) return true;
    if (cell.crawlE && R.isPocket(cx + 1, cy) && dx > near) return true;
    return false;
  }
  _updateStance(dt) {
    this.crouching = this.crouchToggled || !!this.keys['KeyC'] || this._forcedCrouch();
    const target = this.crouching ? CROUCH_EYE_HEIGHT : EYE_HEIGHT;
    const t = 1 - Math.exp(-dt * STANCE_EASE_RATE);
    this.currentEyeHeight += (target - this.currentEyeHeight) * t;
  }
  _updateBattery(dt) {
    this.torch.intensity = 250;
    this.torchGlow.intensity = (250 / 100) * 14;
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
    this.torchGlow.position.copy(this.torch.position).addScaledVector(this._torchForward, 1.1);
    this._torchRaycaster.set(this.torch.position, this._torchForward);
    this._torchRaycaster.far = TORCH_THROW;
    const hits = this._torchRaycaster.intersectObjects(this.wallMeshes, true);
    const hitDist = hits.length ? hits[0].distance : Infinity;
    let targetFactor = 1;
    if (hitDist < TORCH_NEAR_REF_DIST) {
      const clamped = Math.max(hitDist, 0.2);
      targetFactor = Math.max(
        TORCH_NEAR_MIN_FACTOR,
        (clamped / TORCH_NEAR_REF_DIST) * (clamped / TORCH_NEAR_REF_DIST),
      );
    }
    this._torchNearFactor += (targetFactor - this._torchNearFactor) * t;
    this.torch.intensity *= this._torchNearFactor;
    this.torchGlow.intensity *= this._torchNearFactor;
    if (this._flickerNextAt === undefined) {
      this._flickerNextAt = (this.elapsed || 0) + 6 + Math.random() * 10;
      this._flickerFactor = 1;
      this._flickerUntil = 0;
    }
    const now = this.elapsed || 0;
    if (now >= this._flickerNextAt && now >= this._flickerUntil) {
      this._flickerUntil = now + 0.12 + Math.random() * 0.22;
      this._flickerNextAt = now + 5 + Math.random() * 14;
    }
    this._flickerFactor = now < this._flickerUntil ? 0.35 + Math.random() * 0.35 : 1;
    this.torch.intensity *= this._flickerFactor;
    this.torchGlow.intensity *= this._flickerFactor;
  }
  _easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }
  _setDoorLook(exit) {
    this._doorLookTarget = exit || null;
  }
  _updateDoorLook() {
    if (
      !this.exits ||
      !this.exits.length ||
      document.pointerLockElement !== this.renderer.domElement
    ) {
      this._setDoorLook(null);
      return;
    }
    const closedGroups = this.exits.filter((e) => e.doorState === 'closed').map((e) => e.doorGroup);
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
    const wallHits = this._raycaster.intersectObjects(this.wallMeshes, true);
    if (wallHits.length && wallHits[0].distance < hits[0].distance - 0.05) {
      this._setDoorLook(null);
      return;
    }
    let obj = hits[0].object;
    while (obj && !obj.userData.exitLetter) obj = obj.parent;
    const letter = obj ? obj.userData.exitLetter : null;
    this._setDoorLook(letter ? this.exits.find((e) => e.letter === letter) : null);
  }
  _updateInteractPrompt() {
    let payload = null;
    if (this._doorLookTarget) {
      const exit = this._doorLookTarget;
      payload = {
        kind: 'exit',
        label: 'OPEN',
        letter: exit.letter,
        nextLabel: `${this.level + 1}${exit.letter.toUpperCase()}`,
      };
    } else if (this._shortcutDoorLookTarget) {
      const state = this._shortcutDoorLookTarget.doorState;
      payload = {
        kind: 'shortcut',
        label: state === 'open' || state === 'opening' ? 'CLOSE' : 'OPEN',
      };
    }
    const signature = payload ? `${payload.kind}:${payload.label}:${payload.letter || ''}` : null;
    if (signature === this._lastInteractPromptLabel) return;
    this._lastInteractPromptLabel = signature;
    if (this.callbacks.onDoorLookAt) this.callbacks.onDoorLookAt(payload);
  }
  _tryInteractDoor() {
    if (!this.running) return;
    if (this._doorLookTarget) {
      this._openDoor(this._doorLookTarget);
      return;
    }
    if (this._shortcutDoorLookTarget) {
      this._toggleShortcutDoor(this._shortcutDoorLookTarget);
    }
  }
  _updateShortcutDoorLook() {
    if (
      !this.shortcutDoors ||
      !this.shortcutDoors.length ||
      document.pointerLockElement !== this.renderer.domElement
    ) {
      this._shortcutDoorLookTarget = null;
      return;
    }
    const leaves = this.shortcutDoors.map((d) => d.leaf);
    this.camera.getWorldDirection(this._lookDir);
    this._raycaster.set(this.camera.position, this._lookDir);
    this._raycaster.far = SHORTCUT_DOOR_LOOK_DIST;
    const hits = this._raycaster.intersectObjects(leaves, true);
    if (!hits.length) {
      this._shortcutDoorLookTarget = null;
      return;
    }
    const wallHits = this._raycaster.intersectObjects(this.wallMeshes, true);
    if (wallHits.length && wallHits[0].distance < hits[0].distance - 0.05) {
      this._shortcutDoorLookTarget = null;
      return;
    }
    this._shortcutDoorLookTarget = this.shortcutDoors.find((d) => d.leaf === hits[0].object) || null;
  }
  _toggleShortcutDoor(door) {
    if (!door) return;
    const dist = Math.hypot(this.player.x - door.worldX, this.player.z - door.worldZ);
    if (dist > SHORTCUT_DOOR_INTERACT_DIST) return;
    if (door.doorState === 'closed' || door.doorState === 'closing') {
      const local = door.group.worldToLocal(
        new THREE.Vector3(this.player.x, door.group.position.y, this.player.z),
      );
      door.openSign = local.z >= 0 ? 1 : -1;
      door.doorState = 'opening';
      this._playDoorCreak(false);
    } else if (door.doorState === 'open' || door.doorState === 'opening') {
      door.doorState = 'closing';
      this._playDoorCreak(true);
    }
  }
  _updateShortcutDoors(dt) {
    if (!this.shortcutDoors || !this.shortcutDoors.length) return;
    for (const door of this.shortcutDoors) {
      if (door.doorState === 'opening') {
        door.animT = Math.min(1, door.animT + dt / SHORTCUT_DOOR_OPEN_DURATION);
        door.pivot.rotation.y = this._easeOutCubic(door.animT) * SHORTCUT_DOOR_OPEN_ANGLE * door.openSign;
        if (door.animT >= 1) door.doorState = 'open';
      } else if (door.doorState === 'closing') {
        door.animT = Math.max(0, door.animT - dt / SHORTCUT_DOOR_CLOSE_DURATION);
        door.pivot.rotation.y = this._easeOutCubic(door.animT) * SHORTCUT_DOOR_OPEN_ANGLE * door.openSign;
        if (door.animT <= 0) door.doorState = 'closed';
      }
    }
  }
  _openDoor(exit) {
    if (!exit || exit.doorState !== 'closed') return;
    const dist = Math.hypot(this.player.x - exit.worldX, this.player.z - exit.worldZ);
    if (dist > DOOR_INTERACT_DIST) return;
    const { cx, cy } = this._cellCoordsFor(this.player.x, this.player.z);
    if (cx !== exit.x || cy !== exit.y) return;
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
    if (dist >= DOOR_ENTER_RADIUS) return false;
    const { cx, cy } = this._cellCoordsFor(this.player.x, this.player.z);
    return cx === exit.x && cy === exit.y;
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
  _scheduleNextShift() {
    const span = WALL_SHIFT_MAX_DELAY - WALL_SHIFT_MIN_DELAY;
    this._nextShiftIn = WALL_SHIFT_MIN_DELAY + (this.rng ? this.rng() : Math.random()) * span;
  }
  _updateMazeShift(dt) {
    this._updateWallAnimations(dt);
    this._updateWallDebris(dt);
    if (this._nextShiftIn === null) {
      this._scheduleNextShift();
      return;
    }
    this._nextShiftIn -= dt;
    if (this._nextShiftIn <= 0) {
      this._triggerMazeShift();
      this._scheduleNextShift();
    }
  }
  _shiftProtectedCells() {
    const cells = [];
    const { cx, cy } = this._cellCoordsFor(this.player.x, this.player.z);
    for (let dy = -WALL_SHIFT_PROTECT_RADIUS; dy <= WALL_SHIFT_PROTECT_RADIUS; dy++) {
      for (let dx = -WALL_SHIFT_PROTECT_RADIUS; dx <= WALL_SHIFT_PROTECT_RADIUS; dx++) {
        cells.push([cx + dx, cy + dy]);
      }
    }
    if (this.exits) for (const exit of this.exits) cells.push([exit.x, exit.y]);
    if (this._spawnCell) cells.push(this._spawnCell);
    if (this._roomCells) cells.push(...this._roomCells);
    if (this.regions) cells.push(...this.regions.protectedCells());
    if (this._stairs) {
      for (const st of this._stairs) {
        cells.push([st.x, st.y]);
        if (st.vista) cells.push([st.fx, st.fy]);
      }
    }
    return cells;
  }
  _triggerMazeShift() {
    if (!this.maze || !this.mazeW || !this.mazeH) return;
    const { cx, cy } = this._cellCoordsFor(this.player.x, this.player.z);
    const changes = pickMazeShift(this.maze, this.mazeW, this.mazeH, {
      rng: this.rng || Math.random,
      fallCount: 2,
      riseCount: 2,
      protectedCells: this._shiftProtectedCells(),
      near: { x: cx, y: cy },
      nearRadius: WALL_SHIFT_NEAR_RADIUS,
    });
    if (!changes || !changes.length) return;
    const rng = this.rng || Math.random;
    changes.forEach((change, i) => {
      this._animateWallChange(change, i);
      const delay = i * WALL_SHIFT_STAGGER + rng() * WALL_SHIFT_STAGGER_JITTER;
      this.audio.playMazeShift(change.type, delay);
    });
    if (changes.some((c) => c.flattened)) {
      this._rebuildFloor();
      this._rebuildHurdles();
      
      if (this.regions) this.regions.refreshDecorHeights(this.maze);
    }
    if (this.callbacks.onMazeShift) this.callbacks.onMazeShift(changes);
  }
  _wallEdgeTransform(x, y, dir) {
    const cx = this.mazeOrigin.x + x * CELL + CELL / 2;
    const cz = this.mazeOrigin.z + y * CELL + CELL / 2;
    if (dir === 'e') {
      return { geo: this._wallGeoV, px: cx + CELL / 2, pz: cz };
    }
    return { geo: this._wallGeo, px: cx, pz: cz + CELL / 2 };
  }
  _animateWallChange(change, index = 0) {
    const key = this._edgeKey(change.x, change.y, change.dir);
    const rng = this.rng || Math.random;
    const delay = index * WALL_SHIFT_STAGGER + rng() * WALL_SHIFT_STAGGER_JITTER;
    const { px, pz } = this._wallEdgeTransform(change.x, change.y, change.dir);
    if (change.type === 'fall') {
      const mesh = this._wallMeshByEdge.get(key);
      if (!mesh) return;
      this._wallMeshByEdge.delete(key);
      if (this.regions) this.regions.onWallFall(key);
      this._wallAnims.push({
        mesh,
        kind: 'sink',
        elapsed: 0,
        delay,
        started: false,
        duration: WALL_SINK_DURATION,
        startY: mesh.position.y,
        endY: this._wallBottom - this._wallSpan / 2 - 0.4,
        wx: px,
        wz: pz,
        floorY: this._wallBottom,
      });
    } else if (change.type === 'rise') {
      if (this._wallMeshByEdge.has(key) || !this._wallGeo || !this._wallGeoV) return;
      const { geo } = this._wallEdgeTransform(change.x, change.y, change.dir);
      const startY = this._wallBottom - this._wallSpan / 2 - 0.4;
      this._wallCtxRegion = (this.regionMap && this.regionMap[change.y] && this.regionMap[change.y][change.x]) || null;
      this._wallCtxCell = this._wallCtxRegion ? [change.x, change.y] : null;
      const m = new THREE.Mesh(geo, this._pickWallMaterial());
      m.position.set(px, startY, pz);
      this.scene.add(m);
      this.wallMeshes.push(m);
      this._wallMeshByEdge.set(key, m);
      const shiftAxis = change.dir === 'e' ? 'x' : 'z';
      this._maybeAddStain(m, shiftAxis);
      this._maybeAddPainting(m, shiftAxis);
      this._wallCtxRegion = null;
      this._wallCtxCell = null;
      this._wallAnims.push({
        mesh: m,
        kind: 'rise',
        elapsed: 0,
        delay,
        started: false,
        duration: WALL_RISE_DURATION,
        startY,
        endY: this._wallCenterY,
        wx: px,
        wz: pz,
        floorY: this._wallBottom,
      });
    }
  }
  _updateWallAnimations(dt) {
    if (!this._wallAnims.length) return;
    for (let i = this._wallAnims.length - 1; i >= 0; i--) {
      const anim = this._wallAnims[i];
      if (anim.delay > 0) {
        anim.delay -= dt;
        if (anim.delay > 0) continue;
      }
      if (!anim.started) {
        anim.started = true;
        this._playWallShiftSound(anim.kind, anim.wx, anim.wz);
        this._spawnWallDebris(anim.wx, anim.floorY, anim.wz);
      }
      anim.elapsed += dt;
      const t = Math.min(1, anim.elapsed / anim.duration);
      const eased = anim.kind === 'rise' ? this._easeOutCubic(t) : t * t * t;
      anim.mesh.position.y = anim.startY + (anim.endY - anim.startY) * eased;
      if (t >= 1) {
        if (anim.kind === 'sink') {
          this.scene.remove(anim.mesh);
          const idx = this.wallMeshes.indexOf(anim.mesh);
          if (idx >= 0) this.wallMeshes.splice(idx, 1);
          if (anim.mesh.geometry !== this._wallGeo && anim.mesh.geometry !== this._wallGeoV) {
            anim.mesh.geometry.dispose();
          }
        }
        this._wallAnims.splice(i, 1);
      }
    }
  }
  _playWallShiftSound(kind, wx, wz) {
    this._ensureSfxContext();
    if (this.sfxCtx.state === 'suspended') this.sfxCtx.resume();
    const ctx = this.sfxCtx;
    const dx = wx - this.player.x;
    const dz = wz - this.player.z;
    const dist = Math.hypot(dx, dz);
    const distFactor = Math.max(0, 1 - dist / WALL_SHIFT_SOUND_MAX_DIST);
    if (distFactor <= 0) return;
    const angleToWall = Math.atan2(dx, -dz);
    const angleFromFacing = ((angleToWall - this.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
    const pan = Math.max(-1, Math.min(1, Math.sin(angleFromFacing)));
    const now = ctx.currentTime;
    let out = this.sfxMaster;
    if (ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      panner.connect(this.sfxMaster);
      out = panner;
    }
    const dur = kind === 'rise' ? 0.9 : 0.55;
    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.Q.value = 0.7;
    if (kind === 'rise') {
      filt.frequency.setValueAtTime(130, now);
      filt.frequency.linearRampToValueAtTime(340, now + dur);
    } else {
      filt.frequency.setValueAtTime(320, now);
      filt.frequency.exponentialRampToValueAtTime(85, now + dur);
    }
    const g = ctx.createGain();
    const peak = 0.32 * distFactor;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(peak, now + dur * 0.2);
    g.gain.linearRampToValueAtTime(0, now + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(out);
    src.start(now);
    src.stop(now + dur);
  }
  _spawnWallDebris(x, floorY, z) {
    if (!this._debrisTex) this._debrisTex = new THREE.CanvasTexture(makeDebrisCanvas());
    const rng = this.rng || Math.random;
    const count = WALL_SHIFT_DEBRIS_COUNT;
    const positions = new Float32Array(count * 3);
    const velocities = [];
    for (let i = 0; i < count; i++) {
      const ang = rng() * Math.PI * 2;
      const r = rng() * 0.3;
      positions[i * 3] = x + Math.cos(ang) * r;
      positions[i * 3 + 1] = floorY + 0.05;
      positions[i * 3 + 2] = z + Math.sin(ang) * r;
      velocities.push({
        x: Math.cos(ang) * (0.4 + rng() * 0.8),
        y: 1.2 + rng() * 1.6,
        z: Math.sin(ang) * (0.4 + rng() * 0.8),
      });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      map: this._debrisTex,
      size: 0.16,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geo, mat);
    this.scene.add(points);
    this._wallDebrisBursts.push({
      points,
      velocities,
      life: WALL_SHIFT_DEBRIS_LIFE,
      maxLife: WALL_SHIFT_DEBRIS_LIFE,
    });
  }
  _updateWallDebris(dt) {
    if (!this._wallDebrisBursts.length) return;
    for (let i = this._wallDebrisBursts.length - 1; i >= 0; i--) {
      const b = this._wallDebrisBursts[i];
      b.life -= dt;
      const pos = b.points.geometry.attributes.position;
      for (let p = 0; p < b.velocities.length; p++) {
        const v = b.velocities[p];
        pos.array[p * 3] += v.x * dt;
        pos.array[p * 3 + 1] += v.y * dt;
        pos.array[p * 3 + 2] += v.z * dt;
        v.y -= 3.4 * dt;
      }
      pos.needsUpdate = true;
      b.points.material.opacity = Math.max(0, b.life / b.maxLife) * 0.6;
      if (b.life <= 0) {
        this.scene.remove(b.points);
        b.points.geometry.dispose();
        b.points.material.dispose();
        this._wallDebrisBursts.splice(i, 1);
      }
    }
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
      if (!this._floorTransition) {
        this._updateStance(dt);
        this._updateJump(dt);
        this._updateMovement(dt);
      } else {
        this.currentPlayerSpeed = 0;
      }
      this._updateCurrentSurface();
      this._updateFootsteps(dt);
      this._updateBattery(dt);
      this._updateDoorLook();
      this._updateDoors(dt);
      this._updateShortcutDoorLook();
      this._updateInteractPrompt();
      this._updateShortcutDoors(dt);
      this._updateMazeShift(dt);
      this._updateStairs(dt);
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
    if (this.regions) this.regions.update(dt, this.player);
    this._updateViewmodel(dt);
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
    if (this.regions) this.regions.dispose();
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
    if (this._debrisTex) this._debrisTex.dispose();
    if (this._viewmodelEnvTex) this._viewmodelEnvTex.dispose();
    if (this._gltfRoots) {
      this._gltfRoots.forEach((root) => {
        root.traverse((obj) => {
          if (!obj.isMesh) return;
          obj.geometry.dispose();
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((mat) => {
            if (!mat) return;
            Object.keys(mat).forEach((key) => {
              const val = mat[key];
              if (val && val.isTexture) val.dispose();
            });
            mat.dispose();
          });
        });
      });
    }
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}