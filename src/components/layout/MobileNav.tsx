"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, Home, Users, TrendingUp, Wallet, Settings, Moon, Sun, Info } from "lucide-react";
import { useFirebaseDataContext } from "@/components/FirebaseDataContext";

const navItems = [
  { href: "/", icon: Home, label: "Ana Sayfa" },
  { href: "/accounts", icon: Users, label: "Hesaplar" },
  { href: "/ipos", icon: TrendingUp, label: "Halka Arzlar" },
  { href: "/day", icon: TrendingUp, label: "İşlem Günü" },
  { href: "/portfolio", icon: Wallet, label: "Portföy" },
  { href: "/summary", icon: Info, label: "Özet" },
  { href: "/settings", icon: Settings, label: "Ayarlar" },
];

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileNav({ isOpen, onClose }: MobileNavProps) {
  const pathname = usePathname();
  const { darkMode, toggleTheme } = useFirebaseDataContext();

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="fixed top-0 left-0 bottom-0 w-72 z-50 bg-zinc-950 border-r border-zinc-800 shadow-2xl transform transition-transform duration-300 overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-lg font-black">MENÜ</h2>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="p-4 space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== "/" && pathname.startsWith(item.href));
            
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                  isActive 
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                    : "hover:bg-zinc-900 text-zinc-400 hover:text-white"
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-bold">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Theme Toggle */}
        <div className="p-4 border-t border-zinc-800">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-3 p-3 rounded-xl w-full hover:bg-zinc-900 transition-colors text-zinc-400 hover:text-white"
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            <span className="font-bold">{darkMode ? "Açık Tema" : "Koyu Tema"}</span>
          </button>
        </div>
      </div>
    </>
  );
}
