"use client";

import type { DynamicPenetrationInterval } from "@/lib/types";

interface DynamicPenetrationDiagramProps {
  intervals: DynamicPenetrationInterval[];
  tip: string;
  className?: string;
}

export default function DynamicPenetrationDiagram({
  intervals,
  tip,
  className = "",
}: DynamicPenetrationDiagramProps) {
  if (intervals.length === 0) {
    return (
      <div className={`p-4 bg-slate-50 rounded-lg border text-sm text-slate-600 ${className}`}>
        Nu există date pentru diagramă.
      </div>
    );
  }

  const sorted = [...intervals].sort((a, b) => a.from_m - b.from_m);
  const maxBlows = Math.max(1, ...sorted.map((i) => i.blows));
  const maxDepth = Math.max(...sorted.map((i) => i.to_m), 1);
  const padding = { top: 20, right: 40, bottom: 30, left: 50 };
  const width = 280;
  const height = 200;
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const xScale = (blows: number) => padding.left + (blows / maxBlows) * chartW;
  const yScale = (depth: number) => padding.top + (depth / maxDepth) * chartH;

  return (
    <div className={`bg-white rounded-lg border p-4 ${className}`}>
      <h3 className="text-sm font-semibold text-slate-800 mb-3">
        Diagramă penetrare dinamică ({tip})
      </h3>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-[320px] h-auto" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="dpFill" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        <rect x={padding.left} y={padding.top} width={chartW} height={chartH} fill="#f8fafc" stroke="#94a3b8" strokeWidth="1" rx="2" />
        {sorted.map((i, idx) => (
          <rect
            key={i.id || idx}
            x={padding.left}
            y={yScale(i.from_m)}
            width={Math.max(2, xScale(i.blows) - padding.left)}
            height={Math.max(2, yScale(i.to_m) - yScale(i.from_m))}
            fill="url(#dpFill)"
            stroke="#2563eb"
            strokeWidth="1"
          />
        ))}
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + chartH} stroke="#64748b" strokeWidth="1" />
        <line x1={padding.left} y1={padding.top + chartH} x2={padding.left + chartW} y2={padding.top + chartH} stroke="#64748b" strokeWidth="1" />
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const blows = Math.round(t * maxBlows);
          const x = xScale(blows);
          return (
            <g key={t}>
              <line x1={x} y1={padding.top + chartH} x2={x} y2={padding.top + chartH + 4} stroke="#64748b" strokeWidth="1" />
              <text x={x} y={height - 8} textAnchor="middle" fontSize="9" fill="#475569">
                {blows}
              </text>
            </g>
          );
        })}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const depth = (t * maxDepth).toFixed(1);
          const y = yScale(t * maxDepth);
          return (
            <g key={t}>
              <line x1={padding.left - 4} y1={y} x2={padding.left} y2={y} stroke="#64748b" strokeWidth="1" />
              <text x={padding.left - 8} y={y + 3} textAnchor="end" fontSize="9" fill="#475569">
                {depth}
              </text>
            </g>
          );
        })}
        <text x={width / 2} y={height - 4} textAnchor="middle" fontSize="9" fill="#64748b">
          N (bătăi)
        </text>
        <text x={12} y={height / 2} textAnchor="middle" fontSize="9" fill="#64748b" transform={`rotate(-90, 12, ${height / 2})`}>
          Adâncime (m)
        </text>
      </svg>
    </div>
  );
}
