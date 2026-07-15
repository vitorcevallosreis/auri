import * as yup from "yup"

export const schema = yup.object().shape({
  nome: yup.string().required("Nome do Assistente é obrigatório!"),
})

// Docs
// https://www.npmjs.com/package/@hookform/resolvers
