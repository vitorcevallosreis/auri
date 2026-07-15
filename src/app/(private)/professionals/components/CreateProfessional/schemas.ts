import { z } from "zod"

export const basicInfoSchema = z.object({
  company_id: z.string(),
})

export const stepOneSchema = z.object({
  nome: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  formacao: z.string().min(2, "Formação deve ter pelo menos 2 caracteres"),
  registro: z.string().min(2, "Registro deve ter pelo menos 2 caracteres"),
  email: z.string().email("E-mail inválido"),
  telefone: z.string().min(8, "Telefone inválido"),
})

export const stepTwoSchema = z.object({
  quem_atende: z
    .array(z.enum(["ADULTO", "ADOLESCENTE", "CRIANÇA"]))
    .nonempty("Selecione pelo menos uma Faixa Etária"),
})

export const stepThreeSchema = z.object({
  agreements: z.array(z.string()).optional(),
})

export const stepFourSchema = z.object({
  specialties: z.array(z.string()).optional(),
})

const serviceSchema = z.object({
  service_id: z.string(),
  tipo: z.enum(["INDIVIDUAL", "GRUPO", "AMBOS"]).default("INDIVIDUAL"),
  amount: z.number().min(2, "Valor deve ser maior que 2").default(2),
})

export const stepFiveSchema = z.object({
  services: z.array(serviceSchema).optional(),
})

const scheduleSchema = z.record(
  z.enum([
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ]),
  z.object({
    closing: z.string().optional().default(""),
    enabled: z.boolean(),
    opening: z.string().optional().default(""),
  })
)

export const stepSixSchema = z.object({
  scheduler: scheduleSchema,
})

export const stepSevenSchema = z.object({
  observacoes: z.string().optional(),
})

// Juntando todos os schemas
export const formSchema = z.object({
  ...basicInfoSchema.shape,
  ...stepOneSchema.shape,
  ...stepTwoSchema.shape,
  ...stepThreeSchema.shape,
  ...stepFourSchema.shape,
  ...stepFiveSchema.shape,
  ...stepSixSchema.shape,
  ...stepSevenSchema.shape,
})

export type FormData = z.infer<typeof formSchema>
