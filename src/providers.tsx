'use client';

import React from 'react';
import { AppointmentsProvider } from '@/contexts/Appointments';
import { ProfessionalsProvider } from '@/contexts/Professionals';
import { ServicesProvider } from '@/contexts/Services';
import { AgreementsProvider } from '@/contexts/Agreements';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <AppointmentsProvider>
      <ProfessionalsProvider>
        <ServicesProvider>
          <AgreementsProvider>
            {children}
          </AgreementsProvider>
        </ServicesProvider>
      </ProfessionalsProvider>
    </AppointmentsProvider>
  );
}
