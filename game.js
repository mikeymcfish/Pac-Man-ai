window.addEventListener("load", () => {
  const canvas = document.getElementById("game");
  if (!canvas) {
    console.error("Pac-Man canvas element not found.");
    return;
  }
  const ctx = canvas.getContext("2d");

const TILE = 16;
const COLS = 28;
const ROWS = 31;

const MAZE = [
  "############################",
  "#............##............#",
  "#.####.#####.##.#####.####.#",
  "#o####.#####.##.#####.####o#",
  "#.####.#####.##.#####.####.#",
  "#..........................#",
  "#.####.##.########.##.####.#",
  "#.####.##.########.##.####.#",
  "#......##....##....##......#",
  "######.#####.##.#####.######",
  "     #.#####.##.#####.#     ",
  "     #.##..........##.#     ",
  "     #.##.###==###.##.#     ",
  "######.##.#      #.##.######",
  "      .   #      #   .      ",
  "      .   #      #   .      ",
  "######.##.#      #.##.######",
  "     #.##.########.##.#     ",
  "     #.##..........##.#     ",
  "     #.##.########.##.#     ",
  "######.##.########.##.######",
  "#............##............#",
  "#.####.#####.##.#####.####.#",
  "#.####.#####.##.#####.####.#",
  "#o..##................##..o#",
  "###.##.##.########.##.##.###",
  "#......##....##....##......#",
  "#.##########.##.##########.#",
  "#.##########.##.##########.#",
  "#..........................#",
  "############################",
];

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};

let pellets = new Set();
let powerPellets = new Set();

function tileKey(x, y) {
  return `${x},${y}`;
}

function initPellets() {
  pellets.clear();
  powerPellets.clear();
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const tile = MAZE[y][x];
      if (tile === ".") {
        pellets.add(tileKey(x, y));
      }
      if (tile === "o") {
        powerPellets.add(tileKey(x, y));
      }
    }
  }
}

function isWall(x, y) {
  if (y < 0 || y >= ROWS) {
    return true;
  }
  if (x < 0 || x >= COLS) {
    return false;
  }
  const tile = MAZE[y][x];
  return tile === "#";
}

function isDoor(x, y) {
  if (y < 0 || y >= ROWS || x < 0 || x >= COLS) {
    return false;
  }
  return MAZE[y][x] === "=";
}

function wrapPosition(entity) {
  if (entity.x < -TILE / 2) {
    entity.x = COLS * TILE + TILE / 2;
  }
  if (entity.x > COLS * TILE + TILE / 2) {
    entity.x = -TILE / 2;
  }
}

function centerOf(tileX, tileY) {
  return {
    x: tileX * TILE + TILE / 2,
    y: tileY * TILE + TILE / 2,
  };
}

function tileFromPosition(x, y) {
  return {
    x: Math.floor(x / TILE),
    y: Math.floor(y / TILE),
  };
}

function atCenter(entity) {
  const modX = Math.abs((entity.x - TILE / 2) % TILE);
  const modY = Math.abs((entity.y - TILE / 2) % TILE);
  return modX < 0.5 && modY < 0.5;
}

function nextTile(entity, dir) {
  const { x, y } = tileFromPosition(entity.x, entity.y);
  return {
    x: x + dir.x,
    y: y + dir.y,
  };
}

function canMove(entity, dir) {
  const tile = nextTile(entity, dir);
  if (isDoor(tile.x, tile.y) && entity.type !== "ghost") {
    return false;
  }
  return !isWall(tile.x, tile.y);
}

function bfs(start, target) {
  const queue = [start];
  const visited = new Set([tileKey(start.x, start.y)]);
  const parent = new Map();

  while (queue.length) {
    const current = queue.shift();
    if (current.x === target.x && current.y === target.y) {
      break;
    }
    const neighbors = [DIRS.left, DIRS.right, DIRS.up, DIRS.down];
    for (const dir of neighbors) {
      const nx = current.x + dir.x;
      const ny = current.y + dir.y;
      if (isWall(nx, ny) || isDoor(nx, ny)) {
        continue;
      }
      const key = tileKey(nx, ny);
      if (visited.has(key)) {
        continue;
      }
      visited.add(key);
      parent.set(key, current);
      queue.push({ x: nx, y: ny });
    }
  }

  const path = [];
  let step = target;
  let stepKey = tileKey(step.x, step.y);
  if (!parent.has(stepKey) && (step.x !== start.x || step.y !== start.y)) {
    return path;
  }
  while (step && !(step.x === start.x && step.y === start.y)) {
    path.unshift(step);
    stepKey = tileKey(step.x, step.y);
    step = parent.get(stepKey);
  }
  return path;
}

const pacStart = centerOf(13, 23);

const pacman = {
  type: "pacman",
  x: pacStart.x,
  y: pacStart.y,
  dir: DIRS.left,
  nextDir: DIRS.left,
  speed: 90,
  lives: 3,
};

const ghosts = [
  { name: "Blinky", color: "#ff0000", tile: { x: 13, y: 11 } },
  { name: "Pinky", color: "#ffb8ff", tile: { x: 13, y: 14 } },
  { name: "Inky", color: "#00ffff", tile: { x: 12, y: 14 } },
  { name: "Clyde", color: "#ffb852", tile: { x: 15, y: 14 } },
].map((ghost) => {
  const position = centerOf(ghost.tile.x, ghost.tile.y);
  return {
    ...ghost,
    type: "ghost",
    x: position.x,
    y: position.y,
    dir: DIRS.left,
    speed: 80,
    path: [],
  };
});

let score = 0;
let paused = false;
let lastTime = 0;

function updateScore() {
  document.getElementById("score").textContent = `SCORE ${String(score).padStart(5, "0")}`;
  document.getElementById("lives").textContent = `LIVES ${pacman.lives}`;
}

function handleInput() {
  window.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") pacman.nextDir = DIRS.left;
    if (event.key === "ArrowRight") pacman.nextDir = DIRS.right;
    if (event.key === "ArrowUp") pacman.nextDir = DIRS.up;
    if (event.key === "ArrowDown") pacman.nextDir = DIRS.down;
    if (event.key.toLowerCase() === "p") paused = !paused;
  });
}

function moveEntity(entity, dt) {
  if (entity.type === "pacman" && atCenter(entity)) {
    if (canMove(entity, entity.nextDir)) {
      entity.dir = entity.nextDir;
    }
    if (!canMove(entity, entity.dir)) {
      entity.dir = { x: 0, y: 0 };
    }
  }
  if (entity.type === "ghost" && atCenter(entity)) {
    const targetTile = tileFromPosition(pacman.x, pacman.y);
    const currentTile = tileFromPosition(entity.x, entity.y);
    entity.path = bfs(currentTile, targetTile);
    if (entity.path.length) {
      const next = entity.path[0];
      entity.dir = {
        x: Math.sign(next.x - currentTile.x),
        y: Math.sign(next.y - currentTile.y),
      };
    }
  }

  entity.x += entity.dir.x * entity.speed * dt;
  entity.y += entity.dir.y * entity.speed * dt;
  wrapPosition(entity);
}

function eatPellet() {
  const tile = tileFromPosition(pacman.x, pacman.y);
  const key = tileKey(tile.x, tile.y);
  if (pellets.has(key)) {
    pellets.delete(key);
    score += 10;
  }
  if (powerPellets.has(key)) {
    powerPellets.delete(key);
    score += 50;
  }
}

function update(dt) {
  moveEntity(pacman, dt);
  for (const ghost of ghosts) {
    moveEntity(ghost, dt);
  }
  eatPellet();
  updateScore();
}

function drawMaze() {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const tile = MAZE[y][x];
      if (tile === "#") {
        ctx.fillStyle = "#1a1aff";
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
      if (tile === "=") {
        ctx.fillStyle = "#ffb8ff";
        ctx.fillRect(x * TILE, y * TILE + TILE / 2 - 1, TILE, 2);
      }
    }
  }
}

function drawPellets() {
  ctx.fillStyle = "#ffb897";
  for (const key of pellets) {
    const [x, y] = key.split(",").map(Number);
    ctx.beginPath();
    ctx.arc(x * TILE + TILE / 2, y * TILE + TILE / 2, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#ffffff";
  for (const key of powerPellets) {
    const [x, y] = key.split(",").map(Number);
    ctx.beginPath();
    ctx.arc(x * TILE + TILE / 2, y * TILE + TILE / 2, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPacman() {
  ctx.fillStyle = "#ffeb3b";
  ctx.beginPath();
  ctx.arc(pacman.x, pacman.y, TILE / 2 - 1, 0.2, Math.PI * 1.8);
  ctx.lineTo(pacman.x, pacman.y);
  ctx.fill();
}

function drawGhost(ghost) {
  ctx.fillStyle = ghost.color;
  ctx.beginPath();
  ctx.arc(ghost.x, ghost.y, TILE / 2 - 1, Math.PI, 0);
  ctx.lineTo(ghost.x + TILE / 2 - 1, ghost.y + TILE / 2 - 1);
  ctx.lineTo(ghost.x - TILE / 2 + 1, ghost.y + TILE / 2 - 1);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(ghost.x - 4, ghost.y - 2, 2, 0, Math.PI * 2);
  ctx.arc(ghost.x + 4, ghost.y - 2, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawPaths() {
  for (const ghost of ghosts) {
    if (!ghost.path.length) continue;
    ctx.strokeStyle = ghost.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ghost.x, ghost.y);
    for (const tile of ghost.path) {
      const point = centerOf(tile.x, tile.y);
      ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
  }
}

function drawPauseOverlay() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.font = "16px 'Press Start 2P', monospace";
  ctx.textAlign = "center";
  ctx.fillText("PAUSED", canvas.width / 2, canvas.height / 2 - 10);
  ctx.font = "10px 'Press Start 2P', monospace";
  ctx.fillText("Ghost path vectors shown", canvas.width / 2, canvas.height / 2 + 12);
}

function render() {
  drawMaze();
  drawPellets();
  drawPacman();
  for (const ghost of ghosts) {
    drawGhost(ghost);
  }
  if (paused) {
    drawPaths();
    drawPauseOverlay();
  }
}

function loop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;
  if (!paused) {
    update(dt);
  }
  render();
  requestAnimationFrame(loop);
}

  initPellets();
  updateScore();
  handleInput();
  requestAnimationFrame(loop);
});
