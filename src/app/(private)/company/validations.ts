import * as yup from "yup"

export const schema = yup.object().shape({
  name: yup.string().required("Nome da sua Empresa é obrigatório!"),
  description: yup.string().nullable().defined(),
  site_url: yup.string().nullable().defined(),
})

// Docs
// https://www.npmjs.com/package/@hookform/resolvers
