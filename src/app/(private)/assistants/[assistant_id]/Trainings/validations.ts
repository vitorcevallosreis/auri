import * as yup from "yup"

export const schema = yup.object().shape({
  step_by_step: yup.string().nullable(),
  greetings: yup.string().nullable(),
  behavior_text: yup.string().nullable(),
  avoided_topics: yup.string().nullable(),
})
