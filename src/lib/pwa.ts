import { useEffect, useState } from "react";
import { load, save } from "./storage";

/** Yeni sürüm hazır olduğunda (okumayı bölmemek için sayfa kendiliğinden yenilenmez). */
const UPDATE_EVENT = "okuhiz:update-ready";

export function registerServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        reg.addEventListener("updatefound", () => {
          const sw = reg.installing;
          sw?.addEventListener("statechange", () => {
            if (sw.state === "activated" && hadController) window.dispatchEvent(new Event(UPDATE_EVENT));
          });
        });
        // Uzun süre açık kalan sekmelerde saatte bir güncelleme kontrolü.
        setInterval(() => void reg.update(), 60 * 60 * 1000);
      })
      .catch(() => {
        /* service worker desteklenmiyor veya engellendi: uygulama normal çalışır */
      });
  });
}

export function useUpdateReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const on = () => setReady(true);
    window.addEventListener(UPDATE_EVENT, on);
    return () => window.removeEventListener(UPDATE_EVENT, on);
  }, []);
  return ready;
}

export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** Bu tarayıcıda yükleme yapıldı mı (tarayıcı sekmesinde de kartı gizlemek için). */
const INSTALLED_KEY = "okuhiz.installed";
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    save(INSTALLED_KEY, "1");
    listeners.forEach((l) => l());
  });
}

/** "Ana ekrana ekle" desteği: Chrome/Edge/Android'de yükleme istemi, iOS'ta talimat. */
export function useInstallPrompt() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    const mq = window.matchMedia?.("(display-mode: standalone)");
    mq?.addEventListener?.("change", l);
    return () => {
      listeners.delete(l);
      mq?.removeEventListener?.("change", l);
    };
  }, []);
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: fullscreen)").matches ||
    (navigator as { standalone?: boolean }).standalone === true;
  // iPadOS 13+ kendini masaüstü Safari olarak tanıtır; dokunmatik Mac yoktur.
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  return {
    /** Uygulama olarak açılmış ya da bu tarayıcıda yüklenmiş. */
    installed: standalone || load(INSTALLED_KEY) === "1",
    canPrompt: !!deferredPrompt,
    ios,
    prompt: async () => {
      if (!deferredPrompt) return;
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      force((n) => n + 1);
    },
  };
}
