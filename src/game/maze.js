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
        if (neighbor.elevation === cell.elevation) {
          cell.crawlN = true;
          neighbor.crawlS = true;
        }
      }
      if (cell.w && x > 0 && rng() < crawlChance) {
        const neighbor = grid[y][x - 1];
        if (neighbor.elevation === cell.elevation) {
          cell.crawlW = true;
          neighbor.crawlE = true;
        }
      }
    }
  }
}

export function sizeForLevel(level) {
  const size = Math.min(7 + level * 2, 25);
  return { w: size, h: size };
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