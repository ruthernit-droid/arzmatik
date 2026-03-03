"use client";

import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      const dismissed = localStorage.getItem("pwaInstallDismissed");
      if (!dismissed) {
        setTimeout(() => setIsVisible(true), 3000);
      }
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsVisible(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem("pwaInstallDismissed", "true");
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-4 shadow-2xl animate-in slide-in-from-bottom-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Download className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-black text-sm text-white">Uygulamayı Yükle</h3>
            <p className="text-xs text-zinc-400 mt-1">
              Ana ekranınıza ekleyerek daha hızlı erişim sağlayın.
            </p>
          </div>
          <button onClick={handleDismiss} className="text-zinc-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={handleInstall}
          className="w-full mt-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl transition-colors"
        >
          Yükle
        </button>
      </div>
    </div>
  );
}
