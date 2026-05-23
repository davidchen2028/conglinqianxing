"""
《丛林潜行》后端：关卡地图以二维 Grid 数组存储，供前端 API 加载。
Grid 编码：0=可通行草地，1=障碍（树木/墙体）
"""

import json
from pathlib import Path

from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS

BASE_DIR = Path(__file__).resolve().parent
LEVELS_PATH = BASE_DIR / "data" / "levels.json"

app = Flask(__name__, static_folder="static", static_url_path="/static")
CORS(app)


def load_levels_data():
    with open(LEVELS_PATH, encoding="utf-8") as f:
        return json.load(f)


@app.route("/")
def index():
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/api/levels")
def list_levels():
    """返回关卡列表（不含完整 grid，便于选关界面）。"""
    data = load_levels_data()
    summary = []
    for lv in data["levels"]:
        rows = len(lv["grid"])
        cols = len(lv["grid"][0]) if rows else 0
        summary.append(
            {
                "id": lv["id"],
                "name": lv["name"],
                "width": cols,
                "height": rows,
                "guardCount": len(lv.get("guards", [])),
            }
        )
    return jsonify({"levels": summary})


@app.route("/api/levels/<int:level_id>")
def get_level(level_id):
    """返回指定关卡的完整数据（含 grid 二维数组）。"""
    data = load_levels_data()
    for lv in data["levels"]:
        if lv["id"] == level_id:
            return jsonify(lv)
    return jsonify({"error": "关卡不存在"}), 404


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5050, debug=True)
