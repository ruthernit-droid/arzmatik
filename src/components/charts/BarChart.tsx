"use client";

import React from "react";

interface BarChartProps {
  data: { label: string; value: number; color?: string }[];
  height?: number;
  title?: string;
}

export default function BarChart({ data, height = 200, title }: BarChartProps) {
  const maxValue = Math.max(...data.map(d => Math.abs(d.value)), 1);
  
  if (data.length === 0) {
    return (
      <div 
        className="flex items-center justify-center text-zinc-500 text-sm"
        style={{ height }}
      >
        Veri yok
      </div>
    );
  }

  return (
    <div className="w-full">
      {title && (
        <h3 className="text-sm font-black text-zinc-400 mb-4">{title}</h3>
      )}
      <div className="flex items-end justify-between gap-2" style={{ height }}>
        {data.map((item, i) => {
          const barHeight = (Math.abs(item.value) / maxValue) * 100;
          const isNegative = item.value < 0;
          const color = item.color || (isNegative ? "#f43f5e" : "#10b981");
          
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full relative" style={{ height: `${barHeight}%` }}>
                <div 
                  className="absolute bottom-0 w-full rounded-t-md transition-all hover:opacity-80"
                  style={{ 
                    backgroundColor: color,
                    height: '100%',
                    opacity: isNegative ? 0.7 : 1
                  }}
                />
              </div>
              <div className="text-[10px] font-bold text-zinc-500 truncate w-full text-center">
                {item.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
