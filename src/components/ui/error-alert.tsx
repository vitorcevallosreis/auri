'use client';

import React from 'react';
import { Button } from './button';
import { RefreshCw } from 'lucide-react';
import { AlertCircle } from 'lucide-react';

interface ErrorAlertProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorAlert({ message, onRetry }: ErrorAlertProps) {
  return (
    <div 
      className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-start gap-3 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300"
      role="alert"
      aria-live="assertive"
    >
      <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" aria-hidden="true" />
      <div className="flex-1">
        <p>{message}</p>
        {onRetry && (
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2 border-red-200 hover:bg-red-100 hover:text-red-800 dark:border-red-500/30 dark:hover:bg-red-500/15 dark:hover:text-red-300" 
            onClick={onRetry}
          >
            <RefreshCw className="h-4 w-4 mr-1" aria-hidden="true" />
            Tentar Novamente
          </Button>
        )}
      </div>
    </div>
  );
}
