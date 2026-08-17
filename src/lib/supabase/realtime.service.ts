import { RealtimeChannel } from "@supabase/supabase-js"
import { supabase } from "./config"

export type SupabaseRealtimeEventType = "INSERT" | "UPDATE" | "DELETE"

export enum EnumSupabaseRealtimeEventType {
  INSERT = "INSERT",
  UPDATE = "UPDATE",
  DELETE = "DELETE",
}

export interface RealtimePayload<T = any> {
  schema: string
  table: string
  commit_timestamp: string
  eventType: SupabaseRealtimeEventType
  new: T
  old: Partial<T>
  errors: null | Record<string, any>
}

class RealtimeService {
  private channels: Map<string, RealtimeChannel> = new Map()

  subscribeToTable<T>(
    tableName: string,
    callback: (payload: RealtimePayload<T>) => void
  ): RealtimeChannel {
    if (this.channels.has(tableName)) {
      return this.channels.get(tableName)!
    }

    // UM TÓPICO POR TABELA. O nome do canal é a chave que o supabase-js usa
    // para reaproveitar canais: com "db-changes" fixo, a segunda tabela
    // recebia de volta o canal da primeira — já inscrito — e o `.on()` abaixo
    // caía depois do `subscribe()`. O realtime-js antigo engolia isso; a
    // partir de 2.112 ele lança "cannot add postgres_changes callbacks for
    // realtime:db-changes after subscribe()", e como estes contextos montam
    // no layout, a exceção derrubava a área inteira do profissional.
    //
    // O tópico compartilhado também quebrava `unsubscribeFromTable`: cancelar
    // uma tabela cancelava as assinaturas de todas as outras.
    const channel = supabase
      .channel(`db-changes:${tableName}`)
      .on(
        // @ts-expect-error pg name
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: tableName,
        },
        (payload: RealtimePayload<T>) => {
          console.log("Realtime payload:", payload)
          callback(payload)
        }
      )
      .subscribe((status) => {
        console.log("Realtime status:", status)
      })

    this.channels.set(tableName, channel)
    return channel
  }

  unsubscribeFromTable(tableName: string) {
    const channel = this.channels.get(tableName)
    if (channel) {
      channel.unsubscribe()
      this.channels.delete(tableName)
    }
  }
}

export const realtimeService = new RealtimeService()
