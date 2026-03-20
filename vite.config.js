import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // O PWA gera automaticamente o manifesto e cuida do cache no Service Worker
      registerType: "autoUpdate", // Atualiza o SW automaticamente sem o usuário precisar confirmar manualmente.
      devOptions: {
        enabled: true, // Permite rodar e testar o PWA no ambiente de desenvolvimento local (localhost).
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"], // Todos esses arquivos serão cacheados pro app abrir offline.
        // Aumentando o limite do tamanho dos arquivos de cache caso tenhamos mapas/módulos grandes
        maximumFileSizeToCacheInBytes: 5000000,
        runtimeCaching: [
          // Exemplo: não cachear a raiz de APIs do Firebase no Service Worker, vamos usar Dexie pra isso.
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
            handler: "NetworkOnly", // Forçamos que o Firestore só seja acessado via rede. Se falhar, nosso código Dexie assume.
          },
          {
            urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
            handler: "NetworkOnly", // Mesma coisa pro Storage. O fetch do shapefile vai pro Dexie se a rede falhar.
          }
        ]
      },
      manifest: {
        name: "AgroSystem",
        short_name: "AgroSystem",
        description: "Sistema Offline-First de Gestão Agrícola",
        theme_color: "#111a2d", // Cor principal do painel pra ficar bonito no celular
        background_color: "#111a2d",
        display: "standalone" // Tira a barra do navegador, parecendo um app nativo
        // Removidos temporariamente os ícones que estavam com arquivos em branco (0 bytes).
        // Assim evitamos falhas no manifesto. O usuário pode preencher "icons" posteriormente com imagens válidas.
      }
    })
  ],
  base: "/Agro-System/", // Mantendo o prefixo base por causa do GitHub Pages
});