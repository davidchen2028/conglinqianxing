/**
 * 战争迷雾（Fog of War）
 * - unexplored：从未见过
 * - explored：曾进入玩家视野，当前不可见
 * - visible：当前帧在玩家视野内
 */

export class FogOfWar {
  /**
   * @param {number} cols 网格列数
   * @param {number} rows 网格行数
   */
  constructor(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    this.explored = Array.from({ length: rows }, () =>
      Array(cols).fill(false)
    );
    this.visible = Array.from({ length: rows }, () =>
      Array(cols).fill(false)
    );
  }

  reset() {
    for (let r = 0; r < this.rows; r++) {
      this.explored[r].fill(false);
      this.visible[r].fill(false);
    }
  }

  /**
   * 根据玩家中心与视野半径（格数）更新可见/已探索
   */
  revealFromPlayer(grid, tileSize, px, py, visionTiles = 4) {
    for (let r = 0; r < this.rows; r++) {
      this.visible[r].fill(false);
    }

    const pCol = px / tileSize;
    const pRow = py / tileSize;
    const radiusSq = visionTiles * visionTiles;

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        if (grid[row][col] === 1) continue;
        const cx = col + 0.5;
        const cy = row + 0.5;
        const dCol = cx - pCol;
        const dRow = cy - pRow;
        if (dCol * dCol + dRow * dRow > radiusSq) continue;

        const wx = cx * tileSize;
        const wy = cy * tileSize;
        if (
          this._cellVisibleFrom(px, py, wx, wy, grid, tileSize, visionTiles)
        ) {
          this.visible[row][col] = true;
          this.explored[row][col] = true;
        }
      }
    }
  }

  _cellVisibleFrom(px, py, tx, ty, grid, tileSize, visionTiles) {
    const dist = Math.hypot(tx - px, ty - py);
    if (dist > visionTiles * tileSize * 1.2) return false;
    return this._lineClear(grid, tileSize, px, py, tx, ty);
  }

  _lineClear(grid, tileSize, x0, y0, x1, y1) {
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (tileSize * 0.3));
    if (steps < 1) return true;
    const sx = (x1 - x0) / steps;
    const sy = (y1 - y0) / steps;
    for (let i = 1; i < steps; i++) {
      const x = x0 + sx * i;
      const y = y0 + sy * i;
      const col = Math.floor(x / tileSize);
      const row = Math.floor(y / tileSize);
      if (row < 0 || col < 0 || row >= this.rows || col >= this.cols)
        return false;
      if (grid[row][col] === 1) return false;
    }
    return true;
  }

  /**
   * 在 canvas 上绘制迷雾层（在地图与实体之上）
   */
  draw(ctx, tileSize, offsetX, offsetY) {
    const w = this.cols * tileSize;
    const h = this.rows * tileSize;

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const explored = this.explored[row][col];
        const visible = this.visible[row][col];
        if (visible) continue;

        const x = offsetX + col * tileSize;
        const y = offsetY + row * tileSize;

        if (!explored) {
          ctx.fillStyle = "rgba(8, 12, 8, 0.92)";
        } else {
          ctx.fillStyle = "rgba(18, 28, 18, 0.72)";
        }
        ctx.fillRect(x, y, tileSize, tileSize);
      }
    }

    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 1;
    ctx.strokeRect(offsetX, offsetY, w, h);
  }
}
