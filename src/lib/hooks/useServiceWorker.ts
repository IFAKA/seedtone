"use client";

import { useEffect, useCallback, useRef, useState } from "react";

const UPDATE_CHECK_INTERVAL_MS = 60 * 1000; // Check every 60s

export function useServiceWorker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const waitingWorkerRef = useRef<ServiceWorker | null>(null);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        registrationRef.current = registration;

        // Check if there's already a waiting worker (e.g. from a previous visit)
        if (registration.waiting) {
          waitingWorkerRef.current = registration.waiting;
          setUpdateAvailable(true);
        }

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              // New SW installed but waiting — an update is available
              waitingWorkerRef.current = newWorker;
              setUpdateAvailable(true);
            }
          });
        });
      })
      .catch(() => {
        // SW registration failed — silently ignore
      });

    // Reload when the new SW takes over
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });

    // Periodically check for SW updates (important for installed PWAs
    // that stay open without full navigations)
    const interval = setInterval(() => {
      registrationRef.current?.update().catch(() => {});
    }, UPDATE_CHECK_INTERVAL_MS);

    // Also check when the app returns to foreground
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        registrationRef.current?.update().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    if (waitingWorkerRef.current) {
      waitingWorkerRef.current.postMessage({ type: "SKIP_WAITING" });
    }
  }, []);

  const dismissUpdate = useCallback(() => {
    setUpdateAvailable(false);
  }, []);

  return { updateAvailable, applyUpdate, dismissUpdate };
}
