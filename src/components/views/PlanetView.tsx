// 星球视图容器：管理"星球 / 恐怖谷地图"两种模式，并处理空状态和 WebGL 降级。
// 星球模式渲染 3D 星球；点击恐怖谷分区切到恐怖谷地图。恐怖谷地图也是懒加载，
// 它带 three + cannon，只在进入时才加载。

import { Component, lazy, Suspense, type ReactNode, useState } from "react";
import PlanetScene from "../planet/PlanetScene";
import { useI18n } from "../../i18n";
import type { Zone, ZoneId } from "../../utils/planet/types";

// 恐怖谷地图懒加载：体积大（three + cannon），只在进入时加载。
const HorrorValleyView = lazy(() => import("../planet/HorrorValleyView"));

// 捕获 3D 场景抛出的任何渲染异常（比如 WebGL 不可用），显示降级提示。
class PlanetErrorBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

interface Props {
  zones: Zone[];
}

export default function PlanetView({ zones }: Props) {
  const { t } = useI18n();
  const [webglFailed, setWebglFailed] = useState(false);
  // 当前处于星球还是恐怖谷地图。
  const [mode, setMode] = useState<"planet" | "horrorValley">("planet");

  const total = zones.reduce((acc, z) => acc + z.games.length, 0);
  // 恐怖谷分区的游戏（进地图用）。
  const horrorGames = zones.find((z) => z.id === "horror")?.games ?? [];

  if (webglFailed) {
    return <div className="planet-fallback">{t("planet_webgl_unsupported")}</div>;
  }

  if (total === 0) {
    return <div className="planet-empty">{t("planet_empty")}</div>;
  }

  // 恐怖谷地图模式
  if (mode === "horrorValley") {
    return (
      <div className="planet-container">
        <Suspense fallback={<div className="planet-empty">{t("planet_loading")}</div>}>
          <HorrorValleyView games={horrorGames} onBack={() => setMode("planet")} />
        </Suspense>
      </div>
    );
  }

  // 星球模式：点击分区进入对应地图（目前只有恐怖谷）
  const handleEnterZone = (zoneId: ZoneId) => {
    if (zoneId === "horror") setMode("horrorValley");
  };

  return (
    <div className="planet-container">
      <PlanetErrorBoundary onError={() => setWebglFailed(true)}>
        <PlanetScene
          zones={zones}
          onWebGLFailed={() => setWebglFailed(true)}
          onEnterZone={handleEnterZone}
        />
      </PlanetErrorBoundary>
    </div>
  );
}
