import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    port: 5178,
    strictPort: true,
    watch: {
      // 用轮询代替 fs.watch：DSH 的原子写入会产生 .tmpdir，fs.watch 会 EBUSY 崩溃
      usePolling: true,
      interval: 500,
      ignored: [
        "**/archive/**",
        "**/node_modules/**",
        "**/dist/**",
        "**/.tmp-chrome/**",
        "**/samples/**",
      ],
    },
  },
  build: { outDir: "dist", assetsDir: "assets" },
});