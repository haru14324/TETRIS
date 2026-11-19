
// ==========================================
// NEON TETRIS - GAME ENGINE
// ==========================================

const canvas = document.getElementById("tetris");
const ctx = canvas.getContext("2d");

const nextCanvas = document.getElementById("next");
const nextCtx = nextCanvas.getContext("2d");

const scoreElement = document.getElementById("score");
const levelElement = document.getElementById("level");
const linesElement = document.getElementById("lines");

const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");

const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const restartBtn = document.getElementById("restartBtn");

// ==========================================
// CONFIGURATION
// ==========================================

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  "#00E5FF", // I
  "#3478FF", // J
  "#FF9F43", // L
  "#FFE66D", // O
  "#B967FF", // S
  "#F54291", // T
  "#45E879"  // Z
];

const SHAPES = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ],
  J: [
    [2, 0, 0],
    [2, 2, 2],
    [0, 0, 0]
  ],
  L: [
    [0, 0, 3],
    [3, 3, 3],
    [0, 0, 0]
  ],
  O: [
    [4, 4],
    [4, 4]
  ],
  S: [
    [0, 5, 5],
    [5, 5, 0],
    [0, 0, 0]
  ],
  T: [
    [0, 6, 0],
    [6, 6, 6],
    [0, 0, 0]
  ],
  Z: [
    [7, 7, 0],
    [0, 7, 7],
    [0, 0, 0]
  ]
};

// ==========================================
// GAME STATE
// ==========================================

let arena;
let player;
let nextPiece;

let score = 0;
let lines = 0;
let level = 1;

let running = false;
let gameOver = false;

let dropCounter = 0;
let dropInterval = 800;
let lastTime = 0;

let bag = [];

const LINE_SCORES = [0, 100, 300, 500, 800];

// ==========================================
// MATRIX FUNCTIONS
// ==========================================

function createMatrix(width, height) {
  return Array.from(
    { length: height },
    () => Array(width).fill(0)
  );
}

function cloneMatrix(matrix) {
  return matrix.map(row => [...row]);
}

function createPiece(type) {
  return cloneMatrix(SHAPES[type]);
}

// Seven-bag randomizer: each set contains
// all seven pieces before repeating.

function getRandomPiece() {
  if (bag.length === 0) {
    bag = Object.keys(SHAPES);

    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
  }

  return createPiece(bag.pop());
}

// ==========================================
// DRAWING
// ==========================================

function drawBlock(context, x, y, color, ghost = false) {
  context.save();

  if (ghost) {
    context.fillStyle = color + "22";
    context.strokeStyle = color;
    context.lineWidth = 1.5;

    context.fillRect(x, y, BLOCK, BLOCK);
    context.strokeRect(x + 2, y + 2, BLOCK - 4, BLOCK - 4);

  } else {
    context.fillStyle = color;
    context.shadowColor = color;
    context.shadowBlur = 9;

    context.fillRect(x + 1, y + 1, BLOCK - 2, BLOCK - 2);

    context.shadowBlur = 0;

    context.fillStyle = "#FFFFFF55";
    context.fillRect(x + 4, y + 4, BLOCK - 8, 3);

    context.fillStyle = "#00000025";
    context.fillRect(x + 4, y + BLOCK - 7, BLOCK - 8, 3);
  }

  context.restore();
}

function drawMatrix(matrix, offset, context = ctx, ghost = false) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (!value) return;

      const color = COLORS[value];

      drawBlock(
        context,
        (x + offset.x) * BLOCK,
        (y + offset.y) * BLOCK,
        color,
        ghost
      );
    });
  });
}

function drawGrid() {
  ctx.strokeStyle = "#17223B";
  ctx.lineWidth = 0.6;

  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * BLOCK, 0);
    ctx.lineTo(x * BLOCK, canvas.height);
    ctx.stroke();
  }

  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * BLOCK);
    ctx.lineTo(canvas.width, y * BLOCK);
    ctx.stroke();
  }
}

function drawNext() {
  nextCtx.clearRect(0, 0, 120, 120);

  const matrix = nextPiece;

  const width = matrix[0].length;
  const height = matrix.length;

  const offsetX = (120 - width * 24) / 2;
  const offsetY = (120 - height * 24) / 2;

  nextCtx.save();
  nextCtx.translate(offsetX, offsetY);

  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (!value) return;

      const color = COLORS[value];

      nextCtx.fillStyle = color;
      nextCtx.shadowColor = color;
      nextCtx.shadowBlur = 8;

      nextCtx.fillRect(
        x * 24 + 2,
        y * 24 + 2,
        20,
        20
      );
    });
  });

  nextCtx.restore();
}

function draw() {
  ctx.fillStyle = "#070B16";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawGrid();

  drawMatrix(arena, { x: 0, y: 0 });

  if (player.matrix) {
    const ghost = {
      matrix: player.matrix,
      pos: {
        x: player.pos.x,
        y: getGhostY()
      }
    };

    drawMatrix(ghost.matrix, ghost.pos, ctx, true);
    drawMatrix(player.matrix, player.pos);
  }
}

// ==========================================
// COLLISION
// ==========================================

function collide(arena, piece) {
  const matrix = piece.matrix;
  const pos = piece.pos;

  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < matrix[y].length; x++) {

      if (!matrix[y][x]) continue;

      const boardX = x + pos.x;
      const boardY = y + pos.y;

      if (
        boardX < 0 ||
        boardX >= COLS ||
        boardY >= ROWS ||
        boardY < 0
      ) {
        return true;
      }

      if (arena[boardY][boardX] !== 0) {
        return true;
      }
    }
  }

  return false;
}

// ==========================================
// PIECE MOVEMENT
// ==========================================

function move(dir) {
  if (!running || gameOver) return;

  player.pos.x += dir;

  if (collide(arena, player)) {
    player.pos.x -= dir;
  }
}

function rotateMatrix(matrix, direction) {
  const n = matrix.length;

  for (let y = 0; y < n; y++) {
    for (let x = 0; x < y; x++) {
      [matrix[x][y], matrix[y][x]] =
        [matrix[y][x], matrix[x][y]];
    }
  }

  if (direction > 0) {
    matrix.forEach(row => row.reverse());
  } else {
    matrix.reverse();
  }
}

function rotatePlayer(direction) {
  if (!running || gameOver) return;

  const originalX = player.pos.x;
  const originalMatrix = cloneMatrix(player.matrix);

  rotateMatrix(player.matrix, direction);

  // Simple wall kicks.
  const kicks = [0, -1, 1, -2, 2];

  for (const kick of kicks) {
    player.pos.x = originalX + kick;

    if (!collide(arena, player)) {
      return;
    }
  }

  player.matrix = originalMatrix;
  player.pos.x = originalX;
}

// ==========================================
// GHOST PIECE
// ==========================================

function getGhostY() {
  const originalY = player.pos.y;

  while (!collide(arena, {
    matrix: player.matrix,
    pos: {
      x: player.pos.x,
      y: player.pos.y + 1
    }
  })) {
    player.pos.y++;
  }

  const ghostY = player.pos.y;

  player.pos.y = originalY;

  return ghostY;
}

// ==========================================
// LOCK AND MERGE
// ==========================================

function merge() {
  player.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (!value) return;

      arena[y + player.pos.y][x + player.pos.x] = value;
    });
  });
}

function lockPiece() {
  merge();

  clearLines();

  spawnPiece();
}

function playerDrop() {
  if (!running || gameOver) return;

  player.pos.y++;

  if (collide(arena, player)) {
    player.pos.y--;
    lockPiece();
  }

  dropCounter = 0;
}

function hardDrop() {
  if (!running || gameOver) return;

  let distance = 0;

  while (!collide(arena, {
    matrix: player.matrix,
    pos: {
      x: player.pos.x,
      y: player.pos.y + 1
    }
  })) {
    player.pos.y++;
    distance++;
  }

  score += distance * 2;

  updateStats();
  lockPiece();

  dropCounter = 0;
}

// ==========================================
// LINE CLEARING AND SCORING
// ==========================================

function clearLines() {
  let cleared = 0;

  outer:
  for (let y = ROWS - 1; y >= 0; y--) {

    for (let x = 0; x < COLS; x++) {
      if (arena[y][x] === 0) {
        continue outer;
      }
    }

    arena.splice(y, 1);
    arena.unshift(Array(COLS).fill(0));

    cleared++;
    y++;
  }

  if (cleared > 0) {
    score += LINE_SCORES[cleared] * level;
    lines += cleared;

    level = Math.floor(lines / 10) + 1;

    dropInterval = Math.max(
      100,
      800 * Math.pow(0.85, level - 1)
    );

    updateStats();
  }
}

// ==========================================
// SPAWNING PIECES
// ==========================================

function spawnPiece() {
  player.matrix = nextPiece;
  nextPiece = getRandomPiece();

  player.pos.y = 0;
  player.pos.x = Math.floor(
    (COLS - player.matrix[0].length) / 2
  );

  drawNext();

  if (collide(arena, player)) {
    endGame();
  }
}

// ==========================================
// GAME STATE
// ==========================================

function updateStats() {
  scoreElement.textContent = score.toLocaleString();
  levelElement.textContent = level;
  linesElement.textContent = lines;
}

function showOverlay(title, message, buttonText) {
  overlayTitle.textContent = title;
  overlayText.textContent = message;
  startBtn.textContent = buttonText;

  overlay.classList.remove("hidden");
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

function startGame() {
  if (gameOver) {
    resetGame();
  }

  running = true;
  hideOverlay();

  pauseBtn.textContent = "PAUSE";
  lastTime = performance.now();
}

function pauseGame() {
  if (gameOver) return;

  if (running) {
    running = false;
    pauseBtn.textContent = "RESUME";

    showOverlay(
      "PAUSED",
      "Take a break!",
      "RESUME"
    );

  } else {
    startGame();
  }
}

function endGame() {
  running = false;
  gameOver = true;

  showOverlay(
    "GAME OVER",
    "Final Score: " + score.toLocaleString(),
    "PLAY AGAIN"
  );

  pauseBtn.textContent = "PAUSE";
}

function resetGame() {
  arena = createMatrix(COLS, ROWS);

  score = 0;
  lines = 0;
  level = 1;

  dropCounter = 0;
  dropInterval = 800;

  running = false;
  gameOver = false;

  bag = [];

  player = {
    pos: { x: 0, y: 0 },
    matrix: null
  };

  nextPiece = getRandomPiece();

  spawnPiece();

  updateStats();
  draw();

  pauseBtn.textContent = "PAUSE";

  showOverlay(
    "READY?",
    "Let's play Tetris!",
    "START GAME"
  );
}

// ==========================================
// KEYBOARD CONTROLS
// ==========================================

document.addEventListener("keydown", event => {
  const key = event.key;

  const handled = [
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    " ",
    "p",
    "P",
    "r",
    "R"
  ];

  if (handled.includes(key)) {
    event.preventDefault();
  }

  if (key === "r" || key === "R") {
    resetGame();
    return;
  }

  if (key === "p" || key === "P") {
    pauseGame();
    return;
  }

  if (!running) return;

  switch (key) {
    case "ArrowLeft":
      move(-1);
      break;

    case "ArrowRight":
      move(1);
      break;

    case "ArrowDown":
      playerDrop();
      break;

    case "ArrowUp":
      rotatePlayer(1);
      break;

    case " ":
      hardDrop();
      break;
  }
});

// ==========================================
// MOBILE CONTROLS
// ==========================================

document.querySelectorAll("[data-action]").forEach(button => {
  button.addEventListener("click", () => {
    const action = button.dataset.action;

    switch (action) {
      case "left":
        move(-1);
        break;

      case "right":
        move(1);
        break;

      case "rotate":
        rotatePlayer(1);
        break;

      case "down":
        playerDrop();
        break;

      case "drop":
        hardDrop();
        break;
    }
  });
});

// ==========================================
// BUTTON EVENTS
// ==========================================

startBtn.addEventListener("click", startGame);

pauseBtn.addEventListener("click", pauseGame);

restartBtn.addEventListener("click", resetGame);

// ==========================================
// MAIN GAME LOOP
// ==========================================

function update(time = 0) {
  // Limit large time jumps after switching tabs.
  const deltaTime = Math.min(time - lastTime, 100);
  lastTime = time;

  if (running) {
    dropCounter += deltaTime;

    if (dropCounter >= dropInterval) {
      playerDrop();
    }
  }

  draw();

  requestAnimationFrame(update);
}

// ==========================================
// INITIALIZE
// ==========================================

resetGame();
requestAnimationFrame(update);
