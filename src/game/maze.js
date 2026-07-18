export function hashSeed(input) {
  const str =
    input === undefined || input === null || input === ''
      ? String(Math.floor(Math.random() * 0xffffffff))
      : String(input);
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h ^ (h >>> 16)) >>> 0;
}

export function levelSeed(baseSeed, level) {
  return (Math.imul((baseSeed >>> 0) ^ (level + 1), 0x9e3779b1) ^ ((level + 1) << 13)) >>> 0;
}

export function createRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateMaze(w, h, rng = Math.random) {
  const grid = [];
  for (let y = 0; y < h; y++) {
    const row = [];
    for (let x = 0; x < w; x++) {
      row.push({ n: true, s: true, e: true, w: true, visited: false });
    }
    grid.push(row);
  }

  const stack = [];
  let cx = 0,
    cy = 0;
  grid[cy][cx].visited = true;
  stack.push([cx, cy]);

  const dirs = [
    { dx: 0, dy: -1, me: 'n', opp: 's' },
    { dx: 0, dy: 1, me: 's', opp: 'n' },
    { dx: -1, dy: 0, me: 'w', opp: 'e' },
    { dx: 1, dy: 0, me: 'e', opp: 'w' },
  ];

  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const options = [];
    for (const d of dirs) {
      const nx = x + d.dx,
        ny = y + d.dy;
      if (nx >= 0 && nx < w && ny >= 0 && ny < h && !grid[ny][nx].visited) {
        options.push({ nx, ny, ...d });
      }
    }
    if (options.length === 0) {
      stack.pop();
      continue;
    }
    const pick = options[Math.floor(rng() * options.length)];
    grid[y][x][pick.me] = false;
    grid[pick.ny][pick.nx][pick.opp] = false;
    grid[pick.ny][pick.nx].visited = true;
    stack.push([pick.nx, pick.ny]);
  }

  return grid;
}

export function bfsDistances(grid, w, h, sx, sy) {
  const dist = Array.from({ length: h }, () => Array(w).fill(-1));
  dist[sy][sx] = 0;
  const q = [[sx, sy]];
  
  const passable = (cell, dir, dirUp) =>
    !cell[dir] || cell['door' + dirUp] || cell['hatch' + dirUp];

  while (q.length) {
    const [x, y] = q.shift();
    const d = dist[y][x];
    const cell = grid[y][x];
    const neighbors = [];
    if (passable(cell, 'n', 'N')) neighbors.push([x, y - 1]);
    if (passable(cell, 's', 'S')) neighbors.push([x, y + 1]);
    if (passable(cell, 'e', 'E')) neighbors.push([x + 1, y]);
    if (passable(cell, 'w', 'W')) neighbors.push([x - 1, y]);
    for (const [nx, ny] of neighbors) {
      if (dist[ny][nx] === -1) {
        dist[ny][nx] = d + 1;
        q.push([nx, ny]);
      }
    }
  }
  return dist;
}

export function farthestCell(grid, w, h, sx, sy) {
  const dist = bfsDistances(grid, w, h, sx, sy);
  let far = [sx, sy],
    maxd = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (dist[y][x] > maxd) {
        maxd = dist[y][x];
        far = [x, y];
      }
    }
  }
  return far;
}

export function assignElevations(grid, w, h, sx, sy, rng, opts = {}) {
  const rampChance = opts.rampChance ?? 0.1;
  const maxLevels = opts.maxLevels ?? 3;

  const dirs = {
    n: { dx: 0, dy: -1, mine: 'n', opp: 's' },
    s: { dx: 0, dy: 1, mine: 's', opp: 'n' },
    e: { dx: 1, dy: 0, mine: 'e', opp: 'w' },
    w: { dx: -1, dy: 0, mine: 'w', opp: 'e' },
  };
  const order = ['n', 's', 'e', 'w'];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      grid[y][x].elevation = 0;
      grid[y][x].rampDir = null;
    }
  }

  const visited = Array.from({ length: h }, () => Array(w).fill(false));
  visited[sy][sx] = true;
  const stack = [[sx, sy]];

  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const cell = grid[y][x];
    let advanced = false;
    for (const key of order) {
      const d = dirs[key];
      const nx = x + d.dx,
        ny = y + d.dy;
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      if (visited[ny][nx]) continue;
      if (cell[d.mine]) continue;
      visited[ny][nx] = true;
      const child = grid[ny][nx];
      let elevation = cell.elevation;
      let rampDir = null;
      if (rng() < rampChance) {
        const goingUp = rng() < 0.5;
        const proposed = cell.elevation + (goingUp ? 1 : -1);
        if (Math.abs(proposed) <= maxLevels) {
          elevation = proposed;
          rampDir = d.opp;
        }
      }
      child.elevation = elevation;
      child.rampDir = rampDir;
      stack.push([nx, ny]);
      advanced = true;
      break;
    }
    if (!advanced) stack.pop();
  }
}

export function assignObstacles(grid, w, h, sx, sy, rng, opts = {}) {
  const hurdleChance = opts.hurdleChance ?? 0.09;
  const crawlChance = opts.crawlChance ?? 0.05;

  const dirs = {
    n: { dx: 0, dy: -1, mine: 'n', opp: 's' },
    s: { dx: 0, dy: 1, mine: 's', opp: 'n' },
    e: { dx: 1, dy: 0, mine: 'e', opp: 'w' },
    w: { dx: -1, dy: 0, mine: 'w', opp: 'e' },
  };
  const order = ['n', 's', 'e', 'w'];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      grid[y][x].hurdleDir = null;
      grid[y][x].crawlN = false;
      grid[y][x].crawlS = false;
      grid[y][x].crawlE = false;
      grid[y][x].crawlW = false;
    }
  }

  const visited = Array.from({ length: h }, () => Array(w).fill(false));
  visited[sy][sx] = true;
  const stack = [[sx, sy]];
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const cell = grid[y][x];
    let advanced = false;
    for (const key of order) {
      const d = dirs[key];
      const nx = x + d.dx,
        ny = y + d.dy;
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      if (visited[ny][nx]) continue;
      if (cell[d.mine]) continue;
      visited[ny][nx] = true;
      const child = grid[ny][nx];
      if (!child.rampDir && rng() < hurdleChance) {
        child.hurdleDir = d.opp;
      }
      stack.push([nx, ny]);
      advanced = true;
      break;
    }
    if (!advanced) stack.pop();
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cell = grid[y][x];
      if (cell.n && y > 0 && rng() < crawlChance) {
        const neighbor = grid[y - 1][x];
        if (neighbor.elevation === cell.elevation && !cell.rampDir && !neighbor.rampDir) {
          cell.crawlN = true;
          neighbor.crawlS = true;
        }
      }
      if (cell.w && x > 0 && rng() < crawlChance) {
        const neighbor = grid[y][x - 1];
        if (neighbor.elevation === cell.elevation && !cell.rampDir && !neighbor.rampDir) {
          cell.crawlW = true;
          neighbor.crawlE = true;
        }
      }
    }
  }
}

export function assignDoors(grid, w, h, rng, opts = {}) {
  const doorChance = opts.doorChance ?? 0.6;
  const hatchChance = opts.hatchChance ?? 0.5;
  const minShortcutDistance = opts.minShortcutDistance ?? 6;
  const density = opts.density ?? 1;
  const maxShortcuts = opts.maxShortcuts ?? Math.max(1, Math.round(((w * h) / 90) * density));
  const openDoorChance = opts.openDoorChance ?? 0.3;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cell = grid[y][x];
      cell.doorN = false;
      cell.doorS = false;
      cell.doorE = false;
      cell.doorW = false;
      cell.doorOpenN = false;
      cell.doorOpenS = false;
      cell.doorOpenE = false;
      cell.doorOpenW = false;
      cell.hatchN = false;
      cell.hatchS = false;
      cell.hatchE = false;
      cell.hatchW = false;
    }
  }

  const pairs = [
    { dir: 'e', opp: 'w', dx: 1, dy: 0 },
    { dir: 's', opp: 'n', dx: 0, dy: 1 },
  ];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cell = grid[y][x];
      for (const p of pairs) {
        const nx = x + p.dx;
        const ny = y + p.dy;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        const neighbor = grid[ny][nx];
        if ((cell.elevation || 0) !== (neighbor.elevation || 0)) continue;
        if (cell.rampDir || neighbor.rampDir) continue;
        const dirUp = p.dir.toUpperCase();
        const oppUp = p.opp.toUpperCase();
        if (cell[p.dir] && cell['crawl' + dirUp] && rng() < hatchChance) {
          cell['hatch' + dirUp] = true;
          neighbor['hatch' + oppUp] = true;
        }
      }
    }
  }
  
  const candidates = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cell = grid[y][x];
      for (const p of pairs) {
        const nx = x + p.dx;
        const ny = y + p.dy;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        const neighbor = grid[ny][nx];
        if (!cell[p.dir]) continue; 
        if ((cell.elevation || 0) !== (neighbor.elevation || 0)) continue;
        if (cell.rampDir || neighbor.rampDir) continue;
        const dirUp = p.dir.toUpperCase();
        if (cell['crawl' + dirUp]) continue; 
        if (cell.hurdleDir === p.dir || neighbor.hurdleDir === p.opp) continue;
        candidates.push({ x, y, nx, ny, dir: p.dir, opp: p.opp });
      }
    }
  }

  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  let placed = 0;
  const distCache = new Map();
  for (const c of candidates) {
    if (placed >= maxShortcuts) break;
    if (rng() >= doorChance) continue;
    const key = c.y * 100000 + c.x;
    let dist = distCache.get(key);
    if (!dist) {
      dist = bfsDistances(grid, w, h, c.x, c.y);
      distCache.set(key, dist);
    }
    const d = dist[c.ny][c.nx];
    if (d < minShortcutDistance) continue;
    const dirUp = c.dir.toUpperCase();
    const oppUp = c.opp.toUpperCase();
    grid[c.y][c.x]['door' + dirUp] = true;
    grid[c.ny][c.nx]['door' + oppUp] = true;
    const startsOpen = rng() < openDoorChance;
    grid[c.y][c.x]['doorOpen' + dirUp] = startsOpen;
    grid[c.ny][c.nx]['doorOpen' + oppUp] = startsOpen;
    placed++;
  }
}

export function assignRooms(grid, w, h, rng, opts = {}) {
  const avoidCells = opts.avoidCells ?? [];
  const density = opts.density ?? 1;
  const minRooms = opts.minRooms ?? Math.max(1, Math.round(((w * h) / 70) * density));
  const maxRooms = opts.maxRooms ?? Math.max(minRooms + 1, Math.round(((w * h) / 26) * density));
  const minDoors = opts.minDoors ?? 1;
  const maxDoors = opts.maxDoors ?? (density < 0.7 ? 2 : 3);
  const openDoorChance = opts.openDoorChance ?? 0.3;
  const minCells = opts.minCells ?? 2;
  const maxRectCells = opts.maxRectCells ?? 9;
  const maxBlobCells = opts.maxBlobCells ?? 9;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) grid[y][x].roomId = null;
  }

  const avoidSet = new Set(avoidCells.map(([x, y]) => y * 100000 + x));
  const roomCount = minRooms + Math.floor(rng() * (maxRooms - minRooms + 1));

  const rooms = [];
  const maxAttempts = roomCount * 30;
  let attempts = 0;
  while (rooms.length < roomCount && attempts < maxAttempts) {
    attempts++;
    const sx = Math.floor(rng() * w);
    const sy = Math.floor(rng() * h);
    const seed = grid[sy][sx];
    if (seed.roomId != null) continue;
    if (avoidSet.has(sy * 100000 + sx)) continue;
    if (seed.rampDir) continue;
    const elevation = seed.elevation || 0;

    const useRect = rng() < 0.5;
    const cells = useRect
      ? collectRectRoom(grid, w, h, sx, sy, elevation, rng, avoidSet, maxRectCells)
      : collectBlobRoom(grid, w, h, sx, sy, elevation, rng, avoidSet, maxBlobCells);
    if (!cells || cells.length < minCells) continue;

    const { wallEdges, forcedDoorEdges } = collectRoomBoundaryEdges(grid, w, h, cells, elevation);
    if (!wallEdges.length && !forcedDoorEdges.length) continue; 
    const roomId = rooms.length;
    for (const [x, y] of cells) grid[y][x].roomId = roomId;
    openInteriorWalls(grid, w, h, cells);
    
    for (const e of forcedDoorEdges) {
      setWall(grid, w, h, e.x, e.y, e.dir, true);
      const dirUp = e.dir.toUpperCase();
      const oppUp = e.opp.toUpperCase();
      grid[e.y][e.x]['door' + dirUp] = true;
      grid[e.ny][e.nx]['door' + oppUp] = true;
      const startsOpen = rng() < openDoorChance;
      grid[e.y][e.x]['doorOpen' + dirUp] = startsOpen;
      grid[e.ny][e.nx]['doorOpen' + oppUp] = startsOpen;
    }
    
    for (let i = wallEdges.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [wallEdges[i], wallEdges[j]] = [wallEdges[j], wallEdges[i]];
    }
    const targetTotal = Math.max(
      forcedDoorEdges.length,
      Math.min(
        forcedDoorEdges.length + wallEdges.length,
        minDoors + Math.floor(rng() * (maxDoors - minDoors + 1)),
      ),
    );
    const extraDoorsNeeded = Math.max(0, targetTotal - forcedDoorEdges.length);
    for (let i = 0; i < extraDoorsNeeded; i++) {
      const e = wallEdges[i];
      const dirUp = e.dir.toUpperCase();
      const oppUp = e.opp.toUpperCase();
      grid[e.y][e.x]['door' + dirUp] = true;
      grid[e.ny][e.nx]['door' + oppUp] = true;
      const startsOpen = rng() < openDoorChance;
      grid[e.y][e.x]['doorOpen' + dirUp] = startsOpen;
      grid[e.ny][e.nx]['doorOpen' + oppUp] = startsOpen;
    }
    rooms.push({
      id: roomId,
      cells,
      elevation,
      doors: forcedDoorEdges.length + extraDoorsNeeded,
    });
  }
  return rooms;
}

function collectRectRoom(grid, w, h, sx, sy, elevation, rng, avoidSet, maxCells) {
  let rw = 2 + Math.floor(rng() * 3); 
  let rh = 2 + Math.floor(rng() * 3); 
  while (rw * rh > maxCells) {
    if (rw >= rh && rw > 2) rw--;
    else if (rh > 2) rh--;
    else break;
  }
  if (sx + rw > w || sy + rh > h) return null;
  const cells = [];
  for (let y = sy; y < sy + rh; y++) {
    for (let x = sx; x < sx + rw; x++) {
      const c = grid[y][x];
      if ((c.elevation || 0) !== elevation) return null;
      if (c.rampDir) return null;
      if (c.roomId != null) return null;
      if (avoidSet.has(y * 100000 + x)) return null;
      cells.push([x, y]);
    }
  }
  return cells;
}

function collectBlobRoom(grid, w, h, sx, sy, elevation, rng, avoidSet, maxCells) {
  const targetSize = 3 + Math.floor(rng() * (maxCells - 2));
  const key = (x, y) => y * 100000 + x;
  const included = new Set([key(sx, sy)]);
  const cells = [[sx, sy]];
  const frontier = [[sx, sy]];
  while (cells.length < targetSize && frontier.length) {
    const idx = Math.floor(rng() * frontier.length);
    const [cx, cy] = frontier[idx];
    const options = [];
    for (const dir of ['n', 's', 'e', 'w']) {
      const d = SHIFT_DIRS[dir];
      const nx = cx + d.dx,
        ny = cy + d.dy;
      if (!inBounds(nx, ny, w, h)) continue;
      if (included.has(key(nx, ny))) continue;
      const nc = grid[ny][nx];
      if ((nc.elevation || 0) !== elevation) continue;
      if (nc.rampDir) continue;
      if (nc.roomId != null) continue;
      if (avoidSet.has(key(nx, ny))) continue;
      options.push([nx, ny]);
    }
    if (!options.length) {
      frontier.splice(idx, 1);
      continue;
    }
    const [nx, ny] = options[Math.floor(rng() * options.length)];
    included.add(key(nx, ny));
    cells.push([nx, ny]);
    frontier.push([nx, ny]);
  }
  return cells;
}

function collectRoomBoundaryEdges(grid, w, h, cells, elevation) {
  const inRoom = new Set(cells.map(([x, y]) => y * 100000 + x));
  const wallEdges = []; 
  const forcedDoorEdges = []; 
  for (const [x, y] of cells) {
    const cell = grid[y][x];
    for (const dir of ['n', 's', 'e', 'w']) {
      const d = SHIFT_DIRS[dir];
      const nx = x + d.dx,
        ny = y + d.dy;
      if (!inBounds(nx, ny, w, h)) continue;
      if (inRoom.has(ny * 100000 + nx)) continue;
      const neighbor = grid[ny][nx];
      
      
      
      if ((neighbor.elevation || 0) !== elevation) continue;
      if (neighbor.rampDir) continue;
      const edge = { x, y, dir, nx, ny, opp: d.opp };
      if (cell[dir]) wallEdges.push(edge);
      else forcedDoorEdges.push(edge); 
    }
  }
  return { wallEdges, forcedDoorEdges };
}

function openInteriorWalls(grid, w, h, cells) {
  const inRoom = new Set(cells.map(([x, y]) => y * 100000 + x));
  for (const [x, y] of cells) {
    const cell = grid[y][x];
    for (const dir of ['n', 's', 'e', 'w']) {
      const d = SHIFT_DIRS[dir];
      const nx = x + d.dx,
        ny = y + d.dy;
      if (!inBounds(nx, ny, w, h)) continue;
      if (!inRoom.has(ny * 100000 + nx)) continue;
      setWall(grid, w, h, x, y, dir, false);
      const dirUp = dir.toUpperCase();
      const oppUp = d.opp.toUpperCase();
      cell['door' + dirUp] = false;
      cell['doorOpen' + dirUp] = false;
      cell['hatch' + dirUp] = false;
      grid[ny][nx]['door' + oppUp] = false;
      grid[ny][nx]['doorOpen' + oppUp] = false;
      grid[ny][nx]['hatch' + oppUp] = false;
    }
  }
}

export function sizeForLevel(level) {
  const size = Math.min(7 + level * 2, 25);
  return { w: size, h: size };
}

export function roomDensityForLevel(level) {
  const lvl = Math.max(1, level || 1);
  return Math.min(1.6, 0.35 + (lvl - 1) * 0.1);
}

function buildParentTree(grid, w, h, sx, sy) {
  const dist = Array.from({ length: h }, () => Array(w).fill(-1));
  const parent = Array.from({ length: h }, () => Array(w).fill(null));
  dist[sy][sx] = 0;
  const q = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.shift();
    const d = dist[y][x];
    const cell = grid[y][x];
    const neighbors = [];
    if (!cell.n) neighbors.push([x, y - 1]);
    if (!cell.s) neighbors.push([x, y + 1]);
    if (!cell.e) neighbors.push([x + 1, y]);
    if (!cell.w) neighbors.push([x - 1, y]);
    for (const [nx, ny] of neighbors) {
      if (dist[ny][nx] === -1) {
        dist[ny][nx] = d + 1;
        parent[ny][nx] = [x, y];
        q.push([nx, ny]);
      }
    }
  }
  return { dist, parent };
}

function divergenceFraction(dist, parent, ax, ay, bx, by) {
  const bAncestors = new Set();
  let bx2 = bx,
    by2 = by;
  while (true) {
    bAncestors.add(by2 * 10000 + bx2);
    const p = parent[by2][bx2];
    if (!p) break;
    [bx2, by2] = p;
  }
  let cx = ax,
    cy = ay;
  while (true) {
    if (bAncestors.has(cy * 10000 + cx)) {
      return (dist[ay][ax] - dist[cy][cx]) / Math.max(1, dist[ay][ax]);
    }
    const p = parent[cy][cx];
    if (!p) return 1;
    [cx, cy] = p;
  }
}

function selectDivergentCells(grid, w, h, sx, sy, rng, count, minFraction) {
  const { dist, parent } = buildParentTree(grid, w, h, sx, sy);
  let maxDist = 0;
  const cells = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x === sx && y === sy) continue;
      cells.push([x, y]);
      if (dist[y][x] > maxDist) maxDist = dist[y][x];
    }
  }

  const farThreshold = maxDist * 0.55;
  let candidates = cells.filter(([x, y]) => dist[y][x] >= farThreshold);
  if (candidates.length === 0) candidates = cells.slice();

  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  const accepted = [];
  for (const [x, y] of candidates) {
    if (accepted.length >= count) break;
    let ok = true;
    for (const a of accepted) {
      if (divergenceFraction(dist, parent, x, y, a.x, a.y) < minFraction) {
        ok = false;
        break;
      }
    }
    if (ok) accepted.push({ x, y, dist: dist[y][x] });
  }

  if (accepted.length === 0) {
    let far = [sx, sy],
      m = -1;
    for (const [x, y] of cells)
      if (dist[y][x] > m) {
        m = dist[y][x];
        far = [x, y];
      }
    accepted.push({ x: far[0], y: far[1], dist: m });
  }

  accepted.sort((a, b) => b.dist - a.dist);
  return accepted;
}

export function pickExits(grid, w, h, sx, sy, rng) {
  const roll = rng();
  let desired = 1;
  if (roll > 0.5) desired = 2;
  if (roll > 0.75) desired = 3;
  if (roll > 0.9) desired = 4;
  if (roll > 0.97) desired = 5;
  return selectDivergentCells(grid, w, h, sx, sy, rng, desired, 0.2);
}

const DIR_DELTAS = {
  n: [0, -1],
  s: [0, 1],
  e: [1, 0],
  w: [-1, 0],
};
const DIR_OPP = { n: 's', s: 'n', e: 'w', w: 'e' };

function clearHurdleAtCell(grid, w, h, x, y) {
  if (y < 0 || y >= h || x < 0 || x >= w) return;
  const cell = grid[y][x];
  cell.hurdleDir = null;
  for (const dir of Object.keys(DIR_DELTAS)) {
    const [dx, dy] = DIR_DELTAS[dir];
    const nx = x + dx,
      ny = y + dy;
    if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
    const neighbor = grid[ny][nx];
    if (neighbor.hurdleDir === DIR_OPP[dir]) neighbor.hurdleDir = null;
  }
}

export function clearHurdlesNearExits(grid, w, h, exits) {
  if (!exits || !exits.length) return;
  for (const exit of exits) clearHurdleAtCell(grid, w, h, exit.x, exit.y);
}

export function clearHurdlesNearAllDoors(grid, w, h) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cell = grid[y][x];
      if (cell.doorN || cell.doorS || cell.doorE || cell.doorW) {
        clearHurdleAtCell(grid, w, h, x, y);
      }
    }
  }
}

export function pickAnchors(grid, w, h, exits, rng, count) {
  if (!exits || exits.length === 0) {
    return selectDivergentCells(grid, w, h, 0, 0, rng, count, 0.15);
  }

  const minDistToExit = Array.from({ length: h }, () => Array(w).fill(Infinity));
  for (const exit of exits) {
    const grid2 = exit.distGrid || bfsDistances(grid, w, h, exit.x, exit.y);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const d = grid2[y][x];
        if (d >= 0 && d < minDistToExit[y][x]) minDistToExit[y][x] = d;
      }
    }
  }

  let maxVal = 0;
  const cells = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = minDistToExit[y][x];
      if (v === Infinity) continue;
      cells.push([x, y, v]);
      if (v > maxVal) maxVal = v;
    }
  }

  const threshold = maxVal * 0.5;
  let candidates = cells.filter(([, , v]) => v >= threshold);
  if (candidates.length === 0) candidates = cells.slice();

  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  const accepted = [];
  for (const [x, y, v] of candidates) {
    if (accepted.length >= count) break;

    if (accepted.some((a) => Math.hypot(x - a.x, y - a.y) < 2)) continue;
    accepted.push({ x, y, distToExit: v });
  }
  if (accepted.length === 0) {
    let best = cells[0] || [0, 0, 0];
    for (const c of cells) if (c[2] > best[2]) best = c;
    accepted.push({ x: best[0], y: best[1], distToExit: best[2] });
  }

  accepted.sort((a, b) => b.distToExit - a.distToExit);
  return accepted;
}

const SHIFT_DIRS = {
  n: { dx: 0, dy: -1, opp: 's' },
  s: { dx: 0, dy: 1, opp: 'n' },
  e: { dx: 1, dy: 0, opp: 'w' },
  w: { dx: -1, dy: 0, opp: 'e' },
};

function inBounds(x, y, w, h) {
  return x >= 0 && x < w && y >= 0 && y < h;
}

function setWall(grid, w, h, x, y, dir, present) {
  const d = SHIFT_DIRS[dir];
  const nx = x + d.dx;
  const ny = y + d.dy;
  grid[y][x][dir] = present;
  if (inBounds(nx, ny, w, h)) {
    grid[ny][nx][d.opp] = present;
  }
}

function listInteriorEdges(w, h) {
  const edges = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x + 1 < w) edges.push({ x, y, dir: 'e', nx: x + 1, ny: y });
      if (y + 1 < h) edges.push({ x, y, dir: 's', nx: x, ny: y + 1 });
    }
  }
  return edges;
}

function edgeTouchesProtected(edge, protectedSet) {
  return protectedSet.has(edge.y * 100000 + edge.x) || protectedSet.has(edge.ny * 100000 + edge.nx);
}

function edgeHasDoor(grid, edge) {
  const cell = grid[edge.y][edge.x];
  if (edge.dir === 'e') return !!(cell.doorE || cell.hatchE);
  if (edge.dir === 's') return !!(cell.doorS || cell.hatchS);
  return false;
}

function isBridgeEdge(grid, w, h, edge) {
  const startKey = edge.y * 100000 + edge.x;
  const targetKey = edge.ny * 100000 + edge.nx;
  const visited = new Set([startKey]);
  const queue = [[edge.x, edge.y]];
  while (queue.length) {
    const [x, y] = queue.shift();
    const cell = grid[y][x];
    for (const key of ['n', 's', 'e', 'w']) {
      if (cell[key]) continue;
      const d = SHIFT_DIRS[key];
      const nx = x + d.dx;
      const ny = y + d.dy;
      if (!inBounds(nx, ny, w, h)) continue;
      const isTheEdgeItself =
        (x === edge.x && y === edge.y && nx === edge.nx && ny === edge.ny) ||
        (x === edge.nx && y === edge.ny && nx === edge.x && ny === edge.y);
      if (isTheEdgeItself) continue;
      const k = ny * 100000 + nx;
      if (!visited.has(k)) {
        visited.add(k);
        queue.push([nx, ny]);
      }
    }
  }

  return !visited.has(targetKey);
}

function shuffleInPlace(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function collectPlateau(grid, w, h, sx, sy) {
  const startElevation = grid[sy][sx].elevation || 0;
  const key = (x, y) => y * 100000 + x;
  const visited = new Set([key(sx, sy)]);
  const cells = [[sx, sy]];
  const boundary = [];
  const queue = [[sx, sy]];
  while (queue.length) {
    const [x, y] = queue.shift();
    const cell = grid[y][x];
    for (const dir of ['n', 's', 'e', 'w']) {
      const dirUp = dir.toUpperCase();
      const doored = !!(cell['door' + dirUp] || cell['hatch' + dirUp]);
      if (cell[dir] && !doored) continue; 
      const d = SHIFT_DIRS[dir];
      const nx = x + d.dx;
      const ny = y + d.dy;
      if (!inBounds(nx, ny, w, h)) continue;
      const neighborElevation = grid[ny][nx].elevation || 0;
      if (!cell[dir]) {
        if (neighborElevation === startElevation) {
          const k = key(nx, ny);
          if (!visited.has(k)) {
            visited.add(k);
            cells.push([nx, ny]);
            queue.push([nx, ny]);
          }
          continue;
        }
      }
      boundary.push({ x, y, dir, nx, ny, doored });
    }
  }
  return { cells, boundary, elevation: startElevation };
}

function flattenPlateauIfSafe(grid, w, h, sx, sy, targetElevation, protectedSet) {
  const { cells, boundary, elevation } = collectPlateau(grid, w, h, sx, sy);
  if (protectedSet) {
    for (const [x, y] of cells) {
      if (protectedSet.has(y * 100000 + x)) return false;
    }
  }
  const delta = targetElevation - elevation;
  if (delta === 0) return true;
  for (const edge of boundary) {
    const otherElevation = grid[edge.ny][edge.nx].elevation || 0;
    const newDelta = otherElevation - targetElevation;
    if (edge.doored) {
      if (newDelta !== 0) return false;
    } else if (Math.abs(newDelta) > 1) {
      return false;
    }
  }
  for (const [x, y] of cells) {
    grid[y][x].elevation = targetElevation;
  }
  for (const edge of boundary) {
    const cellHere = grid[edge.y][edge.x];
    const cellThere = grid[edge.ny][edge.nx];
    const otherElevation = cellThere.elevation || 0;
    const newDelta = otherElevation - targetElevation;
    const oppDir = SHIFT_DIRS[edge.dir].opp;
    if (newDelta === 0) {
      if (cellHere.rampDir === edge.dir) cellHere.rampDir = null;
      if (cellThere.rampDir === oppDir) cellThere.rampDir = null;
    } else if (!edge.doored && cellHere.rampDir !== edge.dir && cellThere.rampDir !== oppDir) {
      cellHere.rampDir = edge.dir;
    }
  }
  return true;
}

export function pickMazeShift(grid, w, h, opts = {}) {
  const rng = opts.rng ?? Math.random;
  const fallCount = opts.fallCount ?? 2;
  const riseCount = opts.riseCount ?? 2;
  const protectedCells = opts.protectedCells ?? [];
  const near = opts.near ?? null;
  const nearRadius = opts.nearRadius ?? 7;

  const protectedSet = new Set(protectedCells.map(([px, py]) => py * 100000 + px));
  const edges = listInteriorEdges(w, h);

  const edgeDist = (e) => {
    if (!near) return 0;
    const midX = (e.x + e.nx) / 2 + 0.5;
    const midY = (e.y + e.ny) / 2 + 0.5;
    return Math.hypot(midX - near.x, midY - near.y);
  };

  const rankByProximity = (list) => {
    if (!near) return shuffleInPlace(list, rng);
    const close = [];
    const far = [];
    for (const e of list) {
      if (edgeDist(e) <= nearRadius) close.push(e);
      else far.push(e);
    }
    return [...shuffleInPlace(close, rng), ...shuffleInPlace(far, rng)];
  };

  const closedCandidates = rankByProximity(
    edges.filter(
      (e) =>
        grid[e.y][e.x][e.dir] && !edgeTouchesProtected(e, protectedSet) && !edgeHasDoor(grid, e),
    ),
  );
  const openCandidates = rankByProximity(
    edges.filter(
      (e) =>
        !grid[e.y][e.x][e.dir] && !edgeTouchesProtected(e, protectedSet) && !edgeHasDoor(grid, e),
    ),
  );

  const changes = [];

  for (const edge of closedCandidates) {
    if (changes.filter((c) => c.type === 'fall').length >= fallCount) break;
    const elevHere = grid[edge.y][edge.x].elevation || 0;
    const elevThere = grid[edge.ny][edge.nx].elevation || 0;
    let flattened = false;
    if (elevHere !== elevThere) {
      const sizeHere = collectPlateau(grid, w, h, edge.x, edge.y).cells.length;
      const sizeThere = collectPlateau(grid, w, h, edge.nx, edge.ny).cells.length;
      const ok =
        sizeHere <= sizeThere
          ? flattenPlateauIfSafe(grid, w, h, edge.x, edge.y, elevThere, protectedSet)
          : flattenPlateauIfSafe(grid, w, h, edge.nx, edge.ny, elevHere, protectedSet);
      if (!ok) continue;
      flattened = true;
    }
    setWall(grid, w, h, edge.x, edge.y, edge.dir, false);
    changes.push({
      type: 'fall',
      x: edge.x,
      y: edge.y,
      dir: edge.dir,
      nx: edge.nx,
      ny: edge.ny,
      flattened,
    });
  }

  for (const edge of openCandidates) {
    if (changes.filter((c) => c.type === 'rise').length >= riseCount) break;
    if (isBridgeEdge(grid, w, h, edge)) continue;
    setWall(grid, w, h, edge.x, edge.y, edge.dir, true);
    changes.push({ type: 'rise', x: edge.x, y: edge.y, dir: edge.dir, nx: edge.nx, ny: edge.ny });
  }

  return changes;
}

export function generateSurfaceMap(w, h, rng = Math.random) {
  const map = Array.from({ length: h }, () => Array(w).fill('stone'));
  const cellCount = w * h;

  for (const type of ['grass', 'mud', 'water']) {
    const blobCount = Math.max(1, Math.round(cellCount / 90));
    for (let b = 0; b < blobCount; b++) {
      let x = Math.floor(rng() * w);
      let y = Math.floor(rng() * h);
      const steps = 10 + Math.floor(rng() * 20);
      for (let s = 0; s < steps; s++) {
        if (rng() < 0.8) map[y][x] = type;
        const dir = Math.floor(rng() * 4);
        if (dir === 0) x = Math.min(w - 1, x + 1);
        else if (dir === 1) x = Math.max(0, x - 1);
        else if (dir === 2) y = Math.min(h - 1, y + 1);
        else y = Math.max(0, y - 1);
      }
    }
  }

  return map;
}