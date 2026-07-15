export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      myia_appointments: {
        Row: {
          appointment_date: string
          appointment_type: string | null
          client_id: string | null
          cliente_email: string | null
          cliente_nome: string | null
          cliente_telefone: string | null
          company_id: string
          convenio_usado: string | null
          created_at: string
          end_time: string
          id: string
          location: string | null
          notes: string | null
          pesquisa: string | null
          professional_id: string
          service_id: string
          start_time: string
          status: string
          updated_at: string
          valor_cobrado: number | null
        }
        Insert: {
          appointment_date: string
          appointment_type?: string | null
          client_id?: string | null
          cliente_email?: string | null
          cliente_nome?: string | null
          cliente_telefone?: string | null
          company_id: string
          convenio_usado?: string | null
          created_at?: string
          end_time: string
          id?: string
          location?: string | null
          notes?: string | null
          pesquisa?: string | null
          professional_id: string
          service_id: string
          start_time: string
          status?: string
          updated_at?: string
          valor_cobrado?: number | null
        }
        Update: {
          appointment_date?: string
          appointment_type?: string | null
          client_id?: string | null
          cliente_email?: string | null
          cliente_nome?: string | null
          cliente_telefone?: string | null
          company_id?: string
          convenio_usado?: string | null
          created_at?: string
          end_time?: string
          id?: string
          location?: string | null
          notes?: string | null
          pesquisa?: string | null
          professional_id?: string
          service_id?: string
          start_time?: string
          status?: string
          updated_at?: string
          valor_cobrado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "myia_appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "myia_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "myia_appointments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "myia_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "myia_appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "myia_professionals_medical"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "myia_appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "myia_services"
            referencedColumns: ["id"]
          },
        ]
      }
      myia_assistants: {
        Row: {
          avatar: string | null
          avoided_topics: string | null
          behavior: string | null
          behavior_text: string | null
          company_id: string
          created_at: string
          description: string | null
          fallbacks: string | null
          goodbye: string | null
          greetings: string | null
          id: string
          identity: string | null
          llm: string | null
          name: string
          objective: string | null
          paused: boolean
          purpose: string | null
          roles: string | null
          step_by_step: string | null
          strategy: string | null
          tel_fallback: string | null
        }
        Insert: {
          avatar?: string | null
          avoided_topics?: string | null
          behavior?: string | null
          behavior_text?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          fallbacks?: string | null
          goodbye?: string | null
          greetings?: string | null
          id?: string
          identity?: string | null
          llm?: string | null
          name: string
          objective?: string | null
          paused?: boolean
          purpose?: string | null
          roles?: string | null
          step_by_step?: string | null
          strategy?: string | null
          tel_fallback?: string | null
        }
        Update: {
          avatar?: string | null
          avoided_topics?: string | null
          behavior?: string | null
          behavior_text?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          fallbacks?: string | null
          goodbye?: string | null
          greetings?: string | null
          id?: string
          identity?: string | null
          llm?: string | null
          name?: string
          objective?: string | null
          paused?: boolean
          purpose?: string | null
          roles?: string | null
          step_by_step?: string | null
          strategy?: string | null
          tel_fallback?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "myia_assistants_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "myia_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      myia_assistants_llms: {
        Row: {
          enabled: boolean
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          enabled?: boolean
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          enabled?: boolean
          icon?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      myia_categories: {
        Row: {
          company_id: string
          id: string
          name: string
        }
        Insert: {
          company_id: string
          id?: string
          name: string
        }
        Update: {
          company_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "myia_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "myia_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      myia_channels: {
        Row: {
          apiUtilizada: string | null
          assistant_id: string
          created_at: string
          fotoPerfil: string | null
          id: string
          instanceWpp: string | null
          looping_qrcode: number | null
          nome: string | null
          numeroTel: string | null
          pairing_code: string | null
          qrcode64: string | null
          remoteJid: string | null
          status: string
          tipoConexao: string | null
          titular: string | null
          token: string | null
          ultimaAtualizacao: string | null
          urlapi: string | null
        }
        Insert: {
          apiUtilizada?: string | null
          assistant_id: string
          created_at?: string
          fotoPerfil?: string | null
          id?: string
          instanceWpp?: string | null
          looping_qrcode?: number | null
          nome?: string | null
          numeroTel?: string | null
          pairing_code?: string | null
          qrcode64?: string | null
          remoteJid?: string | null
          status?: string
          tipoConexao?: string | null
          titular?: string | null
          token?: string | null
          ultimaAtualizacao?: string | null
          urlapi?: string | null
        }
        Update: {
          apiUtilizada?: string | null
          assistant_id?: string
          created_at?: string
          fotoPerfil?: string | null
          id?: string
          instanceWpp?: string | null
          looping_qrcode?: number | null
          nome?: string | null
          numeroTel?: string | null
          pairing_code?: string | null
          qrcode64?: string | null
          remoteJid?: string | null
          status?: string
          tipoConexao?: string | null
          titular?: string | null
          token?: string | null
          ultimaAtualizacao?: string | null
          urlapi?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "myia_channels_assistant_id_fkey"
            columns: ["assistant_id"]
            isOneToOne: false
            referencedRelation: "myia_assistants"
            referencedColumns: ["id"]
          },
        ]
      }
      myia_chat: {
        Row: {
          archived: boolean
          bot_running: boolean
          channel_name: string | null
          chat_pause: boolean
          company_id: string
          contact_id: string | null
          created_at: string
          id: string
          instance_id: string | null
          labels: string[] | null
          last_message: Json | null
          muted: boolean
          updated_at: string | null
        }
        Insert: {
          archived?: boolean
          bot_running?: boolean
          channel_name?: string | null
          chat_pause?: boolean
          company_id: string
          contact_id?: string | null
          created_at?: string
          id?: string
          instance_id?: string | null
          labels?: string[] | null
          last_message?: Json | null
          muted?: boolean
          updated_at?: string | null
        }
        Update: {
          archived?: boolean
          bot_running?: boolean
          channel_name?: string | null
          chat_pause?: boolean
          company_id?: string
          contact_id?: string | null
          created_at?: string
          id?: string
          instance_id?: string | null
          labels?: string[] | null
          last_message?: Json | null
          muted?: boolean
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "myia_chat_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "myia_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "myia_chat_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "myia_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      myia_companies: {
        Row: {
          created_at: string
          description: string | null
          domain_server: string | null
          id: string
          name: string
          site_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          domain_server?: string | null
          id?: string
          name: string
          site_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          domain_server?: string | null
          id?: string
          name?: string
          site_url?: string | null
        }
        Relationships: []
      }
      myia_company_addresses: {
        Row: {
          city: string | null
          company_id: string
          complement: string | null
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          neighborhood: string | null
          number: string | null
          state: string | null
          state_code: string | null
          street: string | null
          zip_code: string | null
        }
        Insert: {
          city?: string | null
          company_id: string
          complement?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          neighborhood?: string | null
          number?: string | null
          state?: string | null
          state_code?: string | null
          street?: string | null
          zip_code?: string | null
        }
        Update: {
          city?: string | null
          company_id?: string
          complement?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          neighborhood?: string | null
          number?: string | null
          state?: string | null
          state_code?: string | null
          street?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "myia_company_addresses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "myia_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      myia_company_agreements: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          status: boolean
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: boolean
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "myia_company_agreements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "myia_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      myia_company_payment_methods: {
        Row: {
          company_id: string
          created_at: string
          id: string
          name: string
          status: boolean
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          name: string
          status?: boolean
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          status?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "myia_company_payment_methods_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "myia_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      myia_company_policies: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          status: boolean
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: boolean
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "myia_company_policies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "myia_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      myia_contacts: {
        Row: {
          avatar_url: string | null
          checked: boolean
          company_id: string
          created_at: string
          id: string
          name: string
          number: string | null
          remote_jid: string | null
        }
        Insert: {
          avatar_url?: string | null
          checked?: boolean
          company_id: string
          created_at?: string
          id?: string
          name: string
          number?: string | null
          remote_jid?: string | null
        }
        Update: {
          avatar_url?: string | null
          checked?: boolean
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          number?: string | null
          remote_jid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "myia_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "myia_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      myia_messages: {
        Row: {
          chat_id: string
          created_at: string
          from_me: boolean
          id: string
          instance_id: string | null
          key: Json | null
          message: Json | null
          message_id: string | null
          message_timestamp: number | null
          message_type: string | null
          status: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          from_me?: boolean
          id?: string
          instance_id?: string | null
          key?: Json | null
          message?: Json | null
          message_id?: string | null
          message_timestamp?: number | null
          message_type?: string | null
          status?: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          from_me?: boolean
          id?: string
          instance_id?: string | null
          key?: Json | null
          message?: Json | null
          message_id?: string | null
          message_timestamp?: number | null
          message_type?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "myia_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "myia_chat"
            referencedColumns: ["id"]
          },
        ]
      }
      myia_products: {
        Row: {
          available: boolean
          category_id: string | null
          company_id: string
          created_at: string
          description: string | null
          id: string
          image_path: string | null
          name: string
          price: number
        }
        Insert: {
          available?: boolean
          category_id?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          name: string
          price?: number
        }
        Update: {
          available?: boolean
          category_id?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          name?: string
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "myia_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "myia_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "myia_products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "myia_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      myia_professional_availability: {
        Row: {
          created_at: string
          end_time: string
          id: string
          max_simultaneous_clients: number
          professional_id: string
          service_id: string
          start_time: string
          updated_at: string
          weekday: number
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          max_simultaneous_clients?: number
          professional_id: string
          service_id: string
          start_time: string
          updated_at?: string
          weekday: number
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          max_simultaneous_clients?: number
          professional_id?: string
          service_id?: string
          start_time?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "myia_professional_availability_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "myia_professionals_medical"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "myia_professional_availability_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "myia_services"
            referencedColumns: ["id"]
          },
        ]
      }
      myia_professional_services: {
        Row: {
          created_at: string
          id: string
          max_people: number | null
          mode: string | null
          price: number | null
          professional_id: string
          service_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_people?: number | null
          mode?: string | null
          price?: number | null
          professional_id: string
          service_id: string
        }
        Update: {
          created_at?: string
          id?: string
          max_people?: number | null
          mode?: string | null
          price?: number | null
          professional_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "myia_professional_services_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "myia_professionals_medical"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "myia_professional_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "myia_services"
            referencedColumns: ["id"]
          },
        ]
      }
      myia_professionals_medical: {
        Row: {
          atende_cat_idade: string[] | null
          company_id: string
          convenios_aceitos: string[] | null
          created_at: string
          email: string | null
          especialidade: string | null
          formacao: string | null
          horarios_atendimento: Json | null
          id: string
          nome: string
          notificame_dia: boolean | null
          notificame_horas: boolean | null
          observacoes: string | null
          registro: string | null
          search_tags: string[] | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          atende_cat_idade?: string[] | null
          company_id: string
          convenios_aceitos?: string[] | null
          created_at?: string
          email?: string | null
          especialidade?: string | null
          formacao?: string | null
          horarios_atendimento?: Json | null
          id?: string
          nome: string
          notificame_dia?: boolean | null
          notificame_horas?: boolean | null
          observacoes?: string | null
          registro?: string | null
          search_tags?: string[] | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          atende_cat_idade?: string[] | null
          company_id?: string
          convenios_aceitos?: string[] | null
          created_at?: string
          email?: string | null
          especialidade?: string | null
          formacao?: string | null
          horarios_atendimento?: Json | null
          id?: string
          nome?: string
          notificame_dia?: boolean | null
          notificame_horas?: boolean | null
          observacoes?: string | null
          registro?: string | null
          search_tags?: string[] | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "myia_professionals_medical_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "myia_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      myia_services: {
        Row: {
          aceita_convenio: boolean
          available: boolean
          company_id: string
          created_at: string
          description: string | null
          id: string
          image_path: string | null
          name: string
          price: number
          tempo_medio: string | null
          valores_convenios: Json | null
        }
        Insert: {
          aceita_convenio?: boolean
          available?: boolean
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          name: string
          price?: number
          tempo_medio?: string | null
          valores_convenios?: Json | null
        }
        Update: {
          aceita_convenio?: boolean
          available?: boolean
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          name?: string
          price?: number
          tempo_medio?: string | null
          valores_convenios?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "myia_services_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "myia_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      myia_settings_assistants: {
        Row: {
          assistant_id: string
          available_tokens: number
          created_at: string
          id: string
          instance_conection: string | null
          used_tokens: number
        }
        Insert: {
          assistant_id: string
          available_tokens?: number
          created_at?: string
          id?: string
          instance_conection?: string | null
          used_tokens?: number
        }
        Update: {
          assistant_id?: string
          available_tokens?: number
          created_at?: string
          id?: string
          instance_conection?: string | null
          used_tokens?: number
        }
        Relationships: [
          {
            foreignKeyName: "myia_settings_assistants_assistant_id_fkey"
            columns: ["assistant_id"]
            isOneToOne: false
            referencedRelation: "myia_assistants"
            referencedColumns: ["id"]
          },
        ]
      }
      myia_specialties: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "myia_specialties_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "myia_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      myia_users: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id: string
          role?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "myia_users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "myia_companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_company_id: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
