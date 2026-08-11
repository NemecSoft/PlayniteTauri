// 恐怖谷的地形：一块起伏的网格地面，中间是山谷草地，四周是山脉，还有一条河。
// 高度数据来自纯函数 generateValleyHeightMap，这里只负责把它画出来。
// 用顶点色区分草地/山脉/河流，避免贴图资源。

import { useMemo } from "react";
import * as THREE from "three";
import type { ValleyHeightMap } from "../../utils/planet/valleyTerrain";

interface Props {
  heightMap: ValleyHeightMap;
}

export default function HorrorValleyTerrain({ heightMap }: Props) {
  const { size, half, heights } = heightMap;

  // 根据高度图生成网格的顶点、顶点色和下标。
  const geo = useMemo(() => {
    const cell = (half * 2) / size;
    const geometry = new THREE.PlaneGeometry(half * 2, half * 2, size - 1, size - 1);
    geometry.rotateX(-Math.PI / 2); // 把平面从 XY 翻到 XZ，让 Y 朝上
    const pos = geometry.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    // 优先级：道路 > 河流 > 山脉 > 草地
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const gx = Math.round((x + half) / cell);
      const gz = Math.round((z + half) / cell);
      const gi = gz * size + gx;
      const h = heights[gi] ?? 0;
      pos.setY(i, h);
      const isRoad = heightMap.isRoadMask[gi] === 1;
      const riverDist = Math.abs((x + z) / (half * 2));
      let col: [number, number, number];
      if (isRoad) {
        col = [0.45, 0.42, 0.38]; // 道路深灰
      } else if (riverDist < 0.06) {
        col = [0.2, 0.4, 0.7];
      } else if (h > 6) {
        col = [0.4, 0.36, 0.32];
      } else {
        col = [0.3, 0.55, 0.3];
      }
      colors[i * 3] = col[0];
      colors[i * 3 + 1] = col[1];
      colors[i * 3 + 2] = col[2];
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    return geometry;
  }, [size, half, heights, heightMap.isRoadMask]);

  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial vertexColors roughness={1} metalness={0} />
    </mesh>
  );
}
