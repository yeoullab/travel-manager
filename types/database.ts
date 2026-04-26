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
    PostgrestVersion: "12"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          code: string
          color_token: string
          created_at: string
          name: string
          sort_order: number
        }
        Insert: {
          code: string
          color_token: string
          created_at?: string
          name: string
          sort_order: number
        }
        Update: {
          code?: string
          color_token?: string
          created_at?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category_code: string
          created_at: string
          currency: string
          expense_date: string
          id: string
          memo: string | null
          paid_by: string | null
          schedule_item_id: string | null
          title: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          category_code?: string
          created_at?: string
          currency?: string
          expense_date: string
          id?: string
          memo?: string | null
          paid_by?: string | null
          schedule_item_id?: string | null
          title: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category_code?: string
          created_at?: string
          currency?: string
          expense_date?: string
          id?: string
          memo?: string | null
          paid_by?: string | null
          schedule_item_id?: string | null
          title?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_schedule_item_id_fkey"
            columns: ["schedule_item_id"]
            isOneToOne: false
            referencedRelation: "schedule_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          role: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups_with_invite"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          created_by: string
          id: string
          invite_code: string
          max_members: number
          status: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          invite_code?: string
          max_members?: number
          status: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          invite_code?: string
          max_members?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_shares: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          show_expenses: boolean
          show_records: boolean
          show_schedule: boolean
          show_todos: boolean
          token: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          show_expenses?: boolean
          show_records?: boolean
          show_schedule?: boolean
          show_todos?: boolean
          token?: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          show_expenses?: boolean
          show_records?: boolean
          show_schedule?: boolean
          show_todos?: boolean
          token?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_shares_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          color: string
          created_at: string
          display_name: string | null
          email: string
          id: string
        }
        Insert: {
          avatar_url?: string | null
          color?: string
          created_at?: string
          display_name?: string | null
          email: string
          id: string
        }
        Update: {
          avatar_url?: string | null
          color?: string
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
        }
        Relationships: []
      }
      records: {
        Row: {
          content: string
          created_at: string
          date: string
          id: string
          title: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          date: string
          id?: string
          title: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          date?: string
          id?: string
          title?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "records_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_items: {
        Row: {
          category_code: string
          created_at: string
          id: string
          memo: string | null
          place_address: string | null
          place_external_id: string | null
          place_external_url: string | null
          place_lat: number | null
          place_lng: number | null
          place_name: string | null
          place_provider: string | null
          sort_order: number
          time_of_day: string | null
          title: string
          trip_day_id: string
          updated_at: string
          url: string | null
        }
        Insert: {
          category_code?: string
          created_at?: string
          id?: string
          memo?: string | null
          place_address?: string | null
          place_external_id?: string | null
          place_external_url?: string | null
          place_lat?: number | null
          place_lng?: number | null
          place_name?: string | null
          place_provider?: string | null
          sort_order: number
          time_of_day?: string | null
          title: string
          trip_day_id: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          category_code?: string
          created_at?: string
          id?: string
          memo?: string | null
          place_address?: string | null
          place_external_id?: string | null
          place_external_url?: string | null
          place_lat?: number | null
          place_lng?: number | null
          place_name?: string | null
          place_provider?: string | null
          sort_order?: number
          time_of_day?: string | null
          title?: string
          trip_day_id?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_items_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "schedule_items_trip_day_id_fkey"
            columns: ["trip_day_id"]
            isOneToOne: false
            referencedRelation: "trip_days"
            referencedColumns: ["id"]
          },
        ]
      }
      todos: {
        Row: {
          assigned_to: string | null
          created_at: string
          id: string
          is_completed: boolean
          memo: string | null
          title: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean
          memo?: string | null
          title: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean
          memo?: string | null
          title?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "todos_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todos_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todos_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_days: {
        Row: {
          date: string
          day_number: number
          id: string
          trip_id: string
        }
        Insert: {
          date: string
          day_number: number
          id?: string
          trip_id: string
        }
        Update: {
          date?: string
          day_number?: number
          id?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_days_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          created_at: string
          created_by: string
          currencies: string[]
          destination: string
          end_date: string
          group_id: string | null
          id: string
          is_domestic: boolean
          start_date: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          currencies?: string[]
          destination: string
          end_date: string
          group_id?: string | null
          id?: string
          is_domestic?: boolean
          start_date: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          currencies?: string[]
          destination?: string
          end_date?: string
          group_id?: string | null
          id?: string
          is_domestic?: boolean
          start_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups_with_invite"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      groups_with_invite: {
        Row: {
          created_at: string | null
          id: string | null
          invite_code: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          invite_code?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          invite_code?: string | null
          status?: string | null
        }
        Relationships: []
      }
      profiles_public: {
        Row: {
          avatar_url: string | null
          color: string | null
          created_at: string | null
          display_name: string | null
          id: string | null
        }
        Insert: {
          avatar_url?: string | null
          color?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
        }
        Update: {
          avatar_url?: string | null
          color?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_invite: { Args: { p_invite_code: string }; Returns: Json }
      can_access_trip: { Args: { p_trip_id: string }; Returns: boolean }
      cancel_invite: { Args: never; Returns: undefined }
      create_expense: {
        Args: {
          p_amount: number
          p_category_code?: string
          p_currency?: string
          p_expense_date: string
          p_memo?: string
          p_paid_by?: string
          p_schedule_item_id?: string
          p_title: string
          p_trip_id: string
        }
        Returns: string
      }
      create_invite: { Args: never; Returns: Json }
      create_record: {
        Args: {
          p_content: string
          p_date: string
          p_title: string
          p_trip_id: string
        }
        Returns: string
      }
      create_schedule_item: {
        Args: {
          p_category_code?: string
          p_memo?: string
          p_place_address?: string
          p_place_external_id?: string
          p_place_external_url?: string
          p_place_lat?: number
          p_place_lng?: number
          p_place_name?: string
          p_place_provider?: string
          p_time_of_day?: string
          p_title: string
          p_trip_day_id: string
          p_url?: string
        }
        Returns: string
      }
      create_todo: {
        Args: {
          p_assigned_to?: string
          p_memo?: string
          p_title: string
          p_trip_id: string
        }
        Returns: string
      }
      create_trip: {
        Args: {
          p_currencies: string[]
          p_destination: string
          p_end_date: string
          p_is_domestic: boolean
          p_start_date: string
          p_title: string
        }
        Returns: string
      }
      delete_expense: { Args: { p_expense_id: string }; Returns: undefined }
      delete_record: { Args: { p_record_id: string }; Returns: undefined }
      delete_schedule_item: { Args: { p_item_id: string }; Returns: undefined }
      delete_todo: { Args: { p_todo_id: string }; Returns: undefined }
      dissolve_group: { Args: never; Returns: undefined }
      get_guest_trip_data: { Args: { p_token: string }; Returns: Json }
      is_group_member: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: boolean
      }
      move_schedule_item_across_days: {
        Args: {
          p_item_id: string
          p_target_day_id: string
          p_target_position: number
        }
        Returns: undefined
      }
      query_publication_tables: {
        Args: never
        Returns: {
          tablename: string
        }[]
      }
      reorder_schedule_items_in_day: {
        Args: { p_item_ids: string[]; p_trip_day_id: string }
        Returns: undefined
      }
      replica_identity_of: { Args: { p_table: string }; Returns: unknown }
      resize_trip_days: {
        Args: { p_new_end: string; p_new_start: string; p_trip_id: string }
        Returns: undefined
      }
      test_truncate_cascade: { Args: never; Returns: undefined }
      toggle_todo: {
        Args: { p_complete: boolean; p_todo_id: string }
        Returns: undefined
      }
      update_expense: {
        Args: {
          p_amount: number
          p_category_code: string
          p_currency: string
          p_expense_date: string
          p_expense_id: string
          p_memo?: string
          p_paid_by?: string
          p_schedule_item_id?: string
          p_title: string
        }
        Returns: undefined
      }
      update_record: {
        Args: {
          p_content: string
          p_date: string
          p_record_id: string
          p_title: string
        }
        Returns: undefined
      }
      update_schedule_item: {
        Args: {
          p_category_code?: string
          p_item_id: string
          p_memo?: string
          p_place_address?: string
          p_place_external_id?: string
          p_place_external_url?: string
          p_place_lat?: number
          p_place_lng?: number
          p_place_name?: string
          p_place_provider?: string
          p_time_of_day?: string
          p_title: string
          p_url?: string
        }
        Returns: undefined
      }
      update_todo: {
        Args: {
          p_assigned_to?: string
          p_memo?: string
          p_title: string
          p_todo_id: string
        }
        Returns: undefined
      }
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
  public: {
    Enums: {},
  },
} as const
