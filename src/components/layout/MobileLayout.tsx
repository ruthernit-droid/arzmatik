"use client";

import React, { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import MobileNav from "./MobileNav";
import BottomNav from "./BottomNav";

interface MobileLayoutProps {
  children: React.ReactNode;
}

export default function MobileLayout({ children }: MobileLayoutProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      {isMobile && (
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setIsMenuOpen(true)}
            className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-black tracking-tight">HALKA ARZ MATIK</h1>
          <div className="w-10" />
        </header>
      )}

      {/* Main Content */}
      <main className="pb-20 md:pb-6">
        {children}
      </main>

      {/* Bottom Navigation (Mobile Only) */}
      {isMobile && <BottomNav />}

      {/* Mobile Navigation Drawer */}
      <MobileNav isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </div>
  );
}
