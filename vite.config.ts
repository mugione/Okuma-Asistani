import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * pwa/sw.js şablonundan dist/sw.js üretir: uygulama kabuğu (HTML, JS, CSS, ikonlar ve
 * Türkçe için gereken latin/latin-ext font dosyaları) önbellek listesine eklenir.
 * Ek bağımlılık gerektirmez.
 */
function serviceWorker(): Plugin {
  let outDir = "dist";
  return {
    name: "okuhiz-service-worker",
    apply: "build",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    // Tüm dosyalar (CSS'ten türeyen font dosyaları dahil) diske yazıldıktan sonra çalışır.
    writeBundle() {
      const files = readdirSync(join(outDir, "assets")).filter(
        (f) => /\.(js|css)$/.test(f) || /-(latin|latin-ext)-wght-normal-[\w-]+\.woff2$/.test(f),
      );
      const precache = [
        "/",
        "/manifest.webmanifest",
        "/favicon.svg",
        "/icons/icon-192.png",
        "/icons/icon-512.png",
        ...files.map((f) => `/assets/${f}`),
      ];
      const version = Date.now().toString(36);
      const source = readFileSync(new URL("./pwa/sw.js", import.meta.url), "utf8")
        .replace('const VERSION = "__VERSION__";', `const VERSION = "${version}";`)
        .replace("const PRECACHE = __PRECACHE__;", `const PRECACHE = ${JSON.stringify(precache)};`);
      if (source.includes('"__VERSION__"') || source.includes("= __PRECACHE__")) {
        throw new Error("pwa/sw.js yer tutucuları değiştirilemedi");
      }
      writeFileSync(join(outDir, "sw.js"), source);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), serviceWorker()],
  server: {
    // `npm run dev:api` (wrangler dev) 8787 portunda API + yerel D1 sunar.
    proxy: { "/api": "http://127.0.0.1:8787" },
  },
  test: {
    include: ["shared/**/*.test.ts", "worker/**/*.test.ts"],
  },
} as never);
