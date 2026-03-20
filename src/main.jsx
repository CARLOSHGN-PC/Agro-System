import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import AgroSystemModernUI from "./AgroSystemModernUI";
// Adicionando o import para registrar o Service Worker (PWA) no momento de montagem
import { registerSW } from "virtual:pwa-register";

// Ao inicializar a aplicação, se for ambiente PWA compatível, ele verifica atualizações.
// Isso só é acionado no browser.
if ("serviceWorker" in navigator) {
  registerSW({ immediate: true });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AgroSystemModernUI />
  </React.StrictMode>
);