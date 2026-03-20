import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import AgroSystemModernUI from "./AgroSystemModernUI";
// Adicionando o import para registrar o Service Worker (PWA) no momento de montagem
import { registerSW } from "virtual:pwa-register";
import Swal from "sweetalert2";
import { palette } from "./constants/theme";

// Ao inicializar a aplicação, se for ambiente PWA compatível, ele verifica atualizações.
if ("serviceWorker" in navigator) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // Quando o navegador detectar que um novo Service Worker (código novo) foi baixado:
      Swal.fire({
        title: "Nova Atualização!",
        text: "Uma nova versão do AgroSystem está disponível. Deseja atualizar agora?",
        icon: "info",
        showCancelButton: true,
        confirmButtonColor: palette.gold,
        cancelButtonColor: palette.danger,
        confirmButtonText: "Atualizar",
        cancelButtonText: "Mais tarde",
        background: palette.bg,
        color: palette.white,
      }).then((result) => {
        if (result.isConfirmed) {
          updateSW(true);
        }
      });
    },
    onOfflineReady() {
      console.log("App pronto para uso offline.");
    },
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AgroSystemModernUI />
  </React.StrictMode>
);