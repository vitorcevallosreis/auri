'use client';

import React from 'react';
import { Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Appointment {
  id: string;
  patientName: string;
  appointmentType: string;
  time: string;
}

interface NextAppointmentsCardProps {
  appointments: Appointment[];
}

export function NextAppointmentsCard({ appointments }: NextAppointmentsCardProps) {
  return (
    <Card className="col-span-1 lg:col-span-2 shadow-sm border border-gray-100">
      <CardHeader className="pb-3 border-b border-gray-50">
        <CardTitle className="text-lg font-medium flex items-center">
          <span className="text-[#00897B] mr-2">≡</span> Próximas Consultas
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-5">
          {appointments.map((appointment) => (
            <div key={appointment.id} className="flex items-center justify-between py-1">
              <div className="flex items-start">
                <Clock className="h-5 w-5 text-[#00897B] mt-0.5 mr-3" />
                <div>
                  <p className="font-medium text-gray-800">{appointment.patientName}</p>
                  <p className="text-sm text-gray-500">{appointment.appointmentType}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">{appointment.time}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
