import * as yup from "yup"

export const schema = yup.object().shape({
  name: yup.string().required("Nome é obrigatório!"),
  price: yup.number().required("Preço é obrigatório!"),
  description: yup.string().required("Descrição é obrigatória!"),
  tempo_medio: yup.string().required("Tempo médio é obrigatório!").default("60"),
  available: yup
    .boolean()
    .required("Disponibilidade é obrigatória!")
    .default(true),
  aceita_convenio: yup
    .boolean()
    .required("Informação de convênio é obrigatória!")
    .default(false),
  valores_convenios: yup
    .array()
    .of(
      yup.object().shape({
        convenio: yup.string().required("Nome do convênio é obrigatório!"),
        valor: yup.number().required("Valor do convênio é obrigatório!"),
        enable: yup.boolean().required().default(true),
      })
    )
    .nullable()
    .when("aceita_convenio", {
      is: true,
      then: (schema) => schema.required("Valores dos convênios são obrigatórios!"),
      otherwise: (schema) => schema.nullable(),
    }),
})
