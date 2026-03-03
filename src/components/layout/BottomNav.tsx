"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, TrendingUp, Wallet, Settings, History, BarChart3 } from "lucide-react";

const navItems = [
  { href: "/", icon: Home, label: "Ana Sayfa" },
  { href: "/accounts", icon: Users, label: "Hesaplar" },
  { href: "/ipos", icon: TrendingUp, label: "Arzlar" },
  { href: "/stocks", icon: BarChart3, label: "Hisseler" },
  { href: "/history", icon: History, label: "Gecmis" },
  { href: "/settings", icon: Settings, label: "Ayarlar" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== "/" && pathname.startsWith(item.href));
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all min-w-[60px] ${
                isActive 
                  ? "text-primary" 
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? "stroke-[2.5]" : ""}`} />
              <span className="text-[10px] font-bold mt-1">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
