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
  public: {
    Tables: {
      audit_runs: {
        Row: {
          created_at: string
          experiment_slug: string
          findings: Json
          id: string
          leak_count: number
        }
        Insert: {
          created_at?: string
          experiment_slug: string
          findings?: Json
          id?: string
          leak_count?: number
        }
        Update: {
          created_at?: string
          experiment_slug?: string
          findings?: Json
          id?: string
          leak_count?: number
        }
        Relationships: []
      }
      dataset_scans: {
        Row: {
          columns: Json
          created_at: string
          decision: string | null
          filename: string
          findings: Json
          id: string
        }
        Insert: {
          columns?: Json
          created_at?: string
          decision?: string | null
          filename: string
          findings?: Json
          id?: string
        }
        Update: {
          columns?: Json
          created_at?: string
          decision?: string | null
          filename?: string
          findings?: Json
          id?: string
        }
        Relationships: []
      }
      demo_decisions: {
        Row: {
          available_date: string
          created_at: string
          days_of_future_leakage: number
          decision_date: string
          decision_id: string
          experiment_id: string
          feature_name: string
          feature_status: string
          id: string
          knowledge_correct_return: number
          leakage_reason: string
          model_name: string
          original_backtest_return: number
          source: string
        }
        Insert: {
          available_date: string
          created_at?: string
          days_of_future_leakage?: number
          decision_date: string
          decision_id: string
          experiment_id: string
          feature_name: string
          feature_status: string
          id?: string
          knowledge_correct_return: number
          leakage_reason?: string
          model_name: string
          original_backtest_return: number
          source?: string
        }
        Update: {
          available_date?: string
          created_at?: string
          days_of_future_leakage?: number
          decision_date?: string
          decision_id?: string
          experiment_id?: string
          feature_name?: string
          feature_status?: string
          id?: string
          knowledge_correct_return?: number
          leakage_reason?: string
          model_name?: string
          original_backtest_return?: number
          source?: string
        }
        Relationships: []
      }
      experiments: {
        Row: {
          accuracy: number
          created_at: string
          dataset: string
          features_used: string[]
          id: string
          leakage_risks: number
          model: string
          name: string
          ran_at: string
          reaudit_flag: boolean
          slug: string
          status: string
          temporal_status: string
        }
        Insert: {
          accuracy: number
          created_at?: string
          dataset: string
          features_used?: string[]
          id?: string
          leakage_risks?: number
          model: string
          name: string
          ran_at: string
          reaudit_flag?: boolean
          slug: string
          status: string
          temporal_status: string
        }
        Update: {
          accuracy?: number
          created_at?: string
          dataset?: string
          features_used?: string[]
          id?: string
          leakage_risks?: number
          model?: string
          name?: string
          ran_at?: string
          reaudit_flag?: boolean
          slug?: string
          status?: string
          temporal_status?: string
        }
        Relationships: []
      }
      feature_concepts: {
        Row: {
          aliases: string[]
          created_at: string
          evidence_count: number
          id: string
          name: string
          post_outcome: boolean
          safe_for: string
          temporal_rule: string
          unsafe_for: string
        }
        Insert: {
          aliases?: string[]
          created_at?: string
          evidence_count?: number
          id?: string
          name: string
          post_outcome?: boolean
          safe_for: string
          temporal_rule: string
          unsafe_for: string
        }
        Update: {
          aliases?: string[]
          created_at?: string
          evidence_count?: number
          id?: string
          name?: string
          post_outcome?: boolean
          safe_for?: string
          temporal_rule?: string
          unsafe_for?: string
        }
        Relationships: []
      }
      leakage_incidents: {
        Row: {
          created_at: string
          description: string
          detected_at: string
          experiment: string
          feature: string
          id: string
          severity: string
        }
        Insert: {
          created_at?: string
          description: string
          detected_at: string
          experiment: string
          feature: string
          id?: string
          severity: string
        }
        Update: {
          created_at?: string
          description?: string
          detected_at?: string
          experiment?: string
          feature?: string
          id?: string
          severity?: string
        }
        Relationships: []
      }
      memories: {
        Row: {
          concept: string
          confidence: number
          created_at: string
          evidence_count: number
          experiment: string
          feature: string
          id: string
          learned_at: string
          lesson: string
          memory_type: string
          outcome: string
          reason: string
          tags: string[]
        }
        Insert: {
          concept: string
          confidence?: number
          created_at?: string
          evidence_count?: number
          experiment: string
          feature: string
          id?: string
          learned_at?: string
          lesson: string
          memory_type?: string
          outcome: string
          reason: string
          tags?: string[]
        }
        Update: {
          concept?: string
          confidence?: number
          created_at?: string
          evidence_count?: number
          experiment?: string
          feature?: string
          id?: string
          learned_at?: string
          lesson?: string
          memory_type?: string
          outcome?: string
          reason?: string
          tags?: string[]
        }
        Relationships: []
      }
      patterns: {
        Row: {
          created_at: string
          evidence_count: number
          examples: string[]
          id: string
          insight: string
          name: string
          recommendation: string
        }
        Insert: {
          created_at?: string
          evidence_count?: number
          examples?: string[]
          id?: string
          insight: string
          name: string
          recommendation: string
        }
        Update: {
          created_at?: string
          evidence_count?: number
          examples?: string[]
          id?: string
          insight?: string
          name?: string
          recommendation?: string
        }
        Relationships: []
      }
      reaudit_events: {
        Row: {
          affected: Json
          created_at: string
          feature: string
          id: string
          lesson: string
          memory_id: string | null
        }
        Insert: {
          affected?: Json
          created_at?: string
          feature: string
          id?: string
          lesson: string
          memory_id?: string | null
        }
        Update: {
          affected?: Json
          created_at?: string
          feature?: string
          id?: string
          lesson?: string
          memory_id?: string | null
        }
        Relationships: []
      }
      replay_results: {
        Row: {
          corrected_accuracy: number
          created_at: string
          experiment_slug: string
          id: string
          original_accuracy: number
        }
        Insert: {
          corrected_accuracy: number
          created_at?: string
          experiment_slug: string
          id?: string
          original_accuracy: number
        }
        Update: {
          corrected_accuracy?: number
          created_at?: string
          experiment_slug?: string
          id?: string
          original_accuracy?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
