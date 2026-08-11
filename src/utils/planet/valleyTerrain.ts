// 用噪声生成恐怖谷地图的高度图。核心思路：中心区域（山谷）用低振幅噪声，起伏
// 平缓适合开车；四周边缘用高振幅噪声，形成围合的山脉。这样一眼望去就是"被山
// 围起来的一块山谷"，符合"恐怖谷"的观感。

export interface ValleyHeightMap {
  size: number;
  half: number; // 地图半边长（世界单位）
  heights: Float32Array; // size*size，行主序
}

// 简单伪随机噪声：用正弦叠加做伪随机，够用且不引额外依赖。
function pseudoNoise(x: number, z: number, seed: number): number {
  const s = Math.sin(x * 12.9898 + z * 78.233 + seed * 37.719) * 43758.5453;
  return s - Math.floor(s); // 取小数部分，得到 0~1
}

/** 生成 size×size 的高度图，half 是半边长（世界单位）。 */
export function generateValleyHeightMap(size: number, half: number): ValleyHeightMap {
  const heights = new Float32Array(size * size);
  const cell = (half * 2) / size;
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      // 把网格下标换算成世界坐标（居中，地图中心在原点）
      const x = -half + j * cell;
      const z = -half + i * cell;
      // 到地图中心的距离比例（0 是中心，1 是边缘）
      const r = Math.hypot(x, z) / half;
      // 低频起伏（山谷底的丘陵，振幅小，适合开车）
      const valley = 0.6 * Math.sin(x * 0.05) * Math.cos(z * 0.05);
      // 边缘山脉：越靠边越高，形成围合
      const mountains = Math.max(0, r - 0.5) * 18;
      // 一点细节噪声，让地面不那么平
      const detail = (pseudoNoise(x * 0.1, z * 0.1, 1) - 0.5) * 1.2;
      heights[i * size + j] = valley + mountains + detail;
    }
  }
  return { size, half, heights };
}
