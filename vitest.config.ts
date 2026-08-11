// 测试配置。
// 本项目主程序用 Vite 构建，vitest 复用同一套配置，保证测试环境
// 和真实运行环境一致。只测纯函数，不需要浏览器环境，用 node 环境即可。
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
  },
});
