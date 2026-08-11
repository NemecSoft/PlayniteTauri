// 恐怖谷里的树：用 InstancedMesh 一次画一堆树，低开销。
// 树分两段：树干（深褐色圆柱）+ 树冠（绿色锥），组合成一个简单的低模树。

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { ValleyHeightMap } from "../../utils/planet/valleyTerrain";
import type { TreeSpot } from "../../utils/planet/valleyTrees";

interface Props {
  trees: TreeSpot[];
  heightMap: ValleyHeightMap;
}

const TREE_H = 3; // 总高

export default function HorrorValleyTrees({ trees, heightMap }: Props) {
  const { size, half, heights } = heightMap;
  const cell = (half * 2) / size;

  // 给每棵树预先算好位置（贴到地形上）和最终矩阵。
  const matrices = useMemo(() => {
    const arr: { matrix: THREE.Matrix4 }[] = [];
    for (const t of trees) {
      const gx = Math.round((t.x + half) / cell);
      const gz = Math.round((t.z + half) / cell);
      const y = heights[gz * size + gx] ?? 0;
      const m = new THREE.Matrix4();
      m.compose(
        new THREE.Vector3(t.x, y, t.z),
        new THREE.Quaternion(),
        new THREE.Vector3(t.scale, t.scale, t.scale),
      );
      arr.push({ matrix: m });
    }
    return arr;
  }, [trees, size, half, heights, cell]);

  // 树干的 InstancedMesh
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const crownRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    const tm = trunkRef.current;
    const cm = crownRef.current;
    if (!tm || !cm) return;
    for (let i = 0; i < matrices.length; i++) {
      const m = matrices[i].matrix;
      tm.setMatrixAt(i, m);
      // 树冠在树干上方
      const crownM = new THREE.Matrix4().compose(
        new THREE.Vector3(0, TREE_H * 0.55, 0),
        new THREE.Quaternion(),
        new THREE.Vector3(1, 1, 1),
      );
      crownM.multiply(m);
      cm.setMatrixAt(i, crownM);
    }
    tm.instanceMatrix.needsUpdate = true;
    cm.instanceMatrix.needsUpdate = true;
  }, [matrices]);

  if (matrices.length === 0) return null;

  return (
    <group>
      <instancedMesh ref={trunkRef} args={[undefined, undefined, matrices.length]}>
        <cylinderGeometry args={[0.18, 0.25, TREE_H * 0.6, 6]} />
        <meshStandardMaterial color="#5b3a1f" />
      </instancedMesh>
      <instancedMesh ref={crownRef} args={[undefined, undefined, matrices.length]}>
        <coneGeometry args={[1.1, TREE_H * 1.2, 6]} />
        <meshStandardMaterial color="#2d5a2d" />
      </instancedMesh>
    </group>
  );
}