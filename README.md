# 丛林潜行

迷彩军事写实风格的 2D 潜行游戏：**战争迷雾** + **圆锥形手电筒视野（FOV）**。

## 玩法

- 使用 **WASD** 在丛林地图中移动（未探索区域被迷雾遮挡）。
- 巡逻敌人携带手电筒，视野为**扇形区域**；进入扇形且与敌人之间**无墙体遮挡**即任务失败。
- 潜行至**金色机密文件**处拾取，再返回**起点绿色虚线框**撤离。

## 技术实现

| 层级 | 说明 |
|------|------|
| **Python / Flask** | `data/levels.json` 存储多关卡 `grid[][]`（0=草地，1=障碍）及巡逻兵、文件坐标；`GET /api/levels`、`GET /api/levels/<id>` |
| **`static/js/fog.js`** | `FogOfWar`：探索记忆 + 玩家圆形视野 + 射线遮挡 |
| **`static/js/fov.js`** | `isInCone`（距离 + `atan2` 夹角）、`hasLineOfSight`（网格采样）、`isSpottedByGuard` |
| **`static/js/game.js`** | Canvas 渲染、巡逻、胜负判定 |

## 运行

```bash
cd 丛林潜行
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

浏览器打开：<http://127.0.0.1:5050>

## Grid 编码

- `0` — 可通行草地  
- `1` — 树木/障碍（阻挡移动与视线）

关卡元数据还包括 `player`、`file`、`guards`（`fovDeg`、`rangeTiles`、`patrol` 路径点）。
