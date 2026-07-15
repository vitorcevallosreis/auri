import { toast } from "sonner"
import { ZodSchema } from "zod"

export function validateSchema<T>(
  data: unknown,
  schema: ZodSchema<T>,
  error_message?: string
): T {
  const parsed = schema.safeParse(data)
  if (!parsed.success) {
    console.error("Schema validation error:", parsed.error.format())
    throw new Error(error_message || "Invalid API response!")
  }
  return parsed.data
}

export function handleError(error: unknown, context: string): void {
  const message =
    error instanceof Error ? error.message : "An unknown error occurred."
  console.error(`${context}: ${message}`, error)

  toast.error(message)
}
