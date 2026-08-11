// 恐怖谷里的车：用 cannon-es 物理引擎做的可驾驶车辆。
// 不引入 @react-three/cannon 这类 React 绑定（更新慢、可能不兼容 React19/fiber9），
// 而是直接用 cannon-es 原生 API：在 useFrame 里推进物理世界，再把刚体的位置和
// 朝向同步回 three 的 group。键盘 WASD/方向键控制油门刹车和转向，相机跟在车后。
//
// 地形碰撞用 cannon 的 Trimesh（直接从高度图生成顶点和三角面），坐标天然和
// three 网格对齐，车能真实地翻越起伏地形。

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import * as CANNON from "cannon-es";
import type { ValleyHeightMap } from "../../utils/planet/valleyTerrain";

interface Props {
  heightMap: ValleyHeightMap;
  /** 每帧把车辆位置汇报给父组件，用于山洞触发判断。 */
  onPosition?: (pos: [number, number, number]) => void;
}

// 底盘尺寸（世界单位）
const CHASSIS = { w: 1.8, h: 0.7, l: 3.6 };

export default function HorrorValleyVehicle({ heightMap, onPosition }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera);

  // 物理世界和车辆只初始化一次。
  const physics = useMemo(() => createPhysics(heightMap), [heightMap]);

  // 记按键状态，供 useFrame 每帧读取。
  const keys = useRef({ fwd: false, back: false, left: false, right: false });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const down = e.type === "keydown";
      if (["w", "arrowup"].includes(k)) keys.current.fwd = down;
      else if (["s", "arrowdown"].includes(k)) keys.current.back = down;
      else if (["a", "arrowleft"].includes(k)) keys.current.left = down;
      else if (["d", "arrowright"].includes(k)) keys.current.right = down;
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, []);

  // 每帧：读按键 → 控制车辆 → 推进物理 → 同步位置 → 相机跟随。
  useFrame(() => {
    const { world, vehicle, chassis } = physics;
    const force = keys.current.fwd ? 400 : keys.current.back ? -200 : 0;
    const steer = keys.current.left ? 0.5 : keys.current.right ? -0.5 : 0;
    // 驱动轮（后轮）给力，前轮转向
    vehicle.applyEngineForce(force, 2);
    vehicle.applyEngineForce(force, 3);
    vehicle.setSteeringValue(steer, 0);
    vehicle.setSteeringValue(steer, 1);
    // 推进物理，再更新车轮变换
    world.step(1 / 60);
    vehicle.updateWheelTransform(0);
    vehicle.updateWheelTransform(1);
    vehicle.updateWheelTransform(2);
    vehicle.updateWheelTransform(3);

    // 把底盘位置/朝向同步到 three 的 group
    const g = groupRef.current;
    if (g) {
      g.position.set(chassis.position.x, chassis.position.y, chassis.position.z);
      g.quaternion.set(
        chassis.quaternion.x,
        chassis.quaternion.y,
        chassis.quaternion.z,
        chassis.quaternion.w,
      );
      onPosition?.([chassis.position.x, chassis.position.y, chassis.position.z]);
    }

    // 第三人称相机：跟在车后方上方，看向车
    const target = g ? g.position : new THREE.Vector3(0, 0, 0);
    camera.position.set(target.x, target.y + 5, target.z + 9);
    camera.lookAt(target.x, target.y + 1, target.z);
  });

  return (
    <group ref={groupRef}>
      {/* 底盘 */}
      <mesh>
        <boxGeometry args={[CHASSIS.w, CHASSIS.h, CHASSIS.l]} />
        <meshStandardMaterial color="#8b0000" />
      </mesh>
      {/* 车厢 */}
      <mesh position={[0, CHASSIS.h * 0.6, -0.3]}>
        <boxGeometry args={[CHASSIS.w * 0.8, CHASSIS.h * 0.7, CHASSIS.l * 0.6]} />
        <meshStandardMaterial color="#2c2c2c" />
      </mesh>
    </group>
  );
}

/** 创建物理世界、地形碰撞体、车辆，返回引用。 */
function createPhysics(heightMap: ValleyHeightMap) {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });

  // 地形：从高度图生成 Trimesh 静态刚体。
  const { size, half, heights } = heightMap;
  const cell = (half * 2) / size;
  const vertices: number[] = [];
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const x = -half + j * cell;
      const z = -half + i * cell;
      const y = heights[i * size + j];
      vertices.push(x, y, z);
    }
  }
  const indices: number[] = [];
  for (let i = 0; i < size - 1; i++) {
    for (let j = 0; j < size - 1; j++) {
      const a = i * size + j;
      const b = i * size + j + 1;
      const c = (i + 1) * size + j;
      const d = (i + 1) * size + j + 1;
      // 两个三角面（注意绕序，让法线朝上）
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }
  const trimesh = new CANNON.Trimesh(vertices, indices);
  const terrainBody = new CANNON.Body({ mass: 0, shape: trimesh });
  world.addBody(terrainBody);

  // 底盘刚体
  const chassisBody = new CANNON.Body({
    mass: 150,
    shape: new CANNON.Box(new CANNON.Vec3(CHASSIS.w / 2, CHASSIS.h / 2, CHASSIS.l / 2)),
    position: new CANNON.Vec3(0, 4, 30),
  });
  world.addBody(chassisBody);

  // 车辆（RaycastVehicle）
  const vehicle = new CANNON.RaycastVehicle({
    chassisBody,
    indexRightAxis: 0, // x 轴向右
    indexUpAxis: 1, // y 轴向上
    indexForwardAxis: 2, // z 轴向前
  });

  // 四个车轮的连接点（相对底盘中心，单位：x 横向、y 向上、z 纵向）
  const wheelPositions = [
    [-1, 0, 1.3], // 前左
    [1, 0, 1.3], // 前右
    [-1, 0, -1.3], // 后左
    [1, 0, -1.3], // 后右
  ];
  for (const [wx, wy, wz] of wheelPositions) {
    vehicle.addWheel({
      radius: 0.5,
      directionLocal: new CANNON.Vec3(0, -1, 0), // 悬架方向向下
      suspensionStiffness: 30,
      suspensionRestLength: 0.3,
      frictionSlip: 5,
      dampingRelaxation: 2.3,
      dampingCompression: 4.4,
      maxSuspensionForce: 100000,
      rollInfluence: 0.01,
      axleLocal: new CANNON.Vec3(1, 0, 0), // 车轴沿 x 轴
      chassisConnectionPointLocal: new CANNON.Vec3(wx, wy, wz),
      maxSuspensionTravel: 0.3,
      customSlidingRotationalSpeed: -30,
      useCustomSlidingRotationalSpeed: true,
    });
  }
  vehicle.addToWorld(world);

  return { world, vehicle, chassis: chassisBody };
}
