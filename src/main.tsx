import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Fontlar uygulamayla birlikte sunulur (Google Fonts yok): gizlilik, çevrimdışı kullanım ve sıkı CSP için.
import "@fontsource-variable/nunito/wght.css";
import "@fontsource-variable/lexend/wght.css";
import "./index.css";
import { registerServiceWorker } from "./lib/pwa";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

registerServiceWorker();
