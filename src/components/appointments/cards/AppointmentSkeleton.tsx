'use client';

import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface AppointmentSkeletonProps {
  variant?: 'default' | 'compact' | 'minimal';
  count?: number;
}

export function AppointmentSkeleton({ 
  variant = 'default',
  count = 1
}: AppointmentSkeletonProps) {
  const renderSkeleton = () => {
    if (variant === 'minimal') {
      return (
        <div className="space-y-1">
          {Array.from({ length: count }).map((_, index) => (
            <Skeleton 
              key={index} 
              className="h-5 w-full rounded" 
            />
          ))}
        </div>
      );
    }

    if (variant === 'compact') {
      return (
        <div className="space-y-2">
          {Array.from({ length: count }).map((_, index) => (
            <div key={index} className="p-2 border rounded-md">
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {Array.from({ length: count }).map((_, index) => (
          <div key={index} className="p-3 border rounded-md">
            <div className="flex justify-between items-start mb-2">
              <div>
                <Skeleton className="h-5 w-40 mb-2" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <div className="space-y-2 mt-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    );
  };

  return renderSkeleton();
}
