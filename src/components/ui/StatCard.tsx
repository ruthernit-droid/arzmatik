"use client";

import React from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  color?: "emerald" | "blue" | "rose" | "amber" | "purple";
  icon?: React.ReactNode;
}

const colorClasses = {
  emerald: "from-emerald-500/20 to-emerald-600/5 border-emerald-500/20",
  blue: "from-blue-500/20 to-blue-600/5 border-blue-500/20",
  rose: "from-rose-500/20 to-rose-600/5 border-rose-500/20",
  amber: "from-amber-500/20 to-amber-600/5 border-amber-500/20",
  purple: "from-purple-500/20 to-purple-600/5 border-purple-500/20",
};

const textClasses = {
  emerald: "text-emerald-400",
  blue: "text-blue-400",
  rose: "text-rose-400",
  amber: "text-amber-400",
  purple: "text-purple-400",
};

export default function StatCard({ 
  title, 
  value, 
  subtitle, 
  trend, 
  trendValue,
  color = "emerald", 
  icon 
}: StatCardProps) {
  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} border rounded-2xl p-4`}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">{title}</p>
        {icon && <div className={`${textClasses[color]}`}>{icon}</div>}
      </div>
      
      <div className="flex items-end gap-2">
        <p className={`text-2xl font-black ${textClasses[color]}`}>{value}</p>
        
        {trend && trendValue && (
          <div className={`flex items-center gap-1 mb-1 ${
            trend === "up" ? "text-emerald-400" : 
            trend === "down" ? "text-rose-400" : "text-zinc-500"
          }`}>
            <span className="text-xs font-bold">
              {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"}
            </span>
            <span className="text-xs font-bold">{trendValue}</span>
          </div>
        )}
      </div>
      
      {subtitle && (
        <p className="text-xs text-zinc-500 mt-1">{subtitle}</p>
      )}
    </div>
  );
}
