"use client";

import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse bg-gray-200 rounded-lg", className)} />;
}

export function MatchCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="w-8 h-8 rounded-full" />
          <Skeleton className="w-20 h-4" />
        </div>
        <Skeleton className="w-16 h-6" />
        <div className="flex items-center gap-2">
          <Skeleton className="w-20 h-4" />
          <Skeleton className="w-8 h-8 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function LeaderboardSkeleton() {
  return (
    <div className="space-y-2">
      {[1,2,3,4,5].map(i => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="w-8 h-8 rounded-full" />
          <Skeleton className="w-8 h-8 rounded-full" />
          <Skeleton className="w-24 h-4 flex-1" />
          <Skeleton className="w-12 h-5" />
        </div>
      ))}
    </div>
  );
}

export function GroupCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-2">
      <Skeleton className="w-20 h-5" />
      {[1,2,3,4].map(i => (
        <div key={i} className="flex items-center gap-2">
          <Skeleton className="w-6 h-6 rounded-full" />
          <Skeleton className="w-24 h-4 flex-1" />
          <Skeleton className="w-8 h-4" />
        </div>
      ))}
    </div>
  );
}
