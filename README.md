# 帕尔马湾 · Palma Bay

在日落大道拦下一辆跑车，去冲印室取胶片，赶在倒计时结束前把它送到露天影院。路过南滩时，也可以停下来打一局三分制排球。

**[在线试玩](https://daifengxin.github.io/palma-bay/) · [下载离线版 ZIP](https://github.com/daifengxin/palma-bay/releases/latest/download/palma-bay.zip)**

用桌面 Chrome 打开在线版，或解压 ZIP 并双击里面的 `palma-bay.html`。按 **Enter** 进入自由探索，按 **M** 打开海湾地图，选一个目的地开始玩。

| 想做什么 | 操作 |
| --- | --- |
| 逛街、冲刺、跳跃 | WASD 移动，Shift 冲刺，空格跳跃，拖动鼠标环视 |
| 拦下一辆车 | 靠近来车按 E，等车停稳，走到左侧车门再按 E |
| 驾驶 | W 加速，S 刹车或倒车，A／D 转向，空格手刹，V 切换视角 |
| 参加活动 | 按 M 找到胶片配送、沙滩排球、海堤计时赛和海岸摄影，到场按 F 开始 |
| 探索街区 | Z 向行人打招呼，开车按 N 鸣笛。便利店、地下改装车库和街头互动随时可探索 |

## 日落大道的新互动

打开右上角的「声音」，从日落大道的路边泊位出发。东侧人行道上有消防栓、邮筒和路灯，沿街还有红色容器。开车撞断消防栓，水会一直从原井座喷出。附近容器可以接连引爆，冲击波会推开车辆和路人。去海滩还可以撞倒木围栏和遮阳伞。

## 本地开发

克隆仓库后，在根目录执行 `python3 -m http.server 8000`，用浏览器访问 `http://localhost:8000`。城市使用 WebGL，角色使用随仓库附带的 Three.js。街景材质也在仓库内。

```sh
node --test test/*.cjs
python3 build-offline.py ../palma-bay.html --textures textures
```

[架构与玩法说明](architecture.md) · [模型、材质及第三方库署名](credits.html)
