import axios from "axios"

export function getAPIClient() {
  const api = axios.create({ baseURL: process.env.NEXT_PUBLIC_WEBHOOK })

  return api
}
