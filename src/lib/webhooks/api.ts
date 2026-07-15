import { getAPIClient } from "./axios"
import { HttpClient, HttpRequest } from "./HttpRequests"
import { EnumMessageTyped } from "@/contexts/Messages/schemas"

export const api = getAPIClient()

export class AxiosHttpClientAdapter implements HttpClient {
  async request(data: HttpRequest, message_type: string) {
    try {
      const headers =
        message_type === EnumMessageTyped.CONVERSATION
          ? { "Content-Type": "application/json" }
          : { "Content-Type": "multipart/form-data" }

      const result = await api.request({
        url: `/webhook${data.url}-${message_type}`,
        method: data.method,
        data: data.body,
        headers,
      })

      return result.data
    } catch (error: any) {
      return error.response?.data
    }
  }

  // Métodos HTTP padrão para facilitar o uso
  async get(url: string, params?: any, headers?: any) {
    try {
      const response = await api.get(url, { params, headers });
      return response.data;
    } catch (error: any) {
      console.error("GET request error:", error);
      throw error;
    }
  }

  async post(url: string, data?: any, headers?: any) {
    try {
      const response = await api.post(url, data, { headers });
      return response.data;
    } catch (error: any) {
      console.error("POST request error:", error);
      throw error;
    }
  }

  async put(url: string, data?: any, headers?: any) {
    try {
      const response = await api.put(url, data, { headers });
      return response.data;
    } catch (error: any) {
      console.error("PUT request error:", error);
      throw error;
    }
  }

  async delete(url: string, headers?: any) {
    try {
      const response = await api.delete(url, { headers });
      return response.data;
    } catch (error: any) {
      console.error("DELETE request error:", error);
      throw error;
    }
  }
}
