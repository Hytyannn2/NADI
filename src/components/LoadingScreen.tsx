/**
 * Fullscreen App Shell Skeleton Loading Component
 * 
 * Replaces the generic loading spinner with an instant high-fidelity
 * shimmer skeleton of the NADI core layout.
 */
'use client';
import { Skeleton, CardSkeleton } from '@/src/components/ui/Skeleton';

export default function LoadingScreen() {
  return (
    <div className="min-h-screen w-full flex flex-col justify-between p-4 sm:p-6 max-w-lg mx-auto" style={{ background: 'var(--bg-base)' }}>
      {/* Top Header Mockup */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2.5">
            <Skeleton className="w-9 h-9 rounded-2xl shrink-0" />
            <div className="flex flex-col gap-1">
              <Skeleton className="w-20 h-4 rounded-md" />
              <Skeleton className="w-28 h-2.5 rounded-md" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="w-8 h-8 rounded-full" />
            <Skeleton className="w-8 h-8 rounded-full" />
          </div>
        </div>

        {/* Top Tab Pills */}
        <div className="flex items-center gap-2 overflow-hidden py-1">
          <Skeleton className="w-24 h-8 rounded-full shrink-0" />
          <Skeleton className="w-20 h-8 rounded-full shrink-0" />
          <Skeleton className="w-24 h-8 rounded-full shrink-0" />
          <Skeleton className="w-20 h-8 rounded-full shrink-0" />
        </div>

        {/* Hero Card Skeleton */}
        <div
          className="rounded-3xl p-4 border flex flex-col gap-3 relative overflow-hidden"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
        >
          <div className="flex items-center justify-between">
            <Skeleton className="w-32 h-3.5 rounded-md" />
            <Skeleton className="w-16 h-5 rounded-full" />
          </div>
          <div className="flex items-baseline gap-2 my-1">
            <Skeleton className="w-24 h-7 rounded-md" />
            <Skeleton className="w-16 h-4 rounded-md" />
          </div>
          <Skeleton className="w-full h-2 rounded-full" />
        </div>

        {/* Content Feed Cards */}
        <div className="space-y-3 pt-2">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>

      {/* Bottom Navigation Mockup */}
      <div
        className="mt-6 rounded-2xl p-2.5 border flex items-center justify-around"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <Skeleton className="w-5 h-5 rounded-md" />
            <Skeleton className="w-8 h-2 rounded-sm" />
          </div>
        ))}
      </div>
    </div>
  );
}
