"use client";

import { useServiceWorker } from "@/lib/hooks/useServiceWorker";
import { AnimatePresence, motion } from "framer-motion";
import { RefreshCw, X } from "lucide-react";

export function UpdateNotification() {
  const { updateAvailable, applyUpdate, dismissUpdate } = useServiceWorker();

  return (
    <AnimatePresence>
      {updateAvailable && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
        >
          <div
            className="flex items-center gap-3 px-4 py-2.5 rounded-full
              bg-white/10 backdrop-blur-xl border border-white/10
              shadow-lg shadow-black/20"
          >
            <span className="text-white/80 text-sm">Update available</span>
            <button
              onClick={applyUpdate}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full
                bg-white/15 hover:bg-white/25 text-white/90 text-sm
                transition-colors"
            >
              <RefreshCw size={13} />
              Refresh
            </button>
            <button
              onClick={dismissUpdate}
              className="text-white/40 hover:text-white/70 transition-colors"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
