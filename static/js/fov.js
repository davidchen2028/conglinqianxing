/**
 * 圆锥形视野（手电筒扇形）碰撞检测
 * 使用敌人坐标、朝向角、半角与射程，判断目标点是否在扇形内且视线无遮挡。
 */

const TAU = Math.PI * 2;

/** 将角度差归一化到 [-π, π] */
export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}

/**
 * 点 (tx, ty) 是否在从 (ox, oy) 出发的扇形内（仅角度与距离，不含遮挡）
 * @param {number} ox 观察者世界 X
 * @param {number} oy 观察者世界 Y
 * @param {number} facing 朝向弧度
 * @param {number} halfFovRad 半开角（弧度）
 * @param {number} range 最大距离（像素）
 */
export function isInCone(tx, ty, ox, oy, facing, halfFovRad, range) {
  const dx = tx - ox;
  const dy = ty - oy;
  const distSq = dx * dx + dy * dy;
  if (distSq > range * range) return false;
  if (distSq < 1e-6) return true;
  const angleToTarget = Math.atan2(dy, dx);
  return Math.abs(angleDiff(angleToTarget, facing)) <= halfFovRad;
}

/**
 * 网格 DDA 视线检测：从 (x0,y0) 到 (x1,y1) 是否被墙（cell===1）阻挡
 * @param {number[][]} grid
 * @param {number} tileSize
 */
export function hasLineOfSight(grid, tileSize, x0, y0, x1, y1) {
  const cols = grid[0].length;
  const rows = grid.length;
  const maxCol = cols - 1;
  const maxRow = rows - 1;

  let x = x0;
  let y = y0;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return true;

  const steps = Math.ceil(dist / (tileSize * 0.25));
  const stepX = dx / steps;
  const stepY = dy / steps;

  for (let i = 1; i <= steps; i++) {
    x = x0 + stepX * i;
    y = y0 + stepY * i;
    const col = Math.floor(x / tileSize);
    const row = Math.floor(y / tileSize);
    if (col < 0 || row < 0 || col > maxCol || row > maxRow) continue;
    if (grid[row][col] === 1) return false;
  }
  return true;
}

/**
 * 扇形 + 视线：玩家是否被该守卫的手电筒照到
 */
export function isSpottedByGuard(guard, playerX, playerY, grid, tileSize) {
  const halfRad = ((guard.fovDeg || 55) / 2) * (Math.PI / 180);
  const range = (guard.rangeTiles || 5) * tileSize;
  const gx = guard.x;
  const gy = guard.y;

  if (!isInCone(playerX, playerY, gx, gy, guard.facing, halfRad, range)) {
    return false;
  }
  return hasLineOfSight(grid, tileSize, gx, gy, playerX, playerY);
}

/**
 * 扇形顶点（用于绘制手电筒光锥）
 */
export function coneArcPoints(ox, oy, facing, halfFovRad, range, segments = 24) {
  const pts = [[ox, oy]];
  const start = facing - halfFovRad;
  const end = facing + halfFovRad;
  const step = (end - start) / segments;
  for (let i = 0; i <= segments; i++) {
    const a = start + step * i;
    pts.push([ox + Math.cos(a) * range, oy + Math.sin(a) * range]);
  }
  return pts;
}
