import * as yup from "yup"

export const schema = yup.object().shape({
  contact_id: yup
    .string()
    .test(
      "contact_id-conditional",
      "Selecione um Contato para Iníciar o Chat!",
      function (value, context) {
        const { number, country_code } = context.parent
        if (number && country_code) return true
        if (value) return true

        return false
      }
    ),
  number: yup
    .string()
    .test("number-conditional", "Informe o número!", function (value, context) {
      const { contact_id } = context.parent
      if (contact_id) return true

      if (value) {
        if (!/^\d{10,11}$/.test(value)) {
          return this.createError({
            message:
              "O número deve ter entre 10 e 11 dígitos e conter apenas números.",
          })
        }
        return true
      }

      return false
    }),
  country_code: yup
    .string()
    .test(
      "country_code-conditional",
      "Informe o Código do País!",
      function (value, context) {
        const { contact_id } = context.parent
        if (contact_id) return true
        if (value) return true

        return false
      }
    ),
})
