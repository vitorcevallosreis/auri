import * as yup from "yup"

export const schema = yup.object().shape({
  llm: yup.string().required("Selecione um Modelo de IA"),
  objective: yup.string().nullable(),
  strategy: yup.string().nullable(),
  tel_fallback: yup.string().nullable(),
})
