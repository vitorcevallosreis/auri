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

    const channel = supabase
      .channel("db-changes")
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
