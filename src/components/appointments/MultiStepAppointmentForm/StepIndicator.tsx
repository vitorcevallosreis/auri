'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface StepIndicatorProps {
  steps: string[];
  currentStep: number;
  onStepClick?: (step: number) => void;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({
  steps,
  currentStep,
  onStepClick
}) => {
  return (
    <div className="flex items-center justify-center w-full py-4">
      {steps.map((step, index) => (
        <React.Fragment key={step}>
          {/* Step circle */}
          <div 
            className={cn(
              "flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-200",
              index < currentStep 
                ? "bg-primary border-primary text-primary-foreground" 
                : index === currentStep 
                  ? "border-primary text-primary" 
                  : "border-border text-gray-300"
            )}
            onClick={() => {
              // Só permite clicar em etapas anteriores ou na atual
              if (index <= currentStep && onStepClick) {
                onStepClick(index);
              }
            }}
            style={{ cursor: index <= currentStep ? 'pointer' : 'default' }}
          >
            {index < currentStep ? (
              <Check className="h-4 w-4" />
            ) : (
              <span className="text-sm font-medium">{index + 1}</span>
            )}
          </div>

          {/* Step label */}
          <div className="hidden sm:block mx-2">
            <span 
              className={cn(
                "text-xs font-medium",
                index <= currentStep ? "text-primary" : "text-muted-foreground"
              )}
            >
              {step}
            </span>
          </div>

          {/* Connector line (except after last step) */}
          {index < steps.length - 1 && (
            <div 
              className={cn(
                "flex-grow h-0.5 mx-2",
                index < currentStep ? "bg-primary" : "bg-gray-300"
              )}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};
