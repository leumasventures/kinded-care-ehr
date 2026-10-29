import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// base "./" makes built asset paths work on GitHub Pages project sites.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
});