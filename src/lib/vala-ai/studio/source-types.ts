export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      agent_builds: {
        Row: {
          created_at: string;
          data: Json;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          data?: Json;
          id?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          data?: Json;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      dev_audit_logs: {
        Row: {
          action: string;
          actor: string;
          created_at: string;
          details: Json;
          id: string;
          project_id: string | null;
        };
        Insert: {
          action: string;
          actor?: string;
          created_at?: string;
          details?: Json;
          id?: string;
          project_id?: string | null;
        };
        Update: {
          action?: string;
          actor?: string;
          created_at?: string;
          details?: Json;
          id?: string;
          project_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "dev_audit_logs_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "dev_projects";
            referencedColumns: ["id"];
          },
        ];
      };
      dev_clients: {
        Row: {
          created_at: string;
          data: Json;
          email: string | null;
          external_id: string;
          id: string;
          name: string;
          phone: string | null;
          source: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          data?: Json;
          email?: string | null;
          external_id: string;
          id?: string;
          name: string;
          phone?: string | null;
          source?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          data?: Json;
          email?: string | null;
          external_id?: string;
          id?: string;
          name?: string;
          phone?: string | null;
          source?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      dev_issues: {
        Row: {
          created_at: string;
          fixed_version_id: string | null;
          id: string;
          issue_code: string;
          kind: string;
          project_id: string;
          status: string;
          text: string;
          updated_at: string;
          version_id: string | null;
        };
        Insert: {
          created_at?: string;
          fixed_version_id?: string | null;
          id?: string;
          issue_code?: string;
          kind: string;
          project_id: string;
          status?: string;
          text: string;
          updated_at?: string;
          version_id?: string | null;
        };
        Update: {
          created_at?: string;
          fixed_version_id?: string | null;
          id?: string;
          issue_code?: string;
          kind?: string;
          project_id?: string;
          status?: string;
          text?: string;
          updated_at?: string;
          version_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "dev_issues_fixed_version_id_fkey";
            columns: ["fixed_version_id"];
            isOneToOne: false;
            referencedRelation: "dev_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dev_issues_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "dev_projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dev_issues_version_id_fkey";
            columns: ["version_id"];
            isOneToOne: false;
            referencedRelation: "dev_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      dev_matches: {
        Row: {
          created_at: string;
          evidence: Json;
          id: string;
          item_id: string;
          project_id: string;
          requirement_id: string | null;
          score: number;
        };
        Insert: {
          created_at?: string;
          evidence: Json;
          id?: string;
          item_id: string;
          project_id: string;
          requirement_id?: string | null;
          score: number;
        };
        Update: {
          created_at?: string;
          evidence?: Json;
          id?: string;
          item_id?: string;
          project_id?: string;
          requirement_id?: string | null;
          score?: number;
        };
        Relationships: [
          {
            foreignKeyName: "dev_matches_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "library_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dev_matches_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "dev_projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dev_matches_requirement_id_fkey";
            columns: ["requirement_id"];
            isOneToOne: false;
            referencedRelation: "dev_requirements";
            referencedColumns: ["id"];
          },
        ];
      };
      dev_projects: {
        Row: {
          branding: Json;
          client_id: string | null;
          client_name: string | null;
          created_at: string;
          id: string;
          name: string;
          project_code: string;
          selected_item_id: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          branding?: Json;
          client_id?: string | null;
          client_name?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          project_code?: string;
          selected_item_id?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          branding?: Json;
          client_id?: string | null;
          client_name?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          project_code?: string;
          selected_item_id?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dev_projects_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "dev_clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dev_projects_selected_item_id_fkey";
            columns: ["selected_item_id"];
            isOneToOne: false;
            referencedRelation: "library_items";
            referencedColumns: ["id"];
          },
        ];
      };
      dev_requirements: {
        Row: {
          analysis: Json | null;
          created_at: string;
          id: string;
          project_id: string;
          raw_text: string;
        };
        Insert: {
          analysis?: Json | null;
          created_at?: string;
          id?: string;
          project_id: string;
          raw_text: string;
        };
        Update: {
          analysis?: Json | null;
          created_at?: string;
          id?: string;
          project_id?: string;
          raw_text?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dev_requirements_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "dev_projects";
            referencedColumns: ["id"];
          },
        ];
      };
      dev_versions: {
        Row: {
          build_info: Json;
          change_history: string | null;
          created_at: string;
          delivery_status: string;
          id: string;
          license_info: Json;
          project_id: string;
          release_id: string | null;
          test_status: string;
          version_code: string;
        };
        Insert: {
          build_info?: Json;
          change_history?: string | null;
          created_at?: string;
          delivery_status?: string;
          id?: string;
          license_info?: Json;
          project_id: string;
          release_id?: string | null;
          test_status?: string;
          version_code: string;
        };
        Update: {
          build_info?: Json;
          change_history?: string | null;
          created_at?: string;
          delivery_status?: string;
          id?: string;
          license_info?: Json;
          project_id?: string;
          release_id?: string | null;
          test_status?: string;
          version_code?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dev_versions_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "dev_projects";
            referencedColumns: ["id"];
          },
        ];
      };
      dev_workspaces: {
        Row: {
          branding: Json;
          changes: Json;
          created_at: string;
          files: Json;
          id: string;
          item_id: string | null;
          project_id: string;
          updated_at: string;
        };
        Insert: {
          branding?: Json;
          changes?: Json;
          created_at?: string;
          files?: Json;
          id?: string;
          item_id?: string | null;
          project_id: string;
          updated_at?: string;
        };
        Update: {
          branding?: Json;
          changes?: Json;
          created_at?: string;
          files?: Json;
          id?: string;
          item_id?: string | null;
          project_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dev_workspaces_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "library_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dev_workspaces_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: true;
            referencedRelation: "dev_projects";
            referencedColumns: ["id"];
          },
        ];
      };
      library_items: {
        Row: {
          capabilities: string[];
          category: string | null;
          compatibility: string | null;
          database_engine: string | null;
          features: string[];
          framework: string | null;
          id: string;
          indexed_at: string;
          known_requirements: string | null;
          metadata: Json;
          modules: string[];
          name: string;
          source_key: string;
          source_location: string;
          technology: string[];
          version: string | null;
        };
        Insert: {
          capabilities?: string[];
          category?: string | null;
          compatibility?: string | null;
          database_engine?: string | null;
          features?: string[];
          framework?: string | null;
          id?: string;
          indexed_at?: string;
          known_requirements?: string | null;
          metadata?: Json;
          modules?: string[];
          name: string;
          source_key: string;
          source_location: string;
          technology?: string[];
          version?: string | null;
        };
        Update: {
          capabilities?: string[];
          category?: string | null;
          compatibility?: string | null;
          database_engine?: string | null;
          features?: string[];
          framework?: string | null;
          id?: string;
          indexed_at?: string;
          known_requirements?: string | null;
          metadata?: Json;
          modules?: string[];
          name?: string;
          source_key?: string;
          source_location?: string;
          technology?: string[];
          version?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
