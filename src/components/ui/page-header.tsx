'use client';

import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
}

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-bold tracking-tight" id="page-title">
        {title}
      </h1>
      {description && (
        <p className="text-muted-foreground" id="page-description">
          {description}
        </p>
      )}
    </div>
  );
}
