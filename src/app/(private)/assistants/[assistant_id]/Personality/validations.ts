import * as yup from "yup"

export const schema = yup.object().shape({
  identity: yup.string().nullable(),
  roles: yup.string().nullable(),
  fallbacks: yup.string().nullable(),
  goodbye: yup.string().nullable(),
})
