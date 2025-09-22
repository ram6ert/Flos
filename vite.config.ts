import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  root: path.join(__dirname, "src/renderer"),
  base: "./",
  build: {
    outDir: path.join(__dirname, "dist/renderer"),
    emptyOutDir: true,
    sourcemap: process.env.NODE_ENV === "development",
    minify: process.env.NODE_ENV === "production" ? "esbuild" : false,
    rollupOptions: {
      input: path.join(__dirname, "src/renderer/index.html"),
    },
  },
  server: {
    port: 5173,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src/renderer"),
      "@shared": path.resolve(__dirname, "src/shared"),
    },
  },
});
