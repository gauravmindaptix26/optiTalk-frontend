import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    include: ["lucide-react"],
  },
  build: {
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          if (id.includes("zego-zim-web")) {
            return "zego-sdk";
          }

          if (id.includes("@auth0")) {
            return "auth0";
          }

          if (id.includes("jose")) {
            return "jose";
          }

          if (
            id.includes("react") ||
            id.includes("react-dom") ||
            id.includes("scheduler")
          ) {
            return "react-vendor";
          }
        },
      },
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
})
