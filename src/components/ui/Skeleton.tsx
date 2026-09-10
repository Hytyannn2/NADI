/**
 * Universal Skeleton Loading Design System
 * 
 * Reusable shimmer skeleton components for feeds, cards, maps, charts, and telemetry.
 * Leverages the CSS keyframe shimmer defined in globals.css.
 */
import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

/**
 * Base Shimmer Skeleton primitive
 */
export function Skeleton({ className = '', style, ...props }: SkeletonProps) {
  return (
    <div
      className={`skeleton relative overflow-hidden ${className}`}
      style={style}
      aria-hidden="true"
      {...props}
    />
  );
}

/**
 * Card Skeleton: Ideal for job postings, social posts, and community listings
 */
export function CardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-2xl p-4 border flex flex-col gap-3.5 relative overflow-hidden ${className}`}
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
    >
      {/* Header: Avatar + Title & Meta + Badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="w-28 h-3.5 rounded-md" />
            <Skeleton className="w-20 h-2.5 rounded-md" />
          </div>
        </div>
        <Skeleton className="w-16 h-5 rounded-full" />
      </div>

      {/* Body: Two lines of description */}
      <div className="space-y-2 my-1">
        <Skeleton className="w-full h-3 rounded-md" />
        <Skeleton className="w-3/4 h-3 rounded-md" />
      </div>

      {/* Footer: Tags & Action Button */}
      <div className="pt-2 border-t flex items-center justify-between gap-2" style={{ borderColor: 'var(--border-default)' }}>
        <div className="flex items-center gap-1.5">
          <Skeleton className="w-16 h-4 rounded-md" />
          <Skeleton className="w-14 h-4 rounded-md" />
        </div>
        <Skeleton className="w-24 h-7 rounded-xl" />
      </div>
    </div>
  );
}

/**
 * Stats Banner Skeleton: 3-column metric bar
 */
export function StatsBannerSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-3 mb-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-2xl p-3.5 text-center flex flex-col items-center gap-1.5 border"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
        >
          <Skeleton className="w-4 h-4 rounded-full mb-0.5" />
          <Skeleton className="w-12 h-4 rounded-md" />
          <Skeleton className="w-16 h-2.5 rounded-md" />
        </div>
      ))}
    </div>
  );
}

/**
 * Aid Scheme Card Skeleton: Designed for Bantuan financial & NGO aid cards
 */
export function AidCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-2xl p-4 border flex flex-col justify-between gap-4 relative overflow-hidden ${className}`}
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
    >
      <div className="space-y-3">
        {/* Category Pill + Agency */}
        <div className="flex items-center justify-between">
          <Skeleton className="w-20 h-4 rounded-full" />
          <Skeleton className="w-16 h-3 rounded-md" />
        </div>

        {/* Title */}
        <Skeleton className="w-4/5 h-5 rounded-md" />

        {/* Payout amount badge */}
        <div className="p-2.5 rounded-xl border flex items-center justify-between" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-default)' }}>
          <Skeleton className="w-14 h-3 rounded-md" />
          <Skeleton className="w-24 h-5 rounded-md" />
        </div>

        {/* Criteria bullets */}
        <div className="space-y-1.5 pt-1">
          <Skeleton className="w-full h-2.5 rounded-md" />
          <Skeleton className="w-5/6 h-2.5 rounded-md" />
        </div>
      </div>

      {/* Button */}
      <Skeleton className="w-full h-9 rounded-xl mt-2" />
    </div>
  );
}

/**
 * Weather & Telemetry Card Skeleton: Compact header widget for Dashboard
 */
export function WeatherSkeleton() {
  return (
    <div
      className="rounded-2xl p-4 relative overflow-hidden border flex items-center justify-between"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
    >
      <div className="flex items-center gap-3">
        {/* Weather Icon Placeholder */}
        <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
        <div className="flex flex-col gap-2">
          {/* Temperature */}
          <Skeleton className="w-16 h-6 rounded-md" />
          {/* Condition / Feels like */}
          <Skeleton className="w-24 h-3 rounded-md" />
        </div>
      </div>

      {/* Right Stats: Humidity & Wind */}
      <div className="flex flex-col gap-2 border-l pl-4 shrink-0" style={{ borderColor: 'var(--border-default)' }}>
        <div className="flex items-center gap-1.5">
          <Skeleton className="w-3.5 h-3.5 rounded-full" />
          <Skeleton className="w-14 h-3 rounded-md" />
        </div>
        <div className="flex items-center gap-1.5">
          <Skeleton className="w-3.5 h-3.5 rounded-full" />
          <Skeleton className="w-14 h-3 rounded-md" />
        </div>
      </div>
    </div>
  );
}

/**
 * Map Skeleton: High-fidelity map placeholder with simulated UI pills and radar pulse
 */
export function MapSkeleton({
  height = 'h-72',
  label = 'Memuatkan Peta...',
}: {
  height?: string;
  label?: string;
}) {
  return (
    <div
      className={`w-full ${height} rounded-3xl relative overflow-hidden border flex flex-col justify-between p-4 shadow-xl`}
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
    >
      {/* Background Shimmer Layer */}
      <div className="absolute inset-0 skeleton opacity-40 pointer-events-none" />

      {/* Subtle Map Grid lines simulation */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(var(--text-muted) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Top Controls Mockup */}
      <div className="relative z-10 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Skeleton className="w-20 h-6 rounded-full" />
          <Skeleton className="w-24 h-6 rounded-full hidden sm:block" />
        </div>
        <Skeleton className="w-8 h-8 rounded-xl" />
      </div>

      {/* Center Radar Ripple & Status */}
      <div className="relative z-10 flex flex-col items-center justify-center gap-2.5 my-auto">
        <div className="relative flex items-center justify-center">
          <div className="w-12 h-12 rounded-full border border-purple-500/30 animate-ping absolute" />
          <div className="w-8 h-8 rounded-full border border-purple-500/60 flex items-center justify-center" style={{ background: 'rgba(139, 92, 246, 0.15)' }}>
            <div className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse" />
          </div>
        </div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-center" style={{ color: 'var(--text-muted)' }}>
          {label}
        </p>
      </div>

      {/* Bottom Floating Bar Mockup */}
      <div className="relative z-10 flex items-center justify-between">
        <Skeleton className="w-28 h-6 rounded-xl" />
        <Skeleton className="w-16 h-6 rounded-xl" />
      </div>
    </div>
  );
}

/**
 * Chart Skeleton: Simulated IoT telemetry graph with vertical data bars
 */
export function ChartSkeleton({ height = 'h-[260px]' }: { height?: string }) {
  return (
    <div
      className={`w-full ${height} rounded-2xl p-4 border flex flex-col justify-between relative overflow-hidden`}
      style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-default)' }}
    >
      {/* Chart Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="space-y-1">
          <Skeleton className="w-32 h-4 rounded-md" />
          <Skeleton className="w-20 h-2.5 rounded-md" />
        </div>
        <Skeleton className="w-14 h-5 rounded-full" />
      </div>

      {/* Simulated Graph Wave / Columns */}
      <div className="flex items-end justify-between gap-2 h-32 my-auto px-2">
        {[45, 60, 35, 80, 65, 90, 50, 75, 40, 70, 85, 55].map((val, idx) => (
          <div key={idx} className="flex-1 flex flex-col justify-end items-center h-full">
            <Skeleton
              className="w-full rounded-t-md opacity-60"
              style={{ height: `${val}%` }}
            />
          </div>
        ))}
      </div>

      {/* X-Axis labels */}
      <div className="flex justify-between pt-2 border-t" style={{ borderColor: 'var(--border-default)' }}>
        <Skeleton className="w-10 h-2.5 rounded-md" />
        <Skeleton className="w-10 h-2.5 rounded-md" />
        <Skeleton className="w-10 h-2.5 rounded-md" />
        <Skeleton className="w-10 h-2.5 rounded-md" />
      </div>
    </div>
  );
}
