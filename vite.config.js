import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt", // Muda para prompt para que possamos interceptar e avisar o user
      devOptions: {
        enabled: true,
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        maximumFileSizeToCacheInBytes: 5000000,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
            handler: "NetworkOnly",
          },
          {
            urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
            handler: "NetworkOnly",
          }
        ]
      },
      manifest: {
        name: "AgroSystem",
        short_name: "AgroSystem",
        description: "Sistema Offline-First de Gestão Agrícola",
        theme_color: "#111a2d",
        background_color: "#111a2d",
        display: "standalone", // Garante o formato de Aplicativo (sem barra de URL)
        orientation: "portrait", // Preferencialmente na vertical
        icons: [
          {
            src: "icon-192x192.png", // Icones reais agora adicionados para o navegador aceitar a instalação PWA
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "icon-512x512.png",
            sizes: "512x512",
            type: "image/png"
          }
        ]
      }
    })
  ],
  base: "/Agro-System/",
});