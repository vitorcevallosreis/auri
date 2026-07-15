import * as yup from "yup"

export const schema = yup.object().shape({
  zip_code: yup.string().required("O CEP é obrigatório."),
  complement: yup.string().nullable(),
  street: yup.string().nullable(),
  number: yup.string().nullable(),
  neighborhood: yup.string().nullable(),
  city: yup.string().nullable(),
  state: yup.string().nullable(),
  state_code: yup.string().nullable(),
  latitude: yup.number().nullable(),
  longitude: yup.number().nullable(),
})
