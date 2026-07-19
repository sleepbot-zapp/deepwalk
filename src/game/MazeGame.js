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
const FURNITURE_COLLIDE_RADIUS = {
  bed: 1.0,
  cupboard: 0.55,
  bedsideTable: 0.33,
  table: 0.7,
};
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
const SURFACE_TYPES = ['stone', 'grass', 'mud', 'water'];
const STAIN_TYPES = ['blood', 'mud', 'damp'];
const STAIN_CHANCE = 0.45;
const WALL_STYLE_WEIGHTS = [
  {
    style: 'normal',
    weight: 0.58,
  },
  {
    style: 'eerie1',
    weight: 0.14,
  },
  {
    style: 'eerie2',
    weight: 0.14,
  },
  {
    style: 'cracked',
    weight: 0.14,
  },
];
const PAINTING_CHANCE = 0.09;
const PAINTING_MAX_PER_MAZE_BASE = 5;
const PAINTING_MAX_PER_MAZE_PER_CELL = 0.018;
const PAINTING_SCENES = [
  'tall_figure',
  'crouched_figure',
  'antler_figure',
  'hollow_eye',
  'hallway',
  'moon_figure',
  'hooded_figure',
  'smiley_face',
  'symbol',
  'tally_marks',
  'handprints',
  'spiral',
  'mask',
  'door_ajar',
  'staircase',
  'teeth',
  'family_wrong',
];
const CREEPY_CAPTIONS = [
  'IT WAITS WHERE YOU DO NOT LOOK.',
  'DO YOU SEE WHAT I SEE?',
  'NOT ALL DOORS SHOULD BE OPENED.',
  'I AM NOT SUPPOSED TO BE HERE',
  'HE WATCHES WHEN YOU SLEEP',
  "DON'T GO DOWN THERE.",
  'FOLLOW ME',
  "I'M STILL HERE",
  'I SEE YOU',
  'HELP ME',
  'DO NOT LOOK BEHIND YOU.',
  'STAY ON THE PATH.',
  'TURN BACK NOW.',
  'KEEP THE LIGHT ON.',
  "DON'T TRUST THE MIRRORS.",
  'DAY 47. STILL NO WAY OUT.',
  'THE WALLS MOVED AGAIN.',
  'THERE ARE ALWAYS MORE DOORS.',
  'SOMETHING IS UNDER THE FLOOR.',
  "MOMMY SAYS HE ISN'T REAL.",
  'WE USED TO PLAY HERE.',
  'THIS WAS MY ROOM.',
  'PLEASE LET ME OUT.',
  'IS ANYONE THERE?',
  'THE HALLWAY REMEMBERS.',
  'IT WEARS DIFFERENT FACES.',
  'EVERY EXIT LEADS BACK HERE.',
  'THE LIGHT ATTRACTS IT.',
  'YOU ARE NOT ALONE HERE.',
  'SEVEN STEPS. NEVER EIGHT.',
  'DO NOT COUNT THE DOORS.',
  'IT KNOWS YOUR NAME.',
  'WHO LEFT THE LIGHTS ON?',
  'I HEARD IT BREATHING.',
  'NO ONE ELSE REMEMBERS THIS PLACE.',
  'IT ONLY MOVES WHEN YOU BLINK.',
];
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
const DOOR_STYLES = [
  { key: 'darkOak', base: '#2c2016', grain: [40, 26, 14], handle: 0x2b2b2e },
  { key: 'ashGrey', base: '#3a3934', grain: [48, 48, 44], handle: 0x55524a },
  {
    key: 'crimsonFaded',
    base: '#40232a',
    grain: [46, 22, 24],
    ornate: true,
    handle: 0x6b5a3a,
  },
  {
    key: 'spruceDusty',
    base: '#31352a',
    grain: [38, 40, 30],
    pane: 'diamond',
    paneColor: 'rgba(140,150,132,0.22)',
    handle: 0x3a3a3e,
  },
  {
    key: 'birchPale',
    base: '#5e5140',
    grain: [72, 63, 50],
    pane: 'small',
    paneColor: 'rgba(175,182,178,0.26)',
    handle: 0xa89d7c,
  },
  { key: 'charred', base: '#181410', grain: [28, 22, 16], handle: 0x1c1c1e },
  {
    key: 'ironGrey',
    base: '#3a3b3e',
    grain: [50, 52, 56],
    pane: 'cross',
    paneColor: 'rgba(100,110,120,0.22)',
    handle: 0x8a8f96,
    metal: true,
  },
];
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
    };
  }
  _pickWallMaterial() {
    const rng = this.rng || Math.random;
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
    if (this.callbacks.onDoorLookAt) this.callbacks.onDoorLookAt(null);
    if (this._lastInteractPromptLabel !== null) {
      this._lastInteractPromptLabel = null;
      if (this.callbacks.onInteractPrompt) this.callbacks.onInteractPrompt(null);
    }
    if (this.shortcutDoors) {
      for (const d of this.shortcutDoors) this.scene.remove(d.group);
    }
    this.shortcutDoors = [];
    this._shortcutDoorByEdge = new Map();
    this._shortcutDoorLookTarget = null;
    if (this.ceilMesh) this.scene.remove(this.ceilMesh);
    if (this.furnitureMeshes) {
      for (const m of this.furnitureMeshes) this.scene.remove(m);
    }
    this.furnitureMeshes = [];
    this._furnitureColliders = new Map();
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
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const cell = this.maze[y][x];
        const type = (this.surfaceMap[y] && this.surfaceMap[y][x]) || 'stone';
        if (cell.rampDir) {
          rampCells.push({
            x,
            y,
            type,
            cell,
          });
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
        const centerY = topY - FLOOR_THICKNESS / 2;
        matrix.compose(new THREE.Vector3(cx, centerY, cz), quat, new THREE.Vector3(1, 1, 1));
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
          this._furnitureColliders.get(key).push({ x: cx, z: cz, radius: collideRadius });
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
    const ceilMat = new THREE.MeshStandardMaterial({
      color: 0x050506,
      roughness: 1,
    });
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
    this.ceilMesh = new THREE.Mesh(new THREE.PlaneGeometry(w * CELL, h * CELL), ceilMat);
    this.ceilMesh.rotation.x = Math.PI / 2;
    this.ceilMesh.position.set(0, wallTop, 0);
    this.scene.add(this.ceilMesh);
    return {
      x: originX,
      z: originZ,
    };
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
  loadLevel(n, entryLetter) {
    this.level = n;
    this.floorLabel = entryLetter ? `${n}${entryLetter.toUpperCase()}` : String(n);
    const { w, h } = sizeForLevel(n);
    this.mazeW = w;
    this.mazeH = h;
    this.rng = createRng(levelSeed(this.baseSeed, n));
    const density = roomDensityForLevel(n);
    this.maze = generateMaze(w, h, this.rng);
    assignElevations(this.maze, w, h, 0, 0, this.rng);
    assignObstacles(this.maze, w, h, 0, 0, this.rng);
    assignDoors(this.maze, w, h, this.rng, { density });
    this.surfaceMap = generateSurfaceMap(w, h, this.rng);
    const exitCells = pickExits(this.maze, w, h, 0, 0, this.rng);
    this.exits = exitCells.map((e, i) => ({
      ...e,
      letter: EXIT_LETTERS[i] || String(i + 1),
    }));
    
    
    
    clearHurdlesNearExits(this.maze, w, h, this.exits);
    const rooms = assignRooms(this.maze, w, h, this.rng, {
      avoidCells: [[0, 0], ...this.exits.map((e) => [e.x, e.y])],
      density,
    });
    assignRoomFurniture(this.maze, w, h, rooms, this.rng);
    this.rooms = rooms;
    
    
    
    clearHurdlesNearAllDoors(this.maze, w, h);
    this._roomCells = [];
    for (let ry = 0; ry < h; ry++) {
      for (let rx = 0; rx < w; rx++) {
        if (this.maze[ry][rx].roomId != null) this._roomCells.push([rx, ry]);
      }
    }
    this.discoveredExits = new Set();
    const origin = this._buildMazeMeshes(this.maze, w, h);
    this.mazeOrigin = origin;
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
        const anchor = anchors[idx];
        if (anchor) {
          spawnX = anchor.x;
          spawnY = anchor.y;
        }
      }
      entranceWallDir = this._pickEntranceWallDir(spawnX, spawnY);
      if (entranceWallDir) this._buildEntranceDoor(spawnX, spawnY, entranceWallDir);
    }
    this._spawnCell = [spawnX, spawnY];
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
      this.callbacks.onFloorEnter(this.floorLabel, {
        level: n,
        entryLetter: entryLetter || null,
      });
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
    for (const exit of this.exits) {
      const dist = exit.distGrid[cy][cx];
      const progress = 1 - dist / exit.totalDist;
      if (progress > best) best = progress;
    }
    return Math.max(0, Math.min(1, best));
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
        for (const f of furn) {
          if (Math.hypot(nx - f.x, nz - f.z) < f.radius + r) return false;
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
      (!this.isTouchDevice && document.pointerLockElement !== this.renderer.domElement)
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
    let label = null;
    let kind = null;
    if (this._doorLookTarget) {
      label = 'OPEN';
      kind = 'exit';
    } else if (this._shortcutDoorLookTarget) {
      const state = this._shortcutDoorLookTarget.doorState;
      label = state === 'open' || state === 'opening' ? 'CLOSE' : 'OPEN';
      kind = 'shortcut';
    }
    if (label === this._lastInteractPromptLabel) return;
    this._lastInteractPromptLabel = label;
    if (this.callbacks.onInteractPrompt) {
      this.callbacks.onInteractPrompt(label ? { label, kind } : null);
    }
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
      (!this.isTouchDevice && document.pointerLockElement !== this.renderer.domElement)
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
      const m = new THREE.Mesh(geo, this._pickWallMaterial());
      m.position.set(px, startY, pz);
      this.scene.add(m);
      this.wallMeshes.push(m);
      this._wallMeshByEdge.set(key, m);
      const shiftAxis = change.dir === 'e' ? 'x' : 'z';
      this._maybeAddStain(m, shiftAxis);
      this._maybeAddPainting(m, shiftAxis);
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
      this._updateStance(dt);
      this._updateJump(dt);
      this._updateMovement(dt);
      this._updateCurrentSurface();
      this._updateFootsteps(dt);
      this._updateBattery(dt);
      this._updateDoorLook();
      this._updateDoors(dt);
      this._updateShortcutDoorLook();
      this._updateInteractPrompt();
      this._updateShortcutDoors(dt);
      this._updateMazeShift(dt);
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