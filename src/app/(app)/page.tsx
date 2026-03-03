"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { Box, LayoutDashboard, TrendingUp, Users } from "lucide-react";
import { useFirebaseDataContext } from "@/components/FirebaseDataContext";

function Card({ href, title, desc, icon }: { href: string; title: string; desc: string; icon: React.ReactNode }) {
  return (
    <Link href={href} className="glass-card hover:bg-zinc-900/60 p-6 rounded-3xl border border-zinc-800 group transition-all block">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center border border-zinc-800 group-hover:scale-110 transition-transform">
          {icon}
        </div>
        <div>
          <h2 className="text-lg font-black text-white">{title}</h2>
          <p className="text-xs text-zinc-500 font-bold">{desc}</p>
        </div>
      </div>
    </Link>
  );
}

export default function HomePage() {
  const { accounts, ipos, portfolioItems } = useFirebaseDataContext();

  const stats = useMemo(() => {
    const activeCount = accounts.filter((a: any) => a.isActive).length;
    const holdings = portfolioItems.reduce((sum: number, i: any) => sum + Number(i.totalLots || 0), 0);
    return { activeCount, holdings };
  }, [accounts, portfolioItems]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">Kontrol Paneli</h1>
        <p className="text-zinc-500 font-bold text-sm">Hizli erisim: portfoy, hesaplar ve halka arz islemleri.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card href="/portfolio" title="Portfoy" desc={`${portfolioItems.length} hisse | toplam lot: ${stats.holdings}`} icon={<LayoutDashboard className="w-5 h-5 text-emerald-500" />} />
        <Card href="/summary" title="Ozet" desc="Tanimli hesaplarin toplu durumu" icon={<TrendingUp className="w-5 h-5 text-emerald-500" />} />
        <Card href="/accounts" title="Hesaplar" desc={`${accounts.length} hesap | aktif: ${stats.activeCount}`} icon={<Users className="w-5 h-5 text-blue-400" />} />
        <Card href="/ipos" title="Halka Arz" desc={`${ipos.length} kayit`} icon={<Box className="w-5 h-5 text-amber-400" />} />
      </div>
    </div>
  );
}
