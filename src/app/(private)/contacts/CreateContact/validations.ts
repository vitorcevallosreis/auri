import * as yup from "yup"

export const schema = yup.object().shape({
  name: yup.string().optional(),
  state_code: yup.number().required("Código do Estado é obrigatório!"),
  number: yup
    .string()
    .required("Número é obrigatório!")
    .test("number-conditional", "Número inválido!", function (value, context) {
      const { state_code } = context.parent

      // Verifica se o valor existe
      if (!value) {
        return this.createError({
          message: "O número é obrigatório!",
        })
      }

      // Remove caracteres não numéricos
      const cleanedValue = value.replace(/\D/g, "")

      // Validação para state_code abaixo de 31 (9 dígitos, começando com 9)
      if (state_code < 31) {
        if (!/^9\d{8}$/.test(cleanedValue)) {
          return this.createError({
            message: "O número deve ter 9 dígitos e começar com 9.",
          })
        }
      }
      // Validação para state_code acima de 31 (8 dígitos)
      else {
        if (!/^\d{8}$/.test(cleanedValue)) {
          return this.createError({
            message: "O número deve ter 8 dígitos.",
          })
        }
      }

      return true
    }),
  country_code: yup
    .number()
    .required("Código do País é obrigatório!")
    .test(
      "country_code-conditional",
      "Informe o Código do País!",
      function (value) {
        if (value) return true

        return false
      }
    ),
})
