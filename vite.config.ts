import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    server: {
      port: 3000,
      host: "0.0.0.0",
      proxy: {
        "/api": {
          target: "http://localhost:8787",
          changeOrigin: true,
        },
        "/oauth": {
          target: "http://localhost:8787",
          changeOrigin: true,
        },
      },
    },
    plugins: [react()],
    define: {},
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
  };
});
