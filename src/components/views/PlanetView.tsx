// 星球视图容器：把已分好区的数据交给 3D 场景渲染，并处理空状态和 WebGL 降级。
// WebGL 初始化或渲染出错时，用 ErrorBoundary 捕获并显示降级提示，不影响其它视图。

import { Component, type ReactNode, useState } from "react";
import PlanetScene from "../planet/PlanetScene";
import { useI18n } from "../../i18n";
import type { Zone } from "../../utils/planet/types";

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

  const total = zones.reduce((acc, z) => acc + z.games.length, 0);

  if (webglFailed) {
    return <div className="planet-fallback">{t("planet_webgl_unsupported")}</div>;
  }

  if (total === 0) {
    return <div className="planet-empty">{t("planet_empty")}</div>;
  }

  return (
    <div className="planet-container">
      <PlanetErrorBoundary onError={() => setWebglFailed(true)}>
        <PlanetScene zones={zones} onWebGLFailed={() => setWebglFailed(true)} />
      </PlanetErrorBoundary>
    </div>
  );
}
