/**
 * 《丛林潜行》：迷雾与视野（FOV）
 * 绕过巡逻敌人手电筒，偷取机密文件；被照到即失败。
 */

import { isSpottedByGuard, coneArcPoints } from "./fov.js";
import { FogOfWar } from "./fog.js";

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

const TILE = 32;
const PLAYER_SPEED = 2.4;
const PLAYER_RADIUS = 10;
const VISION_TILES = 4.5;
const PICKUP_DIST = 22;

const keys = { w: false, a: false, s: false, d: false };

let gameState = "menu";
let frameId = null;
let levelList = [];
let currentLevel = null;
let grid = [];
let cols = 0;
let rows = 0;
let mapOffsetX = 0;
let mapOffsetY = 0;

const player = { x: 0, y: 0, hasFile: false };
let filePos = { x: 0, y: 0 };
const guards = [];
let fog = null;

const COLORS = {
  grass: ["#3a4f2f", "#2f4230", "#354a32"],
  wall: ["#1e2a1a", "#253020", "#1a2418"],
  camo: ["#4a5d3a", "#5c6b47", "#3d4f35"],
  file: "#c9a227",
  player: "#3d5c40",
  vest: "#2a3d2e",
};

function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = Math.floor(rect.width);
  canvas.height = Math.floor(rect.height);
  ctx.imageSmoothingEnabled = true;
  layoutMap();
}

function layoutMap() {
  if (!cols) return;
  const mapW = cols * TILE;
  const mapH = rows * TILE;
  mapOffsetX = Math.floor((canvas.width - mapW) / 2);
  mapOffsetY = Math.floor((canvas.height - mapH) / 2);
}

async function fetchLevelList() {
  const res = await fetch("/api/levels");
  const data = await res.json();
  levelList = data.levels || [];
  renderLevelButtons();
}

async function loadLevel(id) {
  const res = await fetch(`/api/levels/${id}`);
  if (!res.ok) throw new Error("关卡加载失败");
  currentLevel = await res.json();
  grid = currentLevel.grid;
  rows = grid.length;
  cols = grid[0].length;

  const ps = currentLevel.player;
  player.x = (ps.col + 0.5) * TILE;
  player.y = (ps.row + 0.5) * TILE;
  player.hasFile = false;

  const fs = currentLevel.file;
  filePos.x = (fs.col + 0.5) * TILE;
  filePos.y = (fs.row + 0.5) * TILE;

  guards.length = 0;
  (currentLevel.guards || []).forEach((g, i) => {
    const start = g.patrol[0];
    guards.push({
      id: i,
      col: start.col,
      row: start.row,
      x: (start.col + 0.5) * TILE,
      y: (start.row + 0.5) * TILE,
      facing: 0,
      fovDeg: g.fovDeg ?? 55,
      rangeTiles: g.rangeTiles ?? 5,
      patrol: g.patrol.map((p) => ({
        x: (p.col + 0.5) * TILE,
        y: (p.row + 0.5) * TILE,
      })),
      speed: g.speed ?? 0.018,
      patrolIndex: 0,
      t: Math.random(),
    });
  });

  fog = new FogOfWar(cols, rows);
  layoutMap();
}

function renderLevelButtons() {
  const container = document.getElementById("level-buttons");
  if (!container) return;
  container.innerHTML = "";
  levelList.forEach((lv) => {
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = `${lv.name}（${lv.guardCount} 名巡逻）`;
    btn.addEventListener("click", () => startLevel(lv.id));
    container.appendChild(btn);
  });
}

async function startLevel(id) {
  await loadLevel(id);
  gameState = "playing";
  document.getElementById("menu-screen").classList.add("hidden");
  document.getElementById("hud").classList.remove("hidden");
  document.getElementById("fail-screen").classList.add("hidden");
  document.getElementById("win-screen").classList.add("hidden");
  document.getElementById("level-name").textContent = currentLevel.name;
  lastTimestamp = 0;
  if (frameId) cancelAnimationFrame(frameId);
  frameId = requestAnimationFrame(loop);
}

function tileAtWorld(wx, wy) {
  const col = Math.floor(wx / TILE);
  const row = Math.floor(wy / TILE);
  if (col < 0 || row < 0 || col >= cols || row >= rows) return 1;
  return grid[row][col];
}

function canWalk(wx, wy) {
  const margin = PLAYER_RADIUS * 0.6;
  const points = [
    [wx - margin, wy],
    [wx + margin, wy],
    [wx, wy - margin],
    [wx, wy + margin],
  ];
  return points.every(([x, y]) => tileAtWorld(x, y) === 0);
}

function updatePlayer() {
  let dx = 0;
  let dy = 0;
  if (keys.w) dy -= 1;
  if (keys.s) dy += 1;
  if (keys.a) dx -= 1;
  if (keys.d) dx += 1;
  if (dx === 0 && dy === 0) return;

  const len = Math.hypot(dx, dy);
  dx = (dx / len) * PLAYER_SPEED;
  dy = (dy / len) * PLAYER_SPEED;

  const nx = player.x + dx;
  const ny = player.y + dy;
  if (canWalk(nx, player.y)) player.x = nx;
  if (canWalk(player.x, ny)) player.y = ny;
}

function updateGuards() {
  guards.forEach((g) => {
    g.t += g.speed;
    if (g.t >= 1) {
      g.t = 0;
      g.patrolIndex = (g.patrolIndex + 1) % g.patrol.length;
    }
    const t = g.t;
    const from = g.patrol[g.patrolIndex];
    const to = g.patrol[(g.patrolIndex + 1) % g.patrol.length];
    g.x = from.x + (to.x - from.x) * t;
    g.y = from.y + (to.y - from.y) * t;
    g.facing = Math.atan2(to.y - from.y, to.x - from.x);
  });
}

function checkDetection() {
  for (const g of guards) {
    if (isSpottedByGuard(g, player.x, player.y, grid, TILE)) {
      failMission("被手电筒发现！任务失败。");
      return;
    }
  }
}

function checkFilePickup() {
  if (player.hasFile) return;
  const d = Math.hypot(player.x - filePos.x, player.y - filePos.y);
  if (d < PICKUP_DIST) {
    player.hasFile = true;
    document.getElementById("objective").textContent = "携带文件撤离至起点";
    if (Math.hypot(player.x - spawnX(), player.y - spawnY()) < PICKUP_DIST) {
      winMission();
    }
  }
}

function checkExfil() {
  if (!player.hasFile) return;
  if (Math.hypot(player.x - spawnX(), player.y - spawnY()) < PICKUP_DIST * 1.5) {
    winMission();
  }
}

function spawnX() {
  return (currentLevel.player.col + 0.5) * TILE;
}
function spawnY() {
  return (currentLevel.player.row + 0.5) * TILE;
}

function failMission(msg) {
  gameState = "fail";
  document.getElementById("fail-msg").textContent = msg;
  document.getElementById("fail-screen").classList.remove("hidden");
  cancelAnimationFrame(frameId);
  frameId = null;
}

function winMission() {
  gameState = "win";
  document.getElementById("win-screen").classList.remove("hidden");
  cancelAnimationFrame(frameId);
  frameId = null;
}

function drawCamoRect(x, y, w, h, seed) {
  const n = 5;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = COLORS.camo[(seed + i) % COLORS.camo.length];
    ctx.fillRect(
      x + ((seed * 17 + i * 11) % (w - 4)),
      y + ((seed * 13 + i * 7) % (h - 4)),
      6 + (i % 3) * 4,
      4 + (i % 2) * 3
    );
  }
}

function drawMap() {
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = mapOffsetX + col * TILE;
      const y = mapOffsetY + row * TILE;
      const cell = grid[row][col];
      if (cell === 1) {
        ctx.fillStyle = COLORS.wall[row % COLORS.wall.length];
        ctx.fillRect(x, y, TILE, TILE);
        drawCamoRect(x + 2, y + 2, TILE - 4, TILE - 4, row * cols + col);
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fillRect(x, y + TILE - 6, TILE, 6);
      } else {
        ctx.fillStyle = COLORS.grass[(row + col) % COLORS.grass.length];
        ctx.fillRect(x, y, TILE, TILE);
        if ((row + col) % 3 === 0) {
          ctx.fillStyle = "rgba(60,80,50,0.35)";
          ctx.beginPath();
          ctx.arc(x + TILE / 2, y + TILE / 2, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
}

function drawFlashlight(guard) {
  const halfRad = (guard.fovDeg / 2) * (Math.PI / 180);
  const range = guard.rangeTiles * TILE;
  const ox = mapOffsetX + guard.x;
  const oy = mapOffsetY + guard.y;
  const pts = coneArcPoints(ox, oy, guard.facing, halfRad, range);
  const grad = ctx.createRadialGradient(ox, oy, 0, ox, oy, range);
  grad.addColorStop(0, "rgba(255, 230, 140, 0.45)");
  grad.addColorStop(0.5, "rgba(255, 200, 80, 0.22)");
  grad.addColorStop(1, "rgba(255, 180, 60, 0.02)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i][0], pts[i][1]);
  }
  ctx.closePath();
  ctx.fill();
}

function drawGuard(guard) {
  const x = mapOffsetX + guard.x;
  const y = mapOffsetY + guard.y;
  drawFlashlight(guard);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(guard.facing);
  ctx.fillStyle = "#2c3e2a";
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#8a7a4a";
  ctx.fillRect(6, -3, 14, 6);
  ctx.restore();
}

function drawPlayer() {
  const x = mapOffsetX + player.x;
  const y = mapOffsetY + player.y;
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.arc(x, y, PLAYER_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.vest;
  ctx.fillRect(x - 6, y - 4, 12, 8);
  if (player.hasFile) {
    ctx.fillStyle = COLORS.file;
    ctx.fillRect(x + 8, y - 5, 8, 10);
  }
}

function drawFile() {
  if (player.hasFile) return;
  const x = mapOffsetX + filePos.x;
  const y = mapOffsetY + filePos.y;
  const pulse = 0.85 + Math.sin(Date.now() / 300) * 0.15;
  ctx.fillStyle = COLORS.file;
  ctx.globalAlpha = pulse;
  ctx.fillRect(x - 8, y - 10, 16, 12);
  ctx.strokeStyle = "#8b6914";
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 8, y - 10, 16, 12);
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#1a1a12";
  ctx.font = "8px monospace";
  ctx.fillText("TOP", x - 10, y - 12);
}

function drawSpawnMarker() {
  const x = mapOffsetX + spawnX();
  const y = mapOffsetY + spawnY();
  ctx.strokeStyle = "rgba(100, 180, 100, 0.5)";
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(x - 14, y - 14, 28, 28);
  ctx.setLineDash([]);
}

function render() {
  ctx.fillStyle = "#0d120d";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (!currentLevel) return;

  drawMap();
  drawSpawnMarker();
  drawFile();
  guards.forEach(drawGuard);
  drawPlayer();

  fog.revealFromPlayer(grid, TILE, player.x, player.y, VISION_TILES);
  fog.draw(ctx, TILE, mapOffsetX, mapOffsetY);
}

let lastTimestamp = 0;

function loop(timestamp) {
  if (gameState !== "playing") return;
  const dt = lastTimestamp ? Math.min(timestamp - lastTimestamp, 50) : 16;
  lastTimestamp = timestamp;

  updatePlayer();
  updateGuards();
  checkDetection();
  checkFilePickup();
  checkExfil();
  render();

  frameId = requestAnimationFrame(loop);
}

function bindInput() {
  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (k in keys) {
      keys[k] = true;
      e.preventDefault();
    }
  });
  window.addEventListener("keyup", (e) => {
    const k = e.key.toLowerCase();
    if (k in keys) keys[k] = false;
  });

  document.querySelectorAll("[data-action='menu']").forEach((btn) => {
    btn.addEventListener("click", () => {
      gameState = "menu";
      document.getElementById("menu-screen").classList.remove("hidden");
      document.getElementById("fail-screen").classList.add("hidden");
      document.getElementById("win-screen").classList.add("hidden");
      document.getElementById("hud").classList.add("hidden");
    });
  });

  document.querySelectorAll("[data-action='retry']").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (currentLevel) startLevel(currentLevel.id);
    });
  });

  window.addEventListener("resize", resizeCanvas);
}

async function init() {
  resizeCanvas();
  bindInput();
  await fetchLevelList();
  render();
}

init();
