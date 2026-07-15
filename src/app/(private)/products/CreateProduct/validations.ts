import * as yup from "yup"

export const schema = yup.object().shape({
  category_id: yup.string().required("Categoria é obrigatória!"),
  name: yup.string().required("Nome é obrigatório!"),
  price: yup.number().required("Preço é obrigatório!"),
  description: yup.string().required("Descrição é obrigatória!"),
  available: yup
    .boolean()
    .required("Disponibilidade é obrigatória!")
    .default(true),
})
