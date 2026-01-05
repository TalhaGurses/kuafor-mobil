"use client";

import { useEffect } from "react";

export function useServiceWorker() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("Service Worker kayıt edildi:", registration.scope);
        })
        .catch((error) => {
          console.error("Service Worker kayıt hatası:", error);
        });
    }
  }, []);
}

