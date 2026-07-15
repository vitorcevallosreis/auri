"use client"

import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar } from "@nextui-org/react"
import { Quote, Star, MapPin, Users } from "lucide-react"

const testimonials = [
  {
    id: 1,
    name: "Dr. Carlos Mendes",
    role: "Cardiologista",
    clinic: "CardioCenter Divinópolis",
    location: "Divinópolis, MG",
    avatar: "/images/no_image.png",
    rating: 5,
    specialty: "Cardiologia",
    patients: "2.500+ pacientes",
    quote: "A Ana IA revolucionou nossa recepção. Agendamentos 24/7 sem erro e nossos pacientes adoram o atendimento personalizado. Economizamos 40% nos custos operacionais.",
    results: [
      "40% redução de custos",
      "95% satisfação pacientes", 
      "0 filas de espera"
    ],
    timeUsing: "8 meses"
  },
  {
    id: 2, 
    name: "Dra. Marina Silva",
    role: "Dermatologista",
    clinic: "Clínica DermaBela",
    location: "Divinópolis, MG",
    avatar: "/images/no_image.png",
    rating: 5,
    specialty: "Dermatologia",
    patients: "1.800+ pacientes",
    quote: "Antes perdíamos muitos pacientes por não atender fora do horário. Agora a Ana agenda consultas mesmo à meia-noite. Nossa agenda está sempre cheia!",
    results: [
      "60% mais agendamentos",
      "24/7 disponibilidade",
      "Zero ligações perdidas"
    ],
    timeUsing: "6 meses"
  },
  {
    id: 3,
    name: "Dr. Roberto Lima", 
    role: "Ortopedista",
    clinic: "OrthoClínica Especializada",
    location: "Divinópolis, MG",
    avatar: "/images/no_image.png",
    rating: 5,
    specialty: "Ortopedia",
    patients: "3.200+ pacientes",
    quote: "A integração com WhatsApp foi um divisor de águas. Pacientes confirmam consultas automaticamente e nossa taxa de faltas caiu 70%. Produtividade máxima!",
    results: [
      "70% menos faltas",
      "Confirmações automáticas",
      "WhatsApp integrado"
    ],
    timeUsing: "1 ano"
  }
]

export default function TestimonialsSection() {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Quote className="h-5 w-5 text-[#00897B]" />
          <Badge className="bg-[#E0F2F1] text-[#00897B] hover:bg-[#B2DFDB]">
            Cases de Sucesso
          </Badge>
        </div>
        <h2 className="text-2xl font-bold text-gray-900">
          O que médicos de Divinópolis falam sobre a Nexa
        </h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Clínicas locais que já automatizaram seus atendimentos e transformaram seus resultados
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {testimonials.map((testimonial) => (
          <Card key={testimonial.id} className="relative border-2 hover:shadow-lg transition-all duration-200 overflow-hidden">
            {/* Quote decoration */}
            <div className="absolute top-4 right-4 text-[#00897B]/10">
              <Quote className="h-8 w-8" />
            </div>
            
            <CardContent className="p-6 space-y-4">
              {/* Header with doctor info */}
              <div className="flex items-start gap-3">
                <Avatar
                  src={testimonial.avatar}
                  size="md"
                  showFallback
                  className="border-2 border-[#00897B]/20"
                />
                <div className="flex-1 space-y-1">
                  <div className="font-semibold text-gray-900">{testimonial.name}</div>
                  <div className="text-sm text-gray-600">{testimonial.role}</div>
                  <div className="text-xs text-gray-500 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {testimonial.location}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {Array.from({ length: testimonial.rating }).map((_, i) => (
                    <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
              </div>

              {/* Clinic info */}
              <div className="flex items-center justify-between text-xs bg-gray-50 rounded-lg p-2">
                <div className="flex items-center gap-1">
                  <span className="font-medium">{testimonial.clinic}</span>
                </div>
                <div className="flex items-center gap-1 text-gray-500">
                  <Users className="h-3 w-3" />
                  {testimonial.patients}
                </div>
              </div>

              {/* Quote */}
              <blockquote className="text-sm text-gray-700 leading-relaxed italic">
                "{testimonial.quote}"
              </blockquote>

              {/* Results badges */}
              <div className="flex flex-wrap gap-2">
                {testimonial.results.map((result, index) => (
                  <Badge key={index} variant="outline" className="text-xs border-[#00897B]/20 text-[#00897B]">
                    {result}
                  </Badge>
                ))}
              </div>

              {/* Time using */}
              <div className="pt-2 border-t border-gray-100">
                <div className="text-xs text-gray-500">
                  <span className="font-medium">Usando há:</span> {testimonial.timeUsing}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* CTA bottom */}
      <div className="text-center pt-4">
        <p className="text-sm text-gray-600 mb-4">
          Mais de <span className="font-semibold text-[#00897B]">50 clínicas em MG</span> já automatizaram com a Nexa
        </p>
        <Badge className="bg-[#00897B] hover:bg-[#00796B] text-white px-6 py-2">
          Seja o próximo case de sucesso
        </Badge>
      </div>
    </div>
  )
}
