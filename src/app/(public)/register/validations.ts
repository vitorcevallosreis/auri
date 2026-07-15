import * as yup from "yup"

export const schema = yup.object().shape({
  name: yup.string().required("Seu Nome é obrigatório!"),
  company_name: yup.string().required("Nome da Empresa é obrigatório!"),
  email: yup
    .string()
    .required("Seu Email é obrigatório!")
    .email("Forneça um Email válido!"),
  password: yup
    .string()
    .required("Senha é obrigatório!")
    .min(6, "Senha deve ter no minímo 6 Caracteres!"),
  domain_server: yup.string().required("Deve ter um domínio válido!"),
})

// Docs
// https://www.npmjs.com/package/@hookform/resolvers
