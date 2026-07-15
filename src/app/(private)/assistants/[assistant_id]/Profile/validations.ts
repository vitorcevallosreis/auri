import * as yup from "yup"

export const schema = yup.object().shape({
  name: yup.string().required("Nome do Assistente é obrigatório!"),
  description: yup.string().required("Descrição do Assistente é obrigatório!"),
  behavior: yup.string().nullable(),
  purpose: yup.string().nullable(),
})
