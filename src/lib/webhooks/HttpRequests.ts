export type HttpRequest = {
  url: string
  method: "GET" | "POST" | "PUT" | "DELETE"
  body?: unknown
  headers?: Record<string, string>
}

export enum HttpStatusCode {
  ok = 200,
  created = 201,
  noContent = 204,
  badRequest = 400,
  unauthorized = 401,
  notFound = 404,
  unprocessableEntity = 422,
  serverError = 500,
}

export type HttpResponse<T = unknown> = {
  statusCode: HttpStatusCode
  body?: T
}

export interface DefaultResponse {
  success: boolean
  message: string
}

export interface HttpClient<R = unknown> {
  request: (data: HttpRequest, message_type: string) => Promise<HttpResponse<R>>
}
