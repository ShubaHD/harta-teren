"use client";

/**
 * Small badge for unsynced (pending) records.
 */

interface UnsyncedBadgeProps {
  label?: string;
  className?: string;
}

export default function UnsyncedBadge({ label = "Nesincronizat", className = "" }: UnsyncedBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium bg-amber-100 text-amber-800 px-2 py-0.5 rounded ${className}`}
      title="Modificare salvată local, se va sincroniza când revine conexiunea"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" aria-hidden />
      {label}
    </span>
  );
}
