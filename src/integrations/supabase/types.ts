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
      ai_agents: {
        Row: {
          created_at: string
          id: string
          max_tokens: number
          model_id: string | null
          name: string
          purpose: string
          runs_30d: number
          status: string
          success_rate: number
          system_prompt: string
          temperature: number
          tools: Json
        }
        Insert: {
          created_at?: string
          id?: string
          max_tokens?: number
          model_id?: string | null
          name: string
          purpose: string
          runs_30d?: number
          status?: string
          success_rate?: number
          system_prompt?: string
          temperature?: number
          tools?: Json
        }
        Update: {
          created_at?: string
          id?: string
          max_tokens?: number
          model_id?: string | null
          name?: string
          purpose?: string
          runs_30d?: number
          status?: string
          success_rate?: number
          system_prompt?: string
          temperature?: number
          tools?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ai_agents_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_decision_logs: {
        Row: {
          agent_id: string | null
          confidence: number
          cost_usd: number
          decision: string
          id: string
          input_summary: string | null
          model_id: string | null
          occurred_at: string
          outcome: string
          output_summary: string | null
          tokens: number
        }
        Insert: {
          agent_id?: string | null
          confidence?: number
          cost_usd?: number
          decision: string
          id?: string
          input_summary?: string | null
          model_id?: string | null
          occurred_at?: string
          outcome?: string
          output_summary?: string | null
          tokens?: number
        }
        Update: {
          agent_id?: string | null
          confidence?: number
          cost_usd?: number
          decision?: string
          id?: string
          input_summary?: string | null
          model_id?: string | null
          occurred_at?: string
          outcome?: string
          output_summary?: string | null
          tokens?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_decision_logs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_decision_logs_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_models: {
        Row: {
          context_window: number
          created_at: string
          id: string
          input_cost_per_1k: number
          is_default: boolean
          latency_ms: number
          modality: string
          model_id: string
          name: string
          output_cost_per_1k: number
          provider_id: string | null
          quality_score: number
          status: string
        }
        Insert: {
          context_window?: number
          created_at?: string
          id?: string
          input_cost_per_1k?: number
          is_default?: boolean
          latency_ms?: number
          modality?: string
          model_id: string
          name: string
          output_cost_per_1k?: number
          provider_id?: string | null
          quality_score?: number
          status?: string
        }
        Update: {
          context_window?: number
          created_at?: string
          id?: string
          input_cost_per_1k?: number
          is_default?: boolean
          latency_ms?: number
          modality?: string
          model_id?: string
          name?: string
          output_cost_per_1k?: number
          provider_id?: string | null
          quality_score?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_models_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "ai_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_providers: {
        Row: {
          base_url: string | null
          category: string
          created_at: string
          docs_url: string | null
          id: string
          monthly_cost_usd: number
          name: string
          region: string
          slug: string
          status: string
        }
        Insert: {
          base_url?: string | null
          category?: string
          created_at?: string
          docs_url?: string | null
          id?: string
          monthly_cost_usd?: number
          name: string
          region?: string
          slug: string
          status?: string
        }
        Update: {
          base_url?: string | null
          category?: string
          created_at?: string
          docs_url?: string | null
          id?: string
          monthly_cost_usd?: number
          name?: string
          region?: string
          slug?: string
          status?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          badge: string
          created_at: string
          ends_at: string | null
          gradient: string
          icon_name: string
          id: string
          position: number
          starts_at: string | null
          text: string
          title: string
          updated_at: string
          visible: boolean
        }
        Insert: {
          badge?: string
          created_at?: string
          ends_at?: string | null
          gradient?: string
          icon_name?: string
          id?: string
          position?: number
          starts_at?: string | null
          text?: string
          title: string
          updated_at?: string
          visible?: boolean
        }
        Update: {
          badge?: string
          created_at?: string
          ends_at?: string | null
          gradient?: string
          icon_name?: string
          id?: string
          position?: number
          starts_at?: string | null
          text?: string
          title?: string
          updated_at?: string
          visible?: boolean
        }
        Relationships: []
      }
      api_integrations: {
        Row: {
          auth_type: string
          category: string
          created_at: string
          direction: string
          error_count: number
          id: string
          last_sync_at: string | null
          name: string
          provider_id: string | null
          status: string
          sync_frequency: string
          webhook_url: string | null
        }
        Insert: {
          auth_type?: string
          category?: string
          created_at?: string
          direction?: string
          error_count?: number
          id?: string
          last_sync_at?: string | null
          name: string
          provider_id?: string | null
          status?: string
          sync_frequency?: string
          webhook_url?: string | null
        }
        Update: {
          auth_type?: string
          category?: string
          created_at?: string
          direction?: string
          error_count?: number
          id?: string
          last_sync_at?: string | null
          name?: string
          provider_id?: string | null
          status?: string
          sync_frequency?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_integrations_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "ai_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          created_by: string
          environment: string
          expires_at: string | null
          fingerprint: string
          id: string
          key_prefix: string
          label: string
          last_four: string
          last_rotated_at: string | null
          last_used_at: string | null
          provider_id: string | null
          rotation_days: number
          scopes: string[]
          secret_encrypted: string | null
          service_id: string | null
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          environment?: string
          expires_at?: string | null
          fingerprint: string
          id?: string
          key_prefix?: string
          label: string
          last_four?: string
          last_rotated_at?: string | null
          last_used_at?: string | null
          provider_id?: string | null
          rotation_days?: number
          scopes?: string[]
          secret_encrypted?: string | null
          service_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          environment?: string
          expires_at?: string | null
          fingerprint?: string
          id?: string
          key_prefix?: string
          label?: string
          last_four?: string
          last_rotated_at?: string | null
          last_used_at?: string | null
          provider_id?: string | null
          rotation_days?: number
          scopes?: string[]
          secret_encrypted?: string | null
          service_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "ai_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_keys_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "api_services"
            referencedColumns: ["id"]
          },
        ]
      }
      api_request_logs: {
        Row: {
          error_message: string | null
          id: string
          ip: string | null
          latency_ms: number
          method: string
          occurred_at: string
          path: string
          request_id: string | null
          service_id: string | null
          status_code: number
          user_agent: string | null
        }
        Insert: {
          error_message?: string | null
          id?: string
          ip?: string | null
          latency_ms?: number
          method?: string
          occurred_at?: string
          path?: string
          request_id?: string | null
          service_id?: string | null
          status_code?: number
          user_agent?: string | null
        }
        Update: {
          error_message?: string | null
          id?: string
          ip?: string | null
          latency_ms?: number
          method?: string
          occurred_at?: string
          path?: string
          request_id?: string | null
          service_id?: string | null
          status_code?: number
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_request_logs_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "api_services"
            referencedColumns: ["id"]
          },
        ]
      }
      api_services: {
        Row: {
          avg_latency_ms: number
          category: string
          created_at: string
          endpoint_url: string | null
          health_status: string
          id: string
          last_checked_at: string | null
          name: string
          owner_team: string
          provider_id: string | null
          slug: string
          status: string
          type: string
          uptime_pct: number
          version: string
        }
        Insert: {
          avg_latency_ms?: number
          category?: string
          created_at?: string
          endpoint_url?: string | null
          health_status?: string
          id?: string
          last_checked_at?: string | null
          name: string
          owner_team?: string
          provider_id?: string | null
          slug: string
          status?: string
          type?: string
          uptime_pct?: number
          version?: string
        }
        Update: {
          avg_latency_ms?: number
          category?: string
          created_at?: string
          endpoint_url?: string | null
          health_status?: string
          id?: string
          last_checked_at?: string | null
          name?: string
          owner_team?: string
          provider_id?: string | null
          slug?: string
          status?: string
          type?: string
          uptime_pct?: number
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_services_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "ai_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor: string
          entity_id: string | null
          entity_type: string
          id: string
          ip: string | null
          metadata: Json
          occurred_at: string
          severity: string
        }
        Insert: {
          action: string
          actor?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip?: string | null
          metadata?: Json
          occurred_at?: string
          severity?: string
        }
        Update: {
          action?: string
          actor?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip?: string | null
          metadata?: Json
          occurred_at?: string
          severity?: string
        }
        Relationships: []
      }
      auth_qr_sessions: {
        Row: {
          approved_email: string | null
          created_at: string
          expires_at: string
          id: string
          status: string
          token: string
          user_id: string | null
        }
        Insert: {
          approved_email?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          status?: string
          token: string
          user_id?: string | null
        }
        Update: {
          approved_email?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          status?: string
          token?: string
          user_id?: string | null
        }
        Relationships: []
      }
      automation_rules: {
        Row: {
          action_config: Json
          action_type: string
          condition: Json
          created_at: string
          enabled: boolean
          id: string
          last_run_at: string | null
          name: string
          run_count: number
          trigger_type: string
        }
        Insert: {
          action_config?: Json
          action_type?: string
          condition?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          name: string
          run_count?: number
          trigger_type?: string
        }
        Update: {
          action_config?: Json
          action_type?: string
          condition?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          name?: string
          run_count?: number
          trigger_type?: string
        }
        Relationships: []
      }
      billing_plans: {
        Row: {
          billing_cycle: string
          created_at: string
          currency: string
          id: string
          included_requests: number
          monthly_fee: number
          name: string
          overage_per_1k: number
          provider_id: string | null
          renewal_date: string | null
          status: string
        }
        Insert: {
          billing_cycle?: string
          created_at?: string
          currency?: string
          id?: string
          included_requests?: number
          monthly_fee?: number
          name: string
          overage_per_1k?: number
          provider_id?: string | null
          renewal_date?: string | null
          status?: string
        }
        Update: {
          billing_cycle?: string
          created_at?: string
          currency?: string
          id?: string
          included_requests?: number
          monthly_fee?: number
          name?: string
          overage_per_1k?: number
          provider_id?: string | null
          renewal_date?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_plans_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "ai_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      cache_entries: {
        Row: {
          cache_key: string
          cost_saved_usd: number
          created_at: string
          hits: number
          id: string
          last_hit_at: string | null
          model: string
          size_kb: number
          ttl_hours: number
        }
        Insert: {
          cache_key: string
          cost_saved_usd?: number
          created_at?: string
          hits?: number
          id?: string
          last_hit_at?: string | null
          model: string
          size_kb?: number
          ttl_hours?: number
        }
        Update: {
          cache_key?: string
          cost_saved_usd?: number
          created_at?: string
          hits?: number
          id?: string
          last_hit_at?: string | null
          model?: string
          size_kb?: number
          ttl_hours?: number
        }
        Relationships: []
      }
      chat_handoffs: {
        Row: {
          assigned_to: string | null
          conversation_id: string
          created_at: string
          id: string
          reason: string | null
          requested_by: string
          resolved_at: string | null
          status: string
        }
        Insert: {
          assigned_to?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          reason?: string | null
          requested_by: string
          resolved_at?: string | null
          status?: string
        }
        Update: {
          assigned_to?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          reason?: string | null
          requested_by?: string
          resolved_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_handoffs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          favorite: boolean
          last_read_at: string
          muted: boolean
          role_label: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          favorite?: boolean
          last_read_at?: string
          muted?: boolean
          role_label?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          favorite?: boolean
          last_read_at?: string
          muted?: boolean
          role_label?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          ai_enabled: boolean
          assigned_agent_id: string | null
          category: string | null
          created_at: string
          created_by: string
          department: string | null
          id: string
          kind: string
          last_message_at: string
          priority: string
          reference_code: string | null
          status: string
          subject: string
        }
        Insert: {
          ai_enabled?: boolean
          assigned_agent_id?: string | null
          category?: string | null
          created_at?: string
          created_by: string
          department?: string | null
          id?: string
          kind?: string
          last_message_at?: string
          priority?: string
          reference_code?: string | null
          status?: string
          subject?: string
        }
        Update: {
          ai_enabled?: boolean
          assigned_agent_id?: string | null
          category?: string | null
          created_at?: string
          created_by?: string
          department?: string | null
          id?: string
          kind?: string
          last_message_at?: string
          priority?: string
          reference_code?: string | null
          status?: string
          subject?: string
        }
        Relationships: []
      }
      cost_recommendations: {
        Row: {
          category: string
          created_at: string
          detail: string
          effort: string
          estimated_monthly_saving: number
          id: string
          service_id: string | null
          status: string
          title: string
        }
        Insert: {
          category?: string
          created_at?: string
          detail?: string
          effort?: string
          estimated_monthly_saving?: number
          id?: string
          service_id?: string | null
          status?: string
          title: string
        }
        Update: {
          category?: string
          created_at?: string
          detail?: string
          effort?: string
          estimated_monthly_saving?: number
          id?: string
          service_id?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_recommendations_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "api_services"
            referencedColumns: ["id"]
          },
        ]
      }
      data_governance_rules: {
        Row: {
          compliance_tags: string[]
          created_at: string
          data_class: string
          enabled: boolean
          encryption: string
          id: string
          masking: string
          name: string
          region: string
          retention_days: number
        }
        Insert: {
          compliance_tags?: string[]
          created_at?: string
          data_class?: string
          enabled?: boolean
          encryption?: string
          id?: string
          masking?: string
          name: string
          region?: string
          retention_days?: number
        }
        Update: {
          compliance_tags?: string[]
          created_at?: string
          data_class?: string
          enabled?: boolean
          encryption?: string
          id?: string
          masking?: string
          name?: string
          region?: string
          retention_days?: number
        }
        Relationships: []
      }
      demo_alerts: {
        Row: {
          alert_type: string
          created_at: string
          demo_id: string | null
          id: string
          is_resolved: boolean
          message: string
          resolved_at: string | null
          severity: string
        }
        Insert: {
          alert_type?: string
          created_at?: string
          demo_id?: string | null
          id?: string
          is_resolved?: boolean
          message: string
          resolved_at?: string | null
          severity?: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          demo_id?: string | null
          id?: string
          is_resolved?: boolean
          message?: string
          resolved_at?: string | null
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_alerts_demo_id_fkey"
            columns: ["demo_id"]
            isOneToOne: false
            referencedRelation: "demos"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_analytics: {
        Row: {
          avg_duration_seconds: number
          bounce_rate: number
          conversion_count: number
          conversion_rate: number
          created_at: string
          date: string
          demo_id: string
          device_breakdown: Json
          id: string
          region_breakdown: Json
          top_pages: Json
          total_views: number
          unique_views: number
        }
        Insert: {
          avg_duration_seconds?: number
          bounce_rate?: number
          conversion_count?: number
          conversion_rate?: number
          created_at?: string
          date?: string
          demo_id: string
          device_breakdown?: Json
          id?: string
          region_breakdown?: Json
          top_pages?: Json
          total_views?: number
          unique_views?: number
        }
        Update: {
          avg_duration_seconds?: number
          bounce_rate?: number
          conversion_count?: number
          conversion_rate?: number
          created_at?: string
          date?: string
          demo_id?: string
          device_breakdown?: Json
          id?: string
          region_breakdown?: Json
          top_pages?: Json
          total_views?: number
          unique_views?: number
        }
        Relationships: [
          {
            foreignKeyName: "demo_analytics_demo_id_fkey"
            columns: ["demo_id"]
            isOneToOne: false
            referencedRelation: "demos"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          icon: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      demo_clicks: {
        Row: {
          browser: string | null
          city: string | null
          clicked_at: string
          converted: boolean
          country: string | null
          demo_id: string
          device_type: string | null
          id: string
          product_id: string | null
          referrer: string | null
          region: string | null
          session_duration: number | null
          user_id: string | null
        }
        Insert: {
          browser?: string | null
          city?: string | null
          clicked_at?: string
          converted?: boolean
          country?: string | null
          demo_id: string
          device_type?: string | null
          id?: string
          product_id?: string | null
          referrer?: string | null
          region?: string | null
          session_duration?: number | null
          user_id?: string | null
        }
        Update: {
          browser?: string | null
          city?: string | null
          clicked_at?: string
          converted?: boolean
          country?: string | null
          demo_id?: string
          device_type?: string | null
          id?: string
          product_id?: string | null
          referrer?: string | null
          region?: string | null
          session_duration?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demo_clicks_demo_id_fkey"
            columns: ["demo_id"]
            isOneToOne: false
            referencedRelation: "demos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_clicks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_health: {
        Row: {
          checked_at: string
          demo_id: string
          error_message: string | null
          http_status: number | null
          id: string
          response_time: number | null
          status: Database["public"]["Enums"]["demo_status"]
        }
        Insert: {
          checked_at?: string
          demo_id: string
          error_message?: string | null
          http_status?: number | null
          id?: string
          response_time?: number | null
          status?: Database["public"]["Enums"]["demo_status"]
        }
        Update: {
          checked_at?: string
          demo_id?: string
          error_message?: string | null
          http_status?: number | null
          id?: string
          response_time?: number | null
          status?: Database["public"]["Enums"]["demo_status"]
        }
        Relationships: [
          {
            foreignKeyName: "demo_health_demo_id_fkey"
            columns: ["demo_id"]
            isOneToOne: false
            referencedRelation: "demos"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_login_credentials: {
        Row: {
          created_at: string
          demo_id: string
          id: string
          is_active: boolean
          login_url: string | null
          notes: string | null
          password: string
          role_type: string
          username: string
        }
        Insert: {
          created_at?: string
          demo_id: string
          id?: string
          is_active?: boolean
          login_url?: string | null
          notes?: string | null
          password: string
          role_type?: string
          username: string
        }
        Update: {
          created_at?: string
          demo_id?: string
          id?: string
          is_active?: boolean
          login_url?: string | null
          notes?: string | null
          password?: string
          role_type?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_login_credentials_demo_id_fkey"
            columns: ["demo_id"]
            isOneToOne: false
            referencedRelation: "demos"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_requests: {
        Row: {
          company: string | null
          created_at: string
          demo_id: string | null
          id: string
          message: string | null
          product_id: string | null
          requester_email: string
          requester_name: string
          status: string
          updated_at: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          demo_id?: string | null
          id?: string
          message?: string | null
          product_id?: string | null
          requester_email: string
          requester_name: string
          status?: string
          updated_at?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          demo_id?: string | null
          id?: string
          message?: string | null
          product_id?: string | null
          requester_email?: string
          requester_name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_requests_demo_id_fkey"
            columns: ["demo_id"]
            isOneToOne: false
            referencedRelation: "demos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_technologies: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          name: string
          stack: Database["public"]["Enums"]["demo_tech_stack"]
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          stack?: Database["public"]["Enums"]["demo_tech_stack"]
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          stack?: Database["public"]["Enums"]["demo_tech_stack"]
        }
        Relationships: []
      }
      demo_url_audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          demo_url_id: string | null
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          demo_url_id?: string | null
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          demo_url_id?: string | null
          id?: string
          metadata?: Json
        }
        Relationships: []
      }
      demos: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          ai_category_suggestion: string | null
          ai_tech_suggestion: string | null
          backup_url: string | null
          category: string
          category_id: string | null
          created_at: string
          created_by: string | null
          demo_banner_text: string | null
          demo_type: string
          description: string | null
          disable_destructive: boolean
          disable_exports: boolean
          expiry_date: string | null
          health_check_interval: number
          health_score: number
          http_status: number | null
          id: string
          is_bulk_created: boolean
          is_trending: boolean
          last_health_check: string | null
          last_verified_at: string | null
          lifecycle_status: string
          login_url: string | null
          masked_url: string | null
          max_concurrent_logins: number
          multi_login_enabled: boolean
          normalized_url: string | null
          renewal_date: string | null
          response_time_ms: number | null
          status: Database["public"]["Enums"]["demo_status"]
          tech_stack: Database["public"]["Enums"]["demo_tech_stack"]
          technology_id: string | null
          title: string
          total_login_roles: number
          updated_at: string
          uptime_percentage: number
          url: string
          verification_status: string
          video_fallback_url: string | null
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          ai_category_suggestion?: string | null
          ai_tech_suggestion?: string | null
          backup_url?: string | null
          category?: string
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          demo_banner_text?: string | null
          demo_type?: string
          description?: string | null
          disable_destructive?: boolean
          disable_exports?: boolean
          expiry_date?: string | null
          health_check_interval?: number
          health_score?: number
          http_status?: number | null
          id?: string
          is_bulk_created?: boolean
          is_trending?: boolean
          last_health_check?: string | null
          last_verified_at?: string | null
          lifecycle_status?: string
          login_url?: string | null
          masked_url?: string | null
          max_concurrent_logins?: number
          multi_login_enabled?: boolean
          normalized_url?: string | null
          renewal_date?: string | null
          response_time_ms?: number | null
          status?: Database["public"]["Enums"]["demo_status"]
          tech_stack?: Database["public"]["Enums"]["demo_tech_stack"]
          technology_id?: string | null
          title: string
          total_login_roles?: number
          updated_at?: string
          uptime_percentage?: number
          url: string
          verification_status?: string
          video_fallback_url?: string | null
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          ai_category_suggestion?: string | null
          ai_tech_suggestion?: string | null
          backup_url?: string | null
          category?: string
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          demo_banner_text?: string | null
          demo_type?: string
          description?: string | null
          disable_destructive?: boolean
          disable_exports?: boolean
          expiry_date?: string | null
          health_check_interval?: number
          health_score?: number
          http_status?: number | null
          id?: string
          is_bulk_created?: boolean
          is_trending?: boolean
          last_health_check?: string | null
          last_verified_at?: string | null
          lifecycle_status?: string
          login_url?: string | null
          masked_url?: string | null
          max_concurrent_logins?: number
          multi_login_enabled?: boolean
          normalized_url?: string | null
          renewal_date?: string | null
          response_time_ms?: number | null
          status?: Database["public"]["Enums"]["demo_status"]
          tech_stack?: Database["public"]["Enums"]["demo_tech_stack"]
          technology_id?: string | null
          title?: string
          total_login_roles?: number
          updated_at?: string
          uptime_percentage?: number
          url?: string
          verification_status?: string
          video_fallback_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demos_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "demo_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demos_technology_id_fkey"
            columns: ["technology_id"]
            isOneToOne: false
            referencedRelation: "demo_technologies"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_controls: {
        Row: {
          description: string | null
          engaged: boolean
          engaged_at: string | null
          engaged_by: string | null
          id: string
          key: string
          label: string
          scope: string
        }
        Insert: {
          description?: string | null
          engaged?: boolean
          engaged_at?: string | null
          engaged_by?: string | null
          id?: string
          key: string
          label: string
          scope?: string
        }
        Update: {
          description?: string | null
          engaged?: boolean
          engaged_at?: string | null
          engaged_by?: string | null
          id?: string
          key?: string
          label?: string
          scope?: string
        }
        Relationships: []
      }
      error_events: {
        Row: {
          created_at: string
          fingerprint: string
          fn_name: string | null
          id: string
          message: string
          metadata: Json
          occurred_at: string
          resolved: boolean
          route: string | null
          severity: string
          source: string
          stack: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          fingerprint: string
          fn_name?: string | null
          id?: string
          message: string
          metadata?: Json
          occurred_at?: string
          resolved?: boolean
          route?: string | null
          severity?: string
          source: string
          stack?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          fingerprint?: string
          fn_name?: string | null
          id?: string
          message?: string
          metadata?: Json
          occurred_at?: string
          resolved?: boolean
          route?: string | null
          severity?: string
          source?: string
          stack?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      extension_events: {
        Row: {
          created_at: string
          event_type: string
          extension_id: string | null
          id: string
          install_id: string | null
          latency_ms: number
          message: string | null
          metadata: Json
          occurred_at: string
          status: string
        }
        Insert: {
          created_at?: string
          event_type: string
          extension_id?: string | null
          id?: string
          install_id?: string | null
          latency_ms?: number
          message?: string | null
          metadata?: Json
          occurred_at?: string
          status?: string
        }
        Update: {
          created_at?: string
          event_type?: string
          extension_id?: string | null
          id?: string
          install_id?: string | null
          latency_ms?: number
          message?: string | null
          metadata?: Json
          occurred_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "extension_events_extension_id_fkey"
            columns: ["extension_id"]
            isOneToOne: false
            referencedRelation: "extensions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extension_events_install_id_fkey"
            columns: ["install_id"]
            isOneToOne: false
            referencedRelation: "extension_installs"
            referencedColumns: ["id"]
          },
        ]
      }
      extension_installs: {
        Row: {
          config: Json
          created_at: string
          environment: string
          extension_id: string
          granted_scopes: string[]
          health: string
          id: string
          installed_by: string
          last_sync_at: string | null
          monthly_cost_usd: number
          product: string
          status: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          environment?: string
          extension_id: string
          granted_scopes?: string[]
          health?: string
          id?: string
          installed_by?: string
          last_sync_at?: string | null
          monthly_cost_usd?: number
          product?: string
          status?: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          environment?: string
          extension_id?: string
          granted_scopes?: string[]
          health?: string
          id?: string
          installed_by?: string
          last_sync_at?: string | null
          monthly_cost_usd?: number
          product?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "extension_installs_extension_id_fkey"
            columns: ["extension_id"]
            isOneToOne: false
            referencedRelation: "extensions"
            referencedColumns: ["id"]
          },
        ]
      }
      extensions: {
        Row: {
          base_url: string | null
          category: string
          created_at: string
          description: string | null
          docs_url: string | null
          id: string
          install_count: number
          is_official: boolean
          name: string
          price_usd_month: number
          rating: number
          scopes: string[]
          slug: string
          status: string
          updated_at: string
          vendor: string
          version: string
          webhook_url: string | null
        }
        Insert: {
          base_url?: string | null
          category?: string
          created_at?: string
          description?: string | null
          docs_url?: string | null
          id?: string
          install_count?: number
          is_official?: boolean
          name: string
          price_usd_month?: number
          rating?: number
          scopes?: string[]
          slug: string
          status?: string
          updated_at?: string
          vendor: string
          version?: string
          webhook_url?: string | null
        }
        Update: {
          base_url?: string | null
          category?: string
          created_at?: string
          description?: string | null
          docs_url?: string | null
          id?: string
          install_count?: number
          is_official?: boolean
          name?: string
          price_usd_month?: number
          rating?: number
          scopes?: string[]
          slug?: string
          status?: string
          updated_at?: string
          vendor?: string
          version?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      failover_events: {
        Row: {
          extra_latency_ms: number
          from_model: string
          id: string
          occurred_at: string
          reason: string
          result: string
          to_model: string
        }
        Insert: {
          extra_latency_ms?: number
          from_model: string
          id?: string
          occurred_at?: string
          reason: string
          result?: string
          to_model: string
        }
        Update: {
          extra_latency_ms?: number
          from_model?: string
          id?: string
          occurred_at?: string
          reason?: string
          result?: string
          to_model?: string
        }
        Relationships: []
      }
      feature_strip_items: {
        Row: {
          color_class: string
          created_at: string
          icon_name: string
          id: string
          label: string
          position: number
          updated_at: string
          visible: boolean
        }
        Insert: {
          color_class?: string
          created_at?: string
          icon_name?: string
          id?: string
          label: string
          position?: number
          updated_at?: string
          visible?: boolean
        }
        Update: {
          color_class?: string
          created_at?: string
          icon_name?: string
          id?: string
          label?: string
          position?: number
          updated_at?: string
          visible?: boolean
        }
        Relationships: []
      }
      fine_tuning_jobs: {
        Row: {
          base_model: string
          completed_at: string | null
          cost_usd: number
          created_at: string
          dataset_name: string
          dataset_rows: number
          id: string
          metrics: Json
          name: string
          progress: number
          result_model_id: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          base_model: string
          completed_at?: string | null
          cost_usd?: number
          created_at?: string
          dataset_name: string
          dataset_rows?: number
          id?: string
          metrics?: Json
          name: string
          progress?: number
          result_model_id?: string | null
          started_at?: string | null
          status?: string
        }
        Update: {
          base_model?: string
          completed_at?: string | null
          cost_usd?: number
          created_at?: string
          dataset_name?: string
          dataset_rows?: number
          id?: string
          metrics?: Json
          name?: string
          progress?: number
          result_model_id?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      home_hero_slides: {
        Row: {
          accent: string
          created_at: string
          cta_link: string
          cta_primary: string
          cta_secondary: string
          gradient: string
          highlight: string
          icon_name: string
          id: string
          kicker: string
          position: number
          published_at: string | null
          slug: string
          subtitle: string
          title: string
          unpublish_at: string | null
          updated_at: string
          visible: boolean
        }
        Insert: {
          accent: string
          created_at?: string
          cta_link?: string
          cta_primary: string
          cta_secondary: string
          gradient: string
          highlight?: string
          icon_name: string
          id?: string
          kicker: string
          position?: number
          published_at?: string | null
          slug: string
          subtitle: string
          title: string
          unpublish_at?: string | null
          updated_at?: string
          visible?: boolean
        }
        Update: {
          accent?: string
          created_at?: string
          cta_link?: string
          cta_primary?: string
          cta_secondary?: string
          gradient?: string
          highlight?: string
          icon_name?: string
          id?: string
          kicker?: string
          position?: number
          published_at?: string | null
          slug?: string
          subtitle?: string
          title?: string
          unpublish_at?: string | null
          updated_at?: string
          visible?: boolean
        }
        Relationships: []
      }
      homepage_sections: {
        Row: {
          created_at: string
          id: string
          label: string
          position: number
          section_key: string
          updated_at: string
          visible: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          position?: number
          section_key: string
          updated_at?: string
          visible?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          position?: number
          section_key?: string
          updated_at?: string
          visible?: boolean
        }
        Relationships: []
      }
      incidents: {
        Row: {
          id: string
          impact: string | null
          postmortem_url: string | null
          resolved_at: string | null
          root_cause: string | null
          service_id: string | null
          severity: string
          started_at: string
          status: string
          title: string
        }
        Insert: {
          id?: string
          impact?: string | null
          postmortem_url?: string | null
          resolved_at?: string | null
          root_cause?: string | null
          service_id?: string | null
          severity?: string
          started_at?: string
          status?: string
          title: string
        }
        Update: {
          id?: string
          impact?: string | null
          postmortem_url?: string | null
          resolved_at?: string | null
          root_cause?: string | null
          service_id?: string | null
          severity?: string
          started_at?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "api_services"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_usd: number
          due_at: string | null
          id: string
          invoice_number: string
          issued_at: string
          paid_at: string | null
          period_end: string
          period_start: string
          provider_id: string | null
          status: string
          tax_usd: number
        }
        Insert: {
          amount_usd?: number
          due_at?: string | null
          id?: string
          invoice_number: string
          issued_at?: string
          paid_at?: string | null
          period_end: string
          period_start: string
          provider_id?: string | null
          status?: string
          tax_usd?: number
        }
        Update: {
          amount_usd?: number
          due_at?: string | null
          id?: string
          invoice_number?: string
          issued_at?: string
          paid_at?: string | null
          period_end?: string
          period_start?: string
          provider_id?: string | null
          status?: string
          tax_usd?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "ai_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      license_keys: {
        Row: {
          created_at: string
          email: string | null
          expires_at: string | null
          id: string
          last_used_at: string | null
          license_key: string
          plan: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          expires_at?: string | null
          id?: string
          last_used_at?: string | null
          license_key: string
          plan?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          expires_at?: string | null
          id?: string
          last_used_at?: string | null
          license_key?: string
          plan?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      marketplace_categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          image_key: string | null
          is_featured: boolean
          is_hidden: boolean
          name: string
          seo: Json
          slug: string
          sort_order: number
          tone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          image_key?: string | null
          is_featured?: boolean
          is_hidden?: boolean
          name: string
          seo?: Json
          slug: string
          sort_order?: number
          tone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          image_key?: string | null
          is_featured?: boolean
          is_hidden?: boolean
          name?: string
          seo?: Json
          slug?: string
          sort_order?: number
          tone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      marketplace_homepage_sections: {
        Row: {
          config: Json
          created_at: string
          enabled: boolean
          id: string
          key: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          key: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          key?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketplace_products: {
        Row: {
          badge: string | null
          category_id: string | null
          created_at: string
          downloads: number
          downloads_label: string | null
          icon: string | null
          id: string
          industry_label: string | null
          is_ai: boolean
          is_best_seller: boolean
          is_featured: boolean
          is_new_release: boolean
          is_trending: boolean
          name: string
          price_label: string
          price_period: string | null
          publish_at: string | null
          rating: number
          slug: string
          sort_order: number
          unpublish_at: string | null
          updated_at: string
          visible: boolean
        }
        Insert: {
          badge?: string | null
          category_id?: string | null
          created_at?: string
          downloads?: number
          downloads_label?: string | null
          icon?: string | null
          id?: string
          industry_label?: string | null
          is_ai?: boolean
          is_best_seller?: boolean
          is_featured?: boolean
          is_new_release?: boolean
          is_trending?: boolean
          name: string
          price_label?: string
          price_period?: string | null
          publish_at?: string | null
          rating?: number
          slug: string
          sort_order?: number
          unpublish_at?: string | null
          updated_at?: string
          visible?: boolean
        }
        Update: {
          badge?: string | null
          category_id?: string | null
          created_at?: string
          downloads?: number
          downloads_label?: string | null
          icon?: string | null
          id?: string
          industry_label?: string | null
          is_ai?: boolean
          is_best_seller?: boolean
          is_featured?: boolean
          is_new_release?: boolean
          is_trending?: boolean
          name?: string
          price_label?: string
          price_period?: string | null
          publish_at?: string | null
          rating?: number
          slug?: string
          sort_order?: number
          unpublish_at?: string | null
          updated_at?: string
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "marketplace_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_vendors: {
        Row: {
          country: string | null
          created_at: string
          id: string
          name: string
          product_count: number
          rating: number
          slug: string
          updated_at: string
          verified: boolean
          visible: boolean
        }
        Insert: {
          country?: string | null
          created_at?: string
          id?: string
          name: string
          product_count?: number
          rating?: number
          slug: string
          updated_at?: string
          verified?: boolean
          visible?: boolean
        }
        Update: {
          country?: string | null
          created_at?: string
          id?: string
          name?: string
          product_count?: number
          rating?: number
          slug?: string
          updated_at?: string
          verified?: boolean
          visible?: boolean
        }
        Relationships: []
      }
      message_attachments: {
        Row: {
          conversation_id: string
          created_at: string
          duration_seconds: number | null
          file_name: string
          id: string
          media_kind: string
          message_id: string
          mime_type: string
          size_bytes: number
          storage_path: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          duration_seconds?: number | null
          file_name: string
          id?: string
          media_kind?: string
          message_id: string
          mime_type: string
          size_bytes?: number
          storage_path: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          duration_seconds?: number | null
          file_name?: string
          id?: string
          media_kind?: string
          message_id?: string
          mime_type?: string
          size_bytes?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_attachments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_bookmarks: {
        Row: {
          created_at: string
          message_id: string
          pinned: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          message_id: string
          pinned?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          message_id?: string
          pinned?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_bookmarks_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_mentions: {
        Row: {
          message_id: string
          user_id: string
        }
        Insert: {
          message_id: string
          user_id: string
        }
        Update: {
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_mentions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_receipts: {
        Row: {
          delivered_at: string
          message_id: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          delivered_at?: string
          message_id: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          delivered_at?: string
          message_id?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_receipts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          client_ref: string | null
          conversation_id: string
          created_at: string
          id: string
          kind: string
          parent_id: string | null
          sender_id: string
        }
        Insert: {
          body?: string
          client_ref?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          kind?: string
          parent_id?: string | null
          sender_id: string
        }
        Update: {
          body?: string
          client_ref?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          kind?: string
          parent_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      model_evaluations: {
        Row: {
          baseline: number
          evaluated_at: string
          id: string
          metric: string
          model_id: string | null
          notes: string | null
          score: number
          status: string
          suite: string
        }
        Insert: {
          baseline?: number
          evaluated_at?: string
          id?: string
          metric: string
          model_id?: string | null
          notes?: string | null
          score?: number
          status?: string
          suite: string
        }
        Update: {
          baseline?: number
          evaluated_at?: string
          id?: string
          metric?: string
          model_id?: string | null
          notes?: string | null
          score?: number
          status?: string
          suite?: string
        }
        Relationships: [
          {
            foreignKeyName: "model_evaluations_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
        ]
      }
      model_versions: {
        Row: {
          deprecate_at: string | null
          id: string
          model_id: string | null
          notes: string | null
          released_at: string | null
          retire_at: string | null
          stage: string
          version: string
        }
        Insert: {
          deprecate_at?: string | null
          id?: string
          model_id?: string | null
          notes?: string | null
          released_at?: string | null
          retire_at?: string | null
          stage?: string
          version: string
        }
        Update: {
          deprecate_at?: string | null
          id?: string
          model_id?: string | null
          notes?: string | null
          released_at?: string | null
          retire_at?: string | null
          stage?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "model_versions_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
        ]
      }
      on_device_models: {
        Row: {
          accuracy: number
          created_at: string
          downloads: number
          framework: string
          id: string
          name: string
          platforms: string[]
          size_mb: number
          status: string
          version: string
        }
        Insert: {
          accuracy?: number
          created_at?: string
          downloads?: number
          framework?: string
          id?: string
          name: string
          platforms?: string[]
          size_mb?: number
          status?: string
          version?: string
        }
        Update: {
          accuracy?: number
          created_at?: string
          downloads?: number
          framework?: string
          id?: string
          name?: string
          platforms?: string[]
          size_mb?: number
          status?: string
          version?: string
        }
        Relationships: []
      }
      product_apis: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          notes: string | null
          plan: string
          product: string
          quota_monthly: number
          service_id: string | null
          used_this_month: number
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          notes?: string | null
          plan?: string
          product: string
          quota_monthly?: number
          service_id?: string | null
          used_this_month?: number
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          notes?: string | null
          plan?: string
          product?: string
          quota_monthly?: number
          service_id?: string | null
          used_this_month?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_apis_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "api_services"
            referencedColumns: ["id"]
          },
        ]
      }
      product_demo_mappings: {
        Row: {
          demo_id: string
          id: string
          is_active: boolean
          is_primary: boolean
          linked_at: string
          linked_by: string | null
          product_id: string
        }
        Insert: {
          demo_id: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          linked_at?: string
          linked_by?: string | null
          product_id: string
        }
        Update: {
          demo_id?: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          linked_at?: string
          linked_by?: string | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_demo_mappings_demo_id_fkey"
            columns: ["demo_id"]
            isOneToOne: false
            referencedRelation: "demos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_demo_mappings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_demo_urls: {
        Row: {
          created_at: string
          demo_name: string
          description: string | null
          environment: string
          id: string
          last_checked_at: string | null
          last_http_status: number | null
          last_response_ms: number | null
          last_result: string
          password: string | null
          product_id: string | null
          role_name: string
          sort_order: number
          ssl_valid: boolean | null
          status: string
          updated_at: string
          url: string
          username: string | null
        }
        Insert: {
          created_at?: string
          demo_name: string
          description?: string | null
          environment?: string
          id?: string
          last_checked_at?: string | null
          last_http_status?: number | null
          last_response_ms?: number | null
          last_result?: string
          password?: string | null
          product_id?: string | null
          role_name?: string
          sort_order?: number
          ssl_valid?: boolean | null
          status?: string
          updated_at?: string
          url: string
          username?: string | null
        }
        Update: {
          created_at?: string
          demo_name?: string
          description?: string | null
          environment?: string
          id?: string
          last_checked_at?: string | null
          last_http_status?: number | null
          last_response_ms?: number | null
          last_result?: string
          password?: string | null
          product_id?: string | null
          role_name?: string
          sort_order?: number
          ssl_valid?: boolean | null
          status?: string
          updated_at?: string
          url?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_demo_urls_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          display_name: string | null
          email: string | null
          full_name: string | null
          handle: string | null
          id: string
          job_title: string | null
          last_seen_at: string
          phone: string | null
          presence: string
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          handle?: string | null
          id: string
          job_title?: string | null
          last_seen_at?: string
          phone?: string | null
          presence?: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          handle?: string | null
          id?: string
          job_title?: string | null
          last_seen_at?: string
          phone?: string | null
          presence?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      prompt_versions: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          notes: string | null
          prompt_id: string | null
          version: number
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          prompt_id?: string | null
          version: number
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          prompt_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "prompt_versions_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      prompts: {
        Row: {
          category: string
          current_version: number
          description: string | null
          id: string
          name: string
          owner: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          category?: string
          current_version?: number
          description?: string | null
          id?: string
          name: string
          owner?: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          current_version?: number
          description?: string | null
          id?: string
          name?: string
          owner?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action_on_exceed: string
          burst: number
          created_at: string
          current_usage: number
          enabled: boolean
          id: string
          max_requests: number
          scope: string
          service_id: string | null
          window_seconds: number
        }
        Insert: {
          action_on_exceed?: string
          burst?: number
          created_at?: string
          current_usage?: number
          enabled?: boolean
          id?: string
          max_requests?: number
          scope?: string
          service_id?: string | null
          window_seconds?: number
        }
        Update: {
          action_on_exceed?: string
          burst?: number
          created_at?: string
          current_usage?: number
          enabled?: boolean
          id?: string
          max_requests?: number
          scope?: string
          service_id?: string | null
          window_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "rate_limits_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "api_services"
            referencedColumns: ["id"]
          },
        ]
      }
      role_api_permissions: {
        Row: {
          can_admin: boolean
          can_read: boolean
          can_write: boolean
          created_at: string
          id: string
          rate_limit_per_min: number
          role_name: string
          service_id: string | null
        }
        Insert: {
          can_admin?: boolean
          can_read?: boolean
          can_write?: boolean
          created_at?: string
          id?: string
          rate_limit_per_min?: number
          role_name: string
          service_id?: string | null
        }
        Update: {
          can_admin?: boolean
          can_read?: boolean
          can_write?: boolean
          created_at?: string
          id?: string
          rate_limit_per_min?: number
          role_name?: string
          service_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_api_permissions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "api_services"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          id?: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          id?: string
          permission?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      router_rules: {
        Row: {
          active: boolean
          created_at: string
          fallback_model: string | null
          id: string
          matches_30d: number
          name: string
          pattern: string
          priority: string
          sort_order: number
          target_model: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          fallback_model?: string | null
          id?: string
          matches_30d?: number
          name: string
          pattern: string
          priority?: string
          sort_order?: number
          target_model: string
        }
        Update: {
          active?: boolean
          created_at?: string
          fallback_model?: string | null
          id?: string
          matches_30d?: number
          name?: string
          pattern?: string
          priority?: string
          sort_order?: number
          target_model?: string
        }
        Relationships: []
      }
      safety_policies: {
        Row: {
          action: string
          category: string
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          name: string
          severity_threshold: string
          violations_30d: number
        }
        Insert: {
          action?: string
          category?: string
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          name: string
          severity_threshold?: string
          violations_30d?: number
        }
        Update: {
          action?: string
          category?: string
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          name?: string
          severity_threshold?: string
          violations_30d?: number
        }
        Relationships: []
      }
      security_alerts: {
        Row: {
          category: string
          description: string | null
          detected_at: string
          id: string
          resolved_at: string | null
          severity: string
          source: string
          status: string
          title: string
        }
        Insert: {
          category?: string
          description?: string | null
          detected_at?: string
          id?: string
          resolved_at?: string | null
          severity?: string
          source?: string
          status?: string
          title: string
        }
        Update: {
          category?: string
          description?: string | null
          detected_at?: string
          id?: string
          resolved_at?: string | null
          severity?: string
          source?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      site_notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          is_published: boolean
          kind: string
          link_url: string | null
          published_at: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          is_published?: boolean
          kind?: string
          link_url?: string | null
          published_at?: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_published?: boolean
          kind?: string
          link_url?: string | null
          published_at?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          category: string
          description: string | null
          id: string
          key: string
          label: string
          updated_at: string
          value: string
          value_type: string
        }
        Insert: {
          category?: string
          description?: string | null
          id?: string
          key: string
          label: string
          updated_at?: string
          value?: string
          value_type?: string
        }
        Update: {
          category?: string
          description?: string | null
          id?: string
          key?: string
          label?: string
          updated_at?: string
          value?: string
          value_type?: string
        }
        Relationships: []
      }
      usage_daily: {
        Row: {
          avg_latency_ms: number
          cost_usd: number
          day: string
          errors: number
          id: string
          model_id: string | null
          requests: number
          service_id: string | null
          tokens: number
        }
        Insert: {
          avg_latency_ms?: number
          cost_usd?: number
          day: string
          errors?: number
          id?: string
          model_id?: string | null
          requests?: number
          service_id?: string | null
          tokens?: number
        }
        Update: {
          avg_latency_ms?: number
          cost_usd?: number
          day?: string
          errors?: number
          id?: string
          model_id?: string | null
          requests?: number
          service_id?: string | null
          tokens?: number
        }
        Relationships: [
          {
            foreignKeyName: "usage_daily_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_daily_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "api_services"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_events: {
        Row: {
          cost_usd: number
          id: string
          latency_ms: number
          model_id: string | null
          occurred_at: string
          product: string
          requests: number
          service_id: string | null
          source: string
          status_code: number
          success: boolean
          tokens_in: number
          tokens_out: number
        }
        Insert: {
          cost_usd?: number
          id?: string
          latency_ms?: number
          model_id?: string | null
          occurred_at?: string
          product?: string
          requests?: number
          service_id?: string | null
          source?: string
          status_code?: number
          success?: boolean
          tokens_in?: number
          tokens_out?: number
        }
        Update: {
          cost_usd?: number
          id?: string
          latency_ms?: number
          model_id?: string | null
          occurred_at?: string
          product?: string
          requests?: number
          service_id?: string | null
          source?: string
          status_code?: number
          success?: boolean
          tokens_in?: number
          tokens_out?: number
        }
        Relationships: [
          {
            foreignKeyName: "usage_events_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_events_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "api_services"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          description: string | null
          id: string
          reference: string | null
          type: string
          wallet_id: string | null
        }
        Insert: {
          amount: number
          balance_after?: number
          created_at?: string
          description?: string | null
          id?: string
          reference?: string | null
          type: string
          wallet_id?: string | null
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          description?: string | null
          id?: string
          reference?: string | null
          type?: string
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          auto_topup: boolean
          auto_topup_amount: number
          balance: number
          created_at: string
          currency: string
          id: string
          low_balance_threshold: number
          name: string
          status: string
        }
        Insert: {
          auto_topup?: boolean
          auto_topup_amount?: number
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          low_balance_threshold?: number
          name: string
          status?: string
        }
        Update: {
          auto_topup?: boolean
          auto_topup_amount?: number
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          low_balance_threshold?: number
          name?: string
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_participant: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "boss"
        | "founder"
        | "developer"
        | "employee"
        | "vendor"
        | "author"
        | "affiliate"
        | "influencer"
        | "reseller"
        | "franchise"
        | "seo"
        | "marketing"
        | "sales"
        | "finance"
        | "support"
        | "customer"
        | "marketplace-user"
      demo_status: "active" | "inactive" | "maintenance" | "down"
      demo_tech_stack:
        | "php"
        | "node"
        | "java"
        | "python"
        | "react"
        | "angular"
        | "vue"
        | "other"
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
    Enums: {
      app_role: [
        "admin",
        "boss",
        "founder",
        "developer",
        "employee",
        "vendor",
        "author",
        "affiliate",
        "influencer",
        "reseller",
        "franchise",
        "seo",
        "marketing",
        "sales",
        "finance",
        "support",
        "customer",
        "marketplace-user",
      ],
      demo_status: ["active", "inactive", "maintenance", "down"],
      demo_tech_stack: [
        "php",
        "node",
        "java",
        "python",
        "react",
        "angular",
        "vue",
        "other",
      ],
    },
  },
} as const
