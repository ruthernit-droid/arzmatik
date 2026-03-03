"use client";

import React from "react";

interface PieChartProps {
  data: { label: string; value: number; color: string }[];
  size?: number;
}

export default function PieChart({ data, size = 200 }: PieChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  
  if (total === 0) {
    return (
      <div 
        className="flex items-center justify-center text-zinc-500 text-sm"
        style={{ width: size, height: size }}
      >
        Veri yok
      </div>
    );
  }

  let currentAngle = 0;
  const radius = size / 2;
  const center = radius;

  const slices = data.map((item) => {
    const percentage = item.value / total;
    const angle = percentage * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    const startRad = (startAngle - 90) * (Math.PI / 180);
    const endRad = (endAngle - 90) * (Math.PI / 180);

    const x1 = center + radius * Math.cos(startRad);
    const y1 = center + radius * Math.sin(startRad);
    const x2 = center + radius * Math.cos(endRad);
    const y2 = center + radius * Math.sin(endRad);

    const largeArcFlag = angle > 180 ? 1 : 0;

    const pathData = [
      `M ${center} ${center}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
      `Z`
    ].join(" ");

    return {
      path: pathData,
      color: item.color,
      label: item.label,
      value: item.value,
      percentage: (percentage * 100).toFixed(1)
    };
  });

  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} className="flex-shrink-0">
        {slices.map((slice, i) => (
          <path
            key={i}
            d={slice.path}
            fill={slice.color}
            stroke="var(--background)"
            strokeWidth="2"
          />
        ))}
        <circle cx={center} cy={center} r={radius * 0.5} fill="var(--background)" />
      </svg>
      
      <div className="space-y-2">
        {data.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: item.color }}
            />
            <span className="text-xs font-bold text-zinc-400">{item.label}</span>
            <span className="text-xs font-bold text-zinc-500">
              {((item.value / total) * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
