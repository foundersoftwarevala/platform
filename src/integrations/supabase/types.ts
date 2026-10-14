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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      achievement_categories: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
          slug: string
          sort_order: number | null
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: []
      }
      achievements: {
        Row: {
          category_id: string | null
          color: string | null
          conditions: Json
          created_at: string
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          image_url: string | null
          is_secret: boolean
          name: string
          rarity: Database["public"]["Enums"]["rarity_tier"]
          rewards: Json
          slug: string
          sort_order: number | null
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
          xp_reward: number
        }
        Insert: {
          category_id?: string | null
          color?: string | null
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_secret?: boolean
          name: string
          rarity?: Database["public"]["Enums"]["rarity_tier"]
          rewards?: Json
          slug: string
          sort_order?: number | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          xp_reward?: number
        }
        Update: {
          category_id?: string | null
          color?: string | null
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_secret?: boolean
          name?: string
          rarity?: Database["public"]["Enums"]["rarity_tier"]
          rewards?: Json
          slug?: string
          sort_order?: number | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "achievements_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "achievement_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_logs: {
        Row: {
          activity: string
          created_at: string
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          activity: string
          created_at?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          activity?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      affiliate_clicks: {
        Row: {
          converted_at: string | null
          converted_order_id: string | null
          country: string | null
          created_at: string
          device_type: string | null
          id: string
          landing_path: string | null
          partner_id: string
          product_id: string | null
          purge_after: string
          referral_code: string | null
          referrer_host: string | null
          session_id: string | null
          visitor_hash: string | null
        }
        Insert: {
          converted_at?: string | null
          converted_order_id?: string | null
          country?: string | null
          created_at?: string
          device_type?: string | null
          id?: string
          landing_path?: string | null
          partner_id: string
          product_id?: string | null
          purge_after?: string
          referral_code?: string | null
          referrer_host?: string | null
          session_id?: string | null
          visitor_hash?: string | null
        }
        Update: {
          converted_at?: string | null
          converted_order_id?: string | null
          country?: string | null
          created_at?: string
          device_type?: string | null
          id?: string
          landing_path?: string | null
          partner_id?: string
          product_id?: string | null
          purge_after?: string
          referral_code?: string | null
          referrer_host?: string | null
          session_id?: string | null
          visitor_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_clicks_converted_order_id_fkey"
            columns: ["converted_order_id"]
            isOneToOne: false
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_clicks_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "marketplace_affiliate_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_clicks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_role_permissions: {
        Row: {
          permission: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          permission: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          permission?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      ai_agent_runs: {
        Row: {
          action: string
          agent_id: string
          error: string | null
          finished_at: string | null
          id: string
          input_source: string
          permission_used: string
          result: string | null
          scope: string
          started_at: string
          state: string
          task_id: string | null
          verification: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          action: string
          agent_id: string
          error?: string | null
          finished_at?: string | null
          id?: string
          input_source: string
          permission_used: string
          result?: string | null
          scope: string
          started_at?: string
          state?: string
          task_id?: string | null
          verification?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          action?: string
          agent_id?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          input_source?: string
          permission_used?: string
          result?: string | null
          scope?: string
          started_at?: string
          state?: string
          task_id?: string | null
          verification?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_runs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_runs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "founder_sales_agent_totals"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "ai_agent_runs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tm_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents: {
        Row: {
          agent_key: string | null
          blocked_reason: string | null
          capability: string | null
          channels: string[]
          created_at: string
          id: string
          languages: string[]
          last_active_at: string | null
          lifecycle: string
          market: string | null
          max_concurrent: number
          max_tokens: number
          model_id: string | null
          name: string
          permissions: string[]
          purpose: string
          region: string | null
          runs_30d: number
          specialization: string | null
          status: string
          success_rate: number
          system_prompt: string
          temperature: number
          territory: string | null
          tools: Json
          working_hours: string | null
        }
        Insert: {
          agent_key?: string | null
          blocked_reason?: string | null
          capability?: string | null
          channels?: string[]
          created_at?: string
          id?: string
          languages?: string[]
          last_active_at?: string | null
          lifecycle?: string
          market?: string | null
          max_concurrent?: number
          max_tokens?: number
          model_id?: string | null
          name: string
          permissions?: string[]
          purpose: string
          region?: string | null
          runs_30d?: number
          specialization?: string | null
          status?: string
          success_rate?: number
          system_prompt?: string
          temperature?: number
          territory?: string | null
          tools?: Json
          working_hours?: string | null
        }
        Update: {
          agent_key?: string | null
          blocked_reason?: string | null
          capability?: string | null
          channels?: string[]
          created_at?: string
          id?: string
          languages?: string[]
          last_active_at?: string | null
          lifecycle?: string
          market?: string | null
          max_concurrent?: number
          max_tokens?: number
          model_id?: string | null
          name?: string
          permissions?: string[]
          purpose?: string
          region?: string | null
          runs_30d?: number
          specialization?: string | null
          status?: string
          success_rate?: number
          system_prompt?: string
          temperature?: number
          territory?: string | null
          tools?: Json
          working_hours?: string | null
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
      ai_content_generations: {
        Row: {
          actor: string | null
          api_kind: string | null
          blocks_returned: string[] | null
          content_types: string[]
          context_fields: string[] | null
          context_hash: string | null
          cost_available: boolean
          cost_usd: number | null
          created_at: string
          error_code: string | null
          error_detail: string | null
          finished_at: string | null
          http_status: number | null
          id: string
          job_id: string | null
          language: string
          latency_ms: number | null
          missing_fields: string[] | null
          model_id: string | null
          parsed_output: Json | null
          product_id: string
          prompt_hash: string | null
          prompt_key: string | null
          prompt_version: number | null
          provider_slug: string | null
          raw_output: Json | null
          status: string
          template_key: string | null
          tokens_in: number | null
          tokens_out: number | null
          usage_available: boolean
        }
        Insert: {
          actor?: string | null
          api_kind?: string | null
          blocks_returned?: string[] | null
          content_types: string[]
          context_fields?: string[] | null
          context_hash?: string | null
          cost_available?: boolean
          cost_usd?: number | null
          created_at?: string
          error_code?: string | null
          error_detail?: string | null
          finished_at?: string | null
          http_status?: number | null
          id?: string
          job_id?: string | null
          language?: string
          latency_ms?: number | null
          missing_fields?: string[] | null
          model_id?: string | null
          parsed_output?: Json | null
          product_id: string
          prompt_hash?: string | null
          prompt_key?: string | null
          prompt_version?: number | null
          provider_slug?: string | null
          raw_output?: Json | null
          status?: string
          template_key?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
          usage_available?: boolean
        }
        Update: {
          actor?: string | null
          api_kind?: string | null
          blocks_returned?: string[] | null
          content_types?: string[]
          context_fields?: string[] | null
          context_hash?: string | null
          cost_available?: boolean
          cost_usd?: number | null
          created_at?: string
          error_code?: string | null
          error_detail?: string | null
          finished_at?: string | null
          http_status?: number | null
          id?: string
          job_id?: string | null
          language?: string
          latency_ms?: number | null
          missing_fields?: string[] | null
          model_id?: string | null
          parsed_output?: Json | null
          product_id?: string
          prompt_hash?: string | null
          prompt_key?: string | null
          prompt_version?: number | null
          provider_slug?: string | null
          raw_output?: Json | null
          status?: string
          template_key?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
          usage_available?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ai_content_generations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_content_items: {
        Row: {
          ai_original: string | null
          ai_original_json: Json | null
          approved_at: string | null
          approved_by: string | null
          archived_at: string | null
          content: string | null
          content_json: Json | null
          content_type: string
          context_hash: string | null
          created_at: string
          created_by: string | null
          current_version: number
          duplicate_of: string | null
          duplicate_score: number | null
          duplicate_state: string
          edited_at: string | null
          edited_by: string | null
          generated_at: string | null
          human_edited: boolean
          id: string
          language: string
          legal_findings: Json
          legal_reviewed_at: string | null
          legal_reviewed_by: string | null
          legal_state: string
          product_id: string
          provenance: string
          publish_state: string
          publish_targets: Json
          published_at: string | null
          published_by: string | null
          rejection_code: string | null
          rejection_reason: string | null
          stale: boolean
          stale_reason: string | null
          stale_since: string | null
          status: string
          submitted_at: string | null
          updated_at: string
          validation: Json
          validation_state: string
        }
        Insert: {
          ai_original?: string | null
          ai_original_json?: Json | null
          approved_at?: string | null
          approved_by?: string | null
          archived_at?: string | null
          content?: string | null
          content_json?: Json | null
          content_type: string
          context_hash?: string | null
          created_at?: string
          created_by?: string | null
          current_version?: number
          duplicate_of?: string | null
          duplicate_score?: number | null
          duplicate_state?: string
          edited_at?: string | null
          edited_by?: string | null
          generated_at?: string | null
          human_edited?: boolean
          id?: string
          language?: string
          legal_findings?: Json
          legal_reviewed_at?: string | null
          legal_reviewed_by?: string | null
          legal_state?: string
          product_id: string
          provenance?: string
          publish_state?: string
          publish_targets?: Json
          published_at?: string | null
          published_by?: string | null
          rejection_code?: string | null
          rejection_reason?: string | null
          stale?: boolean
          stale_reason?: string | null
          stale_since?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          validation?: Json
          validation_state?: string
        }
        Update: {
          ai_original?: string | null
          ai_original_json?: Json | null
          approved_at?: string | null
          approved_by?: string | null
          archived_at?: string | null
          content?: string | null
          content_json?: Json | null
          content_type?: string
          context_hash?: string | null
          created_at?: string
          created_by?: string | null
          current_version?: number
          duplicate_of?: string | null
          duplicate_score?: number | null
          duplicate_state?: string
          edited_at?: string | null
          edited_by?: string | null
          generated_at?: string | null
          human_edited?: boolean
          id?: string
          language?: string
          legal_findings?: Json
          legal_reviewed_at?: string | null
          legal_reviewed_by?: string | null
          legal_state?: string
          product_id?: string
          provenance?: string
          publish_state?: string
          publish_targets?: Json
          published_at?: string | null
          published_by?: string | null
          rejection_code?: string | null
          rejection_reason?: string | null
          stale?: boolean
          stale_reason?: string | null
          stale_since?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          validation?: Json
          validation_state?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_content_items_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_content_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_content_job_items: {
        Row: {
          attempts: number
          error: string | null
          generation_id: string | null
          id: string
          job_id: string
          product_id: string
          skip_reason: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          error?: string | null
          generation_id?: string | null
          id?: string
          job_id: string
          product_id: string
          skip_reason?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          error?: string | null
          generation_id?: string | null
          id?: string
          job_id?: string
          product_id?: string
          skip_reason?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_content_job_items_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "ai_content_generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_content_job_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ai_content_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_content_job_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_content_jobs: {
        Row: {
          completed: number
          content_types: string[]
          created_at: string
          created_by: string | null
          failed: number
          filters: Json
          finished_at: string | null
          id: string
          language: string
          last_error: string | null
          needs_review: number
          scope: string
          skipped: number
          started_at: string | null
          status: string
          total: number
        }
        Insert: {
          completed?: number
          content_types: string[]
          created_at?: string
          created_by?: string | null
          failed?: number
          filters?: Json
          finished_at?: string | null
          id?: string
          language?: string
          last_error?: string | null
          needs_review?: number
          scope: string
          skipped?: number
          started_at?: string | null
          status?: string
          total?: number
        }
        Update: {
          completed?: number
          content_types?: string[]
          created_at?: string
          created_by?: string | null
          failed?: number
          filters?: Json
          finished_at?: string | null
          id?: string
          language?: string
          last_error?: string | null
          needs_review?: number
          scope?: string
          skipped?: number
          started_at?: string | null
          status?: string
          total?: number
        }
        Relationships: []
      }
      ai_content_legal_rules: {
        Row: {
          action: string
          active: boolean
          category: string
          code: string
          created_at: string
          label: string
          note: string
          pattern: string
          severity: string
        }
        Insert: {
          action?: string
          active?: boolean
          category: string
          code: string
          created_at?: string
          label: string
          note?: string
          pattern: string
          severity?: string
        }
        Update: {
          action?: string
          active?: boolean
          category?: string
          code?: string
          created_at?: string
          label?: string
          note?: string
          pattern?: string
          severity?: string
        }
        Relationships: []
      }
      ai_content_reviews: {
        Row: {
          created_at: string
          decision: string
          id: string
          item_id: string
          reason: string | null
          reason_code: string | null
          reviewer: string | null
          reviewer_role: string | null
          version: number | null
        }
        Insert: {
          created_at?: string
          decision: string
          id?: string
          item_id: string
          reason?: string | null
          reason_code?: string | null
          reviewer?: string | null
          reviewer_role?: string | null
          version?: number | null
        }
        Update: {
          created_at?: string
          decision?: string
          id?: string
          item_id?: string
          reason?: string | null
          reason_code?: string | null
          reviewer?: string | null
          reviewer_role?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_content_reviews_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "ai_content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_content_settings: {
        Row: {
          allowed_languages: string[]
          blocks: Json
          brand_voice: Json
          bulk_batch_size: number
          daily_request_cap: number
          default_language: string
          duplicate_threshold: number
          high_similarity_threshold: number
          id: boolean
          legal_block_is_absolute: boolean
          legal_review_types: string[]
          limits: Json
          max_output_tokens: number
          model_id: string | null
          overwrite_existing_product_copy: boolean
          provider_slug: string | null
          publish_policy: string
          request_timeout_ms: number
          temperature: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allowed_languages?: string[]
          blocks?: Json
          brand_voice?: Json
          bulk_batch_size?: number
          daily_request_cap?: number
          default_language?: string
          duplicate_threshold?: number
          high_similarity_threshold?: number
          id?: boolean
          legal_block_is_absolute?: boolean
          legal_review_types?: string[]
          limits?: Json
          max_output_tokens?: number
          model_id?: string | null
          overwrite_existing_product_copy?: boolean
          provider_slug?: string | null
          publish_policy?: string
          request_timeout_ms?: number
          temperature?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allowed_languages?: string[]
          blocks?: Json
          brand_voice?: Json
          bulk_batch_size?: number
          daily_request_cap?: number
          default_language?: string
          duplicate_threshold?: number
          high_similarity_threshold?: number
          id?: boolean
          legal_block_is_absolute?: boolean
          legal_review_types?: string[]
          limits?: Json
          max_output_tokens?: number
          model_id?: string | null
          overwrite_existing_product_copy?: boolean
          provider_slug?: string | null
          publish_policy?: string
          request_timeout_ms?: number
          temperature?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ai_content_templates: {
        Row: {
          active: boolean
          created_at: string
          guidance: string
          id: string
          key: string
          label: string
          match_terms: string[]
          structure: Json
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          guidance?: string
          id?: string
          key: string
          label: string
          match_terms?: string[]
          structure?: Json
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          guidance?: string
          id?: string
          key?: string
          label?: string
          match_terms?: string[]
          structure?: Json
          updated_at?: string
        }
        Relationships: []
      }
      ai_content_usage: {
        Row: {
          cost_available: boolean
          cost_usd: number
          failed: number
          model_id: string
          not_configured: number
          provider_slug: string
          requests: number
          succeeded: number
          tokens_in: number
          tokens_out: number
          updated_at: string
          usage_available: boolean
          usage_date: string
        }
        Insert: {
          cost_available?: boolean
          cost_usd?: number
          failed?: number
          model_id: string
          not_configured?: number
          provider_slug: string
          requests?: number
          succeeded?: number
          tokens_in?: number
          tokens_out?: number
          updated_at?: string
          usage_available?: boolean
          usage_date: string
        }
        Update: {
          cost_available?: boolean
          cost_usd?: number
          failed?: number
          model_id?: string
          not_configured?: number
          provider_slug?: string
          requests?: number
          succeeded?: number
          tokens_in?: number
          tokens_out?: number
          updated_at?: string
          usage_available?: boolean
          usage_date?: string
        }
        Relationships: []
      }
      ai_content_versions: {
        Row: {
          actor: string | null
          actor_role: string | null
          content: string | null
          content_json: Json | null
          context_hash: string | null
          created_at: string
          generation_id: string | null
          id: string
          item_id: string
          kind: string
          note: string | null
          previous_content: string | null
          previous_content_json: Json | null
          status_after: string | null
          status_before: string | null
          version: number
        }
        Insert: {
          actor?: string | null
          actor_role?: string | null
          content?: string | null
          content_json?: Json | null
          context_hash?: string | null
          created_at?: string
          generation_id?: string | null
          id?: string
          item_id: string
          kind: string
          note?: string | null
          previous_content?: string | null
          previous_content_json?: Json | null
          status_after?: string | null
          status_before?: string | null
          version: number
        }
        Update: {
          actor?: string | null
          actor_role?: string | null
          content?: string | null
          content_json?: Json | null
          context_hash?: string | null
          created_at?: string
          generation_id?: string | null
          id?: string
          item_id?: string
          kind?: string
          note?: string | null
          previous_content?: string | null
          previous_content_json?: Json | null
          status_after?: string | null
          status_before?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_content_versions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "ai_content_items"
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
            foreignKeyName: "ai_decision_logs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "founder_sales_agent_totals"
            referencedColumns: ["agent_id"]
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
      ai_prompts: {
        Row: {
          config: Json | null
          id: string
          key: string
          model: string
          name: string
          prompt: string
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          config?: Json | null
          id?: string
          key: string
          model?: string
          name: string
          prompt: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          config?: Json | null
          id?: string
          key?: string
          model?: string
          name?: string
          prompt?: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: []
      }
      ai_providers: {
        Row: {
          api_kind: string | null
          approval_status: string
          auth_type: string
          base_url: string | null
          category: string
          content_generation_enabled: boolean
          created_at: string
          credential_env: string | null
          docs_url: string | null
          id: string
          monthly_cost_usd: number
          name: string
          official_url: string | null
          pricing_tier: string
          region: string
          slug: string
          status: string
        }
        Insert: {
          api_kind?: string | null
          approval_status?: string
          auth_type?: string
          base_url?: string | null
          category?: string
          content_generation_enabled?: boolean
          created_at?: string
          credential_env?: string | null
          docs_url?: string | null
          id?: string
          monthly_cost_usd?: number
          name: string
          official_url?: string | null
          pricing_tier?: string
          region?: string
          slug: string
          status?: string
        }
        Update: {
          api_kind?: string | null
          approval_status?: string
          auth_type?: string
          base_url?: string | null
          category?: string
          content_generation_enabled?: boolean
          created_at?: string
          credential_env?: string | null
          docs_url?: string | null
          id?: string
          monthly_cost_usd?: number
          name?: string
          official_url?: string | null
          pricing_tier?: string
          region?: string
          slug?: string
          status?: string
        }
        Relationships: []
      }
      ams_activity_events: {
        Row: {
          created_at: string
          dedupe_key: string
          entity_id: string | null
          entity_type: string | null
          event_key: string
          id: string
          occurred_at: string
          payload: Json
          processed_at: string | null
          role: string
          source: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          dedupe_key: string
          entity_id?: string | null
          entity_type?: string | null
          event_key: string
          id?: string
          occurred_at?: string
          payload?: Json
          processed_at?: string | null
          role: string
          source?: string
          user_id: string
          value?: number
        }
        Update: {
          created_at?: string
          dedupe_key?: string
          entity_id?: string | null
          entity_type?: string | null
          event_key?: string
          id?: string
          occurred_at?: string
          payload?: Json
          processed_at?: string | null
          role?: string
          source?: string
          user_id?: string
          value?: number
        }
        Relationships: []
      }
      ams_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          id: string
          mime_type: string | null
          ticket_id: string
          uploader_id: string
          url: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number
          id?: string
          mime_type?: string | null
          ticket_id: string
          uploader_id: string
          url: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          id?: string
          mime_type?: string | null
          ticket_id?: string
          uploader_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "ams_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "ams_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ams_award_ledger: {
        Row: {
          asset_kind: string
          asset_slug: string | null
          created_at: string
          event_id: string | null
          id: string
          reason: string | null
          role: string
          rule_id: string | null
          user_id: string
          xp_awarded: number
        }
        Insert: {
          asset_kind: string
          asset_slug?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          reason?: string | null
          role: string
          rule_id?: string | null
          user_id: string
          xp_awarded?: number
        }
        Update: {
          asset_kind?: string
          asset_slug?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          reason?: string | null
          role?: string
          rule_id?: string | null
          user_id?: string
          xp_awarded?: number
        }
        Relationships: [
          {
            foreignKeyName: "ams_award_ledger_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "ams_activity_events"
            referencedColumns: ["id"]
          },
        ]
      }
      ams_certificates: {
        Row: {
          achievement_slug: string | null
          certificate_no: string
          id: string
          issued_at: string
          revoked_at: string | null
          revoked_reason: string | null
          role: string
          stage: number | null
          title: string
          user_id: string
          verification: string
        }
        Insert: {
          achievement_slug?: string | null
          certificate_no: string
          id?: string
          issued_at?: string
          revoked_at?: string | null
          revoked_reason?: string | null
          role: string
          stage?: number | null
          title: string
          user_id: string
          verification?: string
        }
        Update: {
          achievement_slug?: string | null
          certificate_no?: string
          id?: string
          issued_at?: string
          revoked_at?: string | null
          revoked_reason?: string | null
          role?: string
          stage?: number | null
          title?: string
          user_id?: string
          verification?: string
        }
        Relationships: []
      }
      ams_chat_messages: {
        Row: {
          author_id: string | null
          body: string
          bookmarked: boolean
          channel: Database["public"]["Enums"]["ams_chat_channel"]
          created_at: string
          id: string
          metadata: Json
          pinned: boolean
          role: string
          ticket_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          bookmarked?: boolean
          channel?: Database["public"]["Enums"]["ams_chat_channel"]
          created_at?: string
          id?: string
          metadata?: Json
          pinned?: boolean
          role?: string
          ticket_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          bookmarked?: boolean
          channel?: Database["public"]["Enums"]["ams_chat_channel"]
          created_at?: string
          id?: string
          metadata?: Json
          pinned?: boolean
          role?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ams_chat_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "ams_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ams_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          is_internal: boolean
          ticket_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          is_internal?: boolean
          ticket_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          ticket_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ams_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "ams_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ams_events: {
        Row: {
          actor_id: string | null
          created_at: string
          from_value: string | null
          id: string
          kind: Database["public"]["Enums"]["ams_event_kind"]
          payload: Json
          ticket_id: string
          to_value: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          from_value?: string | null
          id?: string
          kind: Database["public"]["Enums"]["ams_event_kind"]
          payload?: Json
          ticket_id: string
          to_value?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          from_value?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["ams_event_kind"]
          payload?: Json
          ticket_id?: string
          to_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ams_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "ams_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ams_passports: {
        Row: {
          issued_at: string
          level: number
          passport_no: string
          role: string
          stage: number
          updated_at: string
          user_id: string
          verification: string
        }
        Insert: {
          issued_at?: string
          level?: number
          passport_no: string
          role: string
          stage?: number
          updated_at?: string
          user_id: string
          verification?: string
        }
        Update: {
          issued_at?: string
          level?: number
          passport_no?: string
          role?: string
          stage?: number
          updated_at?: string
          user_id?: string
          verification?: string
        }
        Relationships: []
      }
      ams_role_stages: {
        Row: {
          created_at: string
          id: string
          min_xp: number
          role: string
          stage: number
          tagline: string | null
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          min_xp?: number
          role: string
          stage: number
          tagline?: string | null
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          min_xp?: number
          role?: string
          stage?: number
          tagline?: string | null
          title?: string
        }
        Relationships: []
      }
      ams_tickets: {
        Row: {
          assignee_id: string | null
          category: string | null
          closed_at: string | null
          created_at: string
          created_by: string
          customer_id: string | null
          deleted_at: string | null
          department: string | null
          description: string | null
          expected_resolution_at: string | null
          id: string
          metadata: Json
          priority: Database["public"]["Enums"]["ams_priority"]
          product: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["ams_status"]
          subject: string
          tags: string[]
          team: string | null
          ticket_no: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          category?: string | null
          closed_at?: string | null
          created_at?: string
          created_by: string
          customer_id?: string | null
          deleted_at?: string | null
          department?: string | null
          description?: string | null
          expected_resolution_at?: string | null
          id?: string
          metadata?: Json
          priority?: Database["public"]["Enums"]["ams_priority"]
          product?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["ams_status"]
          subject: string
          tags?: string[]
          team?: string | null
          ticket_no?: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          category?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string | null
          deleted_at?: string | null
          department?: string | null
          description?: string | null
          expected_resolution_at?: string | null
          id?: string
          metadata?: Json
          priority?: Database["public"]["Enums"]["ams_priority"]
          product?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["ams_status"]
          subject?: string
          tags?: string[]
          team?: string | null
          ticket_no?: string
          updated_at?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json | null
          user_id?: string | null
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
      api_service_capabilities: {
        Row: {
          api_available: boolean
          approval_status: string
          authentication_type: string
          automation_status: string
          capability_key: string
          capability_name: string
          created_at: string
          id: string
          last_verified_at: string | null
          official_docs_url: string | null
          pricing_tier: string
          service_id: string
          supported_countries: string[]
          supported_languages: string[]
          supported_search_engines: string[]
          updated_at: string
          verification_evidence: string | null
          verification_status: string
        }
        Insert: {
          api_available?: boolean
          approval_status?: string
          authentication_type?: string
          automation_status?: string
          capability_key: string
          capability_name: string
          created_at?: string
          id?: string
          last_verified_at?: string | null
          official_docs_url?: string | null
          pricing_tier?: string
          service_id: string
          supported_countries?: string[]
          supported_languages?: string[]
          supported_search_engines?: string[]
          updated_at?: string
          verification_evidence?: string | null
          verification_status?: string
        }
        Update: {
          api_available?: boolean
          approval_status?: string
          authentication_type?: string
          automation_status?: string
          capability_key?: string
          capability_name?: string
          created_at?: string
          id?: string
          last_verified_at?: string | null
          official_docs_url?: string | null
          pricing_tier?: string
          service_id?: string
          supported_countries?: string[]
          supported_languages?: string[]
          supported_search_engines?: string[]
          updated_at?: string
          verification_evidence?: string | null
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_service_capabilities_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "api_services"
            referencedColumns: ["id"]
          },
        ]
      }
      api_services: {
        Row: {
          approval_status: string
          auth_type: string
          avg_latency_ms: number
          capabilities: string[]
          category: string
          commercial_use_notes: string | null
          connected_modules: string[]
          created_at: string
          credential_env: string | null
          docs_url: string | null
          endpoint_url: string | null
          health_status: string
          id: string
          last_checked_at: string | null
          name: string
          official_url: string | null
          owner_team: string
          pricing_tier: string
          provider_id: string | null
          rate_limit_notes: string | null
          slug: string
          status: string
          status_url: string | null
          supported_countries: string[]
          supported_languages: string[]
          supported_search_engines: string[]
          terms_url: string | null
          type: string
          updated_at: string
          uptime_pct: number
          version: string
        }
        Insert: {
          approval_status?: string
          auth_type?: string
          avg_latency_ms?: number
          capabilities?: string[]
          category?: string
          commercial_use_notes?: string | null
          connected_modules?: string[]
          created_at?: string
          credential_env?: string | null
          docs_url?: string | null
          endpoint_url?: string | null
          health_status?: string
          id?: string
          last_checked_at?: string | null
          name: string
          official_url?: string | null
          owner_team?: string
          pricing_tier?: string
          provider_id?: string | null
          rate_limit_notes?: string | null
          slug: string
          status?: string
          status_url?: string | null
          supported_countries?: string[]
          supported_languages?: string[]
          supported_search_engines?: string[]
          terms_url?: string | null
          type?: string
          updated_at?: string
          uptime_pct?: number
          version?: string
        }
        Update: {
          approval_status?: string
          auth_type?: string
          avg_latency_ms?: number
          capabilities?: string[]
          category?: string
          commercial_use_notes?: string | null
          connected_modules?: string[]
          created_at?: string
          credential_env?: string | null
          docs_url?: string | null
          endpoint_url?: string | null
          health_status?: string
          id?: string
          last_checked_at?: string | null
          name?: string
          official_url?: string | null
          owner_team?: string
          pricing_tier?: string
          provider_id?: string | null
          rate_limit_notes?: string | null
          slug?: string
          status?: string
          status_url?: string | null
          supported_countries?: string[]
          supported_languages?: string[]
          supported_search_engines?: string[]
          terms_url?: string | null
          type?: string
          updated_at?: string
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
      assist_access_modes: {
        Row: {
          description: string
          icon: string
          id: string
          is_active: boolean
          label: string
          mode_key: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          description: string
          icon?: string
          id?: string
          is_active?: boolean
          label: string
          mode_key: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          description?: string
          icon?: string
          id?: string
          is_active?: boolean
          label?: string
          mode_key?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      assist_agents: {
        Row: {
          agent_code: string
          created_at: string
          display_name: string
          id: string
          specialisation: string
          status: string
          user_id: string | null
        }
        Insert: {
          agent_code: string
          created_at?: string
          display_name: string
          id?: string
          specialisation?: string
          status?: string
          user_id?: string | null
        }
        Update: {
          agent_code?: string
          created_at?: string
          display_name?: string
          id?: string
          specialisation?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      assist_ai_suggestions: {
        Row: {
          acted_at: string | null
          acted_by: string | null
          confidence: number
          created_at: string
          id: string
          message: string
          session_id: string | null
          status: string
          suggestion_code: string
          suggestion_type: string
        }
        Insert: {
          acted_at?: string | null
          acted_by?: string | null
          confidence?: number
          created_at?: string
          id?: string
          message: string
          session_id?: string | null
          status?: string
          suggestion_code: string
          suggestion_type?: string
        }
        Update: {
          acted_at?: string | null
          acted_by?: string | null
          confidence?: number
          created_at?: string
          id?: string
          message?: string
          session_id?: string | null
          status?: string
          suggestion_code?: string
          suggestion_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "assist_ai_suggestions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "assist_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      assist_approvals: {
        Row: {
          agent_id: string | null
          approval_code: string
          assist_type: string
          awaiting_role: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          end_user_id: string | null
          expires_at: string
          id: string
          request_id: string | null
          scope: string
          session_id: string | null
          status: string
          submitted_at: string
        }
        Insert: {
          agent_id?: string | null
          approval_code: string
          assist_type?: string
          awaiting_role?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          end_user_id?: string | null
          expires_at?: string
          id?: string
          request_id?: string | null
          scope?: string
          session_id?: string | null
          status?: string
          submitted_at?: string
        }
        Update: {
          agent_id?: string | null
          approval_code?: string
          assist_type?: string
          awaiting_role?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          end_user_id?: string | null
          expires_at?: string
          id?: string
          request_id?: string | null
          scope?: string
          session_id?: string | null
          status?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assist_approvals_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "assist_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assist_approvals_end_user_id_fkey"
            columns: ["end_user_id"]
            isOneToOne: false
            referencedRelation: "assist_end_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assist_approvals_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "assist_session_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assist_approvals_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "assist_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      assist_audit_logs: {
        Row: {
          action: string
          actor: string
          actor_role: string
          actor_user_id: string | null
          created_at: string
          id: string
          new_state: Json | null
          old_state: Json | null
          reason: string | null
          result: string
          session_code: string | null
          session_id: string | null
          severity: string
          target: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor: string
          actor_role?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          new_state?: Json | null
          old_state?: Json | null
          reason?: string | null
          result?: string
          session_code?: string | null
          session_id?: string | null
          severity?: string
          target?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor?: string
          actor_role?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          new_state?: Json | null
          old_state?: Json | null
          reason?: string | null
          result?: string
          session_code?: string | null
          session_id?: string | null
          severity?: string
          target?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      assist_chat_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          is_translation: boolean
          sender: string
          sender_user_id: string | null
          session_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_translation?: boolean
          sender: string
          sender_user_id?: string | null
          session_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_translation?: boolean
          sender?: string
          sender_user_id?: string | null
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assist_chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "assist_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      assist_control_state: {
        Row: {
          auto_translate: boolean
          control_mode: string
          cursor_control: boolean
          id: string
          is_paused: boolean
          keyboard_control: boolean
          microphone_enabled: boolean
          resolution_lock: boolean
          session_id: string | null
          speaker_enabled: boolean
          updated_at: string
          voice_active: boolean
          window_specific: boolean
        }
        Insert: {
          auto_translate?: boolean
          control_mode?: string
          cursor_control?: boolean
          id?: string
          is_paused?: boolean
          keyboard_control?: boolean
          microphone_enabled?: boolean
          resolution_lock?: boolean
          session_id?: string | null
          speaker_enabled?: boolean
          updated_at?: string
          voice_active?: boolean
          window_specific?: boolean
        }
        Update: {
          auto_translate?: boolean
          control_mode?: string
          cursor_control?: boolean
          id?: string
          is_paused?: boolean
          keyboard_control?: boolean
          microphone_enabled?: boolean
          resolution_lock?: boolean
          session_id?: string | null
          speaker_enabled?: boolean
          updated_at?: string
          voice_active?: boolean
          window_specific?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "assist_control_state_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "assist_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      assist_emergency_stops: {
        Row: {
          created_at: string
          id: string
          reason: string
          session_code: string
          sessions_affected: number
          stop_code: string
          stop_type: string
          stopped_by: string
          stopped_by_user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          session_code: string
          sessions_affected?: number
          stop_code: string
          stop_type?: string
          stopped_by?: string
          stopped_by_user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          session_code?: string
          sessions_affected?: number
          stop_code?: string
          stop_type?: string
          stopped_by?: string
          stopped_by_user_id?: string | null
        }
        Relationships: []
      }
      assist_end_users: {
        Row: {
          active_window: string | null
          created_at: string
          device: string
          id: string
          operating_system: string
          role: string
          user_code: string
          user_id: string | null
        }
        Insert: {
          active_window?: string | null
          created_at?: string
          device?: string
          id?: string
          operating_system?: string
          role?: string
          user_code: string
          user_id?: string | null
        }
        Update: {
          active_window?: string | null
          created_at?: string
          device?: string
          id?: string
          operating_system?: string
          role?: string
          user_code?: string
          user_id?: string | null
        }
        Relationships: []
      }
      assist_file_transfers: {
        Row: {
          accessed_at: string | null
          auto_delete: boolean
          checksum: string | null
          created_at: string
          deleted_at: string | null
          direction: string
          expires_at: string | null
          file_name: string
          id: string
          initiated_by: string | null
          one_time_access: boolean
          progress: number
          session_id: string | null
          size_bytes: number
          status: string
          storage_path: string | null
          transfer_code: string
        }
        Insert: {
          accessed_at?: string | null
          auto_delete?: boolean
          checksum?: string | null
          created_at?: string
          deleted_at?: string | null
          direction: string
          expires_at?: string | null
          file_name: string
          id?: string
          initiated_by?: string | null
          one_time_access?: boolean
          progress?: number
          session_id?: string | null
          size_bytes?: number
          status?: string
          storage_path?: string | null
          transfer_code: string
        }
        Update: {
          accessed_at?: string | null
          auto_delete?: boolean
          checksum?: string | null
          created_at?: string
          deleted_at?: string | null
          direction?: string
          expires_at?: string | null
          file_name?: string
          id?: string
          initiated_by?: string | null
          one_time_access?: boolean
          progress?: number
          session_id?: string | null
          size_bytes?: number
          status?: string
          storage_path?: string | null
          transfer_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "assist_file_transfers_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "assist_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      assist_privacy_controls: {
        Row: {
          control_key: string
          description: string
          enabled: boolean
          icon: string
          id: string
          is_critical: boolean
          label: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          control_key: string
          description: string
          enabled?: boolean
          icon?: string
          id?: string
          is_critical?: boolean
          label: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          control_key?: string
          description?: string
          enabled?: boolean
          icon?: string
          id?: string
          is_critical?: boolean
          label?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      assist_session_requests: {
        Row: {
          ai_assist_enabled: boolean
          assist_type: string
          created_at: string
          end_user_id: string | null
          id: string
          priority: string
          purpose: string
          request_code: string
          requested_by: string | null
          requested_duration_minutes: number
          requested_scope: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          support_ticket_id: string | null
          target_user_id: string | null
          task_id: string | null
        }
        Insert: {
          ai_assist_enabled?: boolean
          assist_type?: string
          created_at?: string
          end_user_id?: string | null
          id?: string
          priority?: string
          purpose: string
          request_code: string
          requested_by?: string | null
          requested_duration_minutes?: number
          requested_scope?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          support_ticket_id?: string | null
          target_user_id?: string | null
          task_id?: string | null
        }
        Update: {
          ai_assist_enabled?: boolean
          assist_type?: string
          created_at?: string
          end_user_id?: string | null
          id?: string
          priority?: string
          purpose?: string
          request_code?: string
          requested_by?: string | null
          requested_duration_minutes?: number
          requested_scope?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          support_ticket_id?: string | null
          target_user_id?: string | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assist_session_requests_end_user_id_fkey"
            columns: ["end_user_id"]
            isOneToOne: false
            referencedRelation: "assist_end_users"
            referencedColumns: ["id"]
          },
        ]
      }
      assist_session_windows: {
        Row: {
          id: string
          is_visible: boolean
          session_id: string | null
          sort_order: number
          title: string
        }
        Insert: {
          id?: string
          is_visible?: boolean
          session_id?: string | null
          sort_order?: number
          title: string
        }
        Update: {
          id?: string
          is_visible?: boolean
          session_id?: string | null
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "assist_session_windows_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "assist_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      assist_sessions: {
        Row: {
          access_mode: string
          actions_count: number
          agent_id: string | null
          ai_involved: boolean
          ai_score: number
          assist_type: string
          consent_at: string | null
          consent_by: string | null
          consent_granted: boolean
          consent_revoked_at: string | null
          created_at: string
          created_by: string | null
          end_reason: string | null
          end_user_id: string | null
          ended_at: string | null
          frame_rate: number
          id: string
          latency_ms: number
          operator_user_id: string | null
          permissions: string[]
          promise_id: string | null
          purpose: string | null
          resolution: string
          restrictions: string[]
          risk_level: string
          session_code: string
          started_at: string | null
          status: string
          support_ticket_id: string | null
          target_user_id: string | null
          task_id: string | null
          updated_at: string
        }
        Insert: {
          access_mode?: string
          actions_count?: number
          agent_id?: string | null
          ai_involved?: boolean
          ai_score?: number
          assist_type?: string
          consent_at?: string | null
          consent_by?: string | null
          consent_granted?: boolean
          consent_revoked_at?: string | null
          created_at?: string
          created_by?: string | null
          end_reason?: string | null
          end_user_id?: string | null
          ended_at?: string | null
          frame_rate?: number
          id?: string
          latency_ms?: number
          operator_user_id?: string | null
          permissions?: string[]
          promise_id?: string | null
          purpose?: string | null
          resolution?: string
          restrictions?: string[]
          risk_level?: string
          session_code: string
          started_at?: string | null
          status?: string
          support_ticket_id?: string | null
          target_user_id?: string | null
          task_id?: string | null
          updated_at?: string
        }
        Update: {
          access_mode?: string
          actions_count?: number
          agent_id?: string | null
          ai_involved?: boolean
          ai_score?: number
          assist_type?: string
          consent_at?: string | null
          consent_by?: string | null
          consent_granted?: boolean
          consent_revoked_at?: string | null
          created_at?: string
          created_by?: string | null
          end_reason?: string | null
          end_user_id?: string | null
          ended_at?: string | null
          frame_rate?: number
          id?: string
          latency_ms?: number
          operator_user_id?: string | null
          permissions?: string[]
          promise_id?: string | null
          purpose?: string | null
          resolution?: string
          restrictions?: string[]
          risk_level?: string
          session_code?: string
          started_at?: string | null
          status?: string
          support_ticket_id?: string | null
          target_user_id?: string | null
          task_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assist_sessions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "assist_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assist_sessions_end_user_id_fkey"
            columns: ["end_user_id"]
            isOneToOne: false
            referencedRelation: "assist_end_users"
            referencedColumns: ["id"]
          },
        ]
      }
      assist_settings: {
        Row: {
          control_type: string
          id: string
          is_locked: boolean
          label: string
          section: string
          setting_key: string
          sort_order: number
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          control_type: string
          id?: string
          is_locked?: boolean
          label: string
          section: string
          setting_key: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          control_type?: string
          id?: string
          is_locked?: boolean
          label?: string
          section?: string
          setting_key?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
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
      author_approval_evidence: {
        Row: {
          added_by: string | null
          created_at: string
          detail: string | null
          id: string
          kind: string
          label: string
          storage_path: string | null
          submission_id: string
          url: string | null
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          kind: string
          label: string
          storage_path?: string | null
          submission_id: string
          url?: string | null
        }
        Update: {
          added_by?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          kind?: string
          label?: string
          storage_path?: string | null
          submission_id?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "author_approval_evidence_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "author_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      author_approval_history: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          ai_recommendation: Json | null
          comment: string | null
          created_at: string
          evidence: Json
          from_status: string | null
          id: string
          reason: string | null
          revision: number
          submission_id: string
          to_status: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          ai_recommendation?: Json | null
          comment?: string | null
          created_at?: string
          evidence?: Json
          from_status?: string | null
          id?: string
          reason?: string | null
          revision: number
          submission_id: string
          to_status?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          ai_recommendation?: Json | null
          comment?: string | null
          created_at?: string
          evidence?: Json
          from_status?: string | null
          id?: string
          reason?: string | null
          revision?: number
          submission_id?: string
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "author_approval_history_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "author_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      author_approval_rules: {
        Row: {
          config: Json
          created_at: string
          description: string
          enabled: boolean
          key: string
          label: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config?: Json
          created_at?: string
          description: string
          enabled?: boolean
          key: string
          label: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config?: Json
          created_at?: string
          description?: string
          enabled?: boolean
          key?: string
          label?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      author_approval_sla: {
        Row: {
          escalate_hours: number
          id: boolean
          response_hours: number
          stale_draft_days: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          escalate_hours?: number
          id?: boolean
          response_hours?: number
          stale_draft_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          escalate_hours?: number
          id?: boolean
          response_hours?: number
          stale_draft_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      author_submissions: {
        Row: {
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          escalate_at: string | null
          escalated_at: string | null
          id: string
          last_action: string | null
          last_reason: string | null
          lock_version: number
          product_id: string
          review_started_at: string | null
          reviewer_id: string | null
          revision: number
          risk_level: string
          risk_reasons: Json
          risk_score: number
          seller_id: string | null
          sla_due_at: string | null
          status: string
          submission_no: string
          submission_type: string
          submitted_at: string | null
          updated_at: string
          version_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          escalate_at?: string | null
          escalated_at?: string | null
          id?: string
          last_action?: string | null
          last_reason?: string | null
          lock_version?: number
          product_id: string
          review_started_at?: string | null
          reviewer_id?: string | null
          revision?: number
          risk_level?: string
          risk_reasons?: Json
          risk_score?: number
          seller_id?: string | null
          sla_due_at?: string | null
          status?: string
          submission_no: string
          submission_type?: string
          submitted_at?: string | null
          updated_at?: string
          version_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          escalate_at?: string | null
          escalated_at?: string | null
          id?: string
          last_action?: string | null
          last_reason?: string | null
          lock_version?: number
          product_id?: string
          review_started_at?: string | null
          reviewer_id?: string | null
          revision?: number
          risk_level?: string
          risk_reasons?: Json
          risk_score?: number
          seller_id?: string | null
          sla_due_at?: string | null
          status?: string
          submission_no?: string
          submission_type?: string
          submitted_at?: string | null
          updated_at?: string
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "author_submissions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "author_submissions_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "marketplace_sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "author_submissions_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "marketplace_product_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          action_config: Json
          action_text: string
          action_type: string
          condition: Json
          condition_text: string | null
          created_at: string
          enabled: boolean
          id: string
          is_enabled: boolean
          last_run_at: string | null
          name: string
          run_count: number
          runs_count: number
          scope: string
          trigger_event: string
          trigger_type: string
          updated_at: string
        }
        Insert: {
          action_config?: Json
          action_text?: string
          action_type?: string
          condition?: Json
          condition_text?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          is_enabled?: boolean
          last_run_at?: string | null
          name: string
          run_count?: number
          runs_count?: number
          scope?: string
          trigger_event?: string
          trigger_type?: string
          updated_at?: string
        }
        Update: {
          action_config?: Json
          action_text?: string
          action_type?: string
          condition?: Json
          condition_text?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          is_enabled?: boolean
          last_run_at?: string | null
          name?: string
          run_count?: number
          runs_count?: number
          scope?: string
          trigger_event?: string
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      awards: {
        Row: {
          audit: Json
          category: string | null
          conditions: Json
          created_at: string
          created_by: string | null
          department: string | null
          description: string
          eligibility_rules: Json
          id: string
          media: Json
          name: string
          priority: number
          rarity: string
          rewards: Json
          slug: string
          status: string
          supported_modules: Json
          supported_roles: Json
          type: string
          unlock_conditions: Json
          updated_at: string
          versions: Json
          visibility: string
        }
        Insert: {
          audit?: Json
          category?: string | null
          conditions?: Json
          created_at?: string
          created_by?: string | null
          department?: string | null
          description?: string
          eligibility_rules?: Json
          id?: string
          media?: Json
          name: string
          priority?: number
          rarity?: string
          rewards?: Json
          slug: string
          status?: string
          supported_modules?: Json
          supported_roles?: Json
          type?: string
          unlock_conditions?: Json
          updated_at?: string
          versions?: Json
          visibility?: string
        }
        Update: {
          audit?: Json
          category?: string | null
          conditions?: Json
          created_at?: string
          created_by?: string | null
          department?: string | null
          description?: string
          eligibility_rules?: Json
          id?: string
          media?: Json
          name?: string
          priority?: number
          rarity?: string
          rewards?: Json
          slug?: string
          status?: string
          supported_modules?: Json
          supported_roles?: Json
          type?: string
          unlock_conditions?: Json
          updated_at?: string
          versions?: Json
          visibility?: string
        }
        Relationships: []
      }
      badge_collections: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
          slug: string
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          slug: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          slug?: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: []
      }
      badges: {
        Row: {
          collection_id: string | null
          color: string | null
          conditions: Json
          created_at: string
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          image_url: string | null
          name: string
          rarity: Database["public"]["Enums"]["rarity_tier"]
          slug: string
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          collection_id?: string | null
          color?: string | null
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          name: string
          rarity?: Database["public"]["Enums"]["rarity_tier"]
          slug: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          collection_id?: string | null
          color?: string | null
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          name?: string
          rarity?: Database["public"]["Enums"]["rarity_tier"]
          slug?: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "badges_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "badge_collections"
            referencedColumns: ["id"]
          },
        ]
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
      blackbox_events: {
        Row: {
          created_at: string
          device_fingerprint: string | null
          entity_id: string | null
          entity_type: string | null
          event_type: string
          geo_location: string | null
          id: string
          ip_address: string | null
          is_sealed: boolean
          metadata: Json | null
          module_name: string
          risk_score: number | null
          role_name: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          device_fingerprint?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          geo_location?: string | null
          id?: string
          ip_address?: string | null
          is_sealed?: boolean
          metadata?: Json | null
          module_name: string
          risk_score?: number | null
          role_name?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          device_fingerprint?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          geo_location?: string | null
          id?: string
          ip_address?: string | null
          is_sealed?: boolean
          metadata?: Json | null
          module_name?: string
          risk_score?: number | null
          role_name?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bot_conversation_logs: {
        Row: {
          bot_id: string | null
          confidence: number | null
          created_at: string
          id: string
          intent: string | null
          language: string
          message_count: number
          outcome: string
          session_id: string | null
        }
        Insert: {
          bot_id?: string | null
          confidence?: number | null
          created_at?: string
          id?: string
          intent?: string | null
          language?: string
          message_count?: number
          outcome?: string
          session_id?: string | null
        }
        Update: {
          bot_id?: string | null
          confidence?: number | null
          created_at?: string
          id?: string
          intent?: string | null
          language?: string
          message_count?: number
          outcome?: string
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_conversation_logs_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "chatbots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_conversation_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_languages: {
        Row: {
          code: string
          conversations: number
          coverage: number
          created_at: string
          id: string
          is_enabled: boolean
          name: string
        }
        Insert: {
          code: string
          conversations?: number
          coverage?: number
          created_at?: string
          id?: string
          is_enabled?: boolean
          name: string
        }
        Update: {
          code?: string
          conversations?: number
          coverage?: number
          created_at?: string
          id?: string
          is_enabled?: boolean
          name?: string
        }
        Relationships: []
      }
      bot_training_documents: {
        Row: {
          accuracy: number
          bot_id: string | null
          chunks: number
          created_at: string
          id: string
          last_trained_at: string | null
          source_type: string
          status: string
          title: string
        }
        Insert: {
          accuracy?: number
          bot_id?: string | null
          chunks?: number
          created_at?: string
          id?: string
          last_trained_at?: string | null
          source_type?: string
          status?: string
          title: string
        }
        Update: {
          accuracy?: number
          bot_id?: string | null
          chunks?: number
          created_at?: string
          id?: string
          last_trained_at?: string | null
          source_type?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_training_documents_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "chatbots"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_asset_versions: {
        Row: {
          asset_id: string
          change_summary: string | null
          changed_at: string
          changed_by: string | null
          height: number | null
          id: string
          public_path: string | null
          sha256: string | null
          size_bytes: number | null
          snapshot: Json
          version: number
          width: number | null
        }
        Insert: {
          asset_id: string
          change_summary?: string | null
          changed_at?: string
          changed_by?: string | null
          height?: number | null
          id?: string
          public_path?: string | null
          sha256?: string | null
          size_bytes?: number | null
          snapshot: Json
          version: number
          width?: number | null
        }
        Update: {
          asset_id?: string
          change_summary?: string | null
          changed_at?: string
          changed_by?: string | null
          height?: number | null
          id?: string
          public_path?: string | null
          sha256?: string | null
          size_bytes?: number | null
          snapshot?: Json
          version?: number
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_asset_versions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "brand_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_assets: {
        Row: {
          active: boolean
          approved: boolean
          approved_at: string | null
          approved_by: string | null
          asset_type: string
          created_at: string
          height: number | null
          id: string
          key: string
          mime_type: string | null
          name: string
          public_path: string | null
          sha256: string | null
          size_bytes: number | null
          updated_at: string
          version: number
          width: number | null
        }
        Insert: {
          active?: boolean
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          asset_type: string
          created_at?: string
          height?: number | null
          id?: string
          key: string
          mime_type?: string | null
          name: string
          public_path?: string | null
          sha256?: string | null
          size_bytes?: number | null
          updated_at?: string
          version?: number
          width?: number | null
        }
        Update: {
          active?: boolean
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          asset_type?: string
          created_at?: string
          height?: number | null
          id?: string
          key?: string
          mime_type?: string | null
          name?: string
          public_path?: string | null
          sha256?: string | null
          size_bytes?: number | null
          updated_at?: string
          version?: number
          width?: number | null
        }
        Relationships: []
      }
      brand_enforcement_rules: {
        Row: {
          action: string
          canonical_asset_key: string | null
          created_at: string
          enabled: boolean
          id: string
          key: string
          label: string
          notes: string | null
          severity: string
          target: string
          updated_at: string
        }
        Insert: {
          action?: string
          canonical_asset_key?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          key: string
          label: string
          notes?: string | null
          severity?: string
          target: string
          updated_at?: string
        }
        Update: {
          action?: string
          canonical_asset_key?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          key?: string
          label?: string
          notes?: string | null
          severity?: string
          target?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_enforcement_rules_canonical_asset_key_fkey"
            columns: ["canonical_asset_key"]
            isOneToOne: false
            referencedRelation: "brand_assets"
            referencedColumns: ["key"]
          },
        ]
      }
      brand_enforcement_runs: {
        Row: {
          blocked: number
          completed_at: string | null
          compliant: number
          detail: Json
          failed: number
          flagged: number
          id: string
          policy_state: string
          replaced: number
          scanned: number
          scope: string
          started_at: string
          started_by: string | null
          whitelisted: number
        }
        Insert: {
          blocked?: number
          completed_at?: string | null
          compliant?: number
          detail?: Json
          failed?: number
          flagged?: number
          id?: string
          policy_state: string
          replaced?: number
          scanned?: number
          scope?: string
          started_at?: string
          started_by?: string | null
          whitelisted?: number
        }
        Update: {
          blocked?: number
          completed_at?: string | null
          compliant?: number
          detail?: Json
          failed?: number
          flagged?: number
          id?: string
          policy_state?: string
          replaced?: number
          scanned?: number
          scope?: string
          started_at?: string
          started_by?: string | null
          whitelisted?: number
        }
        Relationships: []
      }
      brand_protection_events: {
        Row: {
          actor_id: string | null
          actor_role: string | null
          case_id: string | null
          created_at: string
          detail: Json
          event: string
          id: string
          new_state: string | null
          previous_state: string | null
          product_id: string | null
          reason: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_role?: string | null
          case_id?: string | null
          created_at?: string
          detail?: Json
          event: string
          id?: string
          new_state?: string | null
          previous_state?: string | null
          product_id?: string | null
          reason?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_role?: string | null
          case_id?: string | null
          created_at?: string
          detail?: Json
          event?: string
          id?: string
          new_state?: string | null
          previous_state?: string | null
          product_id?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_protection_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "brand_violation_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_protection_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_protection_settings: {
        Row: {
          allow_whitelist_exceptions: boolean
          block_external_logo_overrides: boolean
          block_third_party_favicons: boolean
          block_third_party_manifest: boolean
          id: boolean
          policy_state: string
          protect_package_contents: boolean
          replace_on_upload: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allow_whitelist_exceptions?: boolean
          block_external_logo_overrides?: boolean
          block_third_party_favicons?: boolean
          block_third_party_manifest?: boolean
          id?: boolean
          policy_state?: string
          protect_package_contents?: boolean
          replace_on_upload?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allow_whitelist_exceptions?: boolean
          block_external_logo_overrides?: boolean
          block_third_party_favicons?: boolean
          block_third_party_manifest?: boolean
          id?: boolean
          policy_state?: string
          protect_package_contents?: boolean
          replace_on_upload?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      brand_replacement_history: {
        Row: {
          actor_id: string | null
          actor_kind: string
          case_id: string | null
          created_at: string
          id: string
          original_reference: string | null
          original_sha256: string | null
          product_id: string | null
          reason: string | null
          replacement_asset_key: string | null
          replacement_reference: string | null
          replacement_sha256: string | null
          rule_key: string | null
          surface: string
          verification_detail: string | null
          verified: boolean
        }
        Insert: {
          actor_id?: string | null
          actor_kind?: string
          case_id?: string | null
          created_at?: string
          id?: string
          original_reference?: string | null
          original_sha256?: string | null
          product_id?: string | null
          reason?: string | null
          replacement_asset_key?: string | null
          replacement_reference?: string | null
          replacement_sha256?: string | null
          rule_key?: string | null
          surface: string
          verification_detail?: string | null
          verified?: boolean
        }
        Update: {
          actor_id?: string | null
          actor_kind?: string
          case_id?: string | null
          created_at?: string
          id?: string
          original_reference?: string | null
          original_sha256?: string | null
          product_id?: string | null
          reason?: string | null
          replacement_asset_key?: string | null
          replacement_reference?: string | null
          replacement_sha256?: string | null
          rule_key?: string | null
          surface?: string
          verification_detail?: string | null
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "brand_replacement_history_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "brand_violation_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_replacement_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_replacement_history_replacement_asset_key_fkey"
            columns: ["replacement_asset_key"]
            isOneToOne: false
            referencedRelation: "brand_assets"
            referencedColumns: ["key"]
          },
        ]
      }
      brand_violation_cases: {
        Row: {
          asset_reference: string | null
          case_no: string
          classification: string
          created_at: string
          detection_source: string
          evidence: Json
          id: string
          legal_reference: string | null
          product_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          rule_key: string | null
          seller_id: string | null
          severity: string
          status: string
          surface: string
        }
        Insert: {
          asset_reference?: string | null
          case_no: string
          classification?: string
          created_at?: string
          detection_source?: string
          evidence?: Json
          id?: string
          legal_reference?: string | null
          product_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          rule_key?: string | null
          seller_id?: string | null
          severity?: string
          status?: string
          surface: string
        }
        Update: {
          asset_reference?: string | null
          case_no?: string
          classification?: string
          created_at?: string
          detection_source?: string
          evidence?: Json
          id?: string
          legal_reference?: string | null
          product_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          rule_key?: string | null
          seller_id?: string | null
          severity?: string
          status?: string
          surface?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_violation_cases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_violation_cases_rule_key_fkey"
            columns: ["rule_key"]
            isOneToOne: false
            referencedRelation: "brand_enforcement_rules"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "brand_violation_cases_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "marketplace_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_whitelist_exceptions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          asset_reference: string | null
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          product_id: string | null
          reason: string
          revoked_by: string | null
          revoked_reason: string | null
          rule_key: string | null
          seller_id: string | null
          status: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          asset_reference?: string | null
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          product_id?: string | null
          reason: string
          revoked_by?: string | null
          revoked_reason?: string | null
          rule_key?: string | null
          seller_id?: string | null
          status?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          asset_reference?: string | null
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          product_id?: string | null
          reason?: string
          revoked_by?: string | null
          revoked_reason?: string | null
          rule_key?: string | null
          seller_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_whitelist_exceptions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_whitelist_exceptions_rule_key_fkey"
            columns: ["rule_key"]
            isOneToOne: false
            referencedRelation: "brand_enforcement_rules"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "brand_whitelist_exceptions_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "marketplace_sellers"
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
      call_logs: {
        Row: {
          agent_id: string | null
          caller_name: string
          created_at: string
          customer_id: string | null
          direction: string
          duration_seconds: number
          id: string
          notes: string | null
          phone: string
          started_at: string
          status: string
          wait_seconds: number
        }
        Insert: {
          agent_id?: string | null
          caller_name: string
          created_at?: string
          customer_id?: string | null
          direction?: string
          duration_seconds?: number
          id?: string
          notes?: string | null
          phone: string
          started_at?: string
          status?: string
          wait_seconds?: number
        }
        Update: {
          agent_id?: string | null
          caller_name?: string
          created_at?: string
          customer_id?: string | null
          direction?: string
          duration_seconds?: number
          id?: string
          notes?: string | null
          phone?: string
          started_at?: string
          status?: string
          wait_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          name: string
          rewards: Json | null
          slug: string
          starts_at: string | null
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          name: string
          rewards?: Json | null
          slug: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          name?: string
          rewards?: Json | null
          slug?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: []
      }
      canned_responses: {
        Row: {
          body: string
          category: string
          created_at: string
          id: string
          shortcut: string | null
          title: string
          updated_at: string
          usage_count: number
        }
        Insert: {
          body: string
          category?: string
          created_at?: string
          id?: string
          shortcut?: string | null
          title: string
          updated_at?: string
          usage_count?: number
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          id?: string
          shortcut?: string | null
          title?: string
          updated_at?: string
          usage_count?: number
        }
        Relationships: []
      }
      challenges: {
        Row: {
          conditions: Json
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          id: string
          name: string
          rewards: Json
          starts_at: string | null
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
          xp_reward: number
        }
        Insert: {
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          name: string
          rewards?: Json
          starts_at?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          xp_reward?: number
        }
        Update: {
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          name?: string
          rewards?: Json
          starts_at?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          xp_reward?: number
        }
        Relationships: []
      }
      chat_conversations: {
        Row: {
          allowed_roles: string[]
          created_at: string
          created_by: string | null
          id: string
          module: string
          title: string | null
          updated_at: string
        }
        Insert: {
          allowed_roles?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          module?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          allowed_roles?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          module?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          sender_name: string | null
          sender_type: string
          session_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          sender_name?: string | null
          sender_type?: string
          session_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          sender_name?: string | null
          sender_type?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_participants: {
        Row: {
          conversation_id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          agent_id: string | null
          channel: string
          created_at: string
          ended_at: string | null
          handled_by: string
          id: string
          language: string
          sentiment: string
          started_at: string
          status: string
          unread_count: number
          visitor_email: string | null
          visitor_name: string
        }
        Insert: {
          agent_id?: string | null
          channel?: string
          created_at?: string
          ended_at?: string | null
          handled_by?: string
          id?: string
          language?: string
          sentiment?: string
          started_at?: string
          status?: string
          unread_count?: number
          visitor_email?: string | null
          visitor_name: string
        }
        Update: {
          agent_id?: string | null
          channel?: string
          created_at?: string
          ended_at?: string | null
          handled_by?: string
          id?: string
          language?: string
          sentiment?: string
          started_at?: string
          status?: string
          unread_count?: number
          visitor_email?: string | null
          visitor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbots: {
        Row: {
          channel: string
          conversations: number
          created_at: string
          escalation_rate: number
          id: string
          language: string
          name: string
          purpose: string | null
          resolution_rate: number
          status: string
          updated_at: string
        }
        Insert: {
          channel?: string
          conversations?: number
          created_at?: string
          escalation_rate?: number
          id?: string
          language?: string
          name: string
          purpose?: string | null
          resolution_rate?: number
          status?: string
          updated_at?: string
        }
        Update: {
          channel?: string
          conversations?: number
          created_at?: string
          escalation_rate?: number
          id?: string
          language?: string
          name?: string
          purpose?: string | null
          resolution_rate?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      claims: {
        Row: {
          cost_coins: number
          cost_tokens: number
          created_at: string
          decided_at: string | null
          decided_by: string | null
          fulfilled_at: string | null
          id: string
          notes: string | null
          reward_id: string
          status: Database["public"]["Enums"]["claim_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          cost_coins?: number
          cost_tokens?: number
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          fulfilled_at?: string | null
          id?: string
          notes?: string | null
          reward_id: string
          status?: Database["public"]["Enums"]["claim_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          cost_coins?: number
          cost_tokens?: number
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          fulfilled_at?: string | null
          id?: string
          notes?: string | null
          reward_id?: string
          status?: Database["public"]["Enums"]["claim_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "claims_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          favorite: boolean
          joined_at: string
          last_read_at: string
          muted: boolean
          role_label: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          favorite?: boolean
          joined_at?: string
          last_read_at?: string
          muted?: boolean
          role_label?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          favorite?: boolean
          joined_at?: string
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
          created_at: string
          created_by: string
          id: string
          kind: string
          last_message_at: string
          reference_code: string | null
          subject: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          kind?: string
          last_message_at?: string
          reference_code?: string | null
          subject: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          kind?: string
          last_message_at?: string
          reference_code?: string | null
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
      crm_customers: {
        Row: {
          company_name: string
          contact_name: string
          country: string | null
          created_at: string
          email: string
          health_score: number
          id: string
          industry: string | null
          last_contact_at: string | null
          lifetime_value: number
          open_tickets: number
          owner_id: string | null
          phone: string | null
          plan: string
          status: string
          updated_at: string
        }
        Insert: {
          company_name: string
          contact_name: string
          country?: string | null
          created_at?: string
          email: string
          health_score?: number
          id?: string
          industry?: string | null
          last_contact_at?: string | null
          lifetime_value?: number
          open_tickets?: number
          owner_id?: string | null
          phone?: string | null
          plan?: string
          status?: string
          updated_at?: string
        }
        Update: {
          company_name?: string
          contact_name?: string
          country?: string | null
          created_at?: string
          email?: string
          health_score?: number
          id?: string
          industry?: string | null
          last_contact_at?: string | null
          lifetime_value?: number
          open_tickets?: number
          owner_id?: string | null
          phone?: string | null
          plan?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_customers_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_tasks: {
        Row: {
          created_at: string
          customer_id: string | null
          description: string | null
          due_at: string | null
          id: string
          lead_id: string | null
          owner_id: string | null
          priority: string
          status: string
          task_type: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          lead_id?: string | null
          owner_id?: string | null
          priority?: string
          status?: string
          task_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          lead_id?: string | null
          owner_id?: string | null
          priority?: string
          status?: string
          task_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_tasks_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "sales_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tasks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "team_members"
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
      demo_access_settings: {
        Row: {
          auto_provision_on_publish: boolean
          base_domain: string
          block_search_indexing: boolean
          default_pattern: string
          default_ttl_days: number
          grace_days: number
          id: boolean
          password_protect_by_default: boolean
          reminder_days: number[]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          auto_provision_on_publish?: boolean
          base_domain?: string
          block_search_indexing?: boolean
          default_pattern?: string
          default_ttl_days?: number
          grace_days?: number
          id?: boolean
          password_protect_by_default?: boolean
          reminder_days?: number[]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          auto_provision_on_publish?: boolean
          base_domain?: string
          block_search_indexing?: boolean
          default_pattern?: string
          default_ttl_days?: number
          grace_days?: number
          id?: boolean
          password_protect_by_default?: boolean
          reminder_days?: number[]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      demo_alerts: {
        Row: {
          alert_type: string
          created_at: string
          demo_id: string | null
          demo_url_id: string | null
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
          demo_url_id?: string | null
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
          demo_url_id?: string | null
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
          {
            foreignKeyName: "demo_alerts_demo_url_id_fkey"
            columns: ["demo_url_id"]
            isOneToOne: false
            referencedRelation: "product_demo_urls"
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
          demo_id: string | null
          demo_url_id: string | null
          device_type: string | null
          id: string
          product_id: string | null
          referrer: string | null
          region: string | null
          session_duration: number | null
          source_page: string | null
          user_id: string | null
        }
        Insert: {
          browser?: string | null
          city?: string | null
          clicked_at?: string
          converted?: boolean
          country?: string | null
          demo_id?: string | null
          demo_url_id?: string | null
          device_type?: string | null
          id?: string
          product_id?: string | null
          referrer?: string | null
          region?: string | null
          session_duration?: number | null
          source_page?: string | null
          user_id?: string | null
        }
        Update: {
          browser?: string | null
          city?: string | null
          clicked_at?: string
          converted?: boolean
          country?: string | null
          demo_id?: string | null
          demo_url_id?: string | null
          device_type?: string | null
          id?: string
          product_id?: string | null
          referrer?: string | null
          region?: string | null
          session_duration?: number | null
          source_page?: string | null
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
            foreignKeyName: "demo_clicks_demo_url_id_fkey"
            columns: ["demo_url_id"]
            isOneToOne: false
            referencedRelation: "product_demo_urls"
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
      demo_deployments: {
        Row: {
          created_at: string
          demo_id: string
          deployed_at: string | null
          failure_reason: string | null
          id: string
          provider: string | null
          provider_reference: string | null
          region: string | null
          server_instance_id: string | null
          state: string
          version: string | null
        }
        Insert: {
          created_at?: string
          demo_id: string
          deployed_at?: string | null
          failure_reason?: string | null
          id?: string
          provider?: string | null
          provider_reference?: string | null
          region?: string | null
          server_instance_id?: string | null
          state?: string
          version?: string | null
        }
        Update: {
          created_at?: string
          demo_id?: string
          deployed_at?: string | null
          failure_reason?: string | null
          id?: string
          provider?: string | null
          provider_reference?: string | null
          region?: string | null
          server_instance_id?: string | null
          state?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demo_deployments_demo_id_fkey"
            columns: ["demo_id"]
            isOneToOne: false
            referencedRelation: "demo_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_deployments_server_instance_id_fkey"
            columns: ["server_instance_id"]
            isOneToOne: false
            referencedRelation: "server_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_dns_records: {
        Row: {
          content: string
          created_at: string
          demo_id: string
          id: string
          last_error: string | null
          name: string
          provider: string
          provider_record_id: string | null
          proxied: boolean
          record_type: string
          state: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          content: string
          created_at?: string
          demo_id: string
          id?: string
          last_error?: string | null
          name: string
          provider?: string
          provider_record_id?: string | null
          proxied?: boolean
          record_type?: string
          state?: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          demo_id?: string
          id?: string
          last_error?: string | null
          name?: string
          provider?: string
          provider_record_id?: string | null
          proxied?: boolean
          record_type?: string
          state?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demo_dns_records_demo_id_fkey"
            columns: ["demo_id"]
            isOneToOne: false
            referencedRelation: "demo_domains"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_domain_events: {
        Row: {
          actor_id: string | null
          actor_role: string | null
          correlation_id: string | null
          created_at: string
          demo_id: string | null
          detail: Json
          event: string
          id: string
          job_id: string | null
          latency_ms: number | null
          new_state: string | null
          previous_state: string | null
          product_id: string | null
          provider: string | null
          reason: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_role?: string | null
          correlation_id?: string | null
          created_at?: string
          demo_id?: string | null
          detail?: Json
          event: string
          id?: string
          job_id?: string | null
          latency_ms?: number | null
          new_state?: string | null
          previous_state?: string | null
          product_id?: string | null
          provider?: string | null
          reason?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_role?: string | null
          correlation_id?: string | null
          created_at?: string
          demo_id?: string | null
          detail?: Json
          event?: string
          id?: string
          job_id?: string | null
          latency_ms?: number | null
          new_state?: string | null
          previous_state?: string | null
          product_id?: string | null
          provider?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demo_domain_events_demo_id_fkey"
            columns: ["demo_id"]
            isOneToOne: false
            referencedRelation: "demo_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_domain_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "demo_provision_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_domain_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_domains: {
        Row: {
          allow_indexing: boolean
          branding_policy_version: number | null
          branding_verified_at: string | null
          created_at: string
          created_by: string | null
          demo_ref: string
          deployment_id: string | null
          deployment_version: string | null
          dns_record_id: string | null
          dns_status: string
          environment: string
          expires_at: string | null
          external: boolean
          external_url: string | null
          failure_reason: string | null
          grace_until: string | null
          health: string
          hostname: string
          id: string
          last_health_at: string | null
          password_hash: string | null
          password_protected: boolean
          password_set_at: string | null
          pattern: string
          product_id: string
          published_at: string | null
          security_cleared_at: string | null
          server_instance_id: string | null
          slug: string
          ssl_expires_at: string | null
          ssl_issuer: string | null
          ssl_status: string
          status: string
          updated_at: string
        }
        Insert: {
          allow_indexing?: boolean
          branding_policy_version?: number | null
          branding_verified_at?: string | null
          created_at?: string
          created_by?: string | null
          demo_ref: string
          deployment_id?: string | null
          deployment_version?: string | null
          dns_record_id?: string | null
          dns_status?: string
          environment?: string
          expires_at?: string | null
          external?: boolean
          external_url?: string | null
          failure_reason?: string | null
          grace_until?: string | null
          health?: string
          hostname: string
          id?: string
          last_health_at?: string | null
          password_hash?: string | null
          password_protected?: boolean
          password_set_at?: string | null
          pattern?: string
          product_id: string
          published_at?: string | null
          security_cleared_at?: string | null
          server_instance_id?: string | null
          slug: string
          ssl_expires_at?: string | null
          ssl_issuer?: string | null
          ssl_status?: string
          status?: string
          updated_at?: string
        }
        Update: {
          allow_indexing?: boolean
          branding_policy_version?: number | null
          branding_verified_at?: string | null
          created_at?: string
          created_by?: string | null
          demo_ref?: string
          deployment_id?: string | null
          deployment_version?: string | null
          dns_record_id?: string | null
          dns_status?: string
          environment?: string
          expires_at?: string | null
          external?: boolean
          external_url?: string | null
          failure_reason?: string | null
          grace_until?: string | null
          health?: string
          hostname?: string
          id?: string
          last_health_at?: string | null
          password_hash?: string | null
          password_protected?: boolean
          password_set_at?: string | null
          pattern?: string
          product_id?: string
          published_at?: string | null
          security_cleared_at?: string | null
          server_instance_id?: string | null
          slug?: string
          ssl_expires_at?: string | null
          ssl_issuer?: string | null
          ssl_status?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_domains_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "server_deployments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_domains_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_domains_server_instance_id_fkey"
            columns: ["server_instance_id"]
            isOneToOne: false
            referencedRelation: "server_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_escalations: {
        Row: {
          assigned_to: string | null
          created_at: string
          demo_id: string | null
          escalated_at: string
          id: string
          level: number
          reason: string
          resolution: string | null
          resolved_at: string | null
          role: string | null
          severity: string
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          demo_id?: string | null
          escalated_at?: string
          id?: string
          level?: number
          reason: string
          resolution?: string | null
          resolved_at?: string | null
          role?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          demo_id?: string | null
          escalated_at?: string
          id?: string
          level?: number
          reason?: string
          resolution?: string | null
          resolved_at?: string | null
          role?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_escalations_demo_id_fkey"
            columns: ["demo_id"]
            isOneToOne: false
            referencedRelation: "product_demo_urls"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_expiry_events: {
        Row: {
          created_at: string
          days_out: number | null
          demo_id: string
          id: string
          kind: string
          notified: boolean
        }
        Insert: {
          created_at?: string
          days_out?: number | null
          demo_id: string
          id?: string
          kind: string
          notified?: boolean
        }
        Update: {
          created_at?: string
          days_out?: number | null
          demo_id?: string
          id?: string
          kind?: string
          notified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "demo_expiry_events_demo_id_fkey"
            columns: ["demo_id"]
            isOneToOne: false
            referencedRelation: "demo_domains"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_health: {
        Row: {
          checked_at: string
          demo_id: string | null
          demo_url_id: string | null
          error_message: string | null
          http_status: number | null
          id: string
          response_time: number | null
          status: Database["public"]["Enums"]["demo_status"]
        }
        Insert: {
          checked_at?: string
          demo_id?: string | null
          demo_url_id?: string | null
          error_message?: string | null
          http_status?: number | null
          id?: string
          response_time?: number | null
          status?: Database["public"]["Enums"]["demo_status"]
        }
        Update: {
          checked_at?: string
          demo_id?: string | null
          demo_url_id?: string | null
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
          {
            foreignKeyName: "demo_health_demo_url_id_fkey"
            columns: ["demo_url_id"]
            isOneToOne: false
            referencedRelation: "product_demo_urls"
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
      demo_provider_configs: {
        Row: {
          created_at: string
          credential_env: string | null
          enabled: boolean
          endpoint: string | null
          id: string
          kind: string
          label: string
          last_error: string | null
          slug: string
          updated_at: string
          verified: boolean
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          credential_env?: string | null
          enabled?: boolean
          endpoint?: string | null
          id?: string
          kind: string
          label: string
          last_error?: string | null
          slug: string
          updated_at?: string
          verified?: boolean
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          credential_env?: string | null
          enabled?: boolean
          endpoint?: string | null
          id?: string
          kind?: string
          label?: string
          last_error?: string | null
          slug?: string
          updated_at?: string
          verified?: boolean
          verified_at?: string | null
        }
        Relationships: []
      }
      demo_provision_jobs: {
        Row: {
          actor_id: string | null
          attempt: number
          correlation_id: string
          created_at: string
          demo_id: string
          error_category: string | null
          error_detail: string | null
          finished_at: string | null
          id: string
          idempotency_key: string
          latency_ms: number | null
          operation: string
          provider: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          actor_id?: string | null
          attempt?: number
          correlation_id?: string
          created_at?: string
          demo_id: string
          error_category?: string | null
          error_detail?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key: string
          latency_ms?: number | null
          operation: string
          provider?: string | null
          started_at?: string | null
          status?: string
        }
        Update: {
          actor_id?: string | null
          attempt?: number
          correlation_id?: string
          created_at?: string
          demo_id?: string
          error_category?: string | null
          error_detail?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key?: string
          latency_ms?: number | null
          operation?: string
          provider?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_provision_jobs_demo_id_fkey"
            columns: ["demo_id"]
            isOneToOne: false
            referencedRelation: "demo_domains"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_qr_codes: {
        Row: {
          active: boolean
          created_at: string
          demo_id: string
          id: string
          last_scan_at: string | null
          scan_count: number | null
          target_url: string
          version: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          demo_id: string
          id?: string
          last_scan_at?: string | null
          scan_count?: number | null
          target_url: string
          version?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          demo_id?: string
          id?: string
          last_scan_at?: string | null
          scan_count?: number | null
          target_url?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "demo_qr_codes_demo_id_fkey"
            columns: ["demo_id"]
            isOneToOne: false
            referencedRelation: "demo_domains"
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
      demo_reserved_slugs: {
        Row: {
          reason: string
          slug: string
        }
        Insert: {
          reason: string
          slug: string
        }
        Update: {
          reason?: string
          slug?: string
        }
        Relationships: []
      }
      demo_sandbox_activity: {
        Row: {
          created_at: string
          id: string
          kind: string
          latency_ms: number | null
          path: string | null
          qualifies: boolean
          sandbox_id: string
          status_code: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          latency_ms?: number | null
          path?: string | null
          qualifies?: boolean
          sandbox_id: string
          status_code?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          latency_ms?: number | null
          path?: string | null
          qualifies?: boolean
          sandbox_id?: string
          status_code?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "demo_sandbox_activity_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "demo_sandboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_sandbox_cleanup_jobs: {
        Row: {
          error_detail: string | null
          finished_at: string | null
          id: string
          preserved: Json
          removed: Json
          sandbox_id: string | null
          scope: string
          started_at: string
          status: string
        }
        Insert: {
          error_detail?: string | null
          finished_at?: string | null
          id?: string
          preserved?: Json
          removed?: Json
          sandbox_id?: string | null
          scope?: string
          started_at?: string
          status?: string
        }
        Update: {
          error_detail?: string | null
          finished_at?: string | null
          id?: string
          preserved?: Json
          removed?: Json
          sandbox_id?: string | null
          scope?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_sandbox_cleanup_jobs_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "demo_sandboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_sandbox_credentials: {
        Row: {
          active: boolean
          created_at: string
          expires_at: string | null
          id: string
          password_hash: string
          role_type: string
          rotated_at: string | null
          rotated_by: string | null
          sandbox_id: string
          username: string
          version: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          expires_at?: string | null
          id?: string
          password_hash: string
          role_type: string
          rotated_at?: string | null
          rotated_by?: string | null
          sandbox_id: string
          username: string
          version?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          expires_at?: string | null
          id?: string
          password_hash?: string
          role_type?: string
          rotated_at?: string | null
          rotated_by?: string | null
          sandbox_id?: string
          username?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "demo_sandbox_credentials_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "demo_sandboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_sandbox_expiry_events: {
        Row: {
          created_at: string
          hours_out: number | null
          id: string
          kind: string
          notified: boolean
          sandbox_id: string
        }
        Insert: {
          created_at?: string
          hours_out?: number | null
          id?: string
          kind: string
          notified?: boolean
          sandbox_id: string
        }
        Update: {
          created_at?: string
          hours_out?: number | null
          id?: string
          kind?: string
          notified?: boolean
          sandbox_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_sandbox_expiry_events_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "demo_sandboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_sandbox_health_checks: {
        Row: {
          checks: Json
          created_at: string
          detail: string | null
          id: string
          job_id: string | null
          result: string
          sandbox_id: string
        }
        Insert: {
          checks?: Json
          created_at?: string
          detail?: string | null
          id?: string
          job_id?: string | null
          result: string
          sandbox_id: string
        }
        Update: {
          checks?: Json
          created_at?: string
          detail?: string | null
          id?: string
          job_id?: string | null
          result?: string
          sandbox_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_sandbox_health_checks_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "demo_sandbox_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_sandbox_health_checks_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "demo_sandboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_sandbox_jobs: {
        Row: {
          actor_id: string | null
          attempt: number
          correlation_id: string
          created_at: string
          error_category: string | null
          error_detail: string | null
          finished_at: string | null
          holds_lock: boolean
          id: string
          idempotency_key: string
          operation: string
          sandbox_id: string
          started_at: string | null
          status: string
        }
        Insert: {
          actor_id?: string | null
          attempt?: number
          correlation_id?: string
          created_at?: string
          error_category?: string | null
          error_detail?: string | null
          finished_at?: string | null
          holds_lock?: boolean
          id?: string
          idempotency_key: string
          operation: string
          sandbox_id: string
          started_at?: string | null
          status?: string
        }
        Update: {
          actor_id?: string | null
          attempt?: number
          correlation_id?: string
          created_at?: string
          error_category?: string | null
          error_detail?: string | null
          finished_at?: string | null
          holds_lock?: boolean
          id?: string
          idempotency_key?: string
          operation?: string
          sandbox_id?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_sandbox_jobs_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "demo_sandboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_sandbox_resets: {
        Row: {
          branding_reapplied: boolean
          database_reset: boolean
          failure_reason: string | null
          finished_at: string | null
          health_passed: boolean
          id: string
          job_id: string | null
          outcome: string
          sandbox_id: string
          stages: Json
          started_at: string
          trigger: string
          uploads_reset: boolean
        }
        Insert: {
          branding_reapplied?: boolean
          database_reset?: boolean
          failure_reason?: string | null
          finished_at?: string | null
          health_passed?: boolean
          id?: string
          job_id?: string | null
          outcome?: string
          sandbox_id: string
          stages?: Json
          started_at?: string
          trigger: string
          uploads_reset?: boolean
        }
        Update: {
          branding_reapplied?: boolean
          database_reset?: boolean
          failure_reason?: string | null
          finished_at?: string | null
          health_passed?: boolean
          id?: string
          job_id?: string | null
          outcome?: string
          sandbox_id?: string
          stages?: Json
          started_at?: string
          trigger?: string
          uploads_reset?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "demo_sandbox_resets_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "demo_sandbox_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_sandbox_resets_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "demo_sandboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_sandbox_sessions: {
        Row: {
          ended_at: string | null
          id: string
          last_seen_at: string
          purge_after: string | null
          role_type: string | null
          sandbox_id: string
          session_key: string
          started_at: string
        }
        Insert: {
          ended_at?: string | null
          id?: string
          last_seen_at?: string
          purge_after?: string | null
          role_type?: string | null
          sandbox_id: string
          session_key: string
          started_at?: string
        }
        Update: {
          ended_at?: string | null
          id?: string
          last_seen_at?: string
          purge_after?: string | null
          role_type?: string | null
          sandbox_id?: string
          session_key?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_sandbox_sessions_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "demo_sandboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_sandbox_settings: {
        Row: {
          auto_reset_db: boolean
          auto_reset_hours: number
          auto_reset_uploads: boolean
          cleanup_at: string
          cleanup_timezone: string
          expire_after_idle_hours: number
          grace_hours: number
          id: boolean
          keep_session_logs: boolean
          rotate_credentials: boolean
          rotate_credentials_days: number
          session_log_retention_days: number
          updated_at: string
          updated_by: string | null
          warning_hours: number[]
        }
        Insert: {
          auto_reset_db?: boolean
          auto_reset_hours?: number
          auto_reset_uploads?: boolean
          cleanup_at?: string
          cleanup_timezone?: string
          expire_after_idle_hours?: number
          grace_hours?: number
          id?: boolean
          keep_session_logs?: boolean
          rotate_credentials?: boolean
          rotate_credentials_days?: number
          session_log_retention_days?: number
          updated_at?: string
          updated_by?: string | null
          warning_hours?: number[]
        }
        Update: {
          auto_reset_db?: boolean
          auto_reset_hours?: number
          auto_reset_uploads?: boolean
          cleanup_at?: string
          cleanup_timezone?: string
          expire_after_idle_hours?: number
          grace_hours?: number
          id?: boolean
          keep_session_logs?: boolean
          rotate_credentials?: boolean
          rotate_credentials_days?: number
          session_log_retention_days?: number
          updated_at?: string
          updated_by?: string | null
          warning_hours?: number[]
        }
        Relationships: []
      }
      demo_sandbox_snapshots: {
        Row: {
          assets_digest: string | null
          captured: boolean
          captured_at: string | null
          configuration: Json
          created_at: string
          db_version: string | null
          deployment_version: string | null
          id: string
          note: string | null
          sandbox_id: string
          version: string
        }
        Insert: {
          assets_digest?: string | null
          captured?: boolean
          captured_at?: string | null
          configuration?: Json
          created_at?: string
          db_version?: string | null
          deployment_version?: string | null
          id?: string
          note?: string | null
          sandbox_id: string
          version: string
        }
        Update: {
          assets_digest?: string | null
          captured?: boolean
          captured_at?: string | null
          configuration?: Json
          created_at?: string
          db_version?: string | null
          deployment_version?: string | null
          id?: string
          note?: string | null
          sandbox_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_sandbox_snapshots_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "demo_sandboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_sandboxes: {
        Row: {
          baseline_snapshot_id: string | null
          baseline_version: string | null
          cleanup_after: string | null
          cleanup_status: string
          created_at: string
          created_by: string | null
          demo_id: string
          deployment_id: string | null
          expires_at: string | null
          failure_reason: string | null
          health: string
          id: string
          isolation_strategy: string
          isolation_verified_at: string | null
          last_activity_at: string | null
          last_health_at: string | null
          last_reset_at: string | null
          next_reset_at: string | null
          product_id: string
          sandbox_ref: string
          server_instance_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          baseline_snapshot_id?: string | null
          baseline_version?: string | null
          cleanup_after?: string | null
          cleanup_status?: string
          created_at?: string
          created_by?: string | null
          demo_id: string
          deployment_id?: string | null
          expires_at?: string | null
          failure_reason?: string | null
          health?: string
          id?: string
          isolation_strategy?: string
          isolation_verified_at?: string | null
          last_activity_at?: string | null
          last_health_at?: string | null
          last_reset_at?: string | null
          next_reset_at?: string | null
          product_id: string
          sandbox_ref: string
          server_instance_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          baseline_snapshot_id?: string | null
          baseline_version?: string | null
          cleanup_after?: string | null
          cleanup_status?: string
          created_at?: string
          created_by?: string | null
          demo_id?: string
          deployment_id?: string | null
          expires_at?: string | null
          failure_reason?: string | null
          health?: string
          id?: string
          isolation_strategy?: string
          isolation_verified_at?: string | null
          last_activity_at?: string | null
          last_health_at?: string | null
          last_reset_at?: string | null
          next_reset_at?: string | null
          product_id?: string
          sandbox_ref?: string
          server_instance_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_sandboxes_demo_id_fkey"
            columns: ["demo_id"]
            isOneToOne: false
            referencedRelation: "demo_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_sandboxes_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "server_deployments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_sandboxes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_sandboxes_server_instance_id_fkey"
            columns: ["server_instance_id"]
            isOneToOne: false
            referencedRelation: "server_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_ssl_certificates: {
        Row: {
          auto_renew: boolean
          created_at: string
          demo_id: string | null
          expires_at: string | null
          failure_reason: string | null
          hostname: string
          id: string
          issued_at: string | null
          issuer: string | null
          last_renewal_at: string | null
          next_renewal_at: string | null
          provider: string | null
          state: string
          updated_at: string
          wildcard: boolean
        }
        Insert: {
          auto_renew?: boolean
          created_at?: string
          demo_id?: string | null
          expires_at?: string | null
          failure_reason?: string | null
          hostname: string
          id?: string
          issued_at?: string | null
          issuer?: string | null
          last_renewal_at?: string | null
          next_renewal_at?: string | null
          provider?: string | null
          state?: string
          updated_at?: string
          wildcard?: boolean
        }
        Update: {
          auto_renew?: boolean
          created_at?: string
          demo_id?: string | null
          expires_at?: string | null
          failure_reason?: string | null
          hostname?: string
          id?: string
          issued_at?: string | null
          issuer?: string | null
          last_renewal_at?: string | null
          next_renewal_at?: string | null
          provider?: string | null
          state?: string
          updated_at?: string
          wildcard?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "demo_ssl_certificates_demo_id_fkey"
            columns: ["demo_id"]
            isOneToOne: false
            referencedRelation: "demo_domains"
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
      demo_validation_logs: {
        Row: {
          created_at: string
          demo_id: string | null
          demo_url: string | null
          error_message: string | null
          http_status: number | null
          id: string
          response_time_ms: number | null
          status: string
          validated_at: string
          validated_by: string | null
          validation_type: string
        }
        Insert: {
          created_at?: string
          demo_id?: string | null
          demo_url?: string | null
          error_message?: string | null
          http_status?: number | null
          id?: string
          response_time_ms?: number | null
          status?: string
          validated_at?: string
          validated_by?: string | null
          validation_type?: string
        }
        Update: {
          created_at?: string
          demo_id?: string | null
          demo_url?: string | null
          error_message?: string | null
          http_status?: number | null
          id?: string
          response_time_ms?: number | null
          status?: string
          validated_at?: string
          validated_by?: string | null
          validation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_validation_logs_demo_id_fkey"
            columns: ["demo_id"]
            isOneToOne: false
            referencedRelation: "product_demo_urls"
            referencedColumns: ["id"]
          },
        ]
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
      developer_activity_logs: {
        Row: {
          activity_type: string
          created_at: string
          description: string | null
          developer_id: string
          device_info: string | null
          id: string
          ip_address: unknown
          metadata: Json | null
        }
        Insert: {
          activity_type: string
          created_at?: string
          description?: string | null
          developer_id: string
          device_info?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
        }
        Update: {
          activity_type?: string
          created_at?: string
          description?: string | null
          developer_id?: string
          device_info?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "developer_activity_logs_developer_id_fkey"
            columns: ["developer_id"]
            isOneToOne: false
            referencedRelation: "developers"
            referencedColumns: ["id"]
          },
        ]
      }
      developer_code_submissions: {
        Row: {
          commit_message: string | null
          created_at: string
          developer_id: string
          file_urls: Json | null
          id: string
          notes: string | null
          review_notes: string | null
          review_status: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          submission_type: string
          task_id: string
        }
        Insert: {
          commit_message?: string | null
          created_at?: string
          developer_id: string
          file_urls?: Json | null
          id?: string
          notes?: string | null
          review_notes?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          submission_type?: string
          task_id: string
        }
        Update: {
          commit_message?: string | null
          created_at?: string
          developer_id?: string
          file_urls?: Json | null
          id?: string
          notes?: string | null
          review_notes?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          submission_type?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "developer_code_submissions_developer_id_fkey"
            columns: ["developer_id"]
            isOneToOne: false
            referencedRelation: "developers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "developer_code_submissions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "developer_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      developer_messages: {
        Row: {
          attachments: Json | null
          created_at: string
          id: string
          is_system_message: boolean | null
          message: string
          sender_id: string
          sender_role: Database["public"]["Enums"]["app_role"]
          task_id: string
        }
        Insert: {
          attachments?: Json | null
          created_at?: string
          id?: string
          is_system_message?: boolean | null
          message: string
          sender_id: string
          sender_role: Database["public"]["Enums"]["app_role"]
          task_id: string
        }
        Update: {
          attachments?: Json | null
          created_at?: string
          id?: string
          is_system_message?: boolean | null
          message?: string
          sender_id?: string
          sender_role?: Database["public"]["Enums"]["app_role"]
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "developer_messages_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "developer_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      developer_task_escalations: {
        Row: {
          auto_escalated: boolean
          created_at: string
          escalated_by: string | null
          escalated_to: string
          id: string
          reason: string
          resolution: string | null
          resolved_at: string | null
          status: string
          task_id: string | null
          updated_at: string
        }
        Insert: {
          auto_escalated?: boolean
          created_at?: string
          escalated_by?: string | null
          escalated_to?: string
          id?: string
          reason: string
          resolution?: string | null
          resolved_at?: string | null
          status?: string
          task_id?: string | null
          updated_at?: string
        }
        Update: {
          auto_escalated?: boolean
          created_at?: string
          escalated_by?: string | null
          escalated_to?: string
          id?: string
          reason?: string
          resolution?: string | null
          resolved_at?: string | null
          status?: string
          task_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "developer_task_escalations_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "developer_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      developer_task_internal_notes: {
        Row: {
          author_id: string | null
          author_label: string | null
          content: string
          created_at: string
          developer_id: string | null
          id: string
          task_id: string | null
        }
        Insert: {
          author_id?: string | null
          author_label?: string | null
          content: string
          created_at?: string
          developer_id?: string | null
          id?: string
          task_id?: string | null
        }
        Update: {
          author_id?: string | null
          author_label?: string | null
          content?: string
          created_at?: string
          developer_id?: string | null
          id?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "developer_task_internal_notes_developer_id_fkey"
            columns: ["developer_id"]
            isOneToOne: false
            referencedRelation: "developers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "developer_task_internal_notes_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "developer_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      developer_tasks: {
        Row: {
          accepted_at: string | null
          actual_delivery_at: string | null
          assigned_by: string | null
          attachments: Json
          category: string
          client_id: string | null
          completed_at: string | null
          created_at: string
          deadline: string | null
          delivery_notes: string | null
          description: string | null
          developer_id: string | null
          estimated_hours: number | null
          id: string
          links: Json
          pause_reason: string | null
          paused_at: string | null
          priority: string | null
          progress_note: string | null
          progress_percent: number
          requirements: Json
          started_at: string | null
          status: string
          task_amount: number | null
          tech_stack: string[] | null
          title: string
          tm_task_id: string | null
          total_paused_minutes: number | null
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          actual_delivery_at?: string | null
          assigned_by?: string | null
          attachments?: Json
          category?: string
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          delivery_notes?: string | null
          description?: string | null
          developer_id?: string | null
          estimated_hours?: number | null
          id?: string
          links?: Json
          pause_reason?: string | null
          paused_at?: string | null
          priority?: string | null
          progress_note?: string | null
          progress_percent?: number
          requirements?: Json
          started_at?: string | null
          status?: string
          task_amount?: number | null
          tech_stack?: string[] | null
          title: string
          tm_task_id?: string | null
          total_paused_minutes?: number | null
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          actual_delivery_at?: string | null
          assigned_by?: string | null
          attachments?: Json
          category?: string
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          delivery_notes?: string | null
          description?: string | null
          developer_id?: string | null
          estimated_hours?: number | null
          id?: string
          links?: Json
          pause_reason?: string | null
          paused_at?: string | null
          priority?: string | null
          progress_note?: string | null
          progress_percent?: number
          requirements?: Json
          started_at?: string | null
          status?: string
          task_amount?: number | null
          tech_stack?: string[] | null
          title?: string
          tm_task_id?: string | null
          total_paused_minutes?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "developer_tasks_developer_id_fkey"
            columns: ["developer_id"]
            isOneToOne: false
            referencedRelation: "developers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "developer_tasks_tm_task_id_fkey"
            columns: ["tm_task_id"]
            isOneToOne: false
            referencedRelation: "tm_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      developers: {
        Row: {
          availability_status: string | null
          created_at: string
          current_task_id: string | null
          email: string
          full_name: string
          id: string
          is_frozen: boolean | null
          joined_at: string | null
          max_capacity: number
          onboarding_completed: boolean
          phone: string | null
          skill_tags: string[]
          status: string
          updated_at: string
          user_id: string
          vala_id: string | null
        }
        Insert: {
          availability_status?: string | null
          created_at?: string
          current_task_id?: string | null
          email: string
          full_name: string
          id?: string
          is_frozen?: boolean | null
          joined_at?: string | null
          max_capacity?: number
          onboarding_completed?: boolean
          phone?: string | null
          skill_tags?: string[]
          status?: string
          updated_at?: string
          user_id: string
          vala_id?: string | null
        }
        Update: {
          availability_status?: string | null
          created_at?: string
          current_task_id?: string | null
          email?: string
          full_name?: string
          id?: string
          is_frozen?: boolean | null
          joined_at?: string | null
          max_capacity?: number
          onboarding_completed?: boolean
          phone?: string | null
          skill_tags?: string[]
          status?: string
          updated_at?: string
          user_id?: string
          vala_id?: string | null
        }
        Relationships: []
      }
      email_outbox: {
        Row: {
          attempts: number
          body_html: string
          body_text: string | null
          context: Json
          created_at: string
          id: string
          last_error: string | null
          order_id: string | null
          sent_at: string | null
          status: string
          subject: string
          to_email: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          body_html: string
          body_text?: string | null
          context?: Json
          created_at?: string
          id?: string
          last_error?: string | null
          order_id?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          to_email: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          body_html?: string
          body_text?: string | null
          context?: Json
          created_at?: string
          id?: string
          last_error?: string | null
          order_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          to_email?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_queue: {
        Row: {
          assigned_to: string | null
          category: string
          created_at: string
          from_email: string
          from_name: string | null
          id: string
          preview: string | null
          priority: string
          received_at: string
          status: string
          subject: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          from_email: string
          from_name?: string | null
          id?: string
          preview?: string | null
          priority?: string
          received_at?: string
          status?: string
          subject: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          from_email?: string
          from_name?: string | null
          id?: string
          preview?: string | null
          priority?: string
          received_at?: string
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_queue_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "team_members"
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
      entitlements: {
        Row: {
          created_at: string
          granted_at: string
          id: string
          license_id: string | null
          order_id: string | null
          product_id: string
          revoked_at: string | null
          source: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_at?: string
          id?: string
          license_id?: string | null
          order_id?: string | null
          product_id: string
          revoked_at?: string | null
          source?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_at?: string
          id?: string
          license_id?: string | null
          order_id?: string | null
          product_id?: string
          revoked_at?: string | null
          source?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entitlements_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "licenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entitlements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entitlements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
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
      events: {
        Row: {
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          name: string
          rewards: Json | null
          slug: string
          starts_at: string | null
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          name: string
          rewards?: Json | null
          slug: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          name?: string
          rewards?: Json | null
          slug?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
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
      faq_categories: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          name: string
          position: number
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          name: string
          position?: number
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          name?: string
          position?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      faq_versions: {
        Row: {
          answer: string
          change_summary: string | null
          changed_at: string
          changed_by: string | null
          faq_id: string
          id: string
          question: string
          snapshot: Json
          status: string
          version: number
        }
        Insert: {
          answer: string
          change_summary?: string | null
          changed_at?: string
          changed_by?: string | null
          faq_id: string
          id?: string
          question: string
          snapshot: Json
          status: string
          version: number
        }
        Update: {
          answer?: string
          change_summary?: string | null
          changed_at?: string
          changed_by?: string | null
          faq_id?: string
          id?: string
          question?: string
          snapshot?: Json
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "faq_versions_faq_id_fkey"
            columns: ["faq_id"]
            isOneToOne: false
            referencedRelation: "faqs"
            referencedColumns: ["id"]
          },
        ]
      }
      faqs: {
        Row: {
          ai_generated: boolean
          ai_sources: Json
          answer: string
          author_id: string | null
          category_id: string | null
          created_at: string
          id: string
          keywords: string[]
          language: string
          position: number
          published_at: string | null
          question: string
          related_product_ids: string[]
          scheduled_for: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string | null
          status: string
          tags: string[]
          translation_of: string | null
          updated_at: string
          version: number
        }
        Insert: {
          ai_generated?: boolean
          ai_sources?: Json
          answer: string
          author_id?: string | null
          category_id?: string | null
          created_at?: string
          id?: string
          keywords?: string[]
          language?: string
          position?: number
          published_at?: string | null
          question: string
          related_product_ids?: string[]
          scheduled_for?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string | null
          status?: string
          tags?: string[]
          translation_of?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          ai_generated?: boolean
          ai_sources?: Json
          answer?: string
          author_id?: string | null
          category_id?: string | null
          created_at?: string
          id?: string
          keywords?: string[]
          language?: string
          position?: number
          published_at?: string | null
          question?: string
          related_product_ids?: string[]
          scheduled_for?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string | null
          status?: string
          tags?: string[]
          translation_of?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "faqs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "faq_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faqs_translation_of_fkey"
            columns: ["translation_of"]
            isOneToOne: false
            referencedRelation: "faqs"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_activity_heat: {
        Row: {
          activity_date: string
          hour_slot: number
          id: string
          txn_count: number
          volume: number
        }
        Insert: {
          activity_date: string
          hour_slot: number
          id?: string
          txn_count: number
          volume: number
        }
        Update: {
          activity_date?: string
          hour_slot?: number
          id?: string
          txn_count?: number
          volume?: number
        }
        Relationships: []
      }
      finance_ai_api_usage: {
        Row: {
          billed_to: string
          cost: number
          created_at: string
          id: string
          provider: string
          requests: number
          service: string
          tokens: number
          usage_date: string
        }
        Insert: {
          billed_to: string
          cost: number
          created_at?: string
          id?: string
          provider: string
          requests: number
          service: string
          tokens?: number
          usage_date: string
        }
        Update: {
          billed_to?: string
          cost?: number
          created_at?: string
          id?: string
          provider?: string
          requests?: number
          service?: string
          tokens?: number
          usage_date?: string
        }
        Relationships: []
      }
      finance_ai_controls: {
        Row: {
          auto_stop_percent: number
          budget: number
          id: string
          provider: string
          service: string
          spike_threshold: number
          status: string
          updated_at: string
        }
        Insert: {
          auto_stop_percent?: number
          budget?: number
          id?: string
          provider: string
          service: string
          spike_threshold?: number
          status?: string
          updated_at?: string
        }
        Update: {
          auto_stop_percent?: number
          budget?: number
          id?: string
          provider?: string
          service?: string
          spike_threshold?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      finance_alerts: {
        Row: {
          category: string
          created_at: string
          id: string
          message: string
          severity: string
          status: string
          title: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          message: string
          severity: string
          status?: string
          title: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          message?: string
          severity?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      finance_approvals: {
        Row: {
          amount: number
          created_at: string
          decided_at: string | null
          id: string
          notes: string | null
          reference: string
          request_type: string
          requested_by: string
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          decided_at?: string | null
          id?: string
          notes?: string | null
          reference: string
          request_type: string
          requested_by: string
          status: string
        }
        Update: {
          amount?: number
          created_at?: string
          decided_at?: string | null
          id?: string
          notes?: string | null
          reference?: string
          request_type?: string
          requested_by?: string
          status?: string
        }
        Relationships: []
      }
      finance_audit_logs: {
        Row: {
          action: string
          actor: string
          actor_role: string
          created_at: string
          details: Json
          entity: string
          entity_ref: string | null
          id: string
          ip_address: string
          severity: string
          user_agent: string
        }
        Insert: {
          action: string
          actor: string
          actor_role: string
          created_at?: string
          details?: Json
          entity: string
          entity_ref?: string | null
          id?: string
          ip_address: string
          severity?: string
          user_agent: string
        }
        Update: {
          action?: string
          actor?: string
          actor_role?: string
          created_at?: string
          details?: Json
          entity?: string
          entity_ref?: string | null
          id?: string
          ip_address?: string
          severity?: string
          user_agent?: string
        }
        Relationships: []
      }
      finance_commissions: {
        Row: {
          base_amount: number
          commission_amount: number
          created_at: string
          id: string
          partner_name: string
          partner_type: string
          period: string
          rate_percent: number
          status: string
        }
        Insert: {
          base_amount: number
          commission_amount: number
          created_at?: string
          id?: string
          partner_name: string
          partner_type: string
          period: string
          rate_percent: number
          status: string
        }
        Update: {
          base_amount?: number
          commission_amount?: number
          created_at?: string
          id?: string
          partner_name?: string
          partner_type?: string
          period?: string
          rate_percent?: number
          status?: string
        }
        Relationships: []
      }
      finance_customers: {
        Row: {
          country_code: string | null
          created_at: string
          email: string | null
          external_reference: string | null
          id: string
          name: string
          preferred_currency: string
          preferred_rail: string | null
          updated_at: string
        }
        Insert: {
          country_code?: string | null
          created_at?: string
          email?: string | null
          external_reference?: string | null
          id?: string
          name: string
          preferred_currency?: string
          preferred_rail?: string | null
          updated_at?: string
        }
        Update: {
          country_code?: string | null
          created_at?: string
          email?: string | null
          external_reference?: string | null
          id?: string
          name?: string
          preferred_currency?: string
          preferred_rail?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      finance_daily_metrics: {
        Row: {
          created_at: string
          expenses: number
          id: string
          inflow: number
          metric_date: string
          outflow: number
          profit: number
          revenue: number
          txn_count: number
        }
        Insert: {
          created_at?: string
          expenses: number
          id?: string
          inflow: number
          metric_date: string
          outflow: number
          profit: number
          revenue: number
          txn_count: number
        }
        Update: {
          created_at?: string
          expenses?: number
          id?: string
          inflow?: number
          metric_date?: string
          outflow?: number
          profit?: number
          revenue?: number
          txn_count?: number
        }
        Relationships: []
      }
      finance_expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string
          expense_date: string
          id: string
          recurring: boolean
          status: string
          vendor: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          description: string
          expense_date: string
          id?: string
          recurring?: boolean
          status?: string
          vendor: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string
          expense_date?: string
          id?: string
          recurring?: boolean
          status?: string
          vendor?: string
        }
        Relationships: []
      }
      finance_fraud_alerts: {
        Row: {
          alert_code: string
          amount: number
          detected_at: string
          entity: string
          id: string
          reason: string
          resolved_at: string | null
          risk_score: number
          status: string
          txn_reference: string | null
        }
        Insert: {
          alert_code: string
          amount: number
          detected_at?: string
          entity: string
          id?: string
          reason: string
          resolved_at?: string | null
          risk_score: number
          status: string
          txn_reference?: string | null
        }
        Update: {
          alert_code?: string
          amount?: number
          detected_at?: string
          entity?: string
          id?: string
          reason?: string
          resolved_at?: string | null
          risk_score?: number
          status?: string
          txn_reference?: string | null
        }
        Relationships: []
      }
      finance_gateways: {
        Row: {
          code: string
          created_at: string
          fee_percent: number
          id: string
          last_sync_at: string
          monthly_txn_count: number
          monthly_volume: number
          name: string
          provider: string
          settlement_cycle: string
          status: string
          success_rate: number
          supported_currencies: string[]
        }
        Insert: {
          code: string
          created_at?: string
          fee_percent?: number
          id?: string
          last_sync_at?: string
          monthly_txn_count?: number
          monthly_volume?: number
          name: string
          provider: string
          settlement_cycle?: string
          status?: string
          success_rate?: number
          supported_currencies?: string[]
        }
        Update: {
          code?: string
          created_at?: string
          fee_percent?: number
          id?: string
          last_sync_at?: string
          monthly_txn_count?: number
          monthly_volume?: number
          name?: string
          provider?: string
          settlement_cycle?: string
          status?: string
          success_rate?: number
          supported_currencies?: string[]
        }
        Relationships: []
      }
      finance_invoice_items: {
        Row: {
          created_at: string
          description: string
          discount_amount: number
          id: string
          invoice_id: string
          quantity: number
          tax_amount: number
          unit_amount: number
        }
        Insert: {
          created_at?: string
          description: string
          discount_amount?: number
          id?: string
          invoice_id: string
          quantity: number
          tax_amount?: number
          unit_amount: number
        }
        Update: {
          created_at?: string
          description?: string
          discount_amount?: number
          id?: string
          invoice_id?: string
          quantity?: number
          tax_amount?: number
          unit_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "finance_invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "finance_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_invoices: {
        Row: {
          auto_generated: boolean
          client_name: string
          client_type: string
          created_at: string
          doc_type: string
          due_date: string
          gst_number: string | null
          id: string
          invoice_no: string
          issue_date: string
          line_items: Json
          paid_at: string | null
          status: string
          subtotal: number
          tax_amount: number
          total: number
        }
        Insert: {
          auto_generated?: boolean
          client_name: string
          client_type: string
          created_at?: string
          doc_type?: string
          due_date: string
          gst_number?: string | null
          id?: string
          invoice_no: string
          issue_date: string
          line_items?: Json
          paid_at?: string | null
          status: string
          subtotal: number
          tax_amount: number
          total: number
        }
        Update: {
          auto_generated?: boolean
          client_name?: string
          client_type?: string
          created_at?: string
          doc_type?: string
          due_date?: string
          gst_number?: string | null
          id?: string
          invoice_no?: string
          issue_date?: string
          line_items?: Json
          paid_at?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          total?: number
        }
        Relationships: []
      }
      finance_ledger_entries: {
        Row: {
          account_code: string
          amount: number
          created_at: string
          currency: string
          entry_type: string
          id: string
          immutable_payload: Json
          invoice_id: string | null
          payment_id: string | null
        }
        Insert: {
          account_code: string
          amount: number
          created_at?: string
          currency: string
          entry_type: string
          id?: string
          immutable_payload?: Json
          invoice_id?: string | null
          payment_id?: string | null
        }
        Update: {
          account_code?: string
          amount?: number
          created_at?: string
          currency?: string
          entry_type?: string
          id?: string
          immutable_payload?: Json
          invoice_id?: string | null
          payment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_ledger_entries_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "finance_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_ledger_entries_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "finance_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_payment_events: {
        Row: {
          event_key: string
          event_type: string
          id: string
          intent_id: string | null
          payload: Json
          payment_id: string | null
          received_at: string
        }
        Insert: {
          event_key: string
          event_type: string
          id?: string
          intent_id?: string | null
          payload?: Json
          payment_id?: string | null
          received_at?: string
        }
        Update: {
          event_key?: string
          event_type?: string
          id?: string
          intent_id?: string | null
          payload?: Json
          payment_id?: string | null
          received_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_payment_events_intent_id_fkey"
            columns: ["intent_id"]
            isOneToOne: false
            referencedRelation: "finance_payment_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payment_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "finance_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_payment_intents: {
        Row: {
          amount: number
          client_reference: string | null
          created_at: string
          currency: string
          expires_at: string | null
          id: string
          idempotency_key: string
          invoice_id: string
          provider_reference: string | null
          rail_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          client_reference?: string | null
          created_at?: string
          currency: string
          expires_at?: string | null
          id?: string
          idempotency_key: string
          invoice_id: string
          provider_reference?: string | null
          rail_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          client_reference?: string | null
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          idempotency_key?: string
          invoice_id?: string
          provider_reference?: string | null
          rail_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_payment_intents_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "finance_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payment_intents_rail_id_fkey"
            columns: ["rail_id"]
            isOneToOne: false
            referencedRelation: "finance_payment_rails"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_payment_rails: {
        Row: {
          code: string
          configuration_state: Json
          created_at: string
          display_name: string
          enabled: boolean
          health_status: string
          id: string
          supported_countries: string[]
          supported_currencies: string[]
          updated_at: string
        }
        Insert: {
          code: string
          configuration_state?: Json
          created_at?: string
          display_name: string
          enabled?: boolean
          health_status?: string
          id?: string
          supported_countries?: string[]
          supported_currencies?: string[]
          updated_at?: string
        }
        Update: {
          code?: string
          configuration_state?: Json
          created_at?: string
          display_name?: string
          enabled?: boolean
          health_status?: string
          id?: string
          supported_countries?: string[]
          supported_currencies?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      finance_payment_webhooks: {
        Row: {
          created_at: string
          event_key: string
          id: string
          payload: Json
          processed_at: string | null
          rail_id: string
          signature_valid: boolean
        }
        Insert: {
          created_at?: string
          event_key: string
          id?: string
          payload?: Json
          processed_at?: string | null
          rail_id: string
          signature_valid?: boolean
        }
        Update: {
          created_at?: string
          event_key?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          rail_id?: string
          signature_valid?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "finance_payment_webhooks_rail_id_fkey"
            columns: ["rail_id"]
            isOneToOne: false
            referencedRelation: "finance_payment_rails"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_payments: {
        Row: {
          amount: number
          confirmed_at: string | null
          created_at: string
          currency: string
          id: string
          intent_id: string
          invoice_id: string
          provider_reference: string | null
          provider_transaction_id: string | null
          rail_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          confirmed_at?: string | null
          created_at?: string
          currency: string
          id?: string
          intent_id: string
          invoice_id: string
          provider_reference?: string | null
          provider_transaction_id?: string | null
          rail_id: string
          status: string
          updated_at?: string
        }
        Update: {
          amount?: number
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          intent_id?: string
          invoice_id?: string
          provider_reference?: string | null
          provider_transaction_id?: string | null
          rail_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_payments_intent_id_fkey"
            columns: ["intent_id"]
            isOneToOne: true
            referencedRelation: "finance_payment_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "finance_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payments_rail_id_fkey"
            columns: ["rail_id"]
            isOneToOne: false
            referencedRelation: "finance_payment_rails"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_payouts: {
        Row: {
          amount: number
          bank_reference: string | null
          id: string
          method: string
          payout_code: string
          processed_at: string | null
          recipient_name: string
          recipient_type: string
          requested_at: string
          reviewer_note: string | null
          status: string
        }
        Insert: {
          amount: number
          bank_reference?: string | null
          id?: string
          method: string
          payout_code: string
          processed_at?: string | null
          recipient_name: string
          recipient_type: string
          requested_at?: string
          reviewer_note?: string | null
          status: string
        }
        Update: {
          amount?: number
          bank_reference?: string | null
          id?: string
          method?: string
          payout_code?: string
          processed_at?: string | null
          recipient_name?: string
          recipient_type?: string
          requested_at?: string
          reviewer_note?: string | null
          status?: string
        }
        Relationships: []
      }
      finance_plans: {
        Row: {
          billing_cycle: string
          code: string
          created_at: string
          features: Json
          id: string
          name: string
          price: number
          status: string
        }
        Insert: {
          billing_cycle: string
          code: string
          created_at?: string
          features?: Json
          id?: string
          name: string
          price: number
          status?: string
        }
        Update: {
          billing_cycle?: string
          code?: string
          created_at?: string
          features?: Json
          id?: string
          name?: string
          price?: number
          status?: string
        }
        Relationships: []
      }
      finance_provider_transactions: {
        Row: {
          amount: number
          currency: string
          id: string
          network: string | null
          observed_at: string
          provider_transaction_id: string
          rail_id: string
          reference: string | null
          status: string
        }
        Insert: {
          amount: number
          currency: string
          id?: string
          network?: string | null
          observed_at?: string
          provider_transaction_id: string
          rail_id: string
          reference?: string | null
          status?: string
        }
        Update: {
          amount?: number
          currency?: string
          id?: string
          network?: string | null
          observed_at?: string
          provider_transaction_id?: string
          rail_id?: string
          reference?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_provider_transactions_rail_id_fkey"
            columns: ["rail_id"]
            isOneToOne: false
            referencedRelation: "finance_payment_rails"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_reconciliation_records: {
        Row: {
          created_at: string
          id: string
          invoice_id: string | null
          matching_status: string
          payment_id: string | null
          provider_transaction_id: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_id?: string | null
          matching_status?: string
          payment_id?: string | null
          provider_transaction_id: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          invoice_id?: string | null
          matching_status?: string
          payment_id?: string | null
          provider_transaction_id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_reconciliation_records_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "finance_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_reconciliation_records_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "finance_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_reconciliation_records_provider_transaction_id_fkey"
            columns: ["provider_transaction_id"]
            isOneToOne: false
            referencedRelation: "finance_provider_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_refunds: {
        Row: {
          amount: number
          customer_name: string
          id: string
          invoice_no: string | null
          mode: string
          processed_at: string | null
          reason: string
          refund_code: string
          requested_at: string
          reviewer_note: string | null
          status: string
        }
        Insert: {
          amount: number
          customer_name: string
          id?: string
          invoice_no?: string | null
          mode: string
          processed_at?: string | null
          reason: string
          refund_code: string
          requested_at?: string
          reviewer_note?: string | null
          status: string
        }
        Update: {
          amount?: number
          customer_name?: string
          id?: string
          invoice_no?: string | null
          mode?: string
          processed_at?: string | null
          reason?: string
          refund_code?: string
          requested_at?: string
          reviewer_note?: string | null
          status?: string
        }
        Relationships: []
      }
      finance_subscriptions: {
        Row: {
          amount: number
          auto_renew: boolean
          created_at: string
          customer_name: string
          customer_type: string
          expires_at: string
          id: string
          plan_id: string
          previous_plan: string | null
          started_at: string
          status: string
        }
        Insert: {
          amount: number
          auto_renew?: boolean
          created_at?: string
          customer_name: string
          customer_type: string
          expires_at: string
          id?: string
          plan_id: string
          previous_plan?: string | null
          started_at: string
          status: string
        }
        Update: {
          amount?: number
          auto_renew?: boolean
          created_at?: string
          customer_name?: string
          customer_type?: string
          expires_at?: string
          id?: string
          plan_id?: string
          previous_plan?: string | null
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "finance_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_tax_records: {
        Row: {
          created_at: string
          due_date: string
          filed_at: string | null
          filing_status: string
          id: string
          period: string
          reference_no: string | null
          tax_amount: number
          tax_type: string
          taxable_amount: number
        }
        Insert: {
          created_at?: string
          due_date: string
          filed_at?: string | null
          filing_status: string
          id?: string
          period: string
          reference_no?: string | null
          tax_amount: number
          tax_type: string
          taxable_amount: number
        }
        Update: {
          created_at?: string
          due_date?: string
          filed_at?: string | null
          filing_status?: string
          id?: string
          period?: string
          reference_no?: string | null
          tax_amount?: number
          tax_type?: string
          taxable_amount?: number
        }
        Relationships: []
      }
      finance_transactions: {
        Row: {
          amount: number
          category: string
          counterparty: string
          counterparty_type: string
          direction: string
          gateway: string | null
          id: string
          method: string | null
          notes: string | null
          occurred_at: string
          region: string
          status: string
          txn_code: string
        }
        Insert: {
          amount: number
          category: string
          counterparty: string
          counterparty_type: string
          direction: string
          gateway?: string | null
          id?: string
          method?: string | null
          notes?: string | null
          occurred_at?: string
          region?: string
          status: string
          txn_code: string
        }
        Update: {
          amount?: number
          category?: string
          counterparty?: string
          counterparty_type?: string
          direction?: string
          gateway?: string | null
          id?: string
          method?: string | null
          notes?: string | null
          occurred_at?: string
          region?: string
          status?: string
          txn_code?: string
        }
        Relationships: []
      }
      finance_wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          entry_type: string
          id: string
          note: string | null
          performed_by: string
          reference: string
          status: string
          wallet_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          entry_type: string
          id?: string
          note?: string | null
          performed_by?: string
          reference: string
          status?: string
          wallet_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          entry_type?: string
          id?: string
          note?: string | null
          performed_by?: string
          reference?: string
          status?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "finance_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_wallets: {
        Row: {
          balance: number
          created_at: string
          currency: string
          id: string
          last_activity_at: string
          low_balance_threshold: number
          owner_code: string
          owner_name: string
          owner_type: string
          region: string
          status: string
        }
        Insert: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          last_activity_at?: string
          low_balance_threshold?: number
          owner_code: string
          owner_name: string
          owner_type: string
          region?: string
          status?: string
        }
        Update: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          last_activity_at?: string
          low_balance_threshold?: number
          owner_code?: string
          owner_name?: string
          owner_type?: string
          region?: string
          status?: string
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
      founder_attention: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          created_at: string
          dismiss_reason: string | null
          dismissed_at: string | null
          dismissed_by: string | null
          domain: string
          entity_id: string | null
          entity_type: string | null
          evidence: Json
          id: string
          kind: string
          organization_id: string | null
          owner_id: string | null
          priority: number
          reason: string
          resolved_at: string | null
          resolved_by: string | null
          severity: Database["public"]["Enums"]["founder_severity"]
          source_ref: string | null
          source_system: string
          status: string
          title: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          dismiss_reason?: string | null
          dismissed_at?: string | null
          dismissed_by?: string | null
          domain: string
          entity_id?: string | null
          entity_type?: string | null
          evidence?: Json
          id?: string
          kind: string
          organization_id?: string | null
          owner_id?: string | null
          priority?: number
          reason: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity: Database["public"]["Enums"]["founder_severity"]
          source_ref?: string | null
          source_system: string
          status?: string
          title: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          dismiss_reason?: string | null
          dismissed_at?: string | null
          dismissed_by?: string | null
          domain?: string
          entity_id?: string | null
          entity_type?: string | null
          evidence?: Json
          id?: string
          kind?: string
          organization_id?: string | null
          owner_id?: string | null
          priority?: number
          reason?: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["founder_severity"]
          source_ref?: string | null
          source_system?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      founder_events: {
        Row: {
          actor_id: string | null
          actor_type: Database["public"]["Enums"]["founder_actor"]
          causation_id: string | null
          correlation_id: string | null
          domain: string
          entity_id: string | null
          entity_type: string | null
          event_type: string
          id: string
          metadata: Json
          occurred_at: string
          organization_id: string | null
          payload: Json
          received_at: string
          sequence: number | null
          severity: Database["public"]["Enums"]["founder_severity"]
          source_event_id: string
          source_system: string
          status: string
        }
        Insert: {
          actor_id?: string | null
          actor_type?: Database["public"]["Enums"]["founder_actor"]
          causation_id?: string | null
          correlation_id?: string | null
          domain: string
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          id?: string
          metadata?: Json
          occurred_at: string
          organization_id?: string | null
          payload?: Json
          received_at?: string
          sequence?: number | null
          severity?: Database["public"]["Enums"]["founder_severity"]
          source_event_id: string
          source_system: string
          status?: string
        }
        Update: {
          actor_id?: string | null
          actor_type?: Database["public"]["Enums"]["founder_actor"]
          causation_id?: string | null
          correlation_id?: string | null
          domain?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          organization_id?: string | null
          payload?: Json
          received_at?: string
          sequence?: number | null
          severity?: Database["public"]["Enums"]["founder_severity"]
          source_event_id?: string
          source_system?: string
          status?: string
        }
        Relationships: []
      }
      founder_goals: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          domain: string
          health: Database["public"]["Enums"]["founder_health"]
          id: string
          organization_id: string | null
          owner_id: string | null
          owner_name: string | null
          priority: number
          progress: number | null
          starts_on: string | null
          status: string
          target_on: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          domain: string
          health?: Database["public"]["Enums"]["founder_health"]
          id?: string
          organization_id?: string | null
          owner_id?: string | null
          owner_name?: string | null
          priority?: number
          progress?: number | null
          starts_on?: string | null
          status?: string
          target_on?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          domain?: string
          health?: Database["public"]["Enums"]["founder_health"]
          id?: string
          organization_id?: string | null
          owner_id?: string | null
          owner_name?: string | null
          priority?: number
          progress?: number | null
          starts_on?: string | null
          status?: string
          target_on?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      founder_initiative_tasks: {
        Row: {
          initiative_id: string
          linked_at: string
          linked_by: string | null
          task_id: string
        }
        Insert: {
          initiative_id: string
          linked_at?: string
          linked_by?: string | null
          task_id: string
        }
        Update: {
          initiative_id?: string
          linked_at?: string
          linked_by?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "founder_initiative_tasks_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "founder_initiatives"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_initiatives: {
        Row: {
          created_at: string
          description: string | null
          domain: string | null
          goal_id: string | null
          health: Database["public"]["Enums"]["founder_health"]
          id: string
          objective_id: string | null
          owner_id: string | null
          owner_name: string | null
          priority: number
          progress: number | null
          starts_on: string | null
          status: string
          target_on: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          domain?: string | null
          goal_id?: string | null
          health?: Database["public"]["Enums"]["founder_health"]
          id?: string
          objective_id?: string | null
          owner_id?: string | null
          owner_name?: string | null
          priority?: number
          progress?: number | null
          starts_on?: string | null
          status?: string
          target_on?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          domain?: string | null
          goal_id?: string | null
          health?: Database["public"]["Enums"]["founder_health"]
          id?: string
          objective_id?: string | null
          owner_id?: string | null
          owner_name?: string | null
          priority?: number
          progress?: number | null
          starts_on?: string | null
          status?: string
          target_on?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "founder_initiatives_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "founder_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_initiatives_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "founder_objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_kpi_readings: {
        Row: {
          confidence: Database["public"]["Enums"]["founder_confidence"]
          evidence: Json
          id: string
          kpi_id: string
          measured_at: string
          method: string
          recorded_at: string
          source: string
          status: Database["public"]["Enums"]["founder_health"]
          value: number | null
        }
        Insert: {
          confidence: Database["public"]["Enums"]["founder_confidence"]
          evidence?: Json
          id?: string
          kpi_id: string
          measured_at: string
          method: string
          recorded_at?: string
          source: string
          status?: Database["public"]["Enums"]["founder_health"]
          value?: number | null
        }
        Update: {
          confidence?: Database["public"]["Enums"]["founder_confidence"]
          evidence?: Json
          id?: string
          kpi_id?: string
          measured_at?: string
          method?: string
          recorded_at?: string
          source?: string
          status?: Database["public"]["Enums"]["founder_health"]
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "founder_kpi_readings_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "founder_kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_kpis: {
        Row: {
          active: boolean
          baseline_value: number | null
          created_at: string
          critical_above: number | null
          critical_below: number | null
          definition: string
          domain: string
          goal_id: string | null
          higher_is_better: boolean
          id: string
          key: string
          measurement_hours: number | null
          name: string
          objective_id: string | null
          organization_id: string | null
          owner_id: string | null
          source: string
          target_value: number | null
          unit: string
          updated_at: string
          warn_above: number | null
          warn_below: number | null
        }
        Insert: {
          active?: boolean
          baseline_value?: number | null
          created_at?: string
          critical_above?: number | null
          critical_below?: number | null
          definition: string
          domain: string
          goal_id?: string | null
          higher_is_better?: boolean
          id?: string
          key: string
          measurement_hours?: number | null
          name: string
          objective_id?: string | null
          organization_id?: string | null
          owner_id?: string | null
          source: string
          target_value?: number | null
          unit: string
          updated_at?: string
          warn_above?: number | null
          warn_below?: number | null
        }
        Update: {
          active?: boolean
          baseline_value?: number | null
          created_at?: string
          critical_above?: number | null
          critical_below?: number | null
          definition?: string
          domain?: string
          goal_id?: string | null
          higher_is_better?: boolean
          id?: string
          key?: string
          measurement_hours?: number | null
          name?: string
          objective_id?: string | null
          organization_id?: string | null
          owner_id?: string | null
          source?: string
          target_value?: number | null
          unit?: string
          updated_at?: string
          warn_above?: number | null
          warn_below?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "founder_kpis_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "founder_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_kpis_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "founder_objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_milestones: {
        Row: {
          blocked_reason: string | null
          completed_at: string | null
          completion_criteria: string | null
          created_at: string
          due_on: string | null
          evidence: Json
          id: string
          initiative_id: string
          owner_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          blocked_reason?: string | null
          completed_at?: string | null
          completion_criteria?: string | null
          created_at?: string
          due_on?: string | null
          evidence?: Json
          id?: string
          initiative_id: string
          owner_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          blocked_reason?: string | null
          completed_at?: string | null
          completion_criteria?: string | null
          created_at?: string
          due_on?: string | null
          evidence?: Json
          id?: string
          initiative_id?: string
          owner_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "founder_milestones_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "founder_initiatives"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_objectives: {
        Row: {
          created_at: string
          description: string | null
          goal_id: string
          health: Database["public"]["Enums"]["founder_health"]
          id: string
          owner_id: string | null
          priority: number
          progress: number | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          goal_id: string
          health?: Database["public"]["Enums"]["founder_health"]
          id?: string
          owner_id?: string | null
          priority?: number
          progress?: number | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          goal_id?: string
          health?: Database["public"]["Enums"]["founder_health"]
          id?: string
          owner_id?: string | null
          priority?: number
          progress?: number | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "founder_objectives_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "founder_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_risks: {
        Row: {
          created_at: string
          description: string | null
          detected_at: string
          domain: string
          evidence: Json
          goal_id: string | null
          id: string
          impact: string | null
          initiative_id: string | null
          likelihood: number | null
          organization_id: string | null
          owner_id: string | null
          resolved_at: string | null
          severity: Database["public"]["Enums"]["founder_severity"]
          source: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          detected_at?: string
          domain: string
          evidence?: Json
          goal_id?: string | null
          id?: string
          impact?: string | null
          initiative_id?: string | null
          likelihood?: number | null
          organization_id?: string | null
          owner_id?: string | null
          resolved_at?: string | null
          severity: Database["public"]["Enums"]["founder_severity"]
          source: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          detected_at?: string
          domain?: string
          evidence?: Json
          goal_id?: string | null
          id?: string
          impact?: string | null
          initiative_id?: string | null
          likelihood?: number | null
          organization_id?: string | null
          owner_id?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["founder_severity"]
          source?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "founder_risks_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "founder_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_risks_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "founder_initiatives"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_state_snapshots: {
        Row: {
          built_at: string
          built_by: string
          consistency: string
          degraded: string[]
          event_watermark: string | null
          id: string
          organization_id: string | null
          source_versions: Json
          state: Json
        }
        Insert: {
          built_at?: string
          built_by: string
          consistency?: string
          degraded?: string[]
          event_watermark?: string | null
          id?: string
          organization_id?: string | null
          source_versions?: Json
          state: Json
        }
        Update: {
          built_at?: string
          built_by?: string
          consistency?: string
          degraded?: string[]
          event_watermark?: string | null
          id?: string
          organization_id?: string | null
          source_versions?: Json
          state?: Json
        }
        Relationships: []
      }
      franchise_applications: {
        Row: {
          applicant_user_id: string | null
          application: Json | null
          applied_at: string
          assigned_to: string | null
          business_name: string
          business_type: string
          city: string
          clarification_message: string | null
          code: string
          country: string
          created_at: string
          email: string
          experience: string
          id: string
          investment_capacity: string
          kyc_status: string
          owner_name: string
          phone: string
          requested_territory: string
          review_notes: string | null
          state: string
          status: string
          updated_at: string
        }
        Insert: {
          applicant_user_id?: string | null
          application?: Json | null
          applied_at?: string
          assigned_to?: string | null
          business_name: string
          business_type?: string
          city: string
          clarification_message?: string | null
          code: string
          country?: string
          created_at?: string
          email: string
          experience?: string
          id?: string
          investment_capacity?: string
          kyc_status?: string
          owner_name: string
          phone: string
          requested_territory: string
          review_notes?: string | null
          state: string
          status?: string
          updated_at?: string
        }
        Update: {
          applicant_user_id?: string | null
          application?: Json | null
          applied_at?: string
          assigned_to?: string | null
          business_name?: string
          business_type?: string
          city?: string
          clarification_message?: string | null
          code?: string
          country?: string
          created_at?: string
          email?: string
          experience?: string
          id?: string
          investment_capacity?: string
          kyc_status?: string
          owner_name?: string
          phone?: string
          requested_territory?: string
          review_notes?: string | null
          state?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      franchise_audit_logs: {
        Row: {
          action: string
          actor: string
          created_at: string
          details: string | null
          entity_id: string | null
          entity_type: string
          id: string
          new_value: string | null
          old_value: string | null
          result: string
        }
        Insert: {
          action: string
          actor?: string
          created_at?: string
          details?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          result?: string
        }
        Update: {
          action?: string
          actor?: string
          created_at?: string
          details?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          result?: string
        }
        Relationships: []
      }
      franchise_branches: {
        Row: {
          active_employees: number
          city: string
          code: string
          created_at: string
          franchise_id: string
          id: string
          joined_date: string
          manager: string
          name: string
          performance_score: number
          region: string
          status: string
          total_sales: number
          updated_at: string
        }
        Insert: {
          active_employees?: number
          city: string
          code?: string
          created_at?: string
          franchise_id: string
          id?: string
          joined_date?: string
          manager?: string
          name: string
          performance_score?: number
          region: string
          status?: string
          total_sales?: number
          updated_at?: string
        }
        Update: {
          active_employees?: number
          city?: string
          code?: string
          created_at?: string
          franchise_id?: string
          id?: string
          joined_date?: string
          manager?: string
          name?: string
          performance_score?: number
          region?: string
          status?: string
          total_sales?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "franchise_branches_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
        ]
      }
      franchise_compliance: {
        Row: {
          category: string
          created_at: string
          due_date: string | null
          franchise_id: string
          id: string
          last_checked: string
          notes: string | null
          requirement: string
          severity: string
          status: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          due_date?: string | null
          franchise_id: string
          id?: string
          last_checked?: string
          notes?: string | null
          requirement: string
          severity?: string
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          due_date?: string | null
          franchise_id?: string
          id?: string
          last_checked?: string
          notes?: string | null
          requirement?: string
          severity?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "franchise_compliance_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
        ]
      }
      franchise_contracts: {
        Row: {
          contract_no: string
          contract_type: string
          created_at: string
          end_date: string
          franchise_id: string
          id: string
          renewal_status: string
          signed_at: string | null
          start_date: string
          status: string
          updated_at: string
          value: number
        }
        Insert: {
          contract_no: string
          contract_type?: string
          created_at?: string
          end_date: string
          franchise_id: string
          id?: string
          renewal_status?: string
          signed_at?: string | null
          start_date: string
          status?: string
          updated_at?: string
          value?: number
        }
        Update: {
          contract_no?: string
          contract_type?: string
          created_at?: string
          end_date?: string
          franchise_id?: string
          id?: string
          renewal_status?: string
          signed_at?: string | null
          start_date?: string
          status?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "franchise_contracts_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
        ]
      }
      franchise_documents: {
        Row: {
          application_id: string | null
          created_at: string
          doc_type: string
          expires_at: string | null
          file_url: string | null
          franchise_id: string | null
          id: string
          name: string
          status: string
          updated_at: string
          uploaded_at: string
        }
        Insert: {
          application_id?: string | null
          created_at?: string
          doc_type?: string
          expires_at?: string | null
          file_url?: string | null
          franchise_id?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
          uploaded_at?: string
        }
        Update: {
          application_id?: string | null
          created_at?: string
          doc_type?: string
          expires_at?: string | null
          file_url?: string | null
          franchise_id?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "franchise_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "franchise_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "franchise_documents_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
        ]
      }
      franchise_employees: {
        Row: {
          availability: Json
          branch_id: string | null
          created_at: string
          email: string
          franchise_id: string
          full_name: string
          id: string
          joined_at: string
          performance: number
          role: string
          status: string
          updated_at: string
        }
        Insert: {
          availability?: Json
          branch_id?: string | null
          created_at?: string
          email?: string
          franchise_id: string
          full_name: string
          id?: string
          joined_at?: string
          performance?: number
          role: string
          status?: string
          updated_at?: string
        }
        Update: {
          availability?: Json
          branch_id?: string | null
          created_at?: string
          email?: string
          franchise_id?: string
          full_name?: string
          id?: string
          joined_at?: string
          performance?: number
          role?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "franchise_employees_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "franchise_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "franchise_employees_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
        ]
      }
      franchise_escalations: {
        Row: {
          assigned_to: string
          category: string
          created_at: string
          franchise_id: string | null
          id: string
          priority: string
          raised_by: string
          resolution: string | null
          sla_due: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string
          category?: string
          created_at?: string
          franchise_id?: string | null
          id?: string
          priority?: string
          raised_by?: string
          resolution?: string | null
          sla_due?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string
          category?: string
          created_at?: string
          franchise_id?: string | null
          id?: string
          priority?: string
          raised_by?: string
          resolution?: string | null
          sla_due?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "franchise_escalations_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
        ]
      }
      franchise_fraud_alerts: {
        Row: {
          alert_type: string
          created_at: string
          description: string
          detected_at: string
          franchise_id: string | null
          id: string
          risk_score: number
          severity: string
          status: string
          updated_at: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          description: string
          detected_at?: string
          franchise_id?: string | null
          id?: string
          risk_score?: number
          severity?: string
          status?: string
          updated_at?: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          description?: string
          detected_at?: string
          franchise_id?: string | null
          id?: string
          risk_score?: number
          severity?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "franchise_fraud_alerts_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
        ]
      }
      franchise_leads: {
        Row: {
          company: string
          created_at: string
          franchise_id: string
          id: string
          name: string
          notes: string
          owner_user_id: string | null
          source: string
          stage: string
          updated_at: string
          value: number
        }
        Insert: {
          company?: string
          created_at?: string
          franchise_id: string
          id?: string
          name: string
          notes?: string
          owner_user_id?: string | null
          source?: string
          stage?: string
          updated_at?: string
          value?: number
        }
        Update: {
          company?: string
          created_at?: string
          franchise_id?: string
          id?: string
          name?: string
          notes?: string
          owner_user_id?: string | null
          source?: string
          stage?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "franchise_leads_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
        ]
      }
      franchise_notifications: {
        Row: {
          created_at: string
          franchise_id: string | null
          id: string
          message: string
          read: boolean
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          franchise_id?: string | null
          id?: string
          message?: string
          read?: boolean
          title: string
          type?: string
        }
        Update: {
          created_at?: string
          franchise_id?: string | null
          id?: string
          message?: string
          read?: boolean
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "franchise_notifications_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
        ]
      }
      franchise_performance: {
        Row: {
          conversions: number
          created_at: string
          csat: number
          franchise_id: string
          id: string
          leads: number
          period: string
          revenue: number
          sla_percent: number
          tickets: number
        }
        Insert: {
          conversions?: number
          created_at?: string
          csat?: number
          franchise_id: string
          id?: string
          leads?: number
          period: string
          revenue?: number
          sla_percent?: number
          tickets?: number
        }
        Update: {
          conversions?: number
          created_at?: string
          csat?: number
          franchise_id?: string
          id?: string
          leads?: number
          period?: string
          revenue?: number
          sla_percent?: number
          tickets?: number
        }
        Relationships: [
          {
            foreignKeyName: "franchise_performance_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
        ]
      }
      franchise_royalties: {
        Row: {
          commission_due: number
          created_at: string
          due_date: string | null
          franchise_id: string
          gross_sales: number
          id: string
          paid_amount: number
          paid_at: string | null
          period: string
          royalty_due: number
          royalty_rate: number
          status: string
          updated_at: string
        }
        Insert: {
          commission_due?: number
          created_at?: string
          due_date?: string | null
          franchise_id: string
          gross_sales?: number
          id?: string
          paid_amount?: number
          paid_at?: string | null
          period: string
          royalty_due?: number
          royalty_rate?: number
          status?: string
          updated_at?: string
        }
        Update: {
          commission_due?: number
          created_at?: string
          due_date?: string | null
          franchise_id?: string
          gross_sales?: number
          id?: string
          paid_amount?: number
          paid_at?: string | null
          period?: string
          royalty_due?: number
          royalty_rate?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "franchise_royalties_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
        ]
      }
      franchise_settings: {
        Row: {
          description: string
          id: string
          key: string
          label: string
          updated_at: string
          value: Json
        }
        Insert: {
          description?: string
          id?: string
          key: string
          label: string
          updated_at?: string
          value?: Json
        }
        Update: {
          description?: string
          id?: string
          key?: string
          label?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      franchise_users: {
        Row: {
          active: boolean
          created_at: string
          franchise_id: string
          role: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          franchise_id: string
          role: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          franchise_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "franchise_users_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
        ]
      }
      franchises: {
        Row: {
          active_resellers: number
          business_name: string
          city: string
          code: string
          commission_rate: number
          complaint_rate: number
          conversion_rate: number
          country: string
          created_at: string
          email: string
          health: string
          id: string
          joined_date: string
          last_active: string
          lead_quality: number
          lead_routing: boolean
          name: string
          owner_name: string
          owner_user_id: string | null
          performance_score: number
          phone: string
          pricing_variation: number
          royalty_rate: number
          sla_adherence: number
          state: string
          status: string
          suspension_reason: string | null
          territory: string
          territory_id: string | null
          total_sales: number
          updated_at: string
        }
        Insert: {
          active_resellers?: number
          business_name?: string
          city?: string
          code: string
          commission_rate?: number
          complaint_rate?: number
          conversion_rate?: number
          country?: string
          created_at?: string
          email: string
          health?: string
          id?: string
          joined_date?: string
          last_active?: string
          lead_quality?: number
          lead_routing?: boolean
          name: string
          owner_name: string
          owner_user_id?: string | null
          performance_score?: number
          phone: string
          pricing_variation?: number
          royalty_rate?: number
          sla_adherence?: number
          state?: string
          status?: string
          suspension_reason?: string | null
          territory?: string
          territory_id?: string | null
          total_sales?: number
          updated_at?: string
        }
        Update: {
          active_resellers?: number
          business_name?: string
          city?: string
          code?: string
          commission_rate?: number
          complaint_rate?: number
          conversion_rate?: number
          country?: string
          created_at?: string
          email?: string
          health?: string
          id?: string
          joined_date?: string
          last_active?: string
          lead_quality?: number
          lead_routing?: boolean
          name?: string
          owner_name?: string
          owner_user_id?: string | null
          performance_score?: number
          phone?: string
          pricing_variation?: number
          royalty_rate?: number
          sla_adherence?: number
          state?: string
          status?: string
          suspension_reason?: string | null
          territory?: string
          territory_id?: string | null
          total_sales?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "franchises_territory_id_fkey"
            columns: ["territory_id"]
            isOneToOne: false
            referencedRelation: "territories"
            referencedColumns: ["id"]
          },
        ]
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
      i18n_glossary_terms: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          case_sensitive: boolean
          context: string | null
          created_at: string
          created_by: string | null
          id: string
          namespace: string | null
          notes: string | null
          rule: string
          source_language: string
          source_term: string
          status: string
          target_language: string | null
          target_term: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          case_sensitive?: boolean
          context?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          namespace?: string | null
          notes?: string | null
          rule?: string
          source_language?: string
          source_term: string
          status?: string
          target_language?: string | null
          target_term?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          case_sensitive?: boolean
          context?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          namespace?: string | null
          notes?: string | null
          rule?: string
          source_language?: string
          source_term?: string
          status?: string
          target_language?: string | null
          target_term?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "i18n_glossary_terms_source_language_fkey"
            columns: ["source_language"]
            isOneToOne: false
            referencedRelation: "i18n_languages"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "i18n_glossary_terms_target_language_fkey"
            columns: ["target_language"]
            isOneToOne: false
            referencedRelation: "i18n_languages"
            referencedColumns: ["code"]
          },
        ]
      }
      i18n_languages: {
        Row: {
          aliases: string[]
          code: string
          created_at: string
          direction: string
          enabled: boolean
          fallback: string[]
          flag: string | null
          format_locale: string
          iso639_1: string | null
          iso639_3: string
          legacy_code: string | null
          locale: string
          metadata: Json
          name: string
          native_name: string
          plural_locale: string | null
          region: string | null
          registry_version: string
          replaced_by: string | null
          script: string
          sort_order: number
          translation_status: string
          updated_at: string
        }
        Insert: {
          aliases?: string[]
          code: string
          created_at?: string
          direction: string
          enabled?: boolean
          fallback?: string[]
          flag?: string | null
          format_locale: string
          iso639_1?: string | null
          iso639_3: string
          legacy_code?: string | null
          locale: string
          metadata?: Json
          name: string
          native_name: string
          plural_locale?: string | null
          region?: string | null
          registry_version: string
          replaced_by?: string | null
          script: string
          sort_order: number
          translation_status?: string
          updated_at?: string
        }
        Update: {
          aliases?: string[]
          code?: string
          created_at?: string
          direction?: string
          enabled?: boolean
          fallback?: string[]
          flag?: string | null
          format_locale?: string
          iso639_1?: string | null
          iso639_3?: string
          legacy_code?: string | null
          locale?: string
          metadata?: Json
          name?: string
          native_name?: string
          plural_locale?: string | null
          region?: string | null
          registry_version?: string
          replaced_by?: string | null
          script?: string
          sort_order?: number
          translation_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "i18n_languages_iso639_1_fkey"
            columns: ["iso639_1"]
            isOneToOne: false
            referencedRelation: "registry_languages"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "i18n_languages_replaced_by_fkey"
            columns: ["replaced_by"]
            isOneToOne: false
            referencedRelation: "i18n_languages"
            referencedColumns: ["code"]
          },
        ]
      }
      i18n_request_quota: {
        Row: {
          subject: string
          units: number
          window_start: string
        }
        Insert: {
          subject: string
          units?: number
          window_start: string
        }
        Update: {
          subject?: string
          units?: number
          window_start?: string
        }
        Relationships: []
      }
      i18n_translation_jobs: {
        Row: {
          attempts: number
          context: string | null
          context_hash: string
          created_at: string
          finished_at: string | null
          id: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          namespace: string
          priority: number
          quality_score: number | null
          refresh: boolean
          requested_by: string | null
          result_status: string | null
          run_after: string
          source_hash: string
          source_language: string
          source_text: string
          status: string
          target_language: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          context?: string | null
          context_hash: string
          created_at?: string
          finished_at?: string | null
          id?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          namespace?: string
          priority?: number
          quality_score?: number | null
          refresh?: boolean
          requested_by?: string | null
          result_status?: string | null
          run_after?: string
          source_hash: string
          source_language?: string
          source_text: string
          status?: string
          target_language: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          context?: string | null
          context_hash?: string
          created_at?: string
          finished_at?: string | null
          id?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          namespace?: string
          priority?: number
          quality_score?: number | null
          refresh?: boolean
          requested_by?: string | null
          result_status?: string | null
          run_after?: string
          source_hash?: string
          source_language?: string
          source_text?: string
          status?: string
          target_language?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "i18n_translation_jobs_source_language_fkey"
            columns: ["source_language"]
            isOneToOne: false
            referencedRelation: "i18n_languages"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "i18n_translation_jobs_target_language_fkey"
            columns: ["target_language"]
            isOneToOne: false
            referencedRelation: "i18n_languages"
            referencedColumns: ["code"]
          },
        ]
      }
      i18n_translation_revisions: {
        Row: {
          changed_at: string
          changed_by: string | null
          engine: string | null
          engine_version: string | null
          id: string
          quality_score: number | null
          status: string
          translated_text: string
          translation_id: string
          version: number
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          engine?: string | null
          engine_version?: string | null
          id?: string
          quality_score?: number | null
          status: string
          translated_text: string
          translation_id: string
          version: number
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          engine?: string | null
          engine_version?: string | null
          id?: string
          quality_score?: number | null
          status?: string
          translated_text?: string
          translation_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "i18n_translation_revisions_translation_id_fkey"
            columns: ["translation_id"]
            isOneToOne: false
            referencedRelation: "marketplace_translations"
            referencedColumns: ["id"]
          },
        ]
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
      indexnow_submissions: {
        Row: {
          created_at: string
          host: string
          id: string
          response_body: string | null
          response_status: number | null
          status: string
          submission_id: string
          url_count: number
          urls_submitted: Json
        }
        Insert: {
          created_at?: string
          host: string
          id?: string
          response_body?: string | null
          response_status?: number | null
          status?: string
          submission_id: string
          url_count?: number
          urls_submitted?: Json
        }
        Update: {
          created_at?: string
          host?: string
          id?: string
          response_body?: string | null
          response_status?: number | null
          status?: string
          submission_id?: string
          url_count?: number
          urls_submitted?: Json
        }
        Relationships: []
      }
      influencer_activity: {
        Row: {
          assignment_id: string
          created_at: string
          external_event_id: string
          id: string
          metadata: Json
          metric: string
          occurred_at: string
          quantity: number
          verification_status: string
          verified_at: string | null
        }
        Insert: {
          assignment_id: string
          created_at?: string
          external_event_id: string
          id?: string
          metadata?: Json
          metric: string
          occurred_at: string
          quantity: number
          verification_status?: string
          verified_at?: string | null
        }
        Update: {
          assignment_id?: string
          created_at?: string
          external_event_id?: string
          id?: string
          metadata?: Json
          metric?: string
          occurred_at?: string
          quantity?: number
          verification_status?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "influencer_activity_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "influencer_campaign_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      influencer_agreements: {
        Row: {
          accepted_at: string | null
          accepted_ip: unknown
          campaign_id: string | null
          created_at: string
          id: string
          profile_id: string
          status: string
          terms: Json
          version: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_ip?: unknown
          campaign_id?: string | null
          created_at?: string
          id?: string
          profile_id: string
          status?: string
          terms?: Json
          version: string
        }
        Update: {
          accepted_at?: string | null
          accepted_ip?: unknown
          campaign_id?: string | null
          created_at?: string
          id?: string
          profile_id?: string
          status?: string
          terms?: Json
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "influencer_agreements_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "influencer_agreements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "influencer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      influencer_applications: {
        Row: {
          agreement_accepted: boolean
          applicant_user_id: string | null
          application_number: string
          consent_accepted: boolean
          content_types: string[]
          country: string | null
          created_at: string
          email: string
          engagement_rate: number
          followers: number
          full_name: string
          id: string
          niche: string
          payment_details: Json
          phone: string | null
          region: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          social_profiles: Json
          status: string
          tax_details: Json
          terms_accepted: boolean
          updated_at: string
        }
        Insert: {
          agreement_accepted?: boolean
          applicant_user_id?: string | null
          application_number?: string
          consent_accepted?: boolean
          content_types?: string[]
          country?: string | null
          created_at?: string
          email: string
          engagement_rate?: number
          followers?: number
          full_name: string
          id?: string
          niche: string
          payment_details?: Json
          phone?: string | null
          region?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          social_profiles?: Json
          status?: string
          tax_details?: Json
          terms_accepted?: boolean
          updated_at?: string
        }
        Update: {
          agreement_accepted?: boolean
          applicant_user_id?: string | null
          application_number?: string
          consent_accepted?: boolean
          content_types?: string[]
          country?: string | null
          created_at?: string
          email?: string
          engagement_rate?: number
          followers?: number
          full_name?: string
          id?: string
          niche?: string
          payment_details?: Json
          phone?: string | null
          region?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          social_profiles?: Json
          status?: string
          tax_details?: Json
          terms_accepted?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      influencer_audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: []
      }
      influencer_campaign_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          campaign_id: string
          id: string
          profile_id: string
          status: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          campaign_id: string
          id?: string
          profile_id: string
          status?: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          campaign_id?: string
          id?: string
          profile_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "influencer_campaign_assignments_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "influencer_campaign_assignments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "influencer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      influencer_compensation_rules: {
        Row: {
          active: boolean
          campaign_id: string
          created_at: string
          currency: string
          eligibility: Json
          id: string
          metric: string
          platform: string
          rate: number
        }
        Insert: {
          active?: boolean
          campaign_id: string
          created_at?: string
          currency?: string
          eligibility?: Json
          id?: string
          metric: string
          platform: string
          rate: number
        }
        Update: {
          active?: boolean
          campaign_id?: string
          created_at?: string
          currency?: string
          eligibility?: Json
          id?: string
          metric?: string
          platform?: string
          rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "influencer_compensation_rules_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      influencer_earnings: {
        Row: {
          activity_id: string | null
          approved_at: string | null
          approved_by: string | null
          campaign_id: string
          created_at: string
          currency: string
          deductions: number
          gross_amount: number
          id: string
          net_amount: number | null
          profile_id: string
          status: string
        }
        Insert: {
          activity_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          campaign_id: string
          created_at?: string
          currency?: string
          deductions?: number
          gross_amount: number
          id?: string
          net_amount?: number | null
          profile_id: string
          status?: string
        }
        Update: {
          activity_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          campaign_id?: string
          created_at?: string
          currency?: string
          deductions?: number
          gross_amount?: number
          id?: string
          net_amount?: number | null
          profile_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "influencer_earnings_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: true
            referencedRelation: "influencer_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "influencer_earnings_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "influencer_earnings_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "influencer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      influencer_invoices: {
        Row: {
          amount: number
          created_at: string
          currency: string
          due_at: string | null
          id: string
          invoice_number: string
          issued_at: string | null
          paid_at: string | null
          profile_id: string
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          due_at?: string | null
          id?: string
          invoice_number?: string
          issued_at?: string | null
          paid_at?: string | null
          profile_id: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          due_at?: string | null
          id?: string
          invoice_number?: string
          issued_at?: string | null
          paid_at?: string | null
          profile_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "influencer_invoices_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "influencer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      influencer_notifications: {
        Row: {
          application_id: string | null
          body: string
          created_at: string
          id: string
          kind: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          application_id?: string | null
          body: string
          created_at?: string
          id?: string
          kind: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          application_id?: string | null
          body?: string
          created_at?: string
          id?: string
          kind?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "influencer_notifications_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "influencer_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      influencer_payouts: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          idempotency_key: string
          processed_at: string | null
          processed_by: string | null
          profile_id: string
          provider_reference: string | null
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          idempotency_key: string
          processed_at?: string | null
          processed_by?: string | null
          profile_id: string
          provider_reference?: string | null
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          idempotency_key?: string
          processed_at?: string | null
          processed_by?: string | null
          profile_id?: string
          provider_reference?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "influencer_payouts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "influencer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      influencer_profiles: {
        Row: {
          application_id: string | null
          country: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          niche: string
          region: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          application_id?: string | null
          country?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          niche: string
          region?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          application_id?: string | null
          country?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          niche?: string
          region?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "influencer_profiles_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "influencer_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      influencer_social_accounts: {
        Row: {
          engagement_rate: number
          followers: number
          handle: string | null
          id: string
          platform: string
          profile_id: string
          profile_url: string
          verification_status: string
          verified_at: string | null
        }
        Insert: {
          engagement_rate?: number
          followers?: number
          handle?: string | null
          id?: string
          platform: string
          profile_id: string
          profile_url: string
          verification_status?: string
          verified_at?: string | null
        }
        Update: {
          engagement_rate?: number
          followers?: number
          handle?: string | null
          id?: string
          platform?: string
          profile_id?: string
          profile_url?: string
          verification_status?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "influencer_social_accounts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "influencer_profiles"
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
      lead_agents: {
        Row: {
          avg_response_minutes: number
          can_export: boolean
          can_unmask: boolean
          capacity: number
          conversion_rate: number
          created_at: string
          email: string
          id: string
          name: string
          phone: string
          role: string
          status: Database["public"]["Enums"]["agent_status"]
          team: string
          updated_at: string
        }
        Insert: {
          avg_response_minutes?: number
          can_export?: boolean
          can_unmask?: boolean
          capacity?: number
          conversion_rate?: number
          created_at?: string
          email: string
          id?: string
          name: string
          phone?: string
          role?: string
          status?: Database["public"]["Enums"]["agent_status"]
          team?: string
          updated_at?: string
        }
        Update: {
          avg_response_minutes?: number
          can_export?: boolean
          can_unmask?: boolean
          capacity?: number
          conversion_rate?: number
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string
          role?: string
          status?: Database["public"]["Enums"]["agent_status"]
          team?: string
          updated_at?: string
        }
        Relationships: []
      }
      lead_alerts: {
        Row: {
          acknowledged_at: string | null
          alert_type: string
          created_at: string
          id: string
          is_active: boolean
          lead_id: string | null
          message: string
          severity: string
        }
        Insert: {
          acknowledged_at?: string | null
          alert_type: string
          created_at?: string
          id?: string
          is_active?: boolean
          lead_id?: string | null
          message: string
          severity?: string
        }
        Update: {
          acknowledged_at?: string | null
          alert_type?: string
          created_at?: string
          id?: string
          is_active?: boolean
          lead_id?: string | null
          message?: string
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_alerts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_assignments: {
        Row: {
          agent_id: string | null
          assignment_score: number | null
          auto_assigned: boolean
          created_at: string
          id: string
          lead_id: string
          previous_agent_id: string | null
          reason: string | null
        }
        Insert: {
          agent_id?: string | null
          assignment_score?: number | null
          auto_assigned?: boolean
          created_at?: string
          id?: string
          lead_id: string
          previous_agent_id?: string | null
          reason?: string | null
        }
        Update: {
          agent_id?: string | null
          assignment_score?: number | null
          auto_assigned?: boolean
          created_at?: string
          id?: string
          lead_id?: string
          previous_agent_id?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_assignments_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "lead_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_assignments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_assignments_previous_agent_id_fkey"
            columns: ["previous_agent_id"]
            isOneToOne: false
            referencedRelation: "lead_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_audit_logs: {
        Row: {
          action: string
          action_type: string
          actor: string
          actor_role: string
          created_at: string
          details: string | null
          id: string
          ip_address: string | null
          lead_id: string | null
          metadata: Json
        }
        Insert: {
          action: string
          action_type?: string
          actor?: string
          actor_role?: string
          created_at?: string
          details?: string | null
          id?: string
          ip_address?: string | null
          lead_id?: string | null
          metadata?: Json
        }
        Update: {
          action?: string
          action_type?: string
          actor?: string
          actor_role?: string
          created_at?: string
          details?: string | null
          id?: string
          ip_address?: string | null
          lead_id?: string | null
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "lead_audit_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_automation_rules: {
        Row: {
          accuracy: number
          created_at: string
          description: string
          execution_count: number
          id: string
          is_active: boolean
          last_executed_at: string | null
          name: string
          rule_key: string
          trigger_event: string
          updated_at: string
        }
        Insert: {
          accuracy?: number
          created_at?: string
          description?: string
          execution_count?: number
          id?: string
          is_active?: boolean
          last_executed_at?: string | null
          name: string
          rule_key: string
          trigger_event?: string
          updated_at?: string
        }
        Update: {
          accuracy?: number
          created_at?: string
          description?: string
          execution_count?: number
          id?: string
          is_active?: boolean
          last_executed_at?: string | null
          name?: string
          rule_key?: string
          trigger_event?: string
          updated_at?: string
        }
        Relationships: []
      }
      lead_communications: {
        Row: {
          content: string
          created_at: string
          created_by: string
          direction: string
          duration_seconds: number | null
          id: string
          lead_id: string
          status: string
          subject: string | null
          type: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string
          direction?: string
          duration_seconds?: number | null
          id?: string
          lead_id: string
          status?: string
          subject?: string | null
          type: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          direction?: string
          duration_seconds?: number | null
          id?: string
          lead_id?: string
          status?: string
          subject?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_communications_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_escalations: {
        Row: {
          created_at: string
          escalated_from: string | null
          escalated_to: string | null
          id: string
          idle_minutes: number | null
          is_resolved: boolean
          lead_id: string
          level: number
          reason: string
          resolution_notes: string | null
          resolved_at: string | null
        }
        Insert: {
          created_at?: string
          escalated_from?: string | null
          escalated_to?: string | null
          id?: string
          idle_minutes?: number | null
          is_resolved?: boolean
          lead_id: string
          level?: number
          reason: string
          resolution_notes?: string | null
          resolved_at?: string | null
        }
        Update: {
          created_at?: string
          escalated_from?: string | null
          escalated_to?: string | null
          id?: string
          idle_minutes?: number | null
          is_resolved?: boolean
          lead_id?: string
          level?: number
          reason?: string
          resolution_notes?: string | null
          resolved_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_escalations_escalated_from_fkey"
            columns: ["escalated_from"]
            isOneToOne: false
            referencedRelation: "lead_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_escalations_escalated_to_fkey"
            columns: ["escalated_to"]
            isOneToOne: false
            referencedRelation: "lead_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_escalations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_follow_ups: {
        Row: {
          agent_id: string | null
          completed_at: string | null
          created_at: string
          follow_up_type: string
          id: string
          is_completed: boolean
          lead_id: string
          notes: string | null
          outcome: string | null
          scheduled_at: string
          suggested_message: string | null
        }
        Insert: {
          agent_id?: string | null
          completed_at?: string | null
          created_at?: string
          follow_up_type?: string
          id?: string
          is_completed?: boolean
          lead_id: string
          notes?: string | null
          outcome?: string | null
          scheduled_at: string
          suggested_message?: string | null
        }
        Update: {
          agent_id?: string | null
          completed_at?: string | null
          created_at?: string
          follow_up_type?: string
          id?: string
          is_completed?: boolean
          lead_id?: string
          notes?: string | null
          outcome?: string | null
          scheduled_at?: string
          suggested_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_follow_ups_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "lead_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_follow_ups_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_integration_events: {
        Row: {
          created_at: string
          detail: string
          event: string
          id: string
          integration_key: string
          status: string
        }
        Insert: {
          created_at?: string
          detail?: string
          event: string
          id?: string
          integration_key: string
          status?: string
        }
        Update: {
          created_at?: string
          detail?: string
          event?: string
          id?: string
          integration_key?: string
          status?: string
        }
        Relationships: []
      }
      lead_integrations: {
        Row: {
          category: string
          created_at: string
          description: string
          endpoint_url: string | null
          events_today: number
          id: string
          integration_key: string
          is_enabled: boolean
          last_sync_at: string | null
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string
          endpoint_url?: string | null
          events_today?: number
          id?: string
          integration_key: string
          is_enabled?: boolean
          last_sync_at?: string | null
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          endpoint_url?: string | null
          events_today?: number
          id?: string
          integration_key?: string
          is_enabled?: boolean
          last_sync_at?: string | null
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      lead_notes: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          is_private: boolean
          lead_id: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string
          id?: string
          is_private?: boolean
          lead_id: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          is_private?: boolean
          lead_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_routing_rules: {
        Row: {
          created_at: string
          description: string
          execution_count: number
          id: string
          is_active: boolean
          name: string
          rule_key: string
          strategy: string
          target_team: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          execution_count?: number
          id?: string
          is_active?: boolean
          name: string
          rule_key: string
          strategy?: string
          target_team?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          execution_count?: number
          id?: string
          is_active?: boolean
          name?: string
          rule_key?: string
          strategy?: string
          target_team?: string
          updated_at?: string
        }
        Relationships: []
      }
      lead_scores: {
        Row: {
          confidence: number
          created_at: string
          factors: Json
          id: string
          lead_id: string
          model_version: string
          score: number
          score_type: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          factors?: Json
          id?: string
          lead_id: string
          model_version?: string
          score: number
          score_type: string
        }
        Update: {
          confidence?: number
          created_at?: string
          factors?: Json
          id?: string
          lead_id?: string
          model_version?: string
          score?: number
          score_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_scores_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_settings: {
        Row: {
          category: string
          created_at: string
          id: string
          label: string
          setting_key: string
          updated_at: string
          value_bool: boolean | null
          value_text: string | null
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          label: string
          setting_key: string
          updated_at?: string
          value_bool?: boolean | null
          value_text?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          label?: string
          setting_key?: string
          updated_at?: string
          value_bool?: boolean | null
          value_text?: string | null
        }
        Relationships: []
      }
      lead_sources: {
        Row: {
          campaign: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          slug: string
          sub_sources: Json
          type: Database["public"]["Enums"]["lead_source_type"]
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          campaign?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sub_sources?: Json
          type: Database["public"]["Enums"]["lead_source_type"]
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          campaign?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sub_sources?: Json
          type?: Database["public"]["Enums"]["lead_source_type"]
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: []
      }
      leaderboard_definitions: {
        Row: {
          created_at: string
          description: string | null
          formula: Json | null
          id: string
          metric: string
          name: string
          refresh_minutes: number
          scope: string
          scope_value: string | null
          slug: string
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          formula?: Json | null
          id?: string
          metric?: string
          name: string
          refresh_minutes?: number
          scope?: string
          scope_value?: string | null
          slug: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          formula?: Json | null
          id?: string
          metric?: string
          name?: string
          refresh_minutes?: number
          scope?: string
          scope_value?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: []
      }
      leaderboard_entries: {
        Row: {
          computed_at: string
          definition_id: string
          id: string
          rank: number
          score: number
          user_id: string
        }
        Insert: {
          computed_at?: string
          definition_id: string
          id?: string
          rank: number
          score?: number
          user_id: string
        }
        Update: {
          computed_at?: string
          definition_id?: string
          id?: string
          rank?: number
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_entries_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          ai_score: number
          assigned_agent_id: string | null
          assigned_at: string | null
          attribution: Json
          budget_range: string | null
          campaign: string | null
          card_slot_id: string | null
          category: string
          city: string | null
          closed_at: string | null
          company: string | null
          conversion_probability: number
          country: string
          created_at: string
          cta_action: string | null
          deal_value: number
          device: string
          duplicate_of: string | null
          duplicate_score: number
          email: string
          fraud_score: number
          id: string
          industry: Database["public"]["Enums"]["lead_industry"]
          intent_score: number
          ip_address: string | null
          is_duplicate: boolean
          landing_page: string | null
          language: string
          last_contact_at: string | null
          lost_reason: string | null
          name: string
          next_follow_up: string | null
          phone: string
          priority: Database["public"]["Enums"]["lead_priority"]
          product_id: string | null
          referrer: string | null
          region: string | null
          requirements: string | null
          search_engine: string | null
          source: Database["public"]["Enums"]["lead_source_type"]
          source_page: string | null
          spam_reason: string | null
          state: string | null
          status: Database["public"]["Enums"]["lead_status_type"]
          sub_source: string
          temperature: Database["public"]["Enums"]["lead_temperature"]
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          ai_score?: number
          assigned_agent_id?: string | null
          assigned_at?: string | null
          attribution?: Json
          budget_range?: string | null
          campaign?: string | null
          card_slot_id?: string | null
          category?: string
          city?: string | null
          closed_at?: string | null
          company?: string | null
          conversion_probability?: number
          country?: string
          created_at?: string
          cta_action?: string | null
          deal_value?: number
          device?: string
          duplicate_of?: string | null
          duplicate_score?: number
          email: string
          fraud_score?: number
          id?: string
          industry?: Database["public"]["Enums"]["lead_industry"]
          intent_score?: number
          ip_address?: string | null
          is_duplicate?: boolean
          landing_page?: string | null
          language?: string
          last_contact_at?: string | null
          lost_reason?: string | null
          name: string
          next_follow_up?: string | null
          phone?: string
          priority?: Database["public"]["Enums"]["lead_priority"]
          product_id?: string | null
          referrer?: string | null
          region?: string | null
          requirements?: string | null
          search_engine?: string | null
          source?: Database["public"]["Enums"]["lead_source_type"]
          source_page?: string | null
          spam_reason?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["lead_status_type"]
          sub_source?: string
          temperature?: Database["public"]["Enums"]["lead_temperature"]
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          ai_score?: number
          assigned_agent_id?: string | null
          assigned_at?: string | null
          attribution?: Json
          budget_range?: string | null
          campaign?: string | null
          card_slot_id?: string | null
          category?: string
          city?: string | null
          closed_at?: string | null
          company?: string | null
          conversion_probability?: number
          country?: string
          created_at?: string
          cta_action?: string | null
          deal_value?: number
          device?: string
          duplicate_of?: string | null
          duplicate_score?: number
          email?: string
          fraud_score?: number
          id?: string
          industry?: Database["public"]["Enums"]["lead_industry"]
          intent_score?: number
          ip_address?: string | null
          is_duplicate?: boolean
          landing_page?: string | null
          language?: string
          last_contact_at?: string | null
          lost_reason?: string | null
          name?: string
          next_follow_up?: string | null
          phone?: string
          priority?: Database["public"]["Enums"]["lead_priority"]
          product_id?: string | null
          referrer?: string | null
          region?: string | null
          requirements?: string | null
          search_engine?: string | null
          source?: Database["public"]["Enums"]["lead_source_type"]
          source_page?: string | null
          spam_reason?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["lead_status_type"]
          sub_source?: string
          temperature?: Database["public"]["Enums"]["lead_temperature"]
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "lead_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_card_slot_id_fkey"
            columns: ["card_slot_id"]
            isOneToOne: false
            referencedRelation: "marketplace_card_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_acceptances: {
        Row: {
          accepted_at: string
          agreement_id: string
          body_sha256: string | null
          decision: string
          id: string
          ip_address: string | null
          method: string
          scrolled_to_end: boolean
          session_reference: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string
          user_role: string | null
          version_id: string
          version_label: string
        }
        Insert: {
          accepted_at?: string
          agreement_id: string
          body_sha256?: string | null
          decision?: string
          id?: string
          ip_address?: string | null
          method?: string
          scrolled_to_end?: boolean
          session_reference?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id: string
          user_role?: string | null
          version_id: string
          version_label: string
        }
        Update: {
          accepted_at?: string
          agreement_id?: string
          body_sha256?: string | null
          decision?: string
          id?: string
          ip_address?: string | null
          method?: string
          scrolled_to_end?: boolean
          session_reference?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string
          user_role?: string | null
          version_id?: string
          version_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_acceptances_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "legal_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_acceptances_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "legal_agreement_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_agreement_versions: {
        Row: {
          agreement_id: string
          ai_generated: boolean
          ai_request_id: string | null
          approved_at: string | null
          approved_by: string | null
          body: string
          body_sha256: string | null
          change_summary: string | null
          created_at: string
          created_by: string | null
          id: string
          published_at: string | null
          published_by: string | null
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          superseded_at: string | null
          updated_at: string
          version: string
        }
        Insert: {
          agreement_id: string
          ai_generated?: boolean
          ai_request_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          body: string
          body_sha256?: string | null
          change_summary?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          published_at?: string | null
          published_by?: string | null
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          superseded_at?: string | null
          updated_at?: string
          version: string
        }
        Update: {
          agreement_id?: string
          ai_generated?: boolean
          ai_request_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          body?: string
          body_sha256?: string | null
          change_summary?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          published_at?: string | null
          published_by?: string | null
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          superseded_at?: string | null
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_agreement_versions_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "legal_agreements"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_agreements: {
        Row: {
          agreement_type: string
          applies_to_role: string | null
          country_code: string | null
          created_at: string
          created_by: string | null
          current_version_id: string | null
          gate_on_login: boolean
          id: string
          jurisdiction: string | null
          language_code: string
          language_confirmed_by: string | null
          language_detected: string | null
          name: string
          owner_user_id: string | null
          product_id: string | null
          ref_code: string
          requires_acceptance: boolean
          scope: string
          status: string
          updated_at: string
        }
        Insert: {
          agreement_type: string
          applies_to_role?: string | null
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          gate_on_login?: boolean
          id?: string
          jurisdiction?: string | null
          language_code?: string
          language_confirmed_by?: string | null
          language_detected?: string | null
          name: string
          owner_user_id?: string | null
          product_id?: string | null
          ref_code: string
          requires_acceptance?: boolean
          scope?: string
          status?: string
          updated_at?: string
        }
        Update: {
          agreement_type?: string
          applies_to_role?: string | null
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          gate_on_login?: boolean
          id?: string
          jurisdiction?: string | null
          language_code?: string
          language_confirmed_by?: string | null
          language_detected?: string | null
          name?: string
          owner_user_id?: string | null
          product_id?: string | null
          ref_code?: string
          requires_acceptance?: boolean
          scope?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      legal_ai_requests: {
        Row: {
          ai_type: string
          completed_at: string | null
          created_at: string
          error: string | null
          id: string
          input_reference: string | null
          jurisdiction: string | null
          latency_ms: number | null
          model: string | null
          module: string
          output: string | null
          provider: string | null
          requested_by: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          started_at: string
          status: string
        }
        Insert: {
          ai_type: string
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          input_reference?: string | null
          jurisdiction?: string | null
          latency_ms?: number | null
          model?: string | null
          module?: string
          output?: string | null
          provider?: string | null
          requested_by?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          started_at?: string
          status?: string
        }
        Update: {
          ai_type?: string
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          input_reference?: string | null
          jurisdiction?: string | null
          latency_ms?: number | null
          model?: string | null
          module?: string
          output?: string | null
          provider?: string | null
          requested_by?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      legal_alerts: {
        Row: {
          ai_request_id: string | null
          ai_suggestion: string
          alert_type: string
          confidence: number
          created_at: string
          decision: string | null
          decision_note: string | null
          description: string
          detected_at: string
          detected_in: string
          id: string
          ref_code: string
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          ai_request_id?: string | null
          ai_suggestion?: string
          alert_type: string
          confidence?: number
          created_at?: string
          decision?: string | null
          decision_note?: string | null
          description: string
          detected_at?: string
          detected_in: string
          id?: string
          ref_code: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          ai_request_id?: string | null
          ai_suggestion?: string
          alert_type?: string
          confidence?: number
          created_at?: string
          decision?: string | null
          decision_note?: string | null
          description?: string
          detected_at?: string
          detected_in?: string
          id?: string
          ref_code?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      legal_documents: {
        Row: {
          access_level: string
          checksum: string | null
          created_at: string
          doc_type: string
          encrypted: boolean
          expiry_date: string | null
          id: string
          name: string
          ref_code: string
          size_bytes: number
          size_label: string
          storage_path: string | null
          updated_at: string
          uploaded_at: string
          uploaded_by: string
          uploaded_by_user_id: string | null
        }
        Insert: {
          access_level?: string
          checksum?: string | null
          created_at?: string
          doc_type: string
          encrypted?: boolean
          expiry_date?: string | null
          id?: string
          name: string
          ref_code: string
          size_bytes?: number
          size_label?: string
          storage_path?: string | null
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string
          uploaded_by_user_id?: string | null
        }
        Update: {
          access_level?: string
          checksum?: string | null
          created_at?: string
          doc_type?: string
          encrypted?: boolean
          expiry_date?: string | null
          id?: string
          name?: string
          ref_code?: string
          size_bytes?: number
          size_label?: string
          storage_path?: string | null
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string
          uploaded_by_user_id?: string | null
        }
        Relationships: []
      }
      legal_jurisdictions: {
        Row: {
          country_code: string
          country_name: string
          created_at: string
          default_language: string
          electronic_acceptance_recognised: boolean | null
          id: string
          notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_reference: string | null
          verified: boolean
        }
        Insert: {
          country_code: string
          country_name: string
          created_at?: string
          default_language?: string
          electronic_acceptance_recognised?: boolean | null
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_reference?: string | null
          verified?: boolean
        }
        Update: {
          country_code?: string
          country_name?: string
          created_at?: string
          default_language?: string
          electronic_acceptance_recognised?: boolean | null
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_reference?: string | null
          verified?: boolean
        }
        Relationships: []
      }
      legal_logs: {
        Row: {
          action: string
          actor: string
          actor_role: string
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          new_state: Json | null
          old_state: Json | null
          reason: string | null
          ref_code: string | null
          result: string
          severity: string
        }
        Insert: {
          action: string
          actor?: string
          actor_role?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          new_state?: Json | null
          old_state?: Json | null
          reason?: string | null
          ref_code?: string | null
          result?: string
          severity?: string
        }
        Update: {
          action?: string
          actor?: string
          actor_role?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          new_state?: Json | null
          old_state?: Json | null
          reason?: string | null
          ref_code?: string | null
          result?: string
          severity?: string
        }
        Relationships: []
      }
      legal_misuse_alerts: {
        Row: {
          asset_name: string
          asset_ref: string
          created_at: string
          description: string | null
          detected_in: string
          evidence: string[]
          id: string
          ref_code: string
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string
          status: string
          updated_at: string
        }
        Insert: {
          asset_name: string
          asset_ref: string
          created_at?: string
          description?: string | null
          detected_in: string
          evidence?: string[]
          id?: string
          ref_code: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity: string
          status?: string
          updated_at?: string
        }
        Update: {
          asset_name?: string
          asset_ref?: string
          created_at?: string
          description?: string | null
          detected_in?: string
          evidence?: string[]
          id?: string
          ref_code?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      legal_policies: {
        Row: {
          compliance_assessed_at: string | null
          compliance_assessed_by: string | null
          compliance_score: number
          compliance_source: string
          content: string | null
          created_at: string
          created_by: string | null
          effective_from: string | null
          id: string
          last_updated: string
          name: string
          owner_user_id: string | null
          policy_type: string
          ref_code: string
          review_due: string | null
          status: string
          updated_at: string
          updated_by: string
          version: string
        }
        Insert: {
          compliance_assessed_at?: string | null
          compliance_assessed_by?: string | null
          compliance_score?: number
          compliance_source?: string
          content?: string | null
          created_at?: string
          created_by?: string | null
          effective_from?: string | null
          id?: string
          last_updated?: string
          name: string
          owner_user_id?: string | null
          policy_type: string
          ref_code: string
          review_due?: string | null
          status?: string
          updated_at?: string
          updated_by: string
          version: string
        }
        Update: {
          compliance_assessed_at?: string | null
          compliance_assessed_by?: string | null
          compliance_score?: number
          compliance_source?: string
          content?: string | null
          created_at?: string
          created_by?: string | null
          effective_from?: string | null
          id?: string
          last_updated?: string
          name?: string
          owner_user_id?: string | null
          policy_type?: string
          ref_code?: string
          review_due?: string | null
          status?: string
          updated_at?: string
          updated_by?: string
          version?: string
        }
        Relationships: []
      }
      legal_product_bindings: {
        Row: {
          acceptance_required: boolean
          agreement_id: string | null
          country_code: string | null
          created_at: string
          created_by: string | null
          id: string
          product_id: string | null
          product_name: string | null
          status: string
          updated_at: string
          user_type: string | null
          version_id: string | null
        }
        Insert: {
          acceptance_required?: boolean
          agreement_id?: string | null
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          product_id?: string | null
          product_name?: string | null
          status?: string
          updated_at?: string
          user_type?: string | null
          version_id?: string | null
        }
        Update: {
          acceptance_required?: boolean
          agreement_id?: string | null
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          product_id?: string | null
          product_name?: string | null
          status?: string
          updated_at?: string
          user_type?: string | null
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legal_product_bindings_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "legal_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_product_bindings_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "legal_agreement_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_records: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          details: Json
          id: string
          name: string
          position: number
          record_type: string | null
          ref_code: string | null
          status: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          details?: Json
          id?: string
          name: string
          position?: number
          record_type?: string | null
          ref_code?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          details?: Json
          id?: string
          name?: string
          position?: number
          record_type?: string | null
          ref_code?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      legal_regulations: {
        Row: {
          applies_to: string | null
          code: string
          country_code: string | null
          created_at: string
          evidence_excerpt: string | null
          id: string
          name: string
          notes: string | null
          published_on: string | null
          relevant_section: string | null
          retrieved_on: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_reference: string | null
          source_url: string | null
          status: string
          updated_at: string
          verified: boolean
        }
        Insert: {
          applies_to?: string | null
          code: string
          country_code?: string | null
          created_at?: string
          evidence_excerpt?: string | null
          id?: string
          name: string
          notes?: string | null
          published_on?: string | null
          relevant_section?: string | null
          retrieved_on?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_reference?: string | null
          source_url?: string | null
          status?: string
          updated_at?: string
          verified?: boolean
        }
        Update: {
          applies_to?: string | null
          code?: string
          country_code?: string | null
          created_at?: string
          evidence_excerpt?: string | null
          id?: string
          name?: string
          notes?: string | null
          published_on?: string | null
          relevant_section?: string | null
          retrieved_on?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_reference?: string | null
          source_url?: string | null
          status?: string
          updated_at?: string
          verified?: boolean
        }
        Relationships: []
      }
      legal_trademark_assets: {
        Row: {
          asset_type: string
          created_at: string
          expiry_date: string
          id: string
          jurisdiction: string | null
          name: string
          owner_name: string | null
          ref_code: string
          registration_checked_at: string | null
          registration_checked_by: string | null
          registration_number: string
          registration_source: string | null
          registration_verified: boolean
          status: string
          updated_at: string
          violations: number
        }
        Insert: {
          asset_type: string
          created_at?: string
          expiry_date?: string
          id?: string
          jurisdiction?: string | null
          name: string
          owner_name?: string | null
          ref_code: string
          registration_checked_at?: string | null
          registration_checked_by?: string | null
          registration_number: string
          registration_source?: string | null
          registration_verified?: boolean
          status?: string
          updated_at?: string
          violations?: number
        }
        Update: {
          asset_type?: string
          created_at?: string
          expiry_date?: string
          id?: string
          jurisdiction?: string | null
          name?: string
          owner_name?: string | null
          ref_code?: string
          registration_checked_at?: string | null
          registration_checked_by?: string | null
          registration_number?: string
          registration_source?: string | null
          registration_verified?: boolean
          status?: string
          updated_at?: string
          violations?: number
        }
        Relationships: []
      }
      legal_violations: {
        Row: {
          action_notes: string | null
          assigned_to: string | null
          created_at: string
          description: string
          detected_at: string
          evidence: string[]
          id: string
          previous_violations: number
          ref_code: string
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          status: string
          updated_at: string
          violation_type: string
          violator_id: string
          violator_type: string
          violator_user_id: string | null
        }
        Insert: {
          action_notes?: string | null
          assigned_to?: string | null
          created_at?: string
          description: string
          detected_at?: string
          evidence?: string[]
          id?: string
          previous_violations?: number
          ref_code: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          status?: string
          updated_at?: string
          violation_type: string
          violator_id: string
          violator_type: string
          violator_user_id?: string | null
        }
        Update: {
          action_notes?: string | null
          assigned_to?: string | null
          created_at?: string
          description?: string
          detected_at?: string
          evidence?: string[]
          id?: string
          previous_violations?: number
          ref_code?: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          updated_at?: string
          violation_type?: string
          violator_id?: string
          violator_type?: string
          violator_user_id?: string | null
        }
        Relationships: []
      }
      levels: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          level_number: number
          name: string
          rewards: Json
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
          xp_required: number
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          level_number: number
          name: string
          rewards?: Json
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          xp_required: number
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          level_number?: number
          name?: string
          rewards?: Json
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          xp_required?: number
        }
        Relationships: []
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
      licenses: {
        Row: {
          activation_count: number
          created_at: string
          id: string
          issued_at: string
          last_activated_at: string | null
          license_key: string
          order_id: string
          product_id: string | null
          revoked_at: string | null
          revoked_reason: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activation_count?: number
          created_at?: string
          id?: string
          issued_at?: string
          last_activated_at?: string | null
          license_key: string
          order_id: string
          product_id?: string | null
          revoked_at?: string | null
          revoked_reason?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activation_count?: number
          created_at?: string
          id?: string
          issued_at?: string
          last_activated_at?: string | null
          license_key?: string
          order_id?: string
          product_id?: string | null
          revoked_at?: string | null
          revoked_reason?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "licenses_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "licenses_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_ad_groups: {
        Row: {
          budget: number
          campaign_id: string | null
          clicks: number
          conversions: number
          created_at: string
          id: string
          impressions: number
          is_seed: boolean
          level: string
          name: string
          platform: string
          spend: number
          status: string
        }
        Insert: {
          budget?: number
          campaign_id?: string | null
          clicks?: number
          conversions?: number
          created_at?: string
          id?: string
          impressions?: number
          is_seed?: boolean
          level?: string
          name: string
          platform: string
          spend?: number
          status?: string
        }
        Update: {
          budget?: number
          campaign_id?: string | null
          clicks?: number
          conversions?: number
          created_at?: string
          id?: string
          impressions?: number
          is_seed?: boolean
          level?: string
          name?: string
          platform?: string
          spend?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_ad_groups_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_ai_recommendations: {
        Row: {
          campaign_id: string | null
          category: string
          confidence: number
          created_at: string
          id: string
          impact_estimate: string | null
          is_seed: boolean
          recommendation: string
          status: string
          title: string
        }
        Insert: {
          campaign_id?: string | null
          category: string
          confidence?: number
          created_at?: string
          id?: string
          impact_estimate?: string | null
          is_seed?: boolean
          recommendation: string
          status?: string
          title: string
        }
        Update: {
          campaign_id?: string | null
          category?: string
          confidence?: number
          created_at?: string
          id?: string
          impact_estimate?: string | null
          is_seed?: boolean
          recommendation?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_ai_recommendations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_alerts: {
        Row: {
          category: string
          created_at: string
          id: string
          is_seed: boolean
          message: string
          resolved_at: string | null
          severity: string
          status: string
          title: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          is_seed?: boolean
          message: string
          resolved_at?: string | null
          severity?: string
          status?: string
          title: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_seed?: boolean
          message?: string
          resolved_at?: string | null
          severity?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      marketing_approvals: {
        Row: {
          approver: string | null
          decided_at: string | null
          decided_by: string | null
          id: string
          is_seed: boolean
          item_name: string
          item_type: string
          notes: string | null
          priority: string
          requested_at: string
          requested_by: string
          status: string
          task_id: string | null
        }
        Insert: {
          approver?: string | null
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          is_seed?: boolean
          item_name: string
          item_type: string
          notes?: string | null
          priority?: string
          requested_at?: string
          requested_by: string
          status?: string
          task_id?: string | null
        }
        Update: {
          approver?: string | null
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          is_seed?: boolean
          item_name?: string
          item_type?: string
          notes?: string | null
          priority?: string
          requested_at?: string
          requested_by?: string
          status?: string
          task_id?: string | null
        }
        Relationships: []
      }
      marketing_audit_logs: {
        Row: {
          action: string
          actor: string
          actor_id: string | null
          actor_role: string | null
          after_state: Json | null
          before_state: Json | null
          created_at: string
          details: string | null
          entity_id: string | null
          entity_name: string | null
          entity_type: string
          id: string
          ip_address: string | null
          is_seed: boolean
          module: string
          request_id: string | null
          result: string
          session_id: string | null
          severity: string
        }
        Insert: {
          action: string
          actor: string
          actor_id?: string | null
          actor_role?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          details?: string | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          is_seed?: boolean
          module?: string
          request_id?: string | null
          result?: string
          session_id?: string | null
          severity?: string
        }
        Update: {
          action?: string
          actor?: string
          actor_id?: string | null
          actor_role?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          details?: string | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          is_seed?: boolean
          module?: string
          request_id?: string | null
          result?: string
          session_id?: string | null
          severity?: string
        }
        Relationships: []
      }
      marketing_automations: {
        Row: {
          audience_size: number
          channel: string
          conversions: number
          description: string | null
          id: string
          is_seed: boolean
          last_run_at: string | null
          name: string
          runs: number
          status: string
          trigger_type: string
        }
        Insert: {
          audience_size?: number
          channel: string
          conversions?: number
          description?: string | null
          id?: string
          is_seed?: boolean
          last_run_at?: string | null
          name: string
          runs?: number
          status?: string
          trigger_type: string
        }
        Update: {
          audience_size?: number
          channel?: string
          conversions?: number
          description?: string | null
          id?: string
          is_seed?: boolean
          last_run_at?: string | null
          name?: string
          runs?: number
          status?: string
          trigger_type?: string
        }
        Relationships: []
      }
      marketing_budgets: {
        Row: {
          allocated: number
          channel: string
          committed: number
          id: string
          is_seed: boolean
          name: string
          owner: string | null
          period: string
          spent: number
          status: string
        }
        Insert: {
          allocated?: number
          channel: string
          committed?: number
          id?: string
          is_seed?: boolean
          name: string
          owner?: string | null
          period: string
          spent?: number
          status?: string
        }
        Update: {
          allocated?: number
          channel?: string
          committed?: number
          id?: string
          is_seed?: boolean
          name?: string
          owner?: string | null
          period?: string
          spent?: number
          status?: string
        }
        Relationships: []
      }
      marketing_campaigns: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          budget: number
          channel: string
          clicks: number
          code: string
          conversions: number
          created_at: string
          created_by: string | null
          end_date: string
          id: string
          impressions: number
          is_seed: boolean
          kpi_target: string | null
          leads: number
          name: string
          objective: string
          owner: string | null
          owner_id: string | null
          promise_id: string | null
          region: string | null
          revenue: number
          spend: number
          start_date: string
          status: string
          submitted_at: string | null
          task_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          budget?: number
          channel: string
          clicks?: number
          code: string
          conversions?: number
          created_at?: string
          created_by?: string | null
          end_date: string
          id?: string
          impressions?: number
          is_seed?: boolean
          kpi_target?: string | null
          leads?: number
          name: string
          objective?: string
          owner?: string | null
          owner_id?: string | null
          promise_id?: string | null
          region?: string | null
          revenue?: number
          spend?: number
          start_date: string
          status?: string
          submitted_at?: string | null
          task_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          budget?: number
          channel?: string
          clicks?: number
          code?: string
          conversions?: number
          created_at?: string
          created_by?: string | null
          end_date?: string
          id?: string
          impressions?: number
          is_seed?: boolean
          kpi_target?: string | null
          leads?: number
          name?: string
          objective?: string
          owner?: string | null
          owner_id?: string | null
          promise_id?: string | null
          region?: string | null
          revenue?: number
          spend?: number
          start_date?: string
          status?: string
          submitted_at?: string | null
          task_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      marketing_channel_performance: {
        Row: {
          channel: string
          clicks: number
          conversions: number
          id: string
          impressions: number
          is_seed: boolean
          period_end: string
          period_start: string
          revenue: number
          roas: number
          spend: number
        }
        Insert: {
          channel: string
          clicks?: number
          conversions?: number
          id?: string
          impressions?: number
          is_seed?: boolean
          period_end: string
          period_start: string
          revenue?: number
          roas?: number
          spend?: number
        }
        Update: {
          channel?: string
          clicks?: number
          conversions?: number
          id?: string
          impressions?: number
          is_seed?: boolean
          period_end?: string
          period_start?: string
          revenue?: number
          roas?: number
          spend?: number
        }
        Relationships: []
      }
      marketing_compliance_records: {
        Row: {
          id: string
          is_seed: boolean
          item: string
          last_checked: string
          notes: string | null
          owner: string | null
          regulation: string
          status: string
        }
        Insert: {
          id?: string
          is_seed?: boolean
          item: string
          last_checked?: string
          notes?: string | null
          owner?: string | null
          regulation: string
          status?: string
        }
        Update: {
          id?: string
          is_seed?: boolean
          item?: string
          last_checked?: string
          notes?: string | null
          owner?: string | null
          regulation?: string
          status?: string
        }
        Relationships: []
      }
      marketing_consents: {
        Row: {
          channel: string
          created_at: string
          granted: boolean
          granted_at: string | null
          id: string
          revoked_at: string | null
          source: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          granted?: boolean
          granted_at?: string | null
          id?: string
          revoked_at?: string | null
          source?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          granted?: boolean
          granted_at?: string | null
          id?: string
          revoked_at?: string | null
          source?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      marketing_content_items: {
        Row: {
          author: string | null
          author_id: string | null
          body: string | null
          channel: string
          content_type: string
          created_at: string
          id: string
          is_seed: boolean
          scheduled_for: string | null
          status: string
          tags: string[]
          task_id: string | null
          title: string
          word_count: number
        }
        Insert: {
          author?: string | null
          author_id?: string | null
          body?: string | null
          channel: string
          content_type: string
          created_at?: string
          id?: string
          is_seed?: boolean
          scheduled_for?: string | null
          status?: string
          tags?: string[]
          task_id?: string | null
          title: string
          word_count?: number
        }
        Update: {
          author?: string | null
          author_id?: string | null
          body?: string | null
          channel?: string
          content_type?: string
          created_at?: string
          id?: string
          is_seed?: boolean
          scheduled_for?: string | null
          status?: string
          tags?: string[]
          task_id?: string | null
          title?: string
          word_count?: number
        }
        Relationships: []
      }
      marketing_creatives: {
        Row: {
          asset_type: string
          campaign_id: string | null
          created_at: string
          dimensions: string | null
          format: string
          id: string
          is_seed: boolean
          name: string
          performance_score: number
          status: string
          tags: string[]
          task_id: string | null
          uploaded_by: string | null
          usage_count: number
        }
        Insert: {
          asset_type: string
          campaign_id?: string | null
          created_at?: string
          dimensions?: string | null
          format: string
          id?: string
          is_seed?: boolean
          name: string
          performance_score?: number
          status?: string
          tags?: string[]
          task_id?: string | null
          uploaded_by?: string | null
          usage_count?: number
        }
        Update: {
          asset_type?: string
          campaign_id?: string | null
          created_at?: string
          dimensions?: string | null
          format?: string
          id?: string
          is_seed?: boolean
          name?: string
          performance_score?: number
          status?: string
          tags?: string[]
          task_id?: string | null
          uploaded_by?: string | null
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "marketing_creatives_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_influencers: {
        Row: {
          campaigns_count: number
          category: string | null
          cost_per_post: number
          engagement_rate: number
          followers: number
          handle: string
          id: string
          is_seed: boolean
          name: string
          platform: string
          region: string | null
          roi: number
          status: string
        }
        Insert: {
          campaigns_count?: number
          category?: string | null
          cost_per_post?: number
          engagement_rate?: number
          followers?: number
          handle: string
          id?: string
          is_seed?: boolean
          name: string
          platform: string
          region?: string | null
          roi?: number
          status?: string
        }
        Update: {
          campaigns_count?: number
          category?: string | null
          cost_per_post?: number
          engagement_rate?: number
          followers?: number
          handle?: string
          id?: string
          is_seed?: boolean
          name?: string
          platform?: string
          region?: string | null
          roi?: number
          status?: string
        }
        Relationships: []
      }
      marketing_kpi_snapshots: {
        Row: {
          clicks: number
          conversion_rate: number
          conversions: number
          id: string
          impressions: number
          is_seed: boolean
          leads: number
          metric_date: string
          reach: number
          revenue: number
          roas: number
          spend: number
        }
        Insert: {
          clicks?: number
          conversion_rate?: number
          conversions?: number
          id?: string
          impressions?: number
          is_seed?: boolean
          leads?: number
          metric_date: string
          reach?: number
          revenue?: number
          roas?: number
          spend?: number
        }
        Update: {
          clicks?: number
          conversion_rate?: number
          conversions?: number
          id?: string
          impressions?: number
          is_seed?: boolean
          leads?: number
          metric_date?: string
          reach?: number
          revenue?: number
          roas?: number
          spend?: number
        }
        Relationships: []
      }
      marketing_lead_sources: {
        Row: {
          channel: string
          conversion_rate: number
          cost_per_lead: number
          created_at: string
          id: string
          is_seed: boolean
          leads_count: number
          name: string
          qualified_count: number
          region: string | null
          source_type: string
          status: string
        }
        Insert: {
          channel: string
          conversion_rate?: number
          cost_per_lead?: number
          created_at?: string
          id?: string
          is_seed?: boolean
          leads_count?: number
          name: string
          qualified_count?: number
          region?: string | null
          source_type: string
          status?: string
        }
        Update: {
          channel?: string
          conversion_rate?: number
          cost_per_lead?: number
          created_at?: string
          id?: string
          is_seed?: boolean
          leads_count?: number
          name?: string
          qualified_count?: number
          region?: string | null
          source_type?: string
          status?: string
        }
        Relationships: []
      }
      marketing_leads: {
        Row: {
          assigned_to: string | null
          campaign_id: string | null
          city: string | null
          company: string | null
          created_at: string
          crm_lead_id: string | null
          email: string | null
          full_name: string
          id: string
          is_seed: boolean
          phone: string | null
          score: number
          source_id: string | null
          stage: string
          state: string | null
          status: string
        }
        Insert: {
          assigned_to?: string | null
          campaign_id?: string | null
          city?: string | null
          company?: string | null
          created_at?: string
          crm_lead_id?: string | null
          email?: string | null
          full_name: string
          id?: string
          is_seed?: boolean
          phone?: string | null
          score?: number
          source_id?: string | null
          stage?: string
          state?: string | null
          status?: string
        }
        Update: {
          assigned_to?: string | null
          campaign_id?: string | null
          city?: string | null
          company?: string | null
          created_at?: string
          crm_lead_id?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_seed?: boolean
          phone?: string | null
          score?: number
          source_id?: string | null
          stage?: string
          state?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_leads_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "marketing_lead_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_locations: {
        Row: {
          active_campaigns: number
          city: string | null
          country: string
          id: string
          is_seed: boolean
          leads: number
          location_type: string
          name: string
          population: number
          radius_km: number
          spend: number
          state: string | null
          status: string
        }
        Insert: {
          active_campaigns?: number
          city?: string | null
          country?: string
          id?: string
          is_seed?: boolean
          leads?: number
          location_type?: string
          name: string
          population?: number
          radius_km?: number
          spend?: number
          state?: string | null
          status?: string
        }
        Update: {
          active_campaigns?: number
          city?: string | null
          country?: string
          id?: string
          is_seed?: boolean
          leads?: number
          location_type?: string
          name?: string
          population?: number
          radius_km?: number
          spend?: number
          state?: string | null
          status?: string
        }
        Relationships: []
      }
      marketing_messages: {
        Row: {
          bounced: number
          campaign_id: string | null
          channel: string
          clicked: number
          delivered: number
          id: string
          is_seed: boolean
          name: string
          opened: number
          scheduled_at: string | null
          sent: number
          status: string
          template_id: string | null
        }
        Insert: {
          bounced?: number
          campaign_id?: string | null
          channel: string
          clicked?: number
          delivered?: number
          id?: string
          is_seed?: boolean
          name: string
          opened?: number
          scheduled_at?: string | null
          sent?: number
          status?: string
          template_id?: string | null
        }
        Update: {
          bounced?: number
          campaign_id?: string | null
          channel?: string
          clicked?: number
          delivered?: number
          id?: string
          is_seed?: boolean
          name?: string
          opened?: number
          scheduled_at?: string | null
          sent?: number
          status?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_messages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "marketing_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_offers: {
        Row: {
          code: string | null
          created_at: string
          discount_percent: number
          end_date: string
          festival: string | null
          id: string
          is_seed: boolean
          landing_url: string | null
          offer_type: string
          priority: number
          published_at: string | null
          published_by: string | null
          redemptions: number
          regions: string[]
          revenue: number
          start_date: string
          status: string
          title: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          discount_percent?: number
          end_date: string
          festival?: string | null
          id?: string
          is_seed?: boolean
          landing_url?: string | null
          offer_type?: string
          priority?: number
          published_at?: string | null
          published_by?: string | null
          redemptions?: number
          regions?: string[]
          revenue?: number
          start_date: string
          status?: string
          title: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          discount_percent?: number
          end_date?: string
          festival?: string | null
          id?: string
          is_seed?: boolean
          landing_url?: string | null
          offer_type?: string
          priority?: number
          published_at?: string | null
          published_by?: string | null
          redemptions?: number
          regions?: string[]
          revenue?: number
          start_date?: string
          status?: string
          title?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      marketing_regions: {
        Row: {
          conversions: number
          country: string
          growth_rate: number
          id: string
          is_seed: boolean
          leads: number
          name: string
          revenue: number
          spend: number
          state: string | null
          status: string
        }
        Insert: {
          conversions?: number
          country?: string
          growth_rate?: number
          id?: string
          is_seed?: boolean
          leads?: number
          name: string
          revenue?: number
          spend?: number
          state?: string | null
          status?: string
        }
        Update: {
          conversions?: number
          country?: string
          growth_rate?: number
          id?: string
          is_seed?: boolean
          leads?: number
          name?: string
          revenue?: number
          spend?: number
          state?: string | null
          status?: string
        }
        Relationships: []
      }
      marketing_reports: {
        Row: {
          file_path: string | null
          format: string
          generated_at: string
          generated_by: string | null
          id: string
          is_seed: boolean
          name: string
          period: string
          promise_id: string | null
          report_type: string
          status: string
          summary: string | null
        }
        Insert: {
          file_path?: string | null
          format?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          is_seed?: boolean
          name: string
          period: string
          promise_id?: string | null
          report_type: string
          status?: string
          summary?: string | null
        }
        Update: {
          file_path?: string | null
          format?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          is_seed?: boolean
          name?: string
          period?: string
          promise_id?: string | null
          report_type?: string
          status?: string
          summary?: string | null
        }
        Relationships: []
      }
      marketing_schedules: {
        Row: {
          campaign_id: string | null
          channel: string
          id: string
          is_seed: boolean
          owner: string | null
          recurrence: string
          scheduled_at: string
          status: string
          title: string
        }
        Insert: {
          campaign_id?: string | null
          channel: string
          id?: string
          is_seed?: boolean
          owner?: string | null
          recurrence?: string
          scheduled_at: string
          status?: string
          title: string
        }
        Update: {
          campaign_id?: string | null
          channel?: string
          id?: string
          is_seed?: boolean
          owner?: string | null
          recurrence?: string
          scheduled_at?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_schedules_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_seo_keywords: {
        Row: {
          country: string
          cpc: number
          difficulty: number
          id: string
          intent: string
          is_seed: boolean
          keyword: string
          page_url: string | null
          position: number
          previous_position: number
          search_volume: number
          status: string
          updated_at: string
        }
        Insert: {
          country?: string
          cpc?: number
          difficulty?: number
          id?: string
          intent?: string
          is_seed?: boolean
          keyword: string
          page_url?: string | null
          position?: number
          previous_position?: number
          search_volume?: number
          status?: string
          updated_at?: string
        }
        Update: {
          country?: string
          cpc?: number
          difficulty?: number
          id?: string
          intent?: string
          is_seed?: boolean
          keyword?: string
          page_url?: string | null
          position?: number
          previous_position?: number
          search_volume?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketing_seo_pages: {
        Row: {
          backlinks: number
          health_score: number
          id: string
          indexed: boolean
          is_seed: boolean
          issues: number
          last_crawled: string
          meta_description: string | null
          organic_traffic: number
          title: string
          url: string
        }
        Insert: {
          backlinks?: number
          health_score?: number
          id?: string
          indexed?: boolean
          is_seed?: boolean
          issues?: number
          last_crawled?: string
          meta_description?: string | null
          organic_traffic?: number
          title: string
          url: string
        }
        Update: {
          backlinks?: number
          health_score?: number
          id?: string
          indexed?: boolean
          is_seed?: boolean
          issues?: number
          last_crawled?: string
          meta_description?: string | null
          organic_traffic?: number
          title?: string
          url?: string
        }
        Relationships: []
      }
      marketing_social_posts: {
        Row: {
          campaign_id: string | null
          comments: number
          content: string
          id: string
          is_seed: boolean
          likes: number
          platform: string
          published_at: string | null
          reach: number
          scheduled_at: string | null
          shares: number
          status: string
        }
        Insert: {
          campaign_id?: string | null
          comments?: number
          content: string
          id?: string
          is_seed?: boolean
          likes?: number
          platform: string
          published_at?: string | null
          reach?: number
          scheduled_at?: string | null
          shares?: number
          status?: string
        }
        Update: {
          campaign_id?: string | null
          comments?: number
          content?: string
          id?: string
          is_seed?: boolean
          likes?: number
          platform?: string
          published_at?: string | null
          reach?: number
          scheduled_at?: string | null
          shares?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_social_posts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_templates: {
        Row: {
          body: string | null
          category: string | null
          channel: string
          id: string
          is_seed: boolean
          name: string
          status: string
          subject: string | null
          usage_count: number
        }
        Insert: {
          body?: string | null
          category?: string | null
          channel: string
          id?: string
          is_seed?: boolean
          name: string
          status?: string
          subject?: string | null
          usage_count?: number
        }
        Update: {
          body?: string | null
          category?: string | null
          channel?: string
          id?: string
          is_seed?: boolean
          name?: string
          status?: string
          subject?: string | null
          usage_count?: number
        }
        Relationships: []
      }
      marketplace_affiliate_partners: {
        Row: {
          created_at: string
          display_name: string
          id: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      marketplace_audit_logs: {
        Row: {
          action: string
          actor: string | null
          actor_id: string | null
          actor_role: string | null
          after_state: Json | null
          before_state: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          metadata: Json
          module: string
          reason: string | null
          request_id: string | null
        }
        Insert: {
          action: string
          actor?: string | null
          actor_id?: string | null
          actor_role?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          module?: string
          reason?: string | null
          request_id?: string | null
        }
        Update: {
          action?: string
          actor?: string | null
          actor_id?: string | null
          actor_role?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          module?: string
          reason?: string | null
          request_id?: string | null
        }
        Relationships: []
      }
      marketplace_awards: {
        Row: {
          category: string
          created_at: string
          id: string
          product_slug: string | null
          published: boolean
          sort_order: number
          updated_at: string
          winner: string
          year: number
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          product_slug?: string | null
          published?: boolean
          sort_order?: number
          updated_at?: string
          winner: string
          year?: number
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          product_slug?: string | null
          published?: boolean
          sort_order?: number
          updated_at?: string
          winner?: string
          year?: number
        }
        Relationships: []
      }
      marketplace_card_fields: {
        Row: {
          data_column: string | null
          enabled: boolean
          hint: string | null
          id: string
          key: string
          kind: string
          label: string
          position: number
          priority: number
          requires: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          data_column?: string | null
          enabled?: boolean
          hint?: string | null
          id?: string
          key: string
          kind: string
          label: string
          position: number
          priority?: number
          requires?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          data_column?: string | null
          enabled?: boolean
          hint?: string | null
          id?: string
          key?: string
          kind?: string
          label?: string
          position?: number
          priority?: number
          requires?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      marketplace_card_slots: {
        Row: {
          business_type: string | null
          category_id: string
          country_code: string | null
          country_marker: string
          created_at: string
          current_product_id: string | null
          faq_set: Json
          free_tool_ids: string[]
          h1_template: string | null
          h2_templates: string[]
          hreflang_group: string | null
          id: string
          indexnow_enabled: boolean
          keyword_set: Json
          meta_description_template: string | null
          meta_title_template: string | null
          occupied_since: string | null
          primary_keyword: string | null
          region: string | null
          rotation_policy: string
          schema_types: string[]
          search_engines: string[]
          slot_no: number
          slot_title: string | null
          slot_url: string
          software_type: string | null
          status: string
          updated_at: string
        }
        Insert: {
          business_type?: string | null
          category_id: string
          country_code?: string | null
          country_marker: string
          created_at?: string
          current_product_id?: string | null
          faq_set?: Json
          free_tool_ids?: string[]
          h1_template?: string | null
          h2_templates?: string[]
          hreflang_group?: string | null
          id?: string
          indexnow_enabled?: boolean
          keyword_set?: Json
          meta_description_template?: string | null
          meta_title_template?: string | null
          occupied_since?: string | null
          primary_keyword?: string | null
          region?: string | null
          rotation_policy?: string
          schema_types?: string[]
          search_engines?: string[]
          slot_no: number
          slot_title?: string | null
          slot_url: string
          software_type?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          business_type?: string | null
          category_id?: string
          country_code?: string | null
          country_marker?: string
          created_at?: string
          current_product_id?: string | null
          faq_set?: Json
          free_tool_ids?: string[]
          h1_template?: string | null
          h2_templates?: string[]
          hreflang_group?: string | null
          id?: string
          indexnow_enabled?: boolean
          keyword_set?: Json
          meta_description_template?: string | null
          meta_title_template?: string | null
          occupied_since?: string | null
          primary_keyword?: string | null
          region?: string | null
          rotation_policy?: string
          schema_types?: string[]
          search_engines?: string[]
          slot_no?: number
          slot_title?: string | null
          slot_url?: string
          software_type?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_card_slots_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "marketplace_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_card_slots_current_product_id_fkey"
            columns: ["current_product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_cart_items: {
        Row: {
          cart_id: string
          created_at: string
          id: string
          product_id: string
          quantity: number
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          cart_id: string
          created_at?: string
          id?: string
          product_id: string
          quantity: number
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          cart_id?: string
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "marketplace_carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_cart_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "marketplace_product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_carts: {
        Row: {
          buyer_id: string
          created_at: string
          currency: string
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          currency?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          currency?: string
          id?: string
          status?: string
          updated_at?: string
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
      marketplace_commission_reversals: {
        Row: {
          amount: number
          commission_id: string
          created_at: string
          id: string
          reason: string
          refund_id: string
        }
        Insert: {
          amount: number
          commission_id: string
          created_at?: string
          id?: string
          reason?: string
          refund_id: string
        }
        Update: {
          amount?: number
          commission_id?: string
          created_at?: string
          id?: string
          reason?: string
          refund_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_commission_reversals_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "marketplace_commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_commission_reversals_refund_id_fkey"
            columns: ["refund_id"]
            isOneToOne: false
            referencedRelation: "marketplace_order_refunds"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_commission_rules: {
        Row: {
          active: boolean
          category_id: string | null
          created_at: string
          currency: string
          fixed_amount: number
          id: string
          priority: number
          product_id: string | null
          rate_percent: number
          seller_id: string | null
        }
        Insert: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          currency?: string
          fixed_amount?: number
          id?: string
          priority?: number
          product_id?: string | null
          rate_percent?: number
          seller_id?: string | null
        }
        Update: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          currency?: string
          fixed_amount?: number
          id?: string
          priority?: number
          product_id?: string | null
          rate_percent?: number
          seller_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_commission_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "marketplace_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_commission_rules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_commission_rules_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "marketplace_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_commissions: {
        Row: {
          commission_amount: number
          created_at: string
          gross_amount: number
          id: string
          order_item_id: string
          payout_id: string | null
          rule_snapshot: Json
          seller_amount: number
          seller_id: string | null
          status: string
        }
        Insert: {
          commission_amount: number
          created_at?: string
          gross_amount: number
          id?: string
          order_item_id: string
          payout_id?: string | null
          rule_snapshot?: Json
          seller_amount: number
          seller_id?: string | null
          status?: string
        }
        Update: {
          commission_amount?: number
          created_at?: string
          gross_amount?: number
          id?: string
          order_item_id?: string
          payout_id?: string | null
          rule_snapshot?: Json
          seller_amount?: number
          seller_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_commissions_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: true
            referencedRelation: "marketplace_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_commissions_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "marketplace_payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_commissions_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "marketplace_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_coupon_redemptions: {
        Row: {
          buyer_id: string
          coupon_id: string
          created_at: string
          id: string
          order_id: string
        }
        Insert: {
          buyer_id: string
          coupon_id: string
          created_at?: string
          id?: string
          order_id: string
        }
        Update: {
          buyer_id?: string
          coupon_id?: string
          created_at?: string
          id?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "marketplace_coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_coupon_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          currency: string
          expires_at: string | null
          id: string
          kind: string
          max_redemptions: number | null
          minimum_subtotal: number
          value: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          kind: string
          max_redemptions?: number | null
          minimum_subtotal?: number
          value: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          kind?: string
          max_redemptions?: number | null
          minimum_subtotal?: number
          value?: number
        }
        Relationships: []
      }
      marketplace_disputes: {
        Row: {
          amount: number
          assigned_to: string | null
          buyer_id: string | null
          created_by: string | null
          currency: string
          dispute_no: string
          evidence: Json
          id: string
          opened_at: string
          order_id: string
          payment_reference: string | null
          reason: string
          resolution: string | null
          resolved_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          assigned_to?: string | null
          buyer_id?: string | null
          created_by?: string | null
          currency?: string
          dispute_no?: string
          evidence?: Json
          id?: string
          opened_at?: string
          order_id: string
          payment_reference?: string | null
          reason: string
          resolution?: string | null
          resolved_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          assigned_to?: string | null
          buyer_id?: string | null
          created_by?: string | null
          currency?: string
          dispute_no?: string
          evidence?: Json
          id?: string
          opened_at?: string
          order_id?: string
          payment_reference?: string | null
          reason?: string
          resolution?: string | null
          resolved_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_disputes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_downloads: {
        Row: {
          buyer_id: string
          created_at: string
          entitlement_id: string
          id: string
          version_id: string | null
        }
        Insert: {
          buyer_id: string
          created_at?: string
          entitlement_id: string
          id?: string
          version_id?: string | null
        }
        Update: {
          buyer_id?: string
          created_at?: string
          entitlement_id?: string
          id?: string
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_downloads_entitlement_id_fkey"
            columns: ["entitlement_id"]
            isOneToOne: false
            referencedRelation: "marketplace_entitlements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_downloads_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "marketplace_product_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_entitlements: {
        Row: {
          buyer_id: string
          created_at: string
          ends_at: string | null
          id: string
          order_item_id: string
          product_id: string
          starts_at: string
          status: string
          version_id: string | null
        }
        Insert: {
          buyer_id: string
          created_at?: string
          ends_at?: string | null
          id?: string
          order_item_id: string
          product_id: string
          starts_at?: string
          status?: string
          version_id?: string | null
        }
        Update: {
          buyer_id?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          order_item_id?: string
          product_id?: string
          starts_at?: string
          status?: string
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_entitlements_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: true
            referencedRelation: "marketplace_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_entitlements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_entitlements_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "marketplace_product_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_events: {
        Row: {
          category_id: string | null
          created_at: string
          dedupe_key: string | null
          event_type: string
          id: string
          metadata: Json
          product_id: string | null
          session_id: string | null
          source_page: string | null
          surface: string | null
          user_id: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          dedupe_key?: string | null
          event_type: string
          id?: string
          metadata?: Json
          product_id?: string | null
          session_id?: string | null
          source_page?: string | null
          surface?: string | null
          user_id?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          dedupe_key?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          product_id?: string | null
          session_id?: string | null
          source_page?: string | null
          surface?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_events_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "marketplace_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_filter_groups: {
        Row: {
          combine: string
          enabled: boolean
          id: string
          key: string
          label: string
          position: number
          select_mode: string
          source: string
          updated_at: string
          updated_by: string | null
          visible_desktop: boolean
          visible_mobile: boolean
        }
        Insert: {
          combine?: string
          enabled?: boolean
          id?: string
          key: string
          label: string
          position: number
          select_mode?: string
          source: string
          updated_at?: string
          updated_by?: string | null
          visible_desktop?: boolean
          visible_mobile?: boolean
        }
        Update: {
          combine?: string
          enabled?: boolean
          id?: string
          key?: string
          label?: string
          position?: number
          select_mode?: string
          source?: string
          updated_at?: string
          updated_by?: string | null
          visible_desktop?: boolean
          visible_mobile?: boolean
        }
        Relationships: []
      }
      marketplace_homepage_sections: {
        Row: {
          archived_at: string | null
          category_id: string | null
          clicks: number
          collection_key: string | null
          config: Json
          conversions: number
          created_at: string
          created_by: string | null
          cta_href: string | null
          cta_label: string | null
          description: string | null
          duplicated_from: string | null
          enabled: boolean
          ends_at: string | null
          id: string
          impressions: number
          item_limit: number
          key: string
          manual_product_ids: string[]
          owner_user_id: string | null
          priority: number
          product_filter: Json
          published_at: string | null
          published_by: string | null
          row_type: string
          sort_by: string
          sort_order: number
          source: string
          starts_at: string | null
          status: string
          subtitle: string | null
          title: string
          updated_at: string
          updated_by: string | null
          visible_desktop: boolean
          visible_mobile: boolean
        }
        Insert: {
          archived_at?: string | null
          category_id?: string | null
          clicks?: number
          collection_key?: string | null
          config?: Json
          conversions?: number
          created_at?: string
          created_by?: string | null
          cta_href?: string | null
          cta_label?: string | null
          description?: string | null
          duplicated_from?: string | null
          enabled?: boolean
          ends_at?: string | null
          id?: string
          impressions?: number
          item_limit?: number
          key: string
          manual_product_ids?: string[]
          owner_user_id?: string | null
          priority?: number
          product_filter?: Json
          published_at?: string | null
          published_by?: string | null
          row_type?: string
          sort_by?: string
          sort_order?: number
          source?: string
          starts_at?: string | null
          status?: string
          subtitle?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
          visible_desktop?: boolean
          visible_mobile?: boolean
        }
        Update: {
          archived_at?: string | null
          category_id?: string | null
          clicks?: number
          collection_key?: string | null
          config?: Json
          conversions?: number
          created_at?: string
          created_by?: string | null
          cta_href?: string | null
          cta_label?: string | null
          description?: string | null
          duplicated_from?: string | null
          enabled?: boolean
          ends_at?: string | null
          id?: string
          impressions?: number
          item_limit?: number
          key?: string
          manual_product_ids?: string[]
          owner_user_id?: string | null
          priority?: number
          product_filter?: Json
          published_at?: string | null
          published_by?: string | null
          row_type?: string
          sort_by?: string
          sort_order?: number
          source?: string
          starts_at?: string | null
          status?: string
          subtitle?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          visible_desktop?: boolean
          visible_mobile?: boolean
        }
        Relationships: []
      }
      marketplace_ledger_entries: {
        Row: {
          amount: number
          created_at: string
          currency: string
          entry_type: string
          id: string
          immutable_metadata: Json
          order_id: string | null
          order_item_id: string | null
          reseller_id: string | null
          seller_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          entry_type: string
          id?: string
          immutable_metadata?: Json
          order_id?: string | null
          order_item_id?: string | null
          reseller_id?: string | null
          seller_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          entry_type?: string
          id?: string
          immutable_metadata?: Json
          order_id?: string | null
          order_item_id?: string | null
          reseller_id?: string | null
          seller_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_ledger_entries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_ledger_entries_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "marketplace_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_ledger_entries_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_ledger_entries_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "marketplace_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_licenses: {
        Row: {
          buyer_id: string
          created_at: string
          expires_at: string | null
          id: string
          license_key: string
          license_model: string
          order_item_id: string
          product_id: string
          status: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          license_key?: string
          license_model?: string
          order_item_id: string
          product_id: string
          status?: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          license_key?: string
          license_model?: string
          order_item_id?: string
          product_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_licenses_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: true
            referencedRelation: "marketplace_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_licenses_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_order_attributions: {
        Row: {
          affiliate_partner_id: string | null
          attributed_at: string
          attribution_method: string
          click_id: string | null
          created_at: string
          id: string
          influencer_profile_id: string | null
          metadata: Json
          order_id: string
          referral_code_id: string | null
          reseller_id: string | null
          session_id: string | null
        }
        Insert: {
          affiliate_partner_id?: string | null
          attributed_at?: string
          attribution_method: string
          click_id?: string | null
          created_at?: string
          id?: string
          influencer_profile_id?: string | null
          metadata?: Json
          order_id: string
          referral_code_id?: string | null
          reseller_id?: string | null
          session_id?: string | null
        }
        Update: {
          affiliate_partner_id?: string | null
          attributed_at?: string
          attribution_method?: string
          click_id?: string | null
          created_at?: string
          id?: string
          influencer_profile_id?: string | null
          metadata?: Json
          order_id?: string
          referral_code_id?: string | null
          reseller_id?: string | null
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_order_attributions_affiliate_partner_id_fkey"
            columns: ["affiliate_partner_id"]
            isOneToOne: false
            referencedRelation: "marketplace_affiliate_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_order_attributions_influencer_profile_id_fkey"
            columns: ["influencer_profile_id"]
            isOneToOne: false
            referencedRelation: "influencer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_order_attributions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_order_attributions_referral_code_id_fkey"
            columns: ["referral_code_id"]
            isOneToOne: false
            referencedRelation: "marketplace_referral_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_order_attributions_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_order_attributions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "marketplace_referral_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_order_items: {
        Row: {
          created_at: string
          currency: string
          id: string
          line_total: number
          order_id: string
          product_id: string
          product_name: string
          product_version_id: string | null
          quantity: number
          seller_id: string | null
          unit_amount: number
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          currency: string
          id?: string
          line_total: number
          order_id: string
          product_id: string
          product_name: string
          product_version_id?: string | null
          quantity: number
          seller_id?: string | null
          unit_amount: number
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          line_total?: number
          order_id?: string
          product_id?: string
          product_name?: string
          product_version_id?: string | null
          quantity?: number
          seller_id?: string | null
          unit_amount?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_order_items_product_version_id_fkey"
            columns: ["product_version_id"]
            isOneToOne: false
            referencedRelation: "marketplace_product_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_order_items_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "marketplace_sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "marketplace_product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_order_refunds: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          order_id: string
          payload: Json
          payment_intent_id: string | null
          processed_at: string | null
          provider: string
          provider_refund_id: string | null
          reason: string
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          id?: string
          order_id: string
          payload?: Json
          payment_intent_id?: string | null
          processed_at?: string | null
          provider: string
          provider_refund_id?: string | null
          reason?: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          order_id?: string
          payload?: Json
          payment_intent_id?: string | null
          processed_at?: string | null
          provider?: string
          provider_refund_id?: string | null
          reason?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_order_refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_order_refunds_payment_intent_id_fkey"
            columns: ["payment_intent_id"]
            isOneToOne: false
            referencedRelation: "marketplace_payment_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_order_status_history: {
        Row: {
          actor_id: string | null
          created_at: string
          from_status: string | null
          id: string
          metadata: Json
          order_id: string
          to_status: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          metadata?: Json
          order_id: string
          to_status: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          metadata?: Json
          order_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_orders: {
        Row: {
          amount_inr: number | null
          amount_usd: number | null
          buyer_id: string
          created_at: string
          created_by: string | null
          currency: string
          currency_charged: string | null
          discount_total: number
          fx_rate: number | null
          id: string
          idempotency_key: string
          lead_id: string | null
          metadata: Json
          order_no: string | null
          order_number: string
          payment_gateway: string | null
          payu_status: string | null
          payu_txn_id: string | null
          soft_delete_flag: boolean
          status: string
          subtotal: number
          tax_total: number
          total: number
          txnid: string | null
          updated_at: string
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          amount_inr?: number | null
          amount_usd?: number | null
          buyer_id: string
          created_at?: string
          created_by?: string | null
          currency: string
          currency_charged?: string | null
          discount_total?: number
          fx_rate?: number | null
          id?: string
          idempotency_key: string
          lead_id?: string | null
          metadata?: Json
          order_no?: string | null
          order_number?: string
          payment_gateway?: string | null
          payu_status?: string | null
          payu_txn_id?: string | null
          soft_delete_flag?: boolean
          status?: string
          subtotal: number
          tax_total?: number
          total: number
          txnid?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          amount_inr?: number | null
          amount_usd?: number | null
          buyer_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          currency_charged?: string | null
          discount_total?: number
          fx_rate?: number | null
          id?: string
          idempotency_key?: string
          lead_id?: string | null
          metadata?: Json
          order_no?: string | null
          order_number?: string
          payment_gateway?: string | null
          payu_status?: string | null
          payu_txn_id?: string | null
          soft_delete_flag?: boolean
          status?: string
          subtotal?: number
          tax_total?: number
          total?: number
          txnid?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      marketplace_payment_events: {
        Row: {
          amount: number | null
          created_at: string
          currency: string | null
          event_type: string
          id: string
          payload: Json
          payload_hash: string | null
          payment_intent_id: string
          provider: string
          provider_event_id: string
          signature_verified: boolean
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          event_type: string
          id?: string
          payload?: Json
          payload_hash?: string | null
          payment_intent_id: string
          provider: string
          provider_event_id: string
          signature_verified?: boolean
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          event_type?: string
          id?: string
          payload?: Json
          payload_hash?: string | null
          payment_intent_id?: string
          provider?: string
          provider_event_id?: string
          signature_verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_payment_events_payment_intent_id_fkey"
            columns: ["payment_intent_id"]
            isOneToOne: false
            referencedRelation: "marketplace_payment_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_payment_intents: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          idempotency_key: string
          order_id: string
          provider: string
          provider_intent_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          id?: string
          idempotency_key: string
          order_id: string
          provider: string
          provider_intent_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          idempotency_key?: string
          order_id?: string
          provider?: string
          provider_intent_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_payment_intents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_payout_schedules: {
        Row: {
          active: boolean
          cadence: string
          created_at: string
          currency: string
          holding_days: number
          minimum_amount: number
          payment_method: string | null
          requires_approval: boolean
          seller_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          cadence?: string
          created_at?: string
          currency?: string
          holding_days?: number
          minimum_amount?: number
          payment_method?: string | null
          requires_approval?: boolean
          seller_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          cadence?: string
          created_at?: string
          currency?: string
          holding_days?: number
          minimum_amount?: number
          payment_method?: string | null
          requires_approval?: boolean
          seller_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_payout_schedules_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: true
            referencedRelation: "marketplace_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_payouts: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          idempotency_key: string
          provider_reference: string | null
          seller_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          id?: string
          idempotency_key: string
          provider_reference?: string | null
          seller_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          idempotency_key?: string
          provider_reference?: string | null
          seller_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_payouts_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "marketplace_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_product_pricing: {
        Row: {
          active: boolean
          amount: number
          billing_period: string
          created_at: string
          currency: string
          id: string
          product_id: string
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          active?: boolean
          amount: number
          billing_period?: string
          created_at?: string
          currency?: string
          id?: string
          product_id: string
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          active?: boolean
          amount?: number
          billing_period?: string
          created_at?: string
          currency?: string
          id?: string
          product_id?: string
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_product_pricing_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_product_pricing_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "marketplace_product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_product_variants: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          product_id: string
          sku: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          product_id: string
          sku: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          product_id?: string
          sku?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_product_versions: {
        Row: {
          checksum: string | null
          created_at: string
          download_path: string | null
          id: string
          product_id: string
          published_at: string | null
          release_notes: string
          status: string
          version: string
        }
        Insert: {
          checksum?: string | null
          created_at?: string
          download_path?: string | null
          id?: string
          product_id: string
          published_at?: string | null
          release_notes?: string
          status?: string
          version: string
        }
        Update: {
          checksum?: string | null
          created_at?: string
          download_path?: string | null
          id?: string
          product_id?: string
          published_at?: string | null
          release_notes?: string
          status?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_product_versions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_products: {
        Row: {
          ai: string | null
          analytics: string | null
          api: string | null
          approved_at: string | null
          approved_by: string | null
          authentication: string | null
          backend: string | null
          badge: string | null
          benefits: string | null
          category_id: string | null
          cloud: string | null
          content_status: string
          cover_image: string | null
          created_at: string
          currency: string | null
          dashboard: string | null
          database: string | null
          delete_reason: string | null
          deleted_at: string | null
          deleted_by: string | null
          demo_url: string | null
          deployment: string | null
          description: string | null
          downloads: number
          downloads_label: string | null
          email: string | null
          favicon: string | null
          features: Json
          frontend: string | null
          icon: string | null
          id: string
          industry_label: string | null
          integrations: string | null
          is_ai: boolean
          is_best_seller: boolean
          is_featured: boolean
          is_new_release: boolean
          is_trending: boolean
          languages: string | null
          license: string | null
          logo: string | null
          merged_into: string | null
          mobile: string | null
          moderation_lock: number
          moderation_status: string
          modules: string | null
          multi_branch: string | null
          multi_company: string | null
          multi_school: string | null
          name: string
          offline: string | null
          payment_gateway: string | null
          price_label: string
          price_period: string | null
          public_repo_url: string | null
          publish_at: string | null
          purge_after: string | null
          pwa: string | null
          rating: number
          related_products: string[]
          reports: string | null
          roles: string | null
          search_keywords: string[]
          search_text: string | null
          seller_id: string | null
          slug: string
          sms: string | null
          software_type: string | null
          sort_order: number
          subcategory: string | null
          tags: string[]
          target_audience: string | null
          tax: string | null
          tech_stack: string[]
          technology: string | null
          thumbnail_url: string | null
          unpublish_at: string | null
          updated_at: string
          version: string | null
          visible: boolean
          whatsapp: string | null
        }
        Insert: {
          ai?: string | null
          analytics?: string | null
          api?: string | null
          approved_at?: string | null
          approved_by?: string | null
          authentication?: string | null
          backend?: string | null
          badge?: string | null
          benefits?: string | null
          category_id?: string | null
          cloud?: string | null
          content_status?: string
          cover_image?: string | null
          created_at?: string
          currency?: string | null
          dashboard?: string | null
          database?: string | null
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          demo_url?: string | null
          deployment?: string | null
          description?: string | null
          downloads?: number
          downloads_label?: string | null
          email?: string | null
          favicon?: string | null
          features?: Json
          frontend?: string | null
          icon?: string | null
          id?: string
          industry_label?: string | null
          integrations?: string | null
          is_ai?: boolean
          is_best_seller?: boolean
          is_featured?: boolean
          is_new_release?: boolean
          is_trending?: boolean
          languages?: string | null
          license?: string | null
          logo?: string | null
          merged_into?: string | null
          mobile?: string | null
          moderation_lock?: number
          moderation_status?: string
          modules?: string | null
          multi_branch?: string | null
          multi_company?: string | null
          multi_school?: string | null
          name: string
          offline?: string | null
          payment_gateway?: string | null
          price_label?: string
          price_period?: string | null
          public_repo_url?: string | null
          publish_at?: string | null
          purge_after?: string | null
          pwa?: string | null
          rating?: number
          related_products?: string[]
          reports?: string | null
          roles?: string | null
          search_keywords?: string[]
          search_text?: string | null
          seller_id?: string | null
          slug: string
          sms?: string | null
          software_type?: string | null
          sort_order?: number
          subcategory?: string | null
          tags?: string[]
          target_audience?: string | null
          tax?: string | null
          tech_stack?: string[]
          technology?: string | null
          thumbnail_url?: string | null
          unpublish_at?: string | null
          updated_at?: string
          version?: string | null
          visible?: boolean
          whatsapp?: string | null
        }
        Update: {
          ai?: string | null
          analytics?: string | null
          api?: string | null
          approved_at?: string | null
          approved_by?: string | null
          authentication?: string | null
          backend?: string | null
          badge?: string | null
          benefits?: string | null
          category_id?: string | null
          cloud?: string | null
          content_status?: string
          cover_image?: string | null
          created_at?: string
          currency?: string | null
          dashboard?: string | null
          database?: string | null
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          demo_url?: string | null
          deployment?: string | null
          description?: string | null
          downloads?: number
          downloads_label?: string | null
          email?: string | null
          favicon?: string | null
          features?: Json
          frontend?: string | null
          icon?: string | null
          id?: string
          industry_label?: string | null
          integrations?: string | null
          is_ai?: boolean
          is_best_seller?: boolean
          is_featured?: boolean
          is_new_release?: boolean
          is_trending?: boolean
          languages?: string | null
          license?: string | null
          logo?: string | null
          merged_into?: string | null
          mobile?: string | null
          moderation_lock?: number
          moderation_status?: string
          modules?: string | null
          multi_branch?: string | null
          multi_company?: string | null
          multi_school?: string | null
          name?: string
          offline?: string | null
          payment_gateway?: string | null
          price_label?: string
          price_period?: string | null
          public_repo_url?: string | null
          publish_at?: string | null
          purge_after?: string | null
          pwa?: string | null
          rating?: number
          related_products?: string[]
          reports?: string | null
          roles?: string | null
          search_keywords?: string[]
          search_text?: string | null
          seller_id?: string | null
          slug?: string
          sms?: string | null
          software_type?: string | null
          sort_order?: number
          subcategory?: string | null
          tags?: string[]
          target_audience?: string | null
          tax?: string | null
          tech_stack?: string[]
          technology?: string | null
          thumbnail_url?: string | null
          unpublish_at?: string | null
          updated_at?: string
          version?: string | null
          visible?: boolean
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "marketplace_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_products_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_products_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "marketplace_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_recommendation_configs: {
        Row: {
          blocked_reason: string | null
          created_at: string
          description: string | null
          diversity_per_category: number
          enabled: boolean
          exclude_purchased: boolean
          key: string
          max_results: number
          min_confidence: number
          recency_days: number
          strategy: string
          title: string
          updated_at: string
          updated_by: string | null
          weights: Json
        }
        Insert: {
          blocked_reason?: string | null
          created_at?: string
          description?: string | null
          diversity_per_category?: number
          enabled?: boolean
          exclude_purchased?: boolean
          key: string
          max_results?: number
          min_confidence?: number
          recency_days?: number
          strategy?: string
          title: string
          updated_at?: string
          updated_by?: string | null
          weights?: Json
        }
        Update: {
          blocked_reason?: string | null
          created_at?: string
          description?: string | null
          diversity_per_category?: number
          enabled?: boolean
          exclude_purchased?: boolean
          key?: string
          max_results?: number
          min_confidence?: number
          recency_days?: number
          strategy?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          weights?: Json
        }
        Relationships: []
      }
      marketplace_referral_codes: {
        Row: {
          active: boolean
          affiliate_partner_id: string | null
          code: string
          created_at: string
          id: string
          influencer_profile_id: string | null
          reseller_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          affiliate_partner_id?: string | null
          code: string
          created_at?: string
          id?: string
          influencer_profile_id?: string | null
          reseller_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          affiliate_partner_id?: string | null
          code?: string
          created_at?: string
          id?: string
          influencer_profile_id?: string | null
          reseller_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_referral_codes_affiliate_partner_id_fkey"
            columns: ["affiliate_partner_id"]
            isOneToOne: false
            referencedRelation: "marketplace_affiliate_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_referral_codes_influencer_profile_id_fkey"
            columns: ["influencer_profile_id"]
            isOneToOne: false
            referencedRelation: "influencer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_referral_codes_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_referral_sessions: {
        Row: {
          affiliate_partner_id: string | null
          converted_order_id: string | null
          first_seen_at: string
          id: string
          influencer_profile_id: string | null
          landing_url: string | null
          last_seen_at: string
          metadata: Json
          product_id: string | null
          referral_code_id: string | null
          reseller_id: string | null
          session_key: string
        }
        Insert: {
          affiliate_partner_id?: string | null
          converted_order_id?: string | null
          first_seen_at?: string
          id?: string
          influencer_profile_id?: string | null
          landing_url?: string | null
          last_seen_at?: string
          metadata?: Json
          product_id?: string | null
          referral_code_id?: string | null
          reseller_id?: string | null
          session_key: string
        }
        Update: {
          affiliate_partner_id?: string | null
          converted_order_id?: string | null
          first_seen_at?: string
          id?: string
          influencer_profile_id?: string | null
          landing_url?: string | null
          last_seen_at?: string
          metadata?: Json
          product_id?: string | null
          referral_code_id?: string | null
          reseller_id?: string | null
          session_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_referral_sessions_affiliate_partner_id_fkey"
            columns: ["affiliate_partner_id"]
            isOneToOne: false
            referencedRelation: "marketplace_affiliate_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_referral_sessions_converted_order_id_fkey"
            columns: ["converted_order_id"]
            isOneToOne: true
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_referral_sessions_influencer_profile_id_fkey"
            columns: ["influencer_profile_id"]
            isOneToOne: false
            referencedRelation: "influencer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_referral_sessions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_referral_sessions_referral_code_id_fkey"
            columns: ["referral_code_id"]
            isOneToOne: false
            referencedRelation: "marketplace_referral_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_referral_sessions_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_reviews: {
        Row: {
          buyer_id: string
          comment: string
          created_at: string
          helpful_count: number
          id: string
          moderated_at: string | null
          moderated_by: string | null
          moderation_note: string | null
          order_item_id: string
          product_id: string
          published_at: string | null
          rating: number
          report_count: number
          review_type: string
          seller_response: string | null
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          buyer_id: string
          comment?: string
          created_at?: string
          helpful_count?: number
          id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_note?: string | null
          order_item_id: string
          product_id: string
          published_at?: string | null
          rating: number
          report_count?: number
          review_type?: string
          seller_response?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          comment?: string
          created_at?: string
          helpful_count?: number
          id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_note?: string | null
          order_item_id?: string
          product_id?: string
          published_at?: string | null
          rating?: number
          report_count?: number
          review_type?: string
          seller_response?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_reviews_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: true
            referencedRelation: "marketplace_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_row_config: {
        Row: {
          allow_cross_category: boolean
          allow_duplicates: boolean
          auto_rule: string
          category_id: string | null
          created_at: string
          created_by: string | null
          cta_href: string | null
          cta_label: string | null
          ends_at: string | null
          id: string
          key: string | null
          max_products: number
          row_kind: string
          sort_order: number | null
          source_mode: string
          starts_at: string | null
          status: string
          subcategory: string | null
          title: string | null
          updated_at: string
          updated_by: string | null
          visible_desktop: boolean
          visible_mobile: boolean
          visible_tablet: boolean
        }
        Insert: {
          allow_cross_category?: boolean
          allow_duplicates?: boolean
          auto_rule?: string
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          cta_href?: string | null
          cta_label?: string | null
          ends_at?: string | null
          id?: string
          key?: string | null
          max_products?: number
          row_kind?: string
          sort_order?: number | null
          source_mode?: string
          starts_at?: string | null
          status?: string
          subcategory?: string | null
          title?: string | null
          updated_at?: string
          updated_by?: string | null
          visible_desktop?: boolean
          visible_mobile?: boolean
          visible_tablet?: boolean
        }
        Update: {
          allow_cross_category?: boolean
          allow_duplicates?: boolean
          auto_rule?: string
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          cta_href?: string | null
          cta_label?: string | null
          ends_at?: string | null
          id?: string
          key?: string | null
          max_products?: number
          row_kind?: string
          sort_order?: number | null
          source_mode?: string
          starts_at?: string | null
          status?: string
          subcategory?: string | null
          title?: string | null
          updated_at?: string
          updated_by?: string | null
          visible_desktop?: boolean
          visible_mobile?: boolean
          visible_tablet?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_row_config_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "marketplace_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_row_slots: {
        Row: {
          added_by: string | null
          category_id: string | null
          created_at: string
          id: string
          pinned: boolean
          position: number
          product_id: string
          row_id: string | null
        }
        Insert: {
          added_by?: string | null
          category_id?: string | null
          created_at?: string
          id?: string
          pinned?: boolean
          position: number
          product_id: string
          row_id?: string | null
        }
        Update: {
          added_by?: string | null
          category_id?: string | null
          created_at?: string
          id?: string
          pinned?: boolean
          position?: number
          product_id?: string
          row_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_row_slots_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "marketplace_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_row_slots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_row_slots_row_id_fkey"
            columns: ["row_id"]
            isOneToOne: false
            referencedRelation: "marketplace_row_config"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_saved_products: {
        Row: {
          created_at: string
          id: string
          list: string
          note: string | null
          product_id: string | null
          product_slug: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          list?: string
          note?: string | null
          product_id?: string | null
          product_slug?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          list?: string
          note?: string | null
          product_id?: string | null
          product_slug?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_saved_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_seller_users: {
        Row: {
          created_at: string
          member_role: string
          seller_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          member_role?: string
          seller_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          member_role?: string
          seller_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_seller_users_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "marketplace_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_sellers: {
        Row: {
          application: Json | null
          applied_at: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          display_name: string
          id: string
          owner_user_id: string | null
          payout_currency: string
          payout_metadata: Json
          seller_kind: string | null
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          application?: Json | null
          applied_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          display_name: string
          id?: string
          owner_user_id?: string | null
          payout_currency?: string
          payout_metadata?: Json
          seller_kind?: string | null
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          application?: Json | null
          applied_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          display_name?: string
          id?: string
          owner_user_id?: string | null
          payout_currency?: string
          payout_metadata?: Json
          seller_kind?: string | null
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketplace_stories: {
        Row: {
          author: string
          company: string
          created_at: string
          id: string
          metric: string
          metric_label: string
          product: string
          product_slug: string | null
          published: boolean
          quote: string
          role: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          author?: string
          company: string
          created_at?: string
          id?: string
          metric?: string
          metric_label?: string
          product?: string
          product_slug?: string | null
          published?: boolean
          quote: string
          role?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          author?: string
          company?: string
          created_at?: string
          id?: string
          metric?: string
          metric_label?: string
          product?: string
          product_slug?: string | null
          published?: boolean
          quote?: string
          role?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      marketplace_topbar_modules: {
        Row: {
          category: string
          component: string | null
          config: Json
          created_at: string
          created_by: string | null
          description: string | null
          desktop_enabled: boolean
          featured: boolean
          icon: string | null
          id: string
          mobile_enabled: boolean
          module_key: string
          name: string
          sort_order: number
          status: string
          sticky_enabled: boolean
          tablet_enabled: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category?: string
          component?: string | null
          config?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          desktop_enabled?: boolean
          featured?: boolean
          icon?: string | null
          id?: string
          mobile_enabled?: boolean
          module_key: string
          name: string
          sort_order?: number
          status?: string
          sticky_enabled?: boolean
          tablet_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          component?: string | null
          config?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          desktop_enabled?: boolean
          featured?: boolean
          icon?: string | null
          id?: string
          mobile_enabled?: boolean
          module_key?: string
          name?: string
          sort_order?: number
          status?: string
          sticky_enabled?: boolean
          tablet_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      marketplace_translations: {
        Row: {
          context: string | null
          context_hash: string
          created_at: string
          engine: string | null
          engine_version: string | null
          id: string
          locale: string
          metadata: Json
          model: string | null
          namespace: string
          provider: string | null
          quality_flags: string[]
          quality_score: number | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_hash: string
          source_language: string
          source_text: string
          status: string
          target_language: string | null
          translated_text: string
          translation_key: string | null
          updated_at: string
          version: number
        }
        Insert: {
          context?: string | null
          context_hash: string
          created_at?: string
          engine?: string | null
          engine_version?: string | null
          id?: string
          locale: string
          metadata?: Json
          model?: string | null
          namespace?: string
          provider?: string | null
          quality_flags?: string[]
          quality_score?: number | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_hash: string
          source_language?: string
          source_text: string
          status?: string
          target_language?: string | null
          translated_text: string
          translation_key?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          context?: string | null
          context_hash?: string
          created_at?: string
          engine?: string | null
          engine_version?: string | null
          id?: string
          locale?: string
          metadata?: Json
          model?: string | null
          namespace?: string
          provider?: string | null
          quality_flags?: string[]
          quality_score?: number | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_hash?: string
          source_language?: string
          source_text?: string
          status?: string
          target_language?: string | null
          translated_text?: string
          translation_key?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_translations_source_language_fkey"
            columns: ["source_language"]
            isOneToOne: false
            referencedRelation: "i18n_languages"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "marketplace_translations_target_language_fkey"
            columns: ["target_language"]
            isOneToOne: false
            referencedRelation: "i18n_languages"
            referencedColumns: ["code"]
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
          size_bytes: number
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
          created_at: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
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
      missions: {
        Row: {
          cadence: Database["public"]["Enums"]["mission_cadence"]
          conditions: Json
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          id: string
          name: string
          rewards: Json
          season_id: string | null
          starts_at: string | null
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
          xp_reward: number
        }
        Insert: {
          cadence?: Database["public"]["Enums"]["mission_cadence"]
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          name: string
          rewards?: Json
          season_id?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          xp_reward?: number
        }
        Update: {
          cadence?: Database["public"]["Enums"]["mission_cadence"]
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          name?: string
          rewards?: Json
          season_id?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "missions_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
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
      notification_rules: {
        Row: {
          conditions: Json | null
          created_at: string
          id: string
          name: string
          status: Database["public"]["Enums"]["entity_status"]
          template_id: string | null
          trigger: string
          updated_at: string
        }
        Insert: {
          conditions?: Json | null
          created_at?: string
          id?: string
          name: string
          status?: Database["public"]["Enums"]["entity_status"]
          template_id?: string | null
          trigger: string
          updated_at?: string
        }
        Update: {
          conditions?: Json | null
          created_at?: string
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["entity_status"]
          template_id?: string | null
          trigger?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_rules_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "notification_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_templates: {
        Row: {
          body_template: string
          channel: string
          created_at: string
          id: string
          key: string
          status: Database["public"]["Enums"]["entity_status"]
          title_template: string
          updated_at: string
        }
        Insert: {
          body_template: string
          channel?: string
          created_at?: string
          id?: string
          key: string
          status?: Database["public"]["Enums"]["entity_status"]
          title_template: string
          updated_at?: string
        }
        Update: {
          body_template?: string
          channel?: string
          created_at?: string
          id?: string
          key?: string
          status?: Database["public"]["Enums"]["entity_status"]
          title_template?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json | null
          id: string
          kind: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          kind?: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          kind?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
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
      partner_commissions: {
        Row: {
          approved_at: string | null
          attribution_id: string | null
          click_id: string | null
          commission_amount: number
          created_at: string
          currency: string
          earned_at: string
          gross_amount: number
          id: string
          idempotency_key: string | null
          order_id: string | null
          order_item_id: string | null
          partner_id: string
          partner_kind: Database["public"]["Enums"]["partner_kind"]
          payout_id: string | null
          reversal_reason: string | null
          reversed_by: string | null
          rule_snapshot: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          attribution_id?: string | null
          click_id?: string | null
          commission_amount?: number
          created_at?: string
          currency?: string
          earned_at?: string
          gross_amount?: number
          id?: string
          idempotency_key?: string | null
          order_id?: string | null
          order_item_id?: string | null
          partner_id: string
          partner_kind: Database["public"]["Enums"]["partner_kind"]
          payout_id?: string | null
          reversal_reason?: string | null
          reversed_by?: string | null
          rule_snapshot?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          attribution_id?: string | null
          click_id?: string | null
          commission_amount?: number
          created_at?: string
          currency?: string
          earned_at?: string
          gross_amount?: number
          id?: string
          idempotency_key?: string | null
          order_id?: string | null
          order_item_id?: string | null
          partner_id?: string
          partner_kind?: Database["public"]["Enums"]["partner_kind"]
          payout_id?: string | null
          reversal_reason?: string | null
          reversed_by?: string | null
          rule_snapshot?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_commissions_attribution_id_fkey"
            columns: ["attribution_id"]
            isOneToOne: false
            referencedRelation: "marketplace_order_attributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_commissions_click_id_fkey"
            columns: ["click_id"]
            isOneToOne: false
            referencedRelation: "affiliate_clicks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_commissions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_commissions_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "marketplace_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_commissions_payout_fk"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "partner_payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_commissions_reversed_by_fkey"
            columns: ["reversed_by"]
            isOneToOne: false
            referencedRelation: "partner_commissions"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_payouts: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          completed_at: string | null
          created_at: string
          currency: string
          failure_reason: string | null
          id: string
          idempotency_key: string | null
          partner_id: string
          partner_kind: Database["public"]["Enums"]["partner_kind"]
          payment_method: string | null
          period_end: string | null
          period_start: string | null
          processed_at: string | null
          provider: string | null
          provider_reference: string | null
          requested_at: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          idempotency_key?: string | null
          partner_id: string
          partner_kind: Database["public"]["Enums"]["partner_kind"]
          payment_method?: string | null
          period_end?: string | null
          period_start?: string | null
          processed_at?: string | null
          provider?: string | null
          provider_reference?: string | null
          requested_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          idempotency_key?: string | null
          partner_id?: string
          partner_kind?: Database["public"]["Enums"]["partner_kind"]
          payment_method?: string | null
          period_end?: string | null
          period_start?: string | null
          processed_at?: string | null
          provider?: string | null
          provider_reference?: string | null
          requested_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          amount: number | null
          created_at: string
          id: string
          intent_id: string | null
          metadata: Json
          payment_id: string | null
          source_ip: unknown
          status: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          amount?: number | null
          created_at?: string
          id?: string
          intent_id?: string | null
          metadata?: Json
          payment_id?: string | null
          source_ip?: unknown
          status?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          amount?: number | null
          created_at?: string
          id?: string
          intent_id?: string | null
          metadata?: Json
          payment_id?: string | null
          source_ip?: unknown
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_audit_logs_intent_id_fkey"
            columns: ["intent_id"]
            isOneToOne: false
            referencedRelation: "payment_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_audit_logs_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_blacklist: {
        Row: {
          created_at: string
          created_by: string | null
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_controls: {
        Row: {
          allowed_countries: string[]
          blocked_countries: string[]
          card_enabled: boolean
          id: boolean
          payments_enabled: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allowed_countries?: string[]
          blocked_countries?: string[]
          card_enabled?: boolean
          id?: boolean
          payments_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allowed_countries?: string[]
          blocked_countries?: string[]
          card_enabled?: boolean
          id?: boolean
          payments_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      payment_event_outbox: {
        Row: {
          attempts: number
          available_at: string
          created_at: string
          event_type: string
          id: string
          last_error: string | null
          payload: Json
          payment_id: string
          processed_at: string | null
          status: string
        }
        Insert: {
          attempts?: number
          available_at?: string
          created_at?: string
          event_type: string
          id?: string
          last_error?: string | null
          payload?: Json
          payment_id: string
          processed_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          available_at?: string
          created_at?: string
          event_type?: string
          id?: string
          last_error?: string | null
          payload?: Json
          payment_id?: string
          processed_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_event_outbox_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_intents: {
        Row: {
          amount: number
          attempt_count: number
          base_amount: number
          base_currency: string
          created_at: string
          currency: string
          deleted_at: string | null
          device_id: string | null
          exchange_rate: number
          expires_at: string
          id: string
          idempotency_key: string | null
          item_id: string
          item_type: string
          order_id: string
          session_id: string | null
          source_ip: unknown
          status: string
          transaction_hash: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          attempt_count?: number
          base_amount: number
          base_currency?: string
          created_at?: string
          currency: string
          deleted_at?: string | null
          device_id?: string | null
          exchange_rate: number
          expires_at?: string
          id?: string
          idempotency_key?: string | null
          item_id: string
          item_type: string
          order_id: string
          session_id?: string | null
          source_ip?: unknown
          status?: string
          transaction_hash?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          attempt_count?: number
          base_amount?: number
          base_currency?: string
          created_at?: string
          currency?: string
          deleted_at?: string | null
          device_id?: string | null
          exchange_rate?: number
          expires_at?: string
          id?: string
          idempotency_key?: string | null
          item_id?: string
          item_type?: string
          order_id?: string
          session_id?: string | null
          source_ip?: unknown
          status?: string
          transaction_hash?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_logs: {
        Row: {
          created_at: string
          event_type: string
          id: string
          order_id: string | null
          payload: Json
          provider: string | null
          signature_valid: boolean | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          order_id?: string | null
          payload?: Json
          provider?: string | null
          signature_valid?: boolean | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          order_id?: string | null
          payload?: Json
          provider?: string | null
          signature_valid?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          created_at: string
          details_json: Json
          expiry: string | null
          id: string
          is_default: boolean
          label: string
          last4: string | null
          status: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          details_json?: Json
          expiry?: string | null
          id?: string
          is_default?: boolean
          label: string
          last4?: string | null
          status?: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          details_json?: Json
          expiry?: string | null
          id?: string
          is_default?: boolean
          label?: string
          last4?: string | null
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          auto_verified: boolean
          brand: string | null
          country: string | null
          created_at: string
          currency: string | null
          deleted_at: string | null
          device_id: string | null
          gateway: string | null
          id: string
          intent_id: string | null
          item_id: string
          item_type: string
          last_checked_at: string | null
          last4: string | null
          mismatch_flag: boolean
          order_id: string | null
          payment_id: string | null
          payment_type: string
          reference_id: string
          retry_count: number
          screenshot: string | null
          source_ip: unknown
          status: string
          submitted_amount: number | null
          tags: string[]
          transaction_hash: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          auto_verified?: boolean
          brand?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          deleted_at?: string | null
          device_id?: string | null
          gateway?: string | null
          id?: string
          intent_id?: string | null
          item_id: string
          item_type: string
          last_checked_at?: string | null
          last4?: string | null
          mismatch_flag?: boolean
          order_id?: string | null
          payment_id?: string | null
          payment_type: string
          reference_id: string
          retry_count?: number
          screenshot?: string | null
          source_ip?: unknown
          status?: string
          submitted_amount?: number | null
          tags?: string[]
          transaction_hash?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          auto_verified?: boolean
          brand?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          deleted_at?: string | null
          device_id?: string | null
          gateway?: string | null
          id?: string
          intent_id?: string | null
          item_id?: string
          item_type?: string
          last_checked_at?: string | null
          last4?: string | null
          mismatch_flag?: boolean
          order_id?: string | null
          payment_id?: string | null
          payment_type?: string
          reference_id?: string
          retry_count?: number
          screenshot?: string | null
          source_ip?: unknown
          status?: string
          submitted_amount?: number | null
          tags?: string[]
          transaction_hash?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_intent_id_fkey"
            columns: ["intent_id"]
            isOneToOne: false
            referencedRelation: "payment_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_ai_conversations: {
        Row: {
          code: string
          created_at: string
          id: string
          language: string
          resolution: string
          status: string
          topic: string
          updated_at: string
          user_code: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          language?: string
          resolution?: string
          status?: string
          topic?: string
          updated_at?: string
          user_code: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          language?: string
          resolution?: string
          status?: string
          topic?: string
          updated_at?: string
          user_code?: string
        }
        Relationships: []
      }
      pm_ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "pm_ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_alerts: {
        Row: {
          acknowledged: boolean
          code: string
          created_at: string
          id: string
          message: string
          severity: string
          type: string
        }
        Insert: {
          acknowledged?: boolean
          code: string
          created_at?: string
          id?: string
          message?: string
          severity?: string
          type?: string
        }
        Update: {
          acknowledged?: boolean
          code?: string
          created_at?: string
          id?: string
          message?: string
          severity?: string
          type?: string
        }
        Relationships: []
      }
      pm_assist_sessions: {
        Row: {
          code: string
          created_at: string
          duration_minutes: number
          id: string
          mode: string
          status: string
          updated_at: string
          user_code: string
        }
        Insert: {
          code: string
          created_at?: string
          duration_minutes?: number
          id?: string
          mode?: string
          status?: string
          updated_at?: string
          user_code: string
        }
        Update: {
          code?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          mode?: string
          status?: string
          updated_at?: string
          user_code?: string
        }
        Relationships: []
      }
      pm_audit_logs: {
        Row: {
          action: string
          actor: string
          category: string
          created_at: string
          details: string
          id: string
          ip: string
          status: string
          target: string
        }
        Insert: {
          action: string
          actor?: string
          category?: string
          created_at?: string
          details?: string
          id?: string
          ip?: string
          status?: string
          target?: string
        }
        Update: {
          action?: string
          actor?: string
          category?: string
          created_at?: string
          details?: string
          id?: string
          ip?: string
          status?: string
          target?: string
        }
        Relationships: []
      }
      pm_communication_logs: {
        Row: {
          code: string
          content: string
          created_at: string
          id: string
          type: string
          user_code: string
        }
        Insert: {
          code: string
          content?: string
          created_at?: string
          id?: string
          type?: string
          user_code?: string
        }
        Update: {
          code?: string
          content?: string
          created_at?: string
          id?: string
          type?: string
          user_code?: string
        }
        Relationships: []
      }
      pm_compliance: {
        Row: {
          agreement_accepted: boolean
          created_at: string
          id: string
          legal_flag: boolean
          updated_at: string
          user_code: string
          violations: number
        }
        Insert: {
          agreement_accepted?: boolean
          created_at?: string
          id?: string
          legal_flag?: boolean
          updated_at?: string
          user_code: string
          violations?: number
        }
        Update: {
          agreement_accepted?: boolean
          created_at?: string
          id?: string
          legal_flag?: boolean
          updated_at?: string
          user_code?: string
          violations?: number
        }
        Relationships: []
      }
      pm_decisions: {
        Row: {
          amount: number | null
          code: string
          decision_note: string
          description: string
          id: string
          is_financial: boolean
          priority: string
          requested_at: string
          requested_by: string
          status: string
          subject: string
          type: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          code: string
          decision_note?: string
          description?: string
          id?: string
          is_financial?: boolean
          priority?: string
          requested_at?: string
          requested_by?: string
          status?: string
          subject: string
          type?: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          code?: string
          decision_note?: string
          description?: string
          id?: string
          is_financial?: boolean
          priority?: string
          requested_at?: string
          requested_by?: string
          status?: string
          subject?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      pm_escalations: {
        Row: {
          code: string
          created_at: string
          created_by: string
          decision_note: string
          description: string
          evidence: string[]
          id: string
          priority: string
          source: string
          source_id: string
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string
          decision_note?: string
          description?: string
          evidence?: string[]
          id?: string
          priority?: string
          source?: string
          source_id?: string
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          decision_note?: string
          description?: string
          evidence?: string[]
          id?: string
          priority?: string
          source?: string
          source_id?: string
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      pm_health_metrics: {
        Row: {
          code: string
          description: string
          id: string
          name: string
          status: string
          trend: string
          updated_at: string
          value: string
        }
        Insert: {
          code: string
          description?: string
          id?: string
          name: string
          status?: string
          trend?: string
          updated_at?: string
          value?: string
        }
        Update: {
          code?: string
          description?: string
          id?: string
          name?: string
          status?: string
          trend?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      pm_issues: {
        Row: {
          ai_attempts: number
          build: string
          code: string
          created_at: string
          id: string
          last_attempt_at: string | null
          status: string
          summary: string
          updated_at: string
        }
        Insert: {
          ai_attempts?: number
          build?: string
          code: string
          created_at?: string
          id?: string
          last_attempt_at?: string | null
          status?: string
          summary?: string
          updated_at?: string
        }
        Update: {
          ai_attempts?: number
          build?: string
          code?: string
          created_at?: string
          id?: string
          last_attempt_at?: string | null
          status?: string
          summary?: string
          updated_at?: string
        }
        Relationships: []
      }
      pm_licenses: {
        Row: {
          created_at: string
          domain: string
          domain_status: string
          expiry: string
          id: string
          license_type: string
          transfer_status: string
          updated_at: string
          user_code: string
        }
        Insert: {
          created_at?: string
          domain?: string
          domain_status?: string
          expiry?: string
          id?: string
          license_type?: string
          transfer_status?: string
          updated_at?: string
          user_code: string
        }
        Update: {
          created_at?: string
          domain?: string
          domain_status?: string
          expiry?: string
          id?: string
          license_type?: string
          transfer_status?: string
          updated_at?: string
          user_code?: string
        }
        Relationships: []
      }
      pm_manager_metrics: {
        Row: {
          avg_resolution_time: string
          escalations_handled: number
          escalations_pending: number
          id: string
          manager_code: string
          role: string
          sla_compliance: number
          status: string
          trend: string
          updated_at: string
        }
        Insert: {
          avg_resolution_time?: string
          escalations_handled?: number
          escalations_pending?: number
          id?: string
          manager_code: string
          role?: string
          sla_compliance?: number
          status?: string
          trend?: string
          updated_at?: string
        }
        Update: {
          avg_resolution_time?: string
          escalations_handled?: number
          escalations_pending?: number
          id?: string
          manager_code?: string
          role?: string
          sla_compliance?: number
          status?: string
          trend?: string
          updated_at?: string
        }
        Relationships: []
      }
      pm_products: {
        Row: {
          created_at: string
          custom_changes: string
          id: string
          modules: string[]
          product: string
          updated_at: string
          user_code: string
          version: string
        }
        Insert: {
          created_at?: string
          custom_changes?: string
          id?: string
          modules?: string[]
          product: string
          updated_at?: string
          user_code: string
          version?: string
        }
        Update: {
          created_at?: string
          custom_changes?: string
          id?: string
          modules?: string[]
          product?: string
          updated_at?: string
          user_code?: string
          version?: string
        }
        Relationships: []
      }
      pm_promises: {
        Row: {
          action: string
          code: string
          created_at: string
          deadline: string
          developer_code: string
          id: string
          owner: string
          priority: string
          status: string
          task_code: string
          type: string
          updated_at: string
        }
        Insert: {
          action: string
          code: string
          created_at?: string
          deadline?: string
          developer_code?: string
          id?: string
          owner?: string
          priority?: string
          status?: string
          task_code?: string
          type?: string
          updated_at?: string
        }
        Update: {
          action?: string
          code?: string
          created_at?: string
          deadline?: string
          developer_code?: string
          id?: string
          owner?: string
          priority?: string
          status?: string
          task_code?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      pm_quality_alerts: {
        Row: {
          acknowledged: boolean
          affected_entity: string
          code: string
          confidence: number
          description: string
          detected_at: string
          entity_type: string
          id: string
          pattern: string
          reasoning: string
          severity: string
          suggested_action: string
          updated_at: string
        }
        Insert: {
          acknowledged?: boolean
          affected_entity?: string
          code: string
          confidence?: number
          description?: string
          detected_at?: string
          entity_type?: string
          id?: string
          pattern: string
          reasoning?: string
          severity?: string
          suggested_action?: string
          updated_at?: string
        }
        Update: {
          acknowledged?: boolean
          affected_entity?: string
          code?: string
          confidence?: number
          description?: string
          detected_at?: string
          entity_type?: string
          id?: string
          pattern?: string
          reasoning?: string
          severity?: string
          suggested_action?: string
          updated_at?: string
        }
        Relationships: []
      }
      pm_renewals: {
        Row: {
          code: string
          created_at: string
          expiry: string
          grace: string
          id: string
          product: string
          status: string
          updated_at: string
          user_code: string
        }
        Insert: {
          code: string
          created_at?: string
          expiry?: string
          grace?: string
          id?: string
          product?: string
          status?: string
          updated_at?: string
          user_code: string
        }
        Update: {
          code?: string
          created_at?: string
          expiry?: string
          grace?: string
          id?: string
          product?: string
          status?: string
          updated_at?: string
          user_code?: string
        }
        Relationships: []
      }
      pm_reports: {
        Row: {
          code: string
          generated_at: string
          id: string
          name: string
          size: string
          type: string
        }
        Insert: {
          code: string
          generated_at?: string
          id?: string
          name: string
          size?: string
          type?: string
        }
        Update: {
          code?: string
          generated_at?: string
          id?: string
          name?: string
          size?: string
          type?: string
        }
        Relationships: []
      }
      pm_satisfaction: {
        Row: {
          ai_prediction: string
          created_at: string
          csat: number
          feedback: string
          id: string
          risk: string
          updated_at: string
          user_code: string
        }
        Insert: {
          ai_prediction?: string
          created_at?: string
          csat?: number
          feedback?: string
          id?: string
          risk?: string
          updated_at?: string
          user_code: string
        }
        Update: {
          ai_prediction?: string
          created_at?: string
          csat?: number
          feedback?: string
          id?: string
          risk?: string
          updated_at?: string
          user_code?: string
        }
        Relationships: []
      }
      pm_settings: {
        Row: {
          enabled: boolean
          id: string
          key: string
          label: string
          locked: boolean
          section: string
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          id?: string
          key: string
          label: string
          locked?: boolean
          section?: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          id?: string
          key?: string
          label?: string
          locked?: boolean
          section?: string
          updated_at?: string
        }
        Relationships: []
      }
      pm_tickets: {
        Row: {
          code: string
          id: string
          opened_at: string
          product: string
          severity: string
          status: string
          subject: string
          type: string
          updated_at: string
          user_code: string
        }
        Insert: {
          code: string
          id?: string
          opened_at?: string
          product?: string
          severity?: string
          status?: string
          subject?: string
          type?: string
          updated_at?: string
          user_code?: string
        }
        Update: {
          code?: string
          id?: string
          opened_at?: string
          product?: string
          severity?: string
          status?: string
          subject?: string
          type?: string
          updated_at?: string
          user_code?: string
        }
        Relationships: []
      }
      pm_upgrades: {
        Row: {
          code: string
          created_at: string
          id: string
          item: string
          status: string
          type: string
          updated_at: string
          user_code: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          item?: string
          status?: string
          type?: string
          updated_at?: string
          user_code: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          item?: string
          status?: string
          type?: string
          updated_at?: string
          user_code?: string
        }
        Relationships: []
      }
      pm_usage: {
        Row: {
          ai_calls_pct: number
          api_pct: number
          created_at: string
          fair_usage_alert: boolean
          id: string
          storage_pct: number
          updated_at: string
          user_code: string
        }
        Insert: {
          ai_calls_pct?: number
          api_pct?: number
          created_at?: string
          fair_usage_alert?: boolean
          id?: string
          storage_pct?: number
          updated_at?: string
          user_code: string
        }
        Update: {
          ai_calls_pct?: number
          api_pct?: number
          created_at?: string
          fair_usage_alert?: boolean
          id?: string
          storage_pct?: number
          updated_at?: string
          user_code?: string
        }
        Relationships: []
      }
      pm_users: {
        Row: {
          code: string
          created_at: string
          id: string
          license: string
          product: string
          region: string
          status: string
          tier: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          license?: string
          product: string
          region?: string
          status?: string
          tier?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          license?: string
          product?: string
          region?: string
          status?: string
          tier?: string
          updated_at?: string
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
          detected_category_id: string | null
          environment: string
          id: string
          last_checked_at: string | null
          last_http_status: number | null
          last_response_ms: number | null
          last_result: string
          password: string | null
          processed_at: string | null
          processing: Json | null
          processing_status: string
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
          detected_category_id?: string | null
          environment?: string
          id?: string
          last_checked_at?: string | null
          last_http_status?: number | null
          last_response_ms?: number | null
          last_result?: string
          password?: string | null
          processed_at?: string | null
          processing?: Json | null
          processing_status?: string
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
          detected_category_id?: string | null
          environment?: string
          id?: string
          last_checked_at?: string | null
          last_http_status?: number | null
          last_response_ms?: number | null
          last_result?: string
          password?: string | null
          processed_at?: string | null
          processing?: Json | null
          processing_status?: string
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
            foreignKeyName: "product_demo_urls_detected_category_id_fkey"
            columns: ["detected_category_id"]
            isOneToOne: false
            referencedRelation: "marketplace_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_demo_urls_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_duplicate_candidates: {
        Row: {
          decided_at: string | null
          decided_by: string | null
          decision_reason: string | null
          id: string
          match_percent: number
          product_a: string
          product_b: string
          reasons: Json
          scanned_at: string
          status: string
        }
        Insert: {
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          id?: string
          match_percent: number
          product_a: string
          product_b: string
          reasons?: Json
          scanned_at?: string
          status?: string
        }
        Update: {
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          id?: string
          match_percent?: number
          product_a?: string
          product_b?: string
          reasons?: Json
          scanned_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_duplicate_candidates_product_a_fkey"
            columns: ["product_a"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_duplicate_candidates_product_b_fkey"
            columns: ["product_b"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_merge_operations: {
        Row: {
          candidate_id: string | null
          canonical_id: string
          id: string
          merged_id: string
          moved: Json
          performed_at: string
          performed_by: string | null
          reason: string
        }
        Insert: {
          candidate_id?: string | null
          canonical_id: string
          id?: string
          merged_id: string
          moved?: Json
          performed_at?: string
          performed_by?: string | null
          reason: string
        }
        Update: {
          candidate_id?: string | null
          canonical_id?: string
          id?: string
          merged_id?: string
          moved?: Json
          performed_at?: string
          performed_by?: string | null
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_merge_operations_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "product_duplicate_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_merge_operations_canonical_id_fkey"
            columns: ["canonical_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_merge_operations_merged_id_fkey"
            columns: ["merged_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_moderation_policy: {
        Row: {
          auto_purge: boolean
          dual_approval: boolean
          id: boolean
          preserve_licenses: boolean
          preserve_orders: boolean
          preserve_reviews: boolean
          recovery_days: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          auto_purge?: boolean
          dual_approval?: boolean
          id?: boolean
          preserve_licenses?: boolean
          preserve_orders?: boolean
          preserve_reviews?: boolean
          recovery_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          auto_purge?: boolean
          dual_approval?: boolean
          id?: boolean
          preserve_licenses?: boolean
          preserve_orders?: boolean
          preserve_reviews?: boolean
          recovery_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      product_purge_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          executed_at: string | null
          id: string
          outcome: Json | null
          product_id: string
          reason: string
          requested_at: string
          requested_by: string
          status: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          executed_at?: string | null
          id?: string
          outcome?: Json | null
          product_id: string
          reason: string
          requested_at?: string
          requested_by: string
          status?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          executed_at?: string | null
          id?: string
          outcome?: Json | null
          product_id?: string
          reason?: string
          requested_at?: string
          requested_by?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_purge_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_qr_codes: {
        Row: {
          active: boolean
          background: string
          created_at: string
          created_by: string | null
          error_correction: string
          foreground: string
          id: string
          last_scan_at: string | null
          product_id: string
          qr_code: string
          quiet_zone: number
          scan_count: number
          short_link_id: string | null
          size: number
          target_url: string
          version: number
        }
        Insert: {
          active?: boolean
          background?: string
          created_at?: string
          created_by?: string | null
          error_correction?: string
          foreground?: string
          id?: string
          last_scan_at?: string | null
          product_id: string
          qr_code: string
          quiet_zone?: number
          scan_count?: number
          short_link_id?: string | null
          size?: number
          target_url: string
          version?: number
        }
        Update: {
          active?: boolean
          background?: string
          created_at?: string
          created_by?: string | null
          error_correction?: string
          foreground?: string
          id?: string
          last_scan_at?: string | null
          product_id?: string
          qr_code?: string
          quiet_zone?: number
          scan_count?: number
          short_link_id?: string | null
          size?: number
          target_url?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_qr_codes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_qr_codes_short_link_id_fkey"
            columns: ["short_link_id"]
            isOneToOne: false
            referencedRelation: "product_short_links"
            referencedColumns: ["id"]
          },
        ]
      }
      product_qr_events: {
        Row: {
          browser: string | null
          campaign: string | null
          country: string | null
          created_at: string
          device_type: string | null
          id: string
          product_id: string
          purge_after: string | null
          qr_id: string
          visitor_hash: string | null
        }
        Insert: {
          browser?: string | null
          campaign?: string | null
          country?: string | null
          created_at?: string
          device_type?: string | null
          id?: string
          product_id: string
          purge_after?: string | null
          qr_id: string
          visitor_hash?: string | null
        }
        Update: {
          browser?: string | null
          campaign?: string | null
          country?: string | null
          created_at?: string
          device_type?: string | null
          id?: string
          product_id?: string
          purge_after?: string | null
          qr_id?: string
          visitor_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_qr_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_qr_events_qr_id_fkey"
            columns: ["qr_id"]
            isOneToOne: false
            referencedRelation: "product_qr_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      product_reports: {
        Row: {
          assigned_to: string | null
          created_at: string
          detail: string | null
          evidence: Json
          id: string
          legal_reference: string | null
          product_id: string
          reason: string
          report_no: string
          reporter_id: string | null
          reporter_kind: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          detail?: string | null
          evidence?: Json
          id?: string
          legal_reference?: string | null
          product_id: string
          reason: string
          report_no: string
          reporter_id?: string | null
          reporter_kind?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          detail?: string | null
          evidence?: Json
          id?: string
          legal_reference?: string | null
          product_id?: string
          reason?: string
          report_no?: string
          reporter_id?: string | null
          reporter_kind?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_reports_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_share_events: {
        Row: {
          actor_id: string | null
          channel: string
          created_at: string
          id: string
          product_id: string
          url_kind: string
        }
        Insert: {
          actor_id?: string | null
          channel: string
          created_at?: string
          id?: string
          product_id: string
          url_kind?: string
        }
        Update: {
          actor_id?: string | null
          channel?: string
          created_at?: string
          id?: string
          product_id?: string
          url_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_share_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_short_link_events: {
        Row: {
          browser: string | null
          country: string | null
          created_at: string
          device_type: string | null
          id: string
          product_id: string
          purge_after: string | null
          referrer: string | null
          short_link_id: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          visitor_hash: string | null
        }
        Insert: {
          browser?: string | null
          country?: string | null
          created_at?: string
          device_type?: string | null
          id?: string
          product_id: string
          purge_after?: string | null
          referrer?: string | null
          short_link_id: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_hash?: string | null
        }
        Update: {
          browser?: string | null
          country?: string | null
          created_at?: string
          device_type?: string | null
          id?: string
          product_id?: string
          purge_after?: string | null
          referrer?: string | null
          short_link_id?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_short_link_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_short_link_events_short_link_id_fkey"
            columns: ["short_link_id"]
            isOneToOne: false
            referencedRelation: "product_short_links"
            referencedColumns: ["id"]
          },
        ]
      }
      product_short_links: {
        Row: {
          campaign: string | null
          click_count: number
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          last_click_at: string | null
          product_id: string
          status: string
          updated_at: string
        }
        Insert: {
          campaign?: string | null
          click_count?: number
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          last_click_at?: string | null
          product_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          campaign?: string | null
          click_count?: number
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          last_click_at?: string | null
          product_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_short_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_url_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          correlation_id: string | null
          id: string
          new_path: string
          old_path: string
          product_id: string
          reason: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          correlation_id?: string | null
          id?: string
          new_path: string
          old_path: string
          product_id: string
          reason?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          correlation_id?: string | null
          id?: string
          new_path?: string
          old_path?: string
          product_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_url_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_url_jobs: {
        Row: {
          actor_id: string | null
          conflicts: number
          correlation_id: string
          detail: Json
          failed: number
          finished_at: string | null
          id: string
          operation: string
          processed: number
          scope: string
          skipped: number
          started_at: string
          status: string
          succeeded: number
          total: number
        }
        Insert: {
          actor_id?: string | null
          conflicts?: number
          correlation_id?: string
          detail?: Json
          failed?: number
          finished_at?: string | null
          id?: string
          operation?: string
          processed?: number
          scope?: string
          skipped?: number
          started_at?: string
          status?: string
          succeeded?: number
          total?: number
        }
        Update: {
          actor_id?: string | null
          conflicts?: number
          correlation_id?: string
          detail?: Json
          failed?: number
          finished_at?: string | null
          id?: string
          operation?: string
          processed?: number
          scope?: string
          skipped?: number
          started_at?: string
          status?: string
          succeeded?: number
          total?: number
        }
        Relationships: []
      }
      product_url_route_prefixes: {
        Row: {
          note: string
          prefix: string
          verified_at: string | null
        }
        Insert: {
          note: string
          prefix: string
          verified_at?: string | null
        }
        Update: {
          note?: string
          prefix?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      product_url_settings: {
        Row: {
          analytics_retention_days: number
          canonical_pattern: string
          generate_qr_on_publish: boolean
          id: boolean
          include_product_id_suffix: boolean
          lowercase_hyphenate: boolean
          qr_background: string
          qr_error_correction: string
          qr_foreground: string
          qr_quiet_zone: number
          qr_size: number
          short_code_length: number
          short_link_domain: string | null
          short_link_domain_verified: boolean
          site_url: string
          stop_words: string[]
          strip_stop_words: boolean
          track_short_link_clicks: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          analytics_retention_days?: number
          canonical_pattern?: string
          generate_qr_on_publish?: boolean
          id?: boolean
          include_product_id_suffix?: boolean
          lowercase_hyphenate?: boolean
          qr_background?: string
          qr_error_correction?: string
          qr_foreground?: string
          qr_quiet_zone?: number
          qr_size?: number
          short_code_length?: number
          short_link_domain?: string | null
          short_link_domain_verified?: boolean
          site_url?: string
          stop_words?: string[]
          strip_stop_words?: boolean
          track_short_link_clicks?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          analytics_retention_days?: number
          canonical_pattern?: string
          generate_qr_on_publish?: boolean
          id?: boolean
          include_product_id_suffix?: boolean
          lowercase_hyphenate?: boolean
          qr_background?: string
          qr_error_correction?: string
          qr_foreground?: string
          qr_quiet_zone?: number
          qr_size?: number
          short_code_length?: number
          short_link_domain?: string | null
          short_link_domain_verified?: boolean
          site_url?: string
          stop_words?: string[]
          strip_stop_words?: boolean
          track_short_link_clicks?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      product_urls: {
        Row: {
          created_at: string
          created_by: string | null
          generated_by: string
          id: string
          is_canonical: boolean
          language: string
          path: string
          product_id: string
          redirect_to: string | null
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          generated_by?: string
          id?: string
          is_canonical?: boolean
          language?: string
          path: string
          product_id: string
          redirect_to?: string | null
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          generated_by?: string
          id?: string
          is_canonical?: boolean
          language?: string
          path?: string
          product_id?: string
          redirect_to?: string | null
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_urls_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_urls_redirect_to_fkey"
            columns: ["redirect_to"]
            isOneToOne: false
            referencedRelation: "product_urls"
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
      promise_ai_insights: {
        Row: {
          acted_at: string | null
          acted_by: string | null
          delay_risk: number
          escalation_advice: string
          generated_at: string
          id: string
          miss_probability: number
          promise_id: string
          reason: string | null
          state: string
          suggested_action: string
        }
        Insert: {
          acted_at?: string | null
          acted_by?: string | null
          delay_risk?: number
          escalation_advice: string
          generated_at?: string
          id?: string
          miss_probability?: number
          promise_id: string
          reason?: string | null
          state?: string
          suggested_action: string
        }
        Update: {
          acted_at?: string | null
          acted_by?: string | null
          delay_risk?: number
          escalation_advice?: string
          generated_at?: string
          id?: string
          miss_probability?: number
          promise_id?: string
          reason?: string | null
          state?: string
          suggested_action?: string
        }
        Relationships: [
          {
            foreignKeyName: "promise_ai_insights_promise_id_fkey"
            columns: ["promise_id"]
            isOneToOne: false
            referencedRelation: "promises"
            referencedColumns: ["id"]
          },
        ]
      }
      promise_audit_logs: {
        Row: {
          action: string
          actor: string
          actor_key: string | null
          actor_role: string
          actor_user_id: string | null
          created_at: string
          details: string | null
          id: string
          is_system: boolean
          new_value: string | null
          old_value: string | null
          promise_code: string | null
          promise_id: string | null
          source_module: string
        }
        Insert: {
          action: string
          actor: string
          actor_key?: string | null
          actor_role: string
          actor_user_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          is_system?: boolean
          new_value?: string | null
          old_value?: string | null
          promise_code?: string | null
          promise_id?: string | null
          source_module?: string
        }
        Update: {
          action?: string
          actor?: string
          actor_key?: string | null
          actor_role?: string
          actor_user_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          is_system?: boolean
          new_value?: string | null
          old_value?: string | null
          promise_code?: string | null
          promise_id?: string | null
          source_module?: string
        }
        Relationships: []
      }
      promise_categories: {
        Row: {
          accent: string
          created_at: string
          id: string
          is_active: boolean
          label: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          accent?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          accent?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      promise_escalations: {
        Row: {
          created_at: string
          id: string
          label: string
          level: number
          notified_audience: string | null
          promise_id: string
          raised_by: string
          raised_by_user_id: string | null
          reason: string | null
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          level: number
          notified_audience?: string | null
          promise_id: string
          raised_by?: string
          raised_by_user_id?: string | null
          reason?: string | null
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          level?: number
          notified_audience?: string | null
          promise_id?: string
          raised_by?: string
          raised_by_user_id?: string | null
          reason?: string | null
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "promise_escalations_promise_id_fkey"
            columns: ["promise_id"]
            isOneToOne: false
            referencedRelation: "promises"
            referencedColumns: ["id"]
          },
        ]
      }
      promise_health_events: {
        Row: {
          context: Json
          created_at: string
          event: string
          id: string
          level: string
          message: string
          source: string
        }
        Insert: {
          context?: Json
          created_at?: string
          event: string
          id?: string
          level?: string
          message: string
          source: string
        }
        Update: {
          context?: Json
          created_at?: string
          event?: string
          id?: string
          level?: string
          message?: string
          source?: string
        }
        Relationships: []
      }
      promise_ledger: {
        Row: {
          actor: string
          actor_user_id: string | null
          amount: number
          basis: string | null
          created_at: string
          currency: string
          id: string
          kind: string
          note: string | null
          promise_id: string
          reversed_at: string | null
          reversed_by: string | null
          rule_id: string | null
          status: string
        }
        Insert: {
          actor?: string
          actor_user_id?: string | null
          amount: number
          basis?: string | null
          created_at?: string
          currency?: string
          id?: string
          kind: string
          note?: string | null
          promise_id: string
          reversed_at?: string | null
          reversed_by?: string | null
          rule_id?: string | null
          status?: string
        }
        Update: {
          actor?: string
          actor_user_id?: string | null
          amount?: number
          basis?: string | null
          created_at?: string
          currency?: string
          id?: string
          kind?: string
          note?: string | null
          promise_id?: string
          reversed_at?: string | null
          reversed_by?: string | null
          rule_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "promise_ledger_promise_id_fkey"
            columns: ["promise_id"]
            isOneToOne: false
            referencedRelation: "promises"
            referencedColumns: ["id"]
          },
        ]
      }
      promise_links: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          label: string | null
          module: string
          promise_id: string
          record_id: string
          relation: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          module: string
          promise_id: string
          record_id: string
          relation?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          module?: string
          promise_id?: string
          record_id?: string
          relation?: string
        }
        Relationships: [
          {
            foreignKeyName: "promise_links_promise_id_fkey"
            columns: ["promise_id"]
            isOneToOne: false
            referencedRelation: "promises"
            referencedColumns: ["id"]
          },
        ]
      }
      promise_rules: {
        Row: {
          amount: number
          auto_apply: boolean
          code: string
          conditions: Json
          created_at: string
          id: string
          is_active: boolean
          kind: string
          name: string
          rule_type: string
          updated_at: string
        }
        Insert: {
          amount?: number
          auto_apply?: boolean
          code: string
          conditions?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          kind: string
          name: string
          rule_type?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          auto_apply?: boolean
          code?: string
          conditions?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
          rule_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      promise_settings: {
        Row: {
          auto_escalation: boolean
          auto_reminder: boolean
          escalation_delay_hours: number
          fine_system_enabled: boolean
          health_retention_days: number
          id: string
          lock_after_fulfill: boolean
          promise_expiry_days: number
          reminder_before_hours: number
          require_approval: boolean
          singleton: boolean
          tip_system_enabled: boolean
          updated_at: string
          updated_by: string | null
          work_end_time: string
          work_start_time: string
          working_days: number[]
          working_hours_only: boolean
        }
        Insert: {
          auto_escalation?: boolean
          auto_reminder?: boolean
          escalation_delay_hours?: number
          fine_system_enabled?: boolean
          health_retention_days?: number
          id?: string
          lock_after_fulfill?: boolean
          promise_expiry_days?: number
          reminder_before_hours?: number
          require_approval?: boolean
          singleton?: boolean
          tip_system_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
          work_end_time?: string
          work_start_time?: string
          working_days?: number[]
          working_hours_only?: boolean
        }
        Update: {
          auto_escalation?: boolean
          auto_reminder?: boolean
          escalation_delay_hours?: number
          fine_system_enabled?: boolean
          health_retention_days?: number
          id?: string
          lock_after_fulfill?: boolean
          promise_expiry_days?: number
          reminder_before_hours?: number
          require_approval?: boolean
          singleton?: boolean
          tip_system_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
          work_end_time?: string
          work_start_time?: string
          working_days?: number[]
          working_hours_only?: boolean
        }
        Relationships: []
      }
      promise_subcategories: {
        Row: {
          category_id: string
          created_at: string
          id: string
          is_active: boolean
          label: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promise_subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "promise_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      promises: {
        Row: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          breach_reason: string | null
          category_id: string | null
          code: string
          created_at: string
          created_by: string | null
          currency: string
          deadline: string
          delay_days: number
          description: string | null
          due_soon_at: string | null
          escalated_at: string | null
          escalation_level: number
          escalation_reason: string | null
          escalation_status: string | null
          extended_count: number
          fine_amount: number
          fine_status: string
          fulfilled_at: string | null
          id: string
          is_locked: boolean
          linked_module: string | null
          linked_record_id: string | null
          locked_at: string | null
          locked_by: string | null
          nano_category: string | null
          owner: string
          owner_user_id: string | null
          priority: string
          receiver: string
          receiver_user_id: string | null
          reminded_at: string | null
          sla_hours: number | null
          status: string
          sub_category: string | null
          tip_amount: number
          tip_status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          breach_reason?: string | null
          category_id?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deadline: string
          delay_days?: number
          description?: string | null
          due_soon_at?: string | null
          escalated_at?: string | null
          escalation_level?: number
          escalation_reason?: string | null
          escalation_status?: string | null
          extended_count?: number
          fine_amount?: number
          fine_status?: string
          fulfilled_at?: string | null
          id?: string
          is_locked?: boolean
          linked_module?: string | null
          linked_record_id?: string | null
          locked_at?: string | null
          locked_by?: string | null
          nano_category?: string | null
          owner: string
          owner_user_id?: string | null
          priority?: string
          receiver: string
          receiver_user_id?: string | null
          reminded_at?: string | null
          sla_hours?: number | null
          status?: string
          sub_category?: string | null
          tip_amount?: number
          tip_status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          breach_reason?: string | null
          category_id?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deadline?: string
          delay_days?: number
          description?: string | null
          due_soon_at?: string | null
          escalated_at?: string | null
          escalation_level?: number
          escalation_reason?: string | null
          escalation_status?: string | null
          extended_count?: number
          fine_amount?: number
          fine_status?: string
          fulfilled_at?: string | null
          id?: string
          is_locked?: boolean
          linked_module?: string | null
          linked_record_id?: string | null
          locked_at?: string | null
          locked_by?: string | null
          nano_category?: string | null
          owner?: string
          owner_user_id?: string | null
          priority?: string
          receiver?: string
          receiver_user_id?: string | null
          reminded_at?: string | null
          sla_hours?: number | null
          status?: string
          sub_category?: string | null
          tip_amount?: number
          tip_status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promises_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "promise_categories"
            referencedColumns: ["id"]
          },
        ]
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
      quests: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          rewards: Json
          status: Database["public"]["Enums"]["entity_status"]
          steps: Json
          updated_at: string
          xp_reward: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          rewards?: Json
          status?: Database["public"]["Enums"]["entity_status"]
          steps?: Json
          updated_at?: string
          xp_reward?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          rewards?: Json
          status?: Database["public"]["Enums"]["entity_status"]
          steps?: Json
          updated_at?: string
          xp_reward?: number
        }
        Relationships: []
      }
      quick_support_requests: {
        Row: {
          ai_suggested_solution: string | null
          assigned_to: string | null
          attachments: Json | null
          created_at: string
          description: string
          id: string
          priority: string | null
          request_type: string | null
          resolution_notes: string | null
          resolved_at: string | null
          response_time_minutes: number | null
          status: string | null
          subject: string
          updated_at: string
          user_email: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          ai_suggested_solution?: string | null
          assigned_to?: string | null
          attachments?: Json | null
          created_at?: string
          description: string
          id?: string
          priority?: string | null
          request_type?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          response_time_minutes?: number | null
          status?: string | null
          subject: string
          updated_at?: string
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          ai_suggested_solution?: string | null
          assigned_to?: string | null
          attachments?: Json | null
          created_at?: string
          description?: string
          id?: string
          priority?: string | null
          request_type?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          response_time_minutes?: number | null
          status?: string | null
          subject?: string
          updated_at?: string
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      ranks: {
        Row: {
          benefits: Json
          color: string | null
          created_at: string
          icon: string | null
          id: string
          min_xp: number
          name: string
          rank_number: number
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          benefits?: Json
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          min_xp: number
          name: string
          rank_number: number
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          benefits?: Json
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          min_xp?: number
          name?: string
          rank_number?: number
          status?: Database["public"]["Enums"]["entity_status"]
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
      rd_evaluations: {
        Row: {
          decision: string
          decision_reason: string
          evidence: string
          id: string
          notes: string
          opportunity_id: string
          research_links: string[]
          scores: Json
          updated_at: string
        }
        Insert: {
          decision?: string
          decision_reason?: string
          evidence?: string
          id?: string
          notes?: string
          opportunity_id: string
          research_links?: string[]
          scores?: Json
          updated_at?: string
        }
        Update: {
          decision?: string
          decision_reason?: string
          evidence?: string
          id?: string
          notes?: string
          opportunity_id?: string
          research_links?: string[]
          scores?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rd_evaluations_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: true
            referencedRelation: "rd_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      rd_opportunities: {
        Row: {
          assigned_to: string
          attachments: Json
          category: string
          cluster_key: string
          company: string
          contact_email: string
          contact_name: string
          contact_phone: string
          country: string
          created_at: string
          description: string
          details: Json
          id: string
          priority: string
          public_request_id: string
          related_ref: string
          source: string
          status: string
          submitter_fingerprint: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string
          attachments?: Json
          category?: string
          cluster_key?: string
          company?: string
          contact_email: string
          contact_name: string
          contact_phone?: string
          country?: string
          created_at?: string
          description?: string
          details?: Json
          id?: string
          priority?: string
          public_request_id: string
          related_ref?: string
          source?: string
          status?: string
          submitter_fingerprint?: string
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string
          attachments?: Json
          category?: string
          cluster_key?: string
          company?: string
          contact_email?: string
          contact_name?: string
          contact_phone?: string
          country?: string
          created_at?: string
          description?: string
          details?: Json
          id?: string
          priority?: string
          public_request_id?: string
          related_ref?: string
          source?: string
          status?: string
          submitter_fingerprint?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      rd_opportunity_events: {
        Row: {
          actor: string
          body: string
          created_at: string
          from_value: string
          id: string
          kind: string
          opportunity_id: string
          to_value: string
        }
        Insert: {
          actor?: string
          body?: string
          created_at?: string
          from_value?: string
          id?: string
          kind: string
          opportunity_id: string
          to_value?: string
        }
        Update: {
          actor?: string
          body?: string
          created_at?: string
          from_value?: string
          id?: string
          kind?: string
          opportunity_id?: string
          to_value?: string
        }
        Relationships: [
          {
            foreignKeyName: "rd_opportunity_events_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "rd_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      rd_projects: {
        Row: {
          acceptance_criteria: string
          commercial_terms: string
          created_at: string
          findings: string
          id: string
          kind: string
          name: string
          objective: string
          opportunity_id: string
          owner: string
          pipeline_item_id: string | null
          recommendation: string
          research_question: string
          results: string
          stage: string
          status: string
          team: string[]
          technical_notes: string
          timeline: string
          updated_at: string
        }
        Insert: {
          acceptance_criteria?: string
          commercial_terms?: string
          created_at?: string
          findings?: string
          id?: string
          kind: string
          name: string
          objective?: string
          opportunity_id: string
          owner?: string
          pipeline_item_id?: string | null
          recommendation?: string
          research_question?: string
          results?: string
          stage?: string
          status?: string
          team?: string[]
          technical_notes?: string
          timeline?: string
          updated_at?: string
        }
        Update: {
          acceptance_criteria?: string
          commercial_terms?: string
          created_at?: string
          findings?: string
          id?: string
          kind?: string
          name?: string
          objective?: string
          opportunity_id?: string
          owner?: string
          pipeline_item_id?: string | null
          recommendation?: string
          research_question?: string
          results?: string
          stage?: string
          status?: string
          team?: string[]
          technical_notes?: string
          timeline?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rd_projects_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "rd_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      rd_team_members: {
        Row: {
          active: boolean
          created_at: string
          email: string
          id: string
          invite_code_hash: string | null
          last_login_at: string | null
          name: string
          password_hash: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          id?: string
          invite_code_hash?: string | null
          last_login_at?: string | null
          name?: string
          password_hash?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          id?: string
          invite_code_hash?: string | null
          last_login_at?: string | null
          name?: string
          password_hash?: string | null
        }
        Relationships: []
      }
      registry_countries: {
        Row: {
          code: string
          created_at: string
          name: string
          region: string
        }
        Insert: {
          code: string
          created_at?: string
          name: string
          region: string
        }
        Update: {
          code?: string
          created_at?: string
          name?: string
          region?: string
        }
        Relationships: []
      }
      registry_languages: {
        Row: {
          code: string
          created_at: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          name?: string
        }
        Relationships: []
      }
      registry_search_engines: {
        Row: {
          created_at: string
          has_official_webmaster_api: boolean
          name: string
          primary_regions: string[]
          slug: string
        }
        Insert: {
          created_at?: string
          has_official_webmaster_api?: boolean
          name: string
          primary_regions?: string[]
          slug: string
        }
        Update: {
          created_at?: string
          has_official_webmaster_api?: boolean
          name?: string
          primary_regions?: string[]
          slug?: string
        }
        Relationships: []
      }
      reseller_commission_rules: {
        Row: {
          active: boolean
          category_id: string | null
          created_at: string
          currency: string
          fixed_amount: number
          id: string
          min_volume: number
          plan_code: string | null
          priority: number
          product_id: string | null
          rate_percent: number
          reseller_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          currency?: string
          fixed_amount?: number
          id?: string
          min_volume?: number
          plan_code?: string | null
          priority?: number
          product_id?: string | null
          rate_percent: number
          reseller_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          currency?: string
          fixed_amount?: number
          id?: string
          min_volume?: number
          plan_code?: string | null
          priority?: number
          product_id?: string | null
          rate_percent?: number
          reseller_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_commission_rules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_commission_rules_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_commissions: {
        Row: {
          attribution_id: string | null
          commission_amount: number
          created_at: string
          currency: string
          gross_amount: number
          id: string
          idempotency_key: string
          order_id: string
          order_item_id: string
          payout_id: string | null
          reseller_id: string
          rule_snapshot: Json
          status: string
          updated_at: string
        }
        Insert: {
          attribution_id?: string | null
          commission_amount: number
          created_at?: string
          currency?: string
          gross_amount: number
          id?: string
          idempotency_key: string
          order_id: string
          order_item_id: string
          payout_id?: string | null
          reseller_id: string
          rule_snapshot?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          attribution_id?: string | null
          commission_amount?: number
          created_at?: string
          currency?: string
          gross_amount?: number
          id?: string
          idempotency_key?: string
          order_id?: string
          order_item_id?: string
          payout_id?: string | null
          reseller_id?: string
          rule_snapshot?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_commissions_attribution_id_fkey"
            columns: ["attribution_id"]
            isOneToOne: false
            referencedRelation: "marketplace_order_attributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_commissions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_commissions_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: true
            referencedRelation: "marketplace_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_commissions_payout_fk"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "reseller_payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_commissions_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_membership_entitlements: {
        Row: {
          created_at: string
          expires_at: string
          feature_key: string
          feature_value: Json
          id: string
          membership_id: string
          starts_at: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          feature_key: string
          feature_value: Json
          id?: string
          membership_id: string
          starts_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          feature_key?: string
          feature_value?: Json
          id?: string
          membership_id?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_membership_entitlements_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "reseller_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_membership_events: {
        Row: {
          created_at: string
          event_key: string
          event_type: string
          id: string
          membership_id: string | null
          order_id: string | null
          payload: Json
          reseller_id: string
        }
        Insert: {
          created_at?: string
          event_key: string
          event_type: string
          id?: string
          membership_id?: string | null
          order_id?: string | null
          payload?: Json
          reseller_id: string
        }
        Update: {
          created_at?: string
          event_key?: string
          event_type?: string
          id?: string
          membership_id?: string | null
          order_id?: string | null
          payload?: Json
          reseller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_membership_events_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "reseller_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_membership_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "reseller_membership_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_membership_events_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_membership_orders: {
        Row: {
          amount_usd: number
          approval_status: string
          created_at: string
          currency: string
          finance_intent_id: string | null
          finance_invoice_id: string | null
          id: string
          idempotency_key: string
          membership_id: string | null
          order_number: string
          payment_status: string
          plan_id: string
          proof_metadata: Json
          proof_reference: string | null
          provider_payment_reference: string | null
          reseller_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount_usd: number
          approval_status?: string
          created_at?: string
          currency?: string
          finance_intent_id?: string | null
          finance_invoice_id?: string | null
          id?: string
          idempotency_key: string
          membership_id?: string | null
          order_number?: string
          payment_status?: string
          plan_id: string
          proof_metadata?: Json
          proof_reference?: string | null
          provider_payment_reference?: string | null
          reseller_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount_usd?: number
          approval_status?: string
          created_at?: string
          currency?: string
          finance_intent_id?: string | null
          finance_invoice_id?: string | null
          id?: string
          idempotency_key?: string
          membership_id?: string | null
          order_number?: string
          payment_status?: string
          plan_id?: string
          proof_metadata?: Json
          proof_reference?: string | null
          provider_payment_reference?: string | null
          reseller_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_membership_orders_finance_intent_id_fkey"
            columns: ["finance_intent_id"]
            isOneToOne: false
            referencedRelation: "finance_payment_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_membership_orders_finance_invoice_id_fkey"
            columns: ["finance_invoice_id"]
            isOneToOne: false
            referencedRelation: "finance_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_membership_orders_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "reseller_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_membership_orders_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "reseller_membership_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_membership_orders_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_membership_plans: {
        Row: {
          code: string
          created_at: string
          enabled: boolean
          features: Json
          id: string
          name: string
          price_usd: number
          profit_percent: number
          recommended: boolean
          sort_order: number
          updated_at: string
          validity_days: number
        }
        Insert: {
          code: string
          created_at?: string
          enabled?: boolean
          features?: Json
          id?: string
          name: string
          price_usd: number
          profit_percent: number
          recommended?: boolean
          sort_order: number
          updated_at?: string
          validity_days?: number
        }
        Update: {
          code?: string
          created_at?: string
          enabled?: boolean
          features?: Json
          id?: string
          name?: string
          price_usd?: number
          profit_percent?: number
          recommended?: boolean
          sort_order?: number
          updated_at?: string
          validity_days?: number
        }
        Relationships: []
      }
      reseller_memberships: {
        Row: {
          activated_at: string | null
          created_at: string
          entitlements_snapshot: Json
          expires_at: string | null
          finance_intent_id: string | null
          id: string
          membership_state: string
          order_id: string | null
          plan_code: string
          plan_id: string
          provider_payment_reference: string | null
          renewal_at: string | null
          reseller_id: string
          starts_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          entitlements_snapshot?: Json
          expires_at?: string | null
          finance_intent_id?: string | null
          id?: string
          membership_state?: string
          order_id?: string | null
          plan_code: string
          plan_id: string
          provider_payment_reference?: string | null
          renewal_at?: string | null
          reseller_id: string
          starts_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          entitlements_snapshot?: Json
          expires_at?: string | null
          finance_intent_id?: string | null
          id?: string
          membership_state?: string
          order_id?: string | null
          plan_code?: string
          plan_id?: string
          provider_payment_reference?: string | null
          renewal_at?: string | null
          reseller_id?: string
          starts_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_memberships_finance_intent_id_fkey"
            columns: ["finance_intent_id"]
            isOneToOne: false
            referencedRelation: "finance_payment_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_memberships_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "reseller_membership_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_memberships_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "reseller_membership_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_memberships_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_notifications: {
        Row: {
          audience: string
          body: string | null
          created_at: string
          id: string
          reseller_id: string | null
          scheduled_at: string | null
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          audience?: string
          body?: string | null
          created_at?: string
          id?: string
          reseller_id?: string | null
          scheduled_at?: string | null
          status?: string
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          audience?: string
          body?: string | null
          created_at?: string
          id?: string
          reseller_id?: string | null
          scheduled_at?: string | null
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_notifications_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_payout_schedules: {
        Row: {
          active: boolean
          cadence: string
          created_at: string
          currency: string
          holding_days: number
          minimum_amount: number
          payment_method: string | null
          requires_approval: boolean
          reseller_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          cadence?: string
          created_at?: string
          currency?: string
          holding_days?: number
          minimum_amount?: number
          payment_method?: string | null
          requires_approval?: boolean
          reseller_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          cadence?: string
          created_at?: string
          currency?: string
          holding_days?: number
          minimum_amount?: number
          payment_method?: string | null
          requires_approval?: boolean
          reseller_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_payout_schedules_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: true
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_payouts: {
        Row: {
          amount: number
          approved_at: string | null
          completed_at: string | null
          created_at: string
          currency: string
          failure_reason: string | null
          id: string
          idempotency_key: string
          payment_method: string | null
          processed_at: string | null
          provider_reference: string | null
          requested_at: string
          reseller_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          idempotency_key: string
          payment_method?: string | null
          processed_at?: string | null
          provider_reference?: string | null
          requested_at?: string
          reseller_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          idempotency_key?: string
          payment_method?: string | null
          processed_at?: string | null
          provider_reference?: string | null
          requested_at?: string
          reseller_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_payouts_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      resellers: {
        Row: {
          application: Json | null
          applied_at: string | null
          approved_at: string | null
          approved_by: string | null
          code: string
          company_name: string | null
          created_at: string
          email: string
          gst_number: string | null
          id: string
          kyc_status: string
          last_active_at: string | null
          legal_name: string | null
          name: string
          notes: string | null
          pan_number: string | null
          phone: string | null
          plan_code: string | null
          region: string | null
          status: string
          tier: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          application?: Json | null
          applied_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          code: string
          company_name?: string | null
          created_at?: string
          email: string
          gst_number?: string | null
          id?: string
          kyc_status?: string
          last_active_at?: string | null
          legal_name?: string | null
          name: string
          notes?: string | null
          pan_number?: string | null
          phone?: string | null
          plan_code?: string | null
          region?: string | null
          status?: string
          tier?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          application?: Json | null
          applied_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          code?: string
          company_name?: string | null
          created_at?: string
          email?: string
          gst_number?: string | null
          id?: string
          kyc_status?: string
          last_active_at?: string | null
          legal_name?: string | null
          name?: string
          notes?: string | null
          pan_number?: string | null
          phone?: string | null
          plan_code?: string | null
          region?: string | null
          status?: string
          tier?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      review_media: {
        Row: {
          bytes: number | null
          created_at: string
          id: string
          kind: string
          moderation_status: string
          processing_status: string
          review_id: string
          storage_path: string
          thumbnail_path: string | null
        }
        Insert: {
          bytes?: number | null
          created_at?: string
          id?: string
          kind: string
          moderation_status?: string
          processing_status?: string
          review_id: string
          storage_path: string
          thumbnail_path?: string | null
        }
        Update: {
          bytes?: number | null
          created_at?: string
          id?: string
          kind?: string
          moderation_status?: string
          processing_status?: string
          review_id?: string
          storage_path?: string
          thumbnail_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_media_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "marketplace_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_replies: {
        Row: {
          author_id: string | null
          author_role: string
          content: string
          created_at: string
          id: string
          review_id: string
          status: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          author_role: string
          content: string
          created_at?: string
          id?: string
          review_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          author_role?: string
          content?: string
          created_at?: string
          id?: string
          review_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_replies_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "marketplace_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_reports: {
        Row: {
          created_at: string
          detail: string | null
          id: string
          reason: string
          reporter_id: string | null
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          review_id: string
          status: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: string
          reason: string
          reporter_id?: string | null
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          review_id: string
          status?: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: string
          reason?: string
          reporter_id?: string | null
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          review_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_reports_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "marketplace_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_votes: {
        Row: {
          created_at: string
          helpful: boolean
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          helpful: boolean
          review_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          helpful?: boolean
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_votes_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "marketplace_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_wallets: {
        Row: {
          balance: number
          kind: Database["public"]["Enums"]["wallet_kind"]
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          kind: Database["public"]["Enums"]["wallet_kind"]
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          kind?: Database["public"]["Enums"]["wallet_kind"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rewards: {
        Row: {
          cost_coins: number
          cost_tokens: number
          created_at: string
          created_by: string | null
          description: string | null
          eligibility: Json
          icon: string | null
          id: string
          image_url: string | null
          name: string
          rarity: Database["public"]["Enums"]["rarity_tier"]
          slug: string
          status: Database["public"]["Enums"]["entity_status"]
          stock: number | null
          updated_at: string
        }
        Insert: {
          cost_coins?: number
          cost_tokens?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          eligibility?: Json
          icon?: string | null
          id?: string
          image_url?: string | null
          name: string
          rarity?: Database["public"]["Enums"]["rarity_tier"]
          slug: string
          status?: Database["public"]["Enums"]["entity_status"]
          stock?: number | null
          updated_at?: string
        }
        Update: {
          cost_coins?: number
          cost_tokens?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          eligibility?: Json
          icon?: string | null
          id?: string
          image_url?: string | null
          name?: string
          rarity?: Database["public"]["Enums"]["rarity_tier"]
          slug?: string
          status?: Database["public"]["Enums"]["entity_status"]
          stock?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      rnd_ai_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id?: string
        }
        Relationships: []
      }
      rnd_budgets: {
        Row: {
          created_at: string
          currency: string
          id: string
          is_current: boolean
          period: string
          total_budget: number
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          is_current?: boolean
          period: string
          total_budget?: number
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          is_current?: boolean
          period?: string
          total_budget?: number
        }
        Relationships: []
      }
      rnd_decisions: {
        Row: {
          ai_score: number
          estimated_cost: number
          estimated_time: string
          id: string
          priority: string
          status: string
          submitted_at: string
          submitted_by: string
          title: string
          type: string
          votes_approve: number
          votes_hold: number
          votes_reject: number
        }
        Insert: {
          ai_score?: number
          estimated_cost?: number
          estimated_time?: string
          id?: string
          priority?: string
          status?: string
          submitted_at?: string
          submitted_by?: string
          title: string
          type?: string
          votes_approve?: number
          votes_hold?: number
          votes_reject?: number
        }
        Update: {
          ai_score?: number
          estimated_cost?: number
          estimated_time?: string
          id?: string
          priority?: string
          status?: string
          submitted_at?: string
          submitted_by?: string
          title?: string
          type?: string
          votes_approve?: number
          votes_hold?: number
          votes_reject?: number
        }
        Relationships: []
      }
      rnd_feedback: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          sentiment: string
          sentiment_score: number
          source: string
          status: string
          votes: number
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          id?: string
          sentiment?: string
          sentiment_score?: number
          source?: string
          status?: string
          votes?: number
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          sentiment?: string
          sentiment_score?: number
          source?: string
          status?: string
          votes?: number
        }
        Relationships: []
      }
      rnd_feedback_insights: {
        Row: {
          created_at: string
          feedback_count: number
          id: string
          improvements: Json
          model: string
          summary: string
          themes: Json
        }
        Insert: {
          created_at?: string
          feedback_count?: number
          id?: string
          improvements?: Json
          model?: string
          summary?: string
          themes?: Json
        }
        Update: {
          created_at?: string
          feedback_count?: number
          id?: string
          improvements?: Json
          model?: string
          summary?: string
          themes?: Json
        }
        Relationships: []
      }
      rnd_idea_evaluations: {
        Row: {
          ai_analysis: string
          category: string
          created_at: string
          description: string
          id: string
          scores: Json
          title: string
        }
        Insert: {
          ai_analysis?: string
          category?: string
          created_at?: string
          description?: string
          id?: string
          scores?: Json
          title: string
        }
        Update: {
          ai_analysis?: string
          category?: string
          created_at?: string
          description?: string
          id?: string
          scores?: Json
          title?: string
        }
        Relationships: []
      }
      rnd_ideas: {
        Row: {
          author: string
          category: string
          created_at: string
          description: string
          feasibility: number
          id: string
          priority: string
          research_links: number
          status: string
          title: string
          updated_at: string
          votes: number
        }
        Insert: {
          author?: string
          category?: string
          created_at?: string
          description?: string
          feasibility?: number
          id?: string
          priority?: string
          research_links?: number
          status?: string
          title: string
          updated_at?: string
          votes?: number
        }
        Update: {
          author?: string
          category?: string
          created_at?: string
          description?: string
          feasibility?: number
          id?: string
          priority?: string
          research_links?: number
          status?: string
          title?: string
          updated_at?: string
          votes?: number
        }
        Relationships: []
      }
      rnd_impact_analyses: {
        Row: {
          ai_recommendation: string
          created_at: string
          effort_level: string
          feature: string
          id: string
          maintenance_cost: string
          performance_load: number
          revenue_impact: string
          score_demand: number
          score_effort: number
          score_revenue: number
          score_risk: number
          technical_risk: string
          user_demand: number
        }
        Insert: {
          ai_recommendation?: string
          created_at?: string
          effort_level?: string
          feature: string
          id?: string
          maintenance_cost?: string
          performance_load?: number
          revenue_impact?: string
          score_demand?: number
          score_effort?: number
          score_revenue?: number
          score_risk?: number
          technical_risk?: string
          user_demand?: number
        }
        Update: {
          ai_recommendation?: string
          created_at?: string
          effort_level?: string
          feature?: string
          id?: string
          maintenance_cost?: string
          performance_load?: number
          revenue_impact?: string
          score_demand?: number
          score_effort?: number
          score_revenue?: number
          score_risk?: number
          technical_risk?: string
          user_demand?: number
        }
        Relationships: []
      }
      rnd_market_gaps: {
        Row: {
          created_at: string
          difficulty: string
          gap: string
          id: string
          potential: string
        }
        Insert: {
          created_at?: string
          difficulty?: string
          gap: string
          id?: string
          potential?: string
        }
        Update: {
          created_at?: string
          difficulty?: string
          gap?: string
          id?: string
          potential?: string
        }
        Relationships: []
      }
      rnd_notifications: {
        Row: {
          created_at: string
          dismissed: boolean
          id: string
          message: string
          read: boolean
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          dismissed?: boolean
          id?: string
          message?: string
          read?: boolean
          title: string
          type?: string
        }
        Update: {
          created_at?: string
          dismissed?: boolean
          id?: string
          message?: string
          read?: boolean
          title?: string
          type?: string
        }
        Relationships: []
      }
      rnd_pipeline_items: {
        Row: {
          ai_score: number | null
          assignee: string
          created_at: string
          description: string
          due_date: string | null
          id: string
          priority: string
          progress: number
          stage: string
          title: string
          updated_at: string
        }
        Insert: {
          ai_score?: number | null
          assignee?: string
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          priority?: string
          progress?: number
          stage?: string
          title: string
          updated_at?: string
        }
        Update: {
          ai_score?: number | null
          assignee?: string
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          priority?: string
          progress?: number
          stage?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      rnd_prototypes: {
        Row: {
          completed_hours: number
          created_at: string
          estimated_hours: number
          id: string
          integrations: string[]
          modules: string[]
          name: string
          progress: number
          status: string
          team: string[]
          updated_at: string
        }
        Insert: {
          completed_hours?: number
          created_at?: string
          estimated_hours?: number
          id?: string
          integrations?: string[]
          modules?: string[]
          name: string
          progress?: number
          status?: string
          team?: string[]
          updated_at?: string
        }
        Update: {
          completed_hours?: number
          created_at?: string
          estimated_hours?: number
          id?: string
          integrations?: string[]
          modules?: string[]
          name?: string
          progress?: number
          status?: string
          team?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      rnd_team_feedback: {
        Row: {
          area: string
          content: string
          created_at: string
          id: string
          member: string
        }
        Insert: {
          area?: string
          content: string
          created_at?: string
          id?: string
          member: string
        }
        Update: {
          area?: string
          content?: string
          created_at?: string
          id?: string
          member?: string
        }
        Relationships: []
      }
      rnd_technologies: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          name: string
          relevance: number
          ring: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          name: string
          relevance?: number
          ring?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          name?: string
          relevance?: number
          ring?: string
        }
        Relationships: []
      }
      rnd_transactions: {
        Row: {
          amount: number
          budget_id: string
          created_at: string
          description: string
          id: string
          occurred_on: string
          status: string
          type: string
        }
        Insert: {
          amount: number
          budget_id: string
          created_at?: string
          description: string
          id?: string
          occurred_on?: string
          status?: string
          type?: string
        }
        Update: {
          amount?: number
          budget_id?: string
          created_at?: string
          description?: string
          id?: string
          occurred_on?: string
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "rnd_transactions_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "rnd_budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      rnd_trends: {
        Row: {
          competitors: string[]
          detected_at: string
          id: string
          impact: string
          opportunity: string
          relevance: number
          source: string
          status: string
          title: string
        }
        Insert: {
          competitors?: string[]
          detected_at?: string
          id?: string
          impact?: string
          opportunity?: string
          relevance?: number
          source?: string
          status?: string
          title: string
        }
        Update: {
          competitors?: string[]
          detected_at?: string
          id?: string
          impact?: string
          opportunity?: string
          relevance?: number
          source?: string
          status?: string
          title?: string
        }
        Relationships: []
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
          permission: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          permission: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
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
      safe_assist_ai_logs: {
        Row: {
          action_recommended: string | null
          action_taken: string | null
          ai_analysis: Json | null
          auto_handled: boolean | null
          event_type: string
          id: string
          risk_level: string | null
          session_id: string | null
          timestamp: string
        }
        Insert: {
          action_recommended?: string | null
          action_taken?: string | null
          ai_analysis?: Json | null
          auto_handled?: boolean | null
          event_type: string
          id?: string
          risk_level?: string | null
          session_id?: string | null
          timestamp?: string
        }
        Update: {
          action_recommended?: string | null
          action_taken?: string | null
          ai_analysis?: Json | null
          auto_handled?: boolean | null
          event_type?: string
          id?: string
          risk_level?: string | null
          session_id?: string | null
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "safe_assist_ai_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "safe_assist_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      safe_assist_alerts: {
        Row: {
          alert_type: string
          created_at: string
          id: string
          message: string
          recipients: string[]
          session_id: string | null
        }
        Insert: {
          alert_type: string
          created_at?: string
          id?: string
          message: string
          recipients?: string[]
          session_id?: string | null
        }
        Update: {
          alert_type?: string
          created_at?: string
          id?: string
          message?: string
          recipients?: string[]
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "safe_assist_alerts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "safe_assist_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      safe_assist_events: {
        Row: {
          actor_type: string
          event_data: Json
          event_type: string
          id: string
          session_id: string
          timestamp: string
        }
        Insert: {
          actor_type: string
          event_data?: Json
          event_type: string
          id?: string
          session_id: string
          timestamp?: string
        }
        Update: {
          actor_type?: string
          event_data?: Json
          event_type?: string
          id?: string
          session_id?: string
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "safe_assist_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "safe_assist_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      safe_assist_notifications: {
        Row: {
          created_at: string
          id: string
          message: string | null
          notification_type: string
          read_at: string | null
          session_id: string | null
          severity: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          notification_type: string
          read_at?: string | null
          session_id?: string | null
          severity?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          notification_type?: string
          read_at?: string | null
          session_id?: string | null
          severity?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "safe_assist_notifications_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "safe_assist_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      safe_assist_sessions: {
        Row: {
          agent_device_fingerprint: string | null
          agent_entered_user_code: string | null
          agent_ip_address: string | null
          agent_masked_id: string | null
          agent_verification_code: string | null
          agent_watermark_text: string | null
          ai_flags: Json | null
          ai_monitoring_enabled: boolean | null
          ai_risk_score: number | null
          client_notified_at: string | null
          created_at: string
          dual_verified: boolean | null
          end_reason: string | null
          ended_at: string | null
          ended_by: string | null
          expires_at: string
          id: string
          is_recording_enabled: boolean
          max_duration_minutes: number
          mode: Database["public"]["Enums"]["remote_assist_mode"]
          recording_url: string | null
          session_code: string
          started_at: string | null
          status: Database["public"]["Enums"]["remote_assist_status"]
          support_agent_id: string | null
          support_agent_role: Database["public"]["Enums"]["app_role"] | null
          user_consent_at: string | null
          user_consent_given: boolean
          user_device_fingerprint: string | null
          user_entered_agent_code: string | null
          user_id: string
          user_ip_address: string | null
          user_role: Database["public"]["Enums"]["app_role"] | null
          user_verification_code: string | null
        }
        Insert: {
          agent_device_fingerprint?: string | null
          agent_entered_user_code?: string | null
          agent_ip_address?: string | null
          agent_masked_id?: string | null
          agent_verification_code?: string | null
          agent_watermark_text?: string | null
          ai_flags?: Json | null
          ai_monitoring_enabled?: boolean | null
          ai_risk_score?: number | null
          client_notified_at?: string | null
          created_at?: string
          dual_verified?: boolean | null
          end_reason?: string | null
          ended_at?: string | null
          ended_by?: string | null
          expires_at?: string
          id?: string
          is_recording_enabled?: boolean
          max_duration_minutes?: number
          mode?: Database["public"]["Enums"]["remote_assist_mode"]
          recording_url?: string | null
          session_code: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["remote_assist_status"]
          support_agent_id?: string | null
          support_agent_role?: Database["public"]["Enums"]["app_role"] | null
          user_consent_at?: string | null
          user_consent_given?: boolean
          user_device_fingerprint?: string | null
          user_entered_agent_code?: string | null
          user_id: string
          user_ip_address?: string | null
          user_role?: Database["public"]["Enums"]["app_role"] | null
          user_verification_code?: string | null
        }
        Update: {
          agent_device_fingerprint?: string | null
          agent_entered_user_code?: string | null
          agent_ip_address?: string | null
          agent_masked_id?: string | null
          agent_verification_code?: string | null
          agent_watermark_text?: string | null
          ai_flags?: Json | null
          ai_monitoring_enabled?: boolean | null
          ai_risk_score?: number | null
          client_notified_at?: string | null
          created_at?: string
          dual_verified?: boolean | null
          end_reason?: string | null
          ended_at?: string | null
          ended_by?: string | null
          expires_at?: string
          id?: string
          is_recording_enabled?: boolean
          max_duration_minutes?: number
          mode?: Database["public"]["Enums"]["remote_assist_mode"]
          recording_url?: string | null
          session_code?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["remote_assist_status"]
          support_agent_id?: string | null
          support_agent_role?: Database["public"]["Enums"]["app_role"] | null
          user_consent_at?: string | null
          user_consent_given?: boolean
          user_device_fingerprint?: string | null
          user_entered_agent_code?: string | null
          user_id?: string
          user_ip_address?: string | null
          user_role?: Database["public"]["Enums"]["app_role"] | null
          user_verification_code?: string | null
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
      sales_commissions: {
        Row: {
          commission_rate: number
          created_at: string
          deals_closed: number
          earned: number
          id: string
          member_id: string | null
          paid: number
          period: string
          revenue: number
          status: string
          updated_at: string
        }
        Insert: {
          commission_rate?: number
          created_at?: string
          deals_closed?: number
          earned?: number
          id?: string
          member_id?: string | null
          paid?: number
          period: string
          revenue?: number
          status?: string
          updated_at?: string
        }
        Update: {
          commission_rate?: number
          created_at?: string
          deals_closed?: number
          earned?: number
          id?: string
          member_id?: string | null
          paid?: number
          period?: string
          revenue?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_commissions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_deals: {
        Row: {
          created_at: string
          customer_id: string | null
          expected_close_date: string | null
          id: string
          lead_id: string | null
          owner_id: string | null
          probability: number
          reference: string
          stage: string
          title: string
          updated_at: string
          value: number
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          expected_close_date?: string | null
          id?: string
          lead_id?: string | null
          owner_id?: string | null
          probability?: number
          reference: string
          stage?: string
          title: string
          updated_at?: string
          value?: number
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          expected_close_date?: string | null
          id?: string
          lead_id?: string | null
          owner_id?: string | null
          probability?: number
          reference?: string
          stage?: string
          title?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_deals_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "sales_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_deals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_leads: {
        Row: {
          ai_win_probability: number
          assigned_to: string | null
          category: string | null
          company: string
          contact_name: string
          created_at: string
          email: string | null
          id: string
          notes: string | null
          phone: string | null
          qualified: boolean
          reference: string
          source: string
          stage: string
          updated_at: string
          urgency: string
          value: number
        }
        Insert: {
          ai_win_probability?: number
          assigned_to?: string | null
          category?: string | null
          company: string
          contact_name: string
          created_at?: string
          email?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          qualified?: boolean
          reference: string
          source?: string
          stage?: string
          updated_at?: string
          urgency?: string
          value?: number
        }
        Update: {
          ai_win_probability?: number
          assigned_to?: string | null
          category?: string | null
          company?: string
          contact_name?: string
          created_at?: string
          email?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          qualified?: boolean
          reference?: string
          source?: string
          stage?: string
          updated_at?: string
          urgency?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          created_at: string
          description: string | null
          ends_at: string
          id: string
          name: string
          slug: string
          starts_at: string
          status: Database["public"]["Enums"]["entity_status"]
          theme: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          ends_at: string
          id?: string
          name: string
          slug: string
          starts_at: string
          status?: Database["public"]["Enums"]["entity_status"]
          theme?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          ends_at?: string
          id?: string
          name?: string
          slug?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["entity_status"]
          theme?: Json | null
          updated_at?: string
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
      security_assets: {
        Row: {
          asset_type: string
          created_at: string
          declared_mime: string | null
          detected_mime: string | null
          file_name: string
          id: string
          product_id: string | null
          seller_id: string | null
          sha256: string | null
          size_bytes: number | null
          status: string
          storage_bucket: string | null
          storage_path: string | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          asset_type?: string
          created_at?: string
          declared_mime?: string | null
          detected_mime?: string | null
          file_name: string
          id?: string
          product_id?: string | null
          seller_id?: string | null
          sha256?: string | null
          size_bytes?: number | null
          status?: string
          storage_bucket?: string | null
          storage_path?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          asset_type?: string
          created_at?: string
          declared_mime?: string | null
          detected_mime?: string | null
          file_name?: string
          id?: string
          product_id?: string | null
          seller_id?: string | null
          sha256?: string | null
          size_bytes?: number | null
          status?: string
          storage_bucket?: string | null
          storage_path?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_assets_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_assets_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "marketplace_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      security_dmca_queue: {
        Row: {
          asset_id: string | null
          created_at: string
          evidence: Json
          finding_id: string | null
          id: string
          legal_reference: string | null
          product_id: string | null
          sha256: string | null
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          asset_id?: string | null
          created_at?: string
          evidence?: Json
          finding_id?: string | null
          id?: string
          legal_reference?: string | null
          product_id?: string | null
          sha256?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          asset_id?: string | null
          created_at?: string
          evidence?: Json
          finding_id?: string | null
          id?: string
          legal_reference?: string | null
          product_id?: string | null
          sha256?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "security_dmca_queue_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "security_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_dmca_queue_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "security_findings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_dmca_queue_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          actor_id: string | null
          actor_role: string | null
          asset_id: string | null
          created_at: string
          detail: Json
          event: string
          id: string
          job_id: string | null
          new_state: string | null
          previous_state: string | null
          product_id: string | null
          reason: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_role?: string | null
          asset_id?: string | null
          created_at?: string
          detail?: Json
          event: string
          id?: string
          job_id?: string | null
          new_state?: string | null
          previous_state?: string | null
          product_id?: string | null
          reason?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_role?: string | null
          asset_id?: string | null
          created_at?: string
          detail?: Json
          event?: string
          id?: string
          job_id?: string | null
          new_state?: string | null
          previous_state?: string | null
          product_id?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_events_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "security_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "security_scan_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      security_findings: {
        Row: {
          asset_id: string
          category: string
          confidence: number | null
          created_at: string
          evidence: Json
          id: string
          job_id: string
          result: string
          severity: string
          source: string
          title: string
        }
        Insert: {
          asset_id: string
          category: string
          confidence?: number | null
          created_at?: string
          evidence?: Json
          id?: string
          job_id: string
          result: string
          severity?: string
          source?: string
          title: string
        }
        Update: {
          asset_id?: string
          category?: string
          confidence?: number | null
          created_at?: string
          evidence?: Json
          id?: string
          job_id?: string
          result?: string
          severity?: string
          source?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "security_findings_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "security_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_findings_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "security_scan_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      security_provider_configs: {
        Row: {
          created_at: string
          credential_env: string | null
          enabled: boolean
          endpoint: string | null
          id: string
          kind: string
          label: string
          last_error: string | null
          slug: string
          updated_at: string
          verified: boolean
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          credential_env?: string | null
          enabled?: boolean
          endpoint?: string | null
          id?: string
          kind?: string
          label: string
          last_error?: string | null
          slug: string
          updated_at?: string
          verified?: boolean
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          credential_env?: string | null
          enabled?: boolean
          endpoint?: string | null
          id?: string
          kind?: string
          label?: string
          last_error?: string | null
          slug?: string
          updated_at?: string
          verified?: boolean
          verified_at?: string | null
        }
        Relationships: []
      }
      security_quarantine: {
        Row: {
          asset_id: string
          decided_at: string | null
          decided_by: string | null
          decision_reason: string | null
          id: string
          job_id: string | null
          payload_retained: boolean
          quarantined_at: string
          quarantined_by: string | null
          reason: string
          state: string
        }
        Insert: {
          asset_id: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          id?: string
          job_id?: string | null
          payload_retained?: boolean
          quarantined_at?: string
          quarantined_by?: string | null
          reason: string
          state?: string
        }
        Update: {
          asset_id?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          id?: string
          job_id?: string | null
          payload_retained?: boolean
          quarantined_at?: string
          quarantined_by?: string | null
          reason?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "security_quarantine_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "security_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_quarantine_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "security_scan_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      security_scan_jobs: {
        Row: {
          asset_id: string
          attempt: number
          completed_at: string | null
          created_at: string
          error_category: string | null
          error_detail: string | null
          id: string
          provider: string | null
          provider_reference: string | null
          risk_level: string | null
          risk_score: number | null
          scanner_version: string
          stages: Json
          started_at: string | null
          status: string
        }
        Insert: {
          asset_id: string
          attempt?: number
          completed_at?: string | null
          created_at?: string
          error_category?: string | null
          error_detail?: string | null
          id?: string
          provider?: string | null
          provider_reference?: string | null
          risk_level?: string | null
          risk_score?: number | null
          scanner_version?: string
          stages?: Json
          started_at?: string | null
          status?: string
        }
        Update: {
          asset_id?: string
          attempt?: number
          completed_at?: string | null
          created_at?: string
          error_category?: string | null
          error_detail?: string | null
          id?: string
          provider?: string | null
          provider_reference?: string | null
          risk_level?: string | null
          risk_score?: number | null
          scanner_version?: string
          stages?: Json
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "security_scan_jobs_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "security_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      security_scanner_settings: {
        Row: {
          attach_hash_to_assets: boolean
          auto_quarantine_flagged: boolean
          block_on_malware: boolean
          id: boolean
          max_upload_mb: number
          notify_author_on_rejection: boolean
          result_freshness_days: number
          send_copyright_to_dmca: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          attach_hash_to_assets?: boolean
          auto_quarantine_flagged?: boolean
          block_on_malware?: boolean
          id?: boolean
          max_upload_mb?: number
          notify_author_on_rejection?: boolean
          result_freshness_days?: number
          send_copyright_to_dmca?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          attach_hash_to_assets?: boolean
          auto_quarantine_flagged?: boolean
          block_on_malware?: boolean
          id?: boolean
          max_upload_mb?: number
          notify_author_on_rejection?: boolean
          result_freshness_days?: number
          send_copyright_to_dmca?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      seo_activity_log: {
        Row: {
          action: string
          actor: string
          approval_ref: string | null
          context: Json
          id: string
          occurred_at: string
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor?: string
          approval_ref?: string | null
          context?: Json
          id?: string
          occurred_at?: string
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor?: string
          approval_ref?: string | null
          context?: Json
          id?: string
          occurred_at?: string
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      seo_ad_campaigns: {
        Row: {
          budget: number
          channel: string
          clicks: number
          conversions: number
          cpa: number
          created_at: string
          ends_on: string | null
          id: string
          impressions: number
          name: string
          roas: number
          spend: number
          starts_on: string | null
          status: string
          updated_at: string
        }
        Insert: {
          budget?: number
          channel?: string
          clicks?: number
          conversions?: number
          cpa?: number
          created_at?: string
          ends_on?: string | null
          id?: string
          impressions?: number
          name: string
          roas?: number
          spend?: number
          starts_on?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          budget?: number
          channel?: string
          clicks?: number
          conversions?: number
          cpa?: number
          created_at?: string
          ends_on?: string | null
          id?: string
          impressions?: number
          name?: string
          roas?: number
          spend?: number
          starts_on?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      seo_ai_suggestions: {
        Row: {
          confidence: number
          created_at: string
          id: string
          impact: string
          model: string | null
          status: string
          suggestion: string
          target_ref: string | null
          target_type: string
          title: string
          updated_at: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          id?: string
          impact?: string
          model?: string | null
          status?: string
          suggestion: string
          target_ref?: string | null
          target_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          confidence?: number
          created_at?: string
          id?: string
          impact?: string
          model?: string | null
          status?: string
          suggestion?: string
          target_ref?: string | null
          target_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      seo_alerts: {
        Row: {
          acknowledged: boolean
          category: string
          created_at: string
          id: string
          message: string
          severity: string
          title: string
        }
        Insert: {
          acknowledged?: boolean
          category?: string
          created_at?: string
          id?: string
          message: string
          severity?: string
          title: string
        }
        Update: {
          acknowledged?: boolean
          category?: string
          created_at?: string
          id?: string
          message?: string
          severity?: string
          title?: string
        }
        Relationships: []
      }
      seo_audits: {
        Row: {
          breakdown: Json
          completed_at: string | null
          created_at: string
          id: string
          issues_found: number
          name: string
          pages_crawled: number
          score: number
          started_at: string
          status: string
        }
        Insert: {
          breakdown?: Json
          completed_at?: string | null
          created_at?: string
          id?: string
          issues_found?: number
          name: string
          pages_crawled?: number
          score?: number
          started_at?: string
          status?: string
        }
        Update: {
          breakdown?: Json
          completed_at?: string | null
          created_at?: string
          id?: string
          issues_found?: number
          name?: string
          pages_crawled?: number
          score?: number
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      seo_automation_flows: {
        Row: {
          conversion_rate: number
          created_at: string
          executions: number
          id: string
          name: string
          status: string
          steps: Json
          trigger_event: string
          updated_at: string
        }
        Insert: {
          conversion_rate?: number
          created_at?: string
          executions?: number
          id?: string
          name: string
          status?: string
          steps?: Json
          trigger_event: string
          updated_at?: string
        }
        Update: {
          conversion_rate?: number
          created_at?: string
          executions?: number
          id?: string
          name?: string
          status?: string
          steps?: Json
          trigger_event?: string
          updated_at?: string
        }
        Relationships: []
      }
      seo_automation_runs: {
        Row: {
          automation_id: string
          finished_at: string | null
          id: string
          items_processed: number
          message: string | null
          started_at: string
          status: string
        }
        Insert: {
          automation_id: string
          finished_at?: string | null
          id?: string
          items_processed?: number
          message?: string | null
          started_at?: string
          status?: string
        }
        Update: {
          automation_id?: string
          finished_at?: string | null
          id?: string
          items_processed?: number
          message?: string | null
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_automation_runs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "seo_automations"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_automations: {
        Row: {
          automation_type: string
          created_at: string
          description: string | null
          id: string
          last_run_at: string | null
          name: string
          next_run_at: string | null
          runs_count: number
          schedule: string
          status: string
          success_rate: number
          updated_at: string
        }
        Insert: {
          automation_type: string
          created_at?: string
          description?: string | null
          id?: string
          last_run_at?: string | null
          name: string
          next_run_at?: string | null
          runs_count?: number
          schedule?: string
          status?: string
          success_rate?: number
          updated_at?: string
        }
        Update: {
          automation_type?: string
          created_at?: string
          description?: string | null
          id?: string
          last_run_at?: string | null
          name?: string
          next_run_at?: string | null
          runs_count?: number
          schedule?: string
          status?: string
          success_rate?: number
          updated_at?: string
        }
        Relationships: []
      }
      seo_backlinks: {
        Row: {
          anchor_text: string | null
          created_at: string
          domain_authority: number
          first_seen_at: string
          id: string
          last_checked_at: string | null
          link_type: string
          source_domain: string
          source_url: string
          spam_score: number
          status: string
          target_url: string
        }
        Insert: {
          anchor_text?: string | null
          created_at?: string
          domain_authority?: number
          first_seen_at?: string
          id?: string
          last_checked_at?: string | null
          link_type?: string
          source_domain: string
          source_url: string
          spam_score?: number
          status?: string
          target_url: string
        }
        Update: {
          anchor_text?: string | null
          created_at?: string
          domain_authority?: number
          first_seen_at?: string
          id?: string
          last_checked_at?: string | null
          link_type?: string
          source_domain?: string
          source_url?: string
          spam_score?: number
          status?: string
          target_url?: string
        }
        Relationships: []
      }
      seo_benchmark_runs: {
        Row: {
          created_at: string
          id: string
          label: string
          notes: string | null
          pagination_ms: number
          query_ms: number
          report_ms: number
          rows_scanned: number
          status: string
          target: string
          ttfb_ms: number
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          notes?: string | null
          pagination_ms?: number
          query_ms?: number
          report_ms?: number
          rows_scanned?: number
          status?: string
          target: string
          ttfb_ms?: number
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          notes?: string | null
          pagination_ms?: number
          query_ms?: number
          report_ms?: number
          rows_scanned?: number
          status?: string
          target?: string
          ttfb_ms?: number
        }
        Relationships: []
      }
      seo_competitor_gaps: {
        Row: {
          competitor_id: string
          created_at: string
          id: string
          keyword: string
          opportunity: string
          our_position: number | null
          search_volume: number
          their_position: number | null
        }
        Insert: {
          competitor_id: string
          created_at?: string
          id?: string
          keyword: string
          opportunity?: string
          our_position?: number | null
          search_volume?: number
          their_position?: number | null
        }
        Update: {
          competitor_id?: string
          created_at?: string
          id?: string
          keyword?: string
          opportunity?: string
          our_position?: number | null
          search_volume?: number
          their_position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "seo_competitor_gaps_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "seo_competitors"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_competitors: {
        Row: {
          backlinks_count: number
          created_at: string
          domain: string
          domain_authority: number
          id: string
          keywords_count: number
          name: string
          region: string
          traffic_estimate: number
          updated_at: string
          visibility_score: number
        }
        Insert: {
          backlinks_count?: number
          created_at?: string
          domain: string
          domain_authority?: number
          id?: string
          keywords_count?: number
          name: string
          region?: string
          traffic_estimate?: number
          updated_at?: string
          visibility_score?: number
        }
        Update: {
          backlinks_count?: number
          created_at?: string
          domain?: string
          domain_authority?: number
          id?: string
          keywords_count?: number
          name?: string
          region?: string
          traffic_estimate?: number
          updated_at?: string
          visibility_score?: number
        }
        Relationships: []
      }
      seo_content_items: {
        Row: {
          body: string | null
          content_type: string
          created_at: string
          id: string
          model: string | null
          published_at: string | null
          seo_score: number
          status: string
          target_keyword: string | null
          title: string
          updated_at: string
          url: string | null
          word_count: number
        }
        Insert: {
          body?: string | null
          content_type?: string
          created_at?: string
          id?: string
          model?: string | null
          published_at?: string | null
          seo_score?: number
          status?: string
          target_keyword?: string | null
          title: string
          updated_at?: string
          url?: string | null
          word_count?: number
        }
        Update: {
          body?: string | null
          content_type?: string
          created_at?: string
          id?: string
          model?: string | null
          published_at?: string | null
          seo_score?: number
          status?: string
          target_keyword?: string | null
          title?: string
          updated_at?: string
          url?: string | null
          word_count?: number
        }
        Relationships: []
      }
      seo_email_campaigns: {
        Row: {
          clicked_count: number
          created_at: string
          id: string
          name: string
          opened_count: number
          replied_count: number
          scheduled_at: string | null
          segment: string
          sent_count: number
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          clicked_count?: number
          created_at?: string
          id?: string
          name: string
          opened_count?: number
          replied_count?: number
          scheduled_at?: string | null
          segment?: string
          sent_count?: number
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          clicked_count?: number
          created_at?: string
          id?: string
          name?: string
          opened_count?: number
          replied_count?: number
          scheduled_at?: string | null
          segment?: string
          sent_count?: number
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      seo_error_events: {
        Row: {
          context: Json
          created_at: string
          first_seen_at: string
          fn_name: string | null
          id: string
          last_seen_at: string
          message: string
          name: string
          occurrences: number
          resolved: boolean
          route: string | null
          severity: string
          source: string
          stack: string | null
        }
        Insert: {
          context?: Json
          created_at?: string
          first_seen_at?: string
          fn_name?: string | null
          id?: string
          last_seen_at?: string
          message: string
          name: string
          occurrences?: number
          resolved?: boolean
          route?: string | null
          severity?: string
          source: string
          stack?: string | null
        }
        Update: {
          context?: Json
          created_at?: string
          first_seen_at?: string
          fn_name?: string | null
          id?: string
          last_seen_at?: string
          message?: string
          name?: string
          occurrences?: number
          resolved?: boolean
          route?: string | null
          severity?: string
          source?: string
          stack?: string | null
        }
        Relationships: []
      }
      seo_inbox_messages: {
        Row: {
          auto_reply: string | null
          channel: string
          contact_handle: string | null
          contact_name: string
          created_at: string
          id: string
          message: string
          replied_at: string | null
          status: string
        }
        Insert: {
          auto_reply?: string | null
          channel?: string
          contact_handle?: string | null
          contact_name: string
          created_at?: string
          id?: string
          message: string
          replied_at?: string | null
          status?: string
        }
        Update: {
          auto_reply?: string | null
          channel?: string
          contact_handle?: string | null
          contact_name?: string
          created_at?: string
          id?: string
          message?: string
          replied_at?: string | null
          status?: string
        }
        Relationships: []
      }
      seo_indexing_records: {
        Row: {
          crawl_status: string
          created_at: string
          discovered_at: string
          http_status: number
          id: string
          index_state: string
          indexed_at: string | null
          last_crawled_at: string | null
          notes: string | null
          source: string
          url: string
        }
        Insert: {
          crawl_status?: string
          created_at?: string
          discovered_at?: string
          http_status?: number
          id?: string
          index_state?: string
          indexed_at?: string | null
          last_crawled_at?: string | null
          notes?: string | null
          source?: string
          url: string
        }
        Update: {
          crawl_status?: string
          created_at?: string
          discovered_at?: string
          http_status?: number
          id?: string
          index_state?: string
          indexed_at?: string | null
          last_crawled_at?: string | null
          notes?: string | null
          source?: string
          url?: string
        }
        Relationships: []
      }
      seo_integrations: {
        Row: {
          category: string
          config: Json
          created_at: string
          display_name: string
          id: string
          last_sync_at: string | null
          provider: string
          status: string
          updated_at: string
        }
        Insert: {
          category?: string
          config?: Json
          created_at?: string
          display_name: string
          id?: string
          last_sync_at?: string | null
          provider: string
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          config?: Json
          created_at?: string
          display_name?: string
          id?: string
          last_sync_at?: string | null
          provider?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      seo_issues: {
        Row: {
          category: string
          created_at: string
          description: string
          detected_at: string
          fix_suggestion: string | null
          id: string
          issue_type: string
          page_url: string
          resolved_at: string | null
          severity: string
          status: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description: string
          detected_at?: string
          fix_suggestion?: string | null
          id?: string
          issue_type: string
          page_url: string
          resolved_at?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          detected_at?: string
          fix_suggestion?: string | null
          id?: string
          issue_type?: string
          page_url?: string
          resolved_at?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      seo_keyword_rankings: {
        Row: {
          clicks: number
          created_at: string
          id: string
          impressions: number
          keyword_id: string
          position: number
          recorded_on: string
        }
        Insert: {
          clicks?: number
          created_at?: string
          id?: string
          impressions?: number
          keyword_id: string
          position: number
          recorded_on: string
        }
        Update: {
          clicks?: number
          created_at?: string
          id?: string
          impressions?: number
          keyword_id?: string
          position?: number
          recorded_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_keyword_rankings_keyword_id_fkey"
            columns: ["keyword_id"]
            isOneToOne: false
            referencedRelation: "seo_keywords"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_keywords: {
        Row: {
          country: string | null
          cpc: number
          created_at: string
          difficulty: number
          id: string
          industry: string | null
          intent: string
          keyword: string
          position: number | null
          previous_position: number | null
          region: string
          search_volume: number
          status: string
          target_url: string | null
          updated_at: string
        }
        Insert: {
          country?: string | null
          cpc?: number
          created_at?: string
          difficulty?: number
          id?: string
          industry?: string | null
          intent?: string
          keyword: string
          position?: number | null
          previous_position?: number | null
          region?: string
          search_volume?: number
          status?: string
          target_url?: string | null
          updated_at?: string
        }
        Update: {
          country?: string | null
          cpc?: number
          created_at?: string
          difficulty?: number
          id?: string
          industry?: string | null
          intent?: string
          keyword?: string
          position?: number | null
          previous_position?: number | null
          region?: string
          search_volume?: number
          status?: string
          target_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      seo_leads: {
        Row: {
          company: string | null
          country: string | null
          created_at: string
          email: string
          estimated_value: number
          full_name: string
          id: string
          landing_url: string | null
          phone: string | null
          score: number
          source_channel: string
          source_keyword: string | null
          stage: string
          updated_at: string
        }
        Insert: {
          company?: string | null
          country?: string | null
          created_at?: string
          email: string
          estimated_value?: number
          full_name: string
          id?: string
          landing_url?: string | null
          phone?: string | null
          score?: number
          source_channel?: string
          source_keyword?: string | null
          stage?: string
          updated_at?: string
        }
        Update: {
          company?: string | null
          country?: string | null
          created_at?: string
          email?: string
          estimated_value?: number
          full_name?: string
          id?: string
          landing_url?: string | null
          phone?: string | null
          score?: number
          source_channel?: string
          source_keyword?: string | null
          stage?: string
          updated_at?: string
        }
        Relationships: []
      }
      seo_meta_rules: {
        Row: {
          applies_to: number
          created_at: string
          description_template: string
          id: string
          name: string
          og_image_template: string | null
          priority: number
          status: string
          title_template: string
          updated_at: string
          url_pattern: string
        }
        Insert: {
          applies_to?: number
          created_at?: string
          description_template: string
          id?: string
          name: string
          og_image_template?: string | null
          priority?: number
          status?: string
          title_template: string
          updated_at?: string
          url_pattern: string
        }
        Update: {
          applies_to?: number
          created_at?: string
          description_template?: string
          id?: string
          name?: string
          og_image_template?: string | null
          priority?: number
          status?: string
          title_template?: string
          updated_at?: string
          url_pattern?: string
        }
        Relationships: []
      }
      seo_page_behavior: {
        Row: {
          avg_time_seconds: number
          bounce_rate: number
          clicks: number
          created_at: string
          id: string
          page_url: string
          rage_clicks: number
          recorded_on: string
          scroll_depth_pct: number
          sessions: number
        }
        Insert: {
          avg_time_seconds?: number
          bounce_rate?: number
          clicks?: number
          created_at?: string
          id?: string
          page_url: string
          rage_clicks?: number
          recorded_on: string
          scroll_depth_pct?: number
          sessions?: number
        }
        Update: {
          avg_time_seconds?: number
          bounce_rate?: number
          clicks?: number
          created_at?: string
          id?: string
          page_url?: string
          rage_clicks?: number
          recorded_on?: string
          scroll_depth_pct?: number
          sessions?: number
        }
        Relationships: []
      }
      seo_pages: {
        Row: {
          canonical_url: string | null
          created_at: string
          h1: string | null
          id: string
          index_status: string
          issues_count: number
          last_crawled_at: string | null
          meta_description: string | null
          meta_title: string | null
          page_type: string
          product_id: string | null
          schema_json: Json | null
          seo_score: number
          title: string
          updated_at: string
          url: string
          word_count: number
        }
        Insert: {
          canonical_url?: string | null
          created_at?: string
          h1?: string | null
          id?: string
          index_status?: string
          issues_count?: number
          last_crawled_at?: string | null
          meta_description?: string | null
          meta_title?: string | null
          page_type?: string
          product_id?: string | null
          schema_json?: Json | null
          seo_score?: number
          title: string
          updated_at?: string
          url: string
          word_count?: number
        }
        Update: {
          canonical_url?: string | null
          created_at?: string
          h1?: string | null
          id?: string
          index_status?: string
          issues_count?: number
          last_crawled_at?: string | null
          meta_description?: string | null
          meta_title?: string | null
          page_type?: string
          product_id?: string | null
          schema_json?: Json | null
          seo_score?: number
          title?: string
          updated_at?: string
          url?: string
          word_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "seo_pages_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_performance_metrics: {
        Row: {
          avg_position: number
          clicks: number
          cls: number
          conversions: number
          created_at: string
          ctr: number
          id: string
          impressions: number
          inp_ms: number
          lcp_ms: number
          organic_sessions: number
          recorded_on: string
        }
        Insert: {
          avg_position?: number
          clicks?: number
          cls?: number
          conversions?: number
          created_at?: string
          ctr?: number
          id?: string
          impressions?: number
          inp_ms?: number
          lcp_ms?: number
          organic_sessions?: number
          recorded_on: string
        }
        Update: {
          avg_position?: number
          clicks?: number
          cls?: number
          conversions?: number
          created_at?: string
          ctr?: number
          id?: string
          impressions?: number
          inp_ms?: number
          lcp_ms?: number
          organic_sessions?: number
          recorded_on?: string
        }
        Relationships: []
      }
      seo_product_entries: {
        Row: {
          category: string
          created_at: string
          id: string
          meta_description: string | null
          meta_title: string | null
          product_name: string
          status: string
          structured_data: Json
          target_keywords: string[]
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          product_name: string
          status?: string
          structured_data?: Json
          target_keywords?: string[]
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          product_name?: string
          status?: string
          structured_data?: Json
          target_keywords?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      seo_reels: {
        Row: {
          created_at: string
          duration_seconds: number
          id: string
          model: string | null
          platform: string
          prompt: string
          script: string | null
          status: string
          title: string
          updated_at: string
          views: number
        }
        Insert: {
          created_at?: string
          duration_seconds?: number
          id?: string
          model?: string | null
          platform?: string
          prompt: string
          script?: string | null
          status?: string
          title: string
          updated_at?: string
          views?: number
        }
        Update: {
          created_at?: string
          duration_seconds?: number
          id?: string
          model?: string | null
          platform?: string
          prompt?: string
          script?: string | null
          status?: string
          title?: string
          updated_at?: string
          views?: number
        }
        Relationships: []
      }
      seo_regions: {
        Row: {
          code: string
          created_at: string
          flag: string | null
          growth_pct: number
          id: string
          keywords_count: number
          name: string
          region_group: string
          traffic_share: number
        }
        Insert: {
          code: string
          created_at?: string
          flag?: string | null
          growth_pct?: number
          id?: string
          keywords_count?: number
          name: string
          region_group?: string
          traffic_share?: number
        }
        Update: {
          code?: string
          created_at?: string
          flag?: string | null
          growth_pct?: number
          id?: string
          keywords_count?: number
          name?: string
          region_group?: string
          traffic_share?: number
        }
        Relationships: []
      }
      seo_reports: {
        Row: {
          created_at: string
          generated_at: string | null
          id: string
          name: string
          period_end: string
          period_start: string
          report_type: string
          status: string
          summary: Json
        }
        Insert: {
          created_at?: string
          generated_at?: string | null
          id?: string
          name: string
          period_end: string
          period_start: string
          report_type?: string
          status?: string
          summary?: Json
        }
        Update: {
          created_at?: string
          generated_at?: string | null
          id?: string
          name?: string
          period_end?: string
          period_start?: string
          report_type?: string
          status?: string
          summary?: Json
        }
        Relationships: []
      }
      seo_social_comments: {
        Row: {
          author: string
          auto_reply: string | null
          comment: string
          created_at: string
          id: string
          platform: string
          replied_at: string | null
          sentiment: string
          status: string
        }
        Insert: {
          author: string
          auto_reply?: string | null
          comment: string
          created_at?: string
          id?: string
          platform: string
          replied_at?: string | null
          sentiment?: string
          status?: string
        }
        Update: {
          author?: string
          auto_reply?: string | null
          comment?: string
          created_at?: string
          id?: string
          platform?: string
          replied_at?: string | null
          sentiment?: string
          status?: string
        }
        Relationships: []
      }
      seo_social_posts: {
        Row: {
          content: string
          created_at: string
          engagements: number
          id: string
          impressions: number
          link_url: string | null
          platform: string
          published_at: string | null
          scheduled_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          engagements?: number
          id?: string
          impressions?: number
          link_url?: string | null
          platform: string
          published_at?: string | null
          scheduled_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          engagements?: number
          id?: string
          impressions?: number
          link_url?: string | null
          platform?: string
          published_at?: string | null
          scheduled_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      seo_spam_events: {
        Row: {
          blocked: boolean
          country: string | null
          created_at: string
          detail: string | null
          event_type: string
          id: string
          source_ip: string
        }
        Insert: {
          blocked?: boolean
          country?: string | null
          created_at?: string
          detail?: string | null
          event_type: string
          id?: string
          source_ip: string
        }
        Update: {
          blocked?: boolean
          country?: string | null
          created_at?: string
          detail?: string | null
          event_type?: string
          id?: string
          source_ip?: string
        }
        Relationships: []
      }
      seo_technical_checks: {
        Row: {
          affected_urls: number
          category: string
          created_at: string
          detail: string | null
          id: string
          last_checked_at: string
          name: string
          status: string
        }
        Insert: {
          affected_urls?: number
          category?: string
          created_at?: string
          detail?: string | null
          id?: string
          last_checked_at?: string
          name: string
          status?: string
        }
        Update: {
          affected_urls?: number
          category?: string
          created_at?: string
          detail?: string | null
          id?: string
          last_checked_at?: string
          name?: string
          status?: string
        }
        Relationships: []
      }
      server_ai_insights: {
        Row: {
          applied_at: string | null
          confidence: number
          created_at: string
          description: string
          id: string
          impact: string | null
          insight_type: string
          recommendation: string
          server_id: string | null
          severity: string
          status: string
          title: string
        }
        Insert: {
          applied_at?: string | null
          confidence?: number
          created_at?: string
          description: string
          id?: string
          impact?: string | null
          insight_type?: string
          recommendation: string
          server_id?: string | null
          severity?: string
          status?: string
          title: string
        }
        Update: {
          applied_at?: string | null
          confidence?: number
          created_at?: string
          description?: string
          id?: string
          impact?: string | null
          insight_type?: string
          recommendation?: string
          server_id?: string | null
          severity?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "server_ai_insights_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "server_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      server_alerts: {
        Row: {
          acknowledged_at: string | null
          alert_code: string | null
          alert_type: string
          category: string
          created_at: string
          id: string
          is_resolved: boolean
          message: string
          resolution_notes: string | null
          resolved_at: string | null
          server_id: string | null
          severity: string
          source_ip: string | null
          status: string
        }
        Insert: {
          acknowledged_at?: string | null
          alert_code?: string | null
          alert_type: string
          category?: string
          created_at?: string
          id?: string
          is_resolved?: boolean
          message: string
          resolution_notes?: string | null
          resolved_at?: string | null
          server_id?: string | null
          severity?: string
          source_ip?: string | null
          status?: string
        }
        Update: {
          acknowledged_at?: string | null
          alert_code?: string | null
          alert_type?: string
          category?: string
          created_at?: string
          id?: string
          is_resolved?: boolean
          message?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          server_id?: string | null
          severity?: string
          source_ip?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "server_alerts_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "server_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      server_audit_logs: {
        Row: {
          action: string
          actor: string
          created_at: string
          details: string | null
          id: string
          ip_address: string | null
          result: string
          risk_level: string
          server_id: string | null
        }
        Insert: {
          action: string
          actor?: string
          created_at?: string
          details?: string | null
          id?: string
          ip_address?: string | null
          result?: string
          risk_level?: string
          server_id?: string | null
        }
        Update: {
          action?: string
          actor?: string
          created_at?: string
          details?: string | null
          id?: string
          ip_address?: string | null
          result?: string
          risk_level?: string
          server_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "server_audit_logs_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "server_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      server_backup_jobs: {
        Row: {
          backup_type: string
          created_at: string
          duration_minutes: number | null
          encryption_enabled: boolean
          error_message: string | null
          id: string
          job_code: string
          job_name: string
          last_run_at: string | null
          next_run_at: string | null
          progress: number
          retention_days: number
          schedule: string | null
          server_id: string | null
          size_gb: number
          status: string
          storage_location: string | null
        }
        Insert: {
          backup_type?: string
          created_at?: string
          duration_minutes?: number | null
          encryption_enabled?: boolean
          error_message?: string | null
          id?: string
          job_code: string
          job_name: string
          last_run_at?: string | null
          next_run_at?: string | null
          progress?: number
          retention_days?: number
          schedule?: string | null
          server_id?: string | null
          size_gb?: number
          status?: string
          storage_location?: string | null
        }
        Update: {
          backup_type?: string
          created_at?: string
          duration_minutes?: number | null
          encryption_enabled?: boolean
          error_message?: string | null
          id?: string
          job_code?: string
          job_name?: string
          last_run_at?: string | null
          next_run_at?: string | null
          progress?: number
          retention_days?: number
          schedule?: string | null
          server_id?: string | null
          size_gb?: number
          status?: string
          storage_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "server_backup_jobs_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "server_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      server_backup_schedules: {
        Row: {
          backup_type: string
          created_at: string
          encryption_enabled: boolean
          frequency: string
          id: string
          is_enabled: boolean
          last_run_at: string | null
          last_status: string
          next_run_at: string | null
          retention_days: number
          schedule_name: string
          server_id: string | null
        }
        Insert: {
          backup_type?: string
          created_at?: string
          encryption_enabled?: boolean
          frequency: string
          id?: string
          is_enabled?: boolean
          last_run_at?: string | null
          last_status?: string
          next_run_at?: string | null
          retention_days?: number
          schedule_name: string
          server_id?: string | null
        }
        Update: {
          backup_type?: string
          created_at?: string
          encryption_enabled?: boolean
          frequency?: string
          id?: string
          is_enabled?: boolean
          last_run_at?: string | null
          last_status?: string
          next_run_at?: string | null
          retention_days?: number
          schedule_name?: string
          server_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "server_backup_schedules_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "server_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      server_deployments: {
        Row: {
          branch: string
          commit_sha: string | null
          created_at: string
          deployed_at: string
          deployment_code: string
          deployment_name: string
          duration_seconds: number | null
          environment: string
          id: string
          progress: number
          server_id: string | null
          status: string
          triggered_by: string | null
        }
        Insert: {
          branch?: string
          commit_sha?: string | null
          created_at?: string
          deployed_at?: string
          deployment_code: string
          deployment_name: string
          duration_seconds?: number | null
          environment?: string
          id?: string
          progress?: number
          server_id?: string | null
          status?: string
          triggered_by?: string | null
        }
        Update: {
          branch?: string
          commit_sha?: string | null
          created_at?: string
          deployed_at?: string
          deployment_code?: string
          deployment_name?: string
          duration_seconds?: number | null
          environment?: string
          id?: string
          progress?: number
          server_id?: string | null
          status?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "server_deployments_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "server_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      server_firewall_rules: {
        Row: {
          action: string
          created_at: string
          direction: string
          id: string
          ports: string
          protocol: string
          rule_name: string
          server_id: string | null
          source_cidr: string
          status: string
        }
        Insert: {
          action?: string
          created_at?: string
          direction?: string
          id?: string
          ports: string
          protocol?: string
          rule_name: string
          server_id?: string | null
          source_cidr?: string
          status?: string
        }
        Update: {
          action?: string
          created_at?: string
          direction?: string
          id?: string
          ports?: string
          protocol?: string
          rule_name?: string
          server_id?: string | null
          source_cidr?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "server_firewall_rules_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "server_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      server_incidents: {
        Row: {
          created_at: string
          id: string
          incident_code: string
          incident_type: string
          mttr_minutes: number | null
          opened_at: string
          resolution_notes: string | null
          resolved_at: string | null
          server_id: string | null
          severity: string
          status: string
          summary: string
        }
        Insert: {
          created_at?: string
          id?: string
          incident_code: string
          incident_type: string
          mttr_minutes?: number | null
          opened_at?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          server_id?: string | null
          severity?: string
          status?: string
          summary: string
        }
        Update: {
          created_at?: string
          id?: string
          incident_code?: string
          incident_type?: string
          mttr_minutes?: number | null
          opened_at?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          server_id?: string | null
          severity?: string
          status?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "server_incidents_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "server_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      server_instances: {
        Row: {
          app_patch_status: string
          auto_scaling_enabled: boolean
          backup_status: string
          cpu_cores: number
          cpu_usage: number
          created_at: string
          disk_usage: number
          error_rate: number
          health_score: number
          health_status: string
          hostname: string | null
          id: string
          ip_address: string | null
          last_health_check: string | null
          last_patch_date: string | null
          last_restart: string | null
          max_instances: number
          min_instances: number
          monthly_cost: number
          network_in_mbps: number
          network_out_mbps: number
          notes: string | null
          os_patch_status: string
          os_type: string
          owner_id: string | null
          plan_name: string | null
          provider: string
          ram_gb: number
          ram_usage: number
          region_code: string
          region_name: string
          response_time_ms: number
          security_risk_level: string
          server_code: string
          server_name: string
          server_type: string
          sla_percent: number
          ssh_port: number
          status: string
          storage_gb: number
          tags: string[]
          updated_at: string
          uptime_percent: number
          workload: string
        }
        Insert: {
          app_patch_status?: string
          auto_scaling_enabled?: boolean
          backup_status?: string
          cpu_cores?: number
          cpu_usage?: number
          created_at?: string
          disk_usage?: number
          error_rate?: number
          health_score?: number
          health_status?: string
          hostname?: string | null
          id?: string
          ip_address?: string | null
          last_health_check?: string | null
          last_patch_date?: string | null
          last_restart?: string | null
          max_instances?: number
          min_instances?: number
          monthly_cost?: number
          network_in_mbps?: number
          network_out_mbps?: number
          notes?: string | null
          os_patch_status?: string
          os_type?: string
          owner_id?: string | null
          plan_name?: string | null
          provider?: string
          ram_gb?: number
          ram_usage?: number
          region_code: string
          region_name: string
          response_time_ms?: number
          security_risk_level?: string
          server_code: string
          server_name: string
          server_type?: string
          sla_percent?: number
          ssh_port?: number
          status?: string
          storage_gb?: number
          tags?: string[]
          updated_at?: string
          uptime_percent?: number
          workload?: string
        }
        Update: {
          app_patch_status?: string
          auto_scaling_enabled?: boolean
          backup_status?: string
          cpu_cores?: number
          cpu_usage?: number
          created_at?: string
          disk_usage?: number
          error_rate?: number
          health_score?: number
          health_status?: string
          hostname?: string | null
          id?: string
          ip_address?: string | null
          last_health_check?: string | null
          last_patch_date?: string | null
          last_restart?: string | null
          max_instances?: number
          min_instances?: number
          monthly_cost?: number
          network_in_mbps?: number
          network_out_mbps?: number
          notes?: string | null
          os_patch_status?: string
          os_type?: string
          owner_id?: string | null
          plan_name?: string | null
          provider?: string
          ram_gb?: number
          ram_usage?: number
          region_code?: string
          region_name?: string
          response_time_ms?: number
          security_risk_level?: string
          server_code?: string
          server_name?: string
          server_type?: string
          sla_percent?: number
          ssh_port?: number
          status?: string
          storage_gb?: number
          tags?: string[]
          updated_at?: string
          uptime_percent?: number
          workload?: string
        }
        Relationships: []
      }
      server_invoices: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          invoice_code: string
          issued_at: string
          period_end: string
          period_label: string
          period_start: string
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          invoice_code: string
          issued_at: string
          period_end: string
          period_label: string
          period_start: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          invoice_code?: string
          issued_at?: string
          period_end?: string
          period_label?: string
          period_start?: string
          status?: string
        }
        Relationships: []
      }
      server_login_history: {
        Row: {
          id: string
          ip_address: string | null
          logged_at: string
          method: string
          server_id: string | null
          server_label: string
          session_duration_minutes: number | null
          status: string
          username: string
        }
        Insert: {
          id?: string
          ip_address?: string | null
          logged_at?: string
          method?: string
          server_id?: string | null
          server_label: string
          session_duration_minutes?: number | null
          status?: string
          username: string
        }
        Update: {
          id?: string
          ip_address?: string | null
          logged_at?: string
          method?: string
          server_id?: string | null
          server_label?: string
          session_duration_minutes?: number | null
          status?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "server_login_history_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "server_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      server_logs: {
        Row: {
          id: string
          level: string
          logged_at: string
          message: string
          server_id: string | null
          service_name: string | null
        }
        Insert: {
          id?: string
          level?: string
          logged_at?: string
          message: string
          server_id?: string | null
          service_name?: string | null
        }
        Update: {
          id?: string
          level?: string
          logged_at?: string
          message?: string
          server_id?: string | null
          service_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "server_logs_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "server_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      server_maintenance_windows: {
        Row: {
          created_at: string
          id: string
          impact: string
          notes: string | null
          scheduled_end: string
          scheduled_start: string
          server_scope: string
          status: string
          title: string
          window_code: string
          window_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          impact?: string
          notes?: string | null
          scheduled_end: string
          scheduled_start: string
          server_scope: string
          status?: string
          title: string
          window_code: string
          window_type?: string
        }
        Update: {
          created_at?: string
          id?: string
          impact?: string
          notes?: string | null
          scheduled_end?: string
          scheduled_start?: string
          server_scope?: string
          status?: string
          title?: string
          window_code?: string
          window_type?: string
        }
        Relationships: []
      }
      server_metrics_history: {
        Row: {
          active_connections: number | null
          cpu_usage: number | null
          disk_usage: number | null
          error_count: number | null
          id: string
          network_in_mbps: number | null
          network_out_mbps: number | null
          ram_usage: number | null
          recorded_at: string
          request_count: number | null
          response_time_ms: number | null
          server_id: string | null
        }
        Insert: {
          active_connections?: number | null
          cpu_usage?: number | null
          disk_usage?: number | null
          error_count?: number | null
          id?: string
          network_in_mbps?: number | null
          network_out_mbps?: number | null
          ram_usage?: number | null
          recorded_at?: string
          request_count?: number | null
          response_time_ms?: number | null
          server_id?: string | null
        }
        Update: {
          active_connections?: number | null
          cpu_usage?: number | null
          disk_usage?: number | null
          error_count?: number | null
          id?: string
          network_in_mbps?: number | null
          network_out_mbps?: number | null
          ram_usage?: number | null
          recorded_at?: string
          request_count?: number | null
          response_time_ms?: number | null
          server_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "server_metrics_history_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "server_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      server_network_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          message: string
          severity: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          message: string
          severity?: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          message?: string
          severity?: string
        }
        Relationships: []
      }
      server_network_traffic: {
        Row: {
          id: string
          inbound_mbps: number
          latency_ms: number
          outbound_mbps: number
          packet_loss: number
          recorded_at: string
          region_code: string
          region_name: string
        }
        Insert: {
          id?: string
          inbound_mbps?: number
          latency_ms?: number
          outbound_mbps?: number
          packet_loss?: number
          recorded_at?: string
          region_code: string
          region_name: string
        }
        Update: {
          id?: string
          inbound_mbps?: number
          latency_ms?: number
          outbound_mbps?: number
          packet_loss?: number
          recorded_at?: string
          region_code?: string
          region_name?: string
        }
        Relationships: []
      }
      server_plans: {
        Row: {
          bandwidth_tb: number
          cpu_cores: number
          created_at: string
          features: string[]
          id: string
          is_active: boolean
          is_recommended: boolean
          plan_code: string
          plan_name: string
          plan_type: string
          price_monthly: number
          price_yearly: number | null
          ram_gb: number
          recommendation_reason: string | null
          regions: string[]
          storage_gb: number
        }
        Insert: {
          bandwidth_tb?: number
          cpu_cores: number
          created_at?: string
          features?: string[]
          id?: string
          is_active?: boolean
          is_recommended?: boolean
          plan_code: string
          plan_name: string
          plan_type: string
          price_monthly: number
          price_yearly?: number | null
          ram_gb: number
          recommendation_reason?: string | null
          regions?: string[]
          storage_gb: number
        }
        Update: {
          bandwidth_tb?: number
          cpu_cores?: number
          created_at?: string
          features?: string[]
          id?: string
          is_active?: boolean
          is_recommended?: boolean
          plan_code?: string
          plan_name?: string
          plan_type?: string
          price_monthly?: number
          price_yearly?: number | null
          ram_gb?: number
          recommendation_reason?: string | null
          regions?: string[]
          storage_gb?: number
        }
        Relationships: []
      }
      server_purchases: {
        Row: {
          amount: number
          auto_backup: boolean
          completed_at: string | null
          created_at: string
          firewall_preset: string
          id: string
          os_type: string
          payment_method: string
          plan_id: string | null
          purchase_code: string
          region_code: string
          server_id: string | null
          server_name: string | null
          status: string
        }
        Insert: {
          amount?: number
          auto_backup?: boolean
          completed_at?: string | null
          created_at?: string
          firewall_preset?: string
          id?: string
          os_type?: string
          payment_method?: string
          plan_id?: string | null
          purchase_code: string
          region_code: string
          server_id?: string | null
          server_name?: string | null
          status?: string
        }
        Update: {
          amount?: number
          auto_backup?: boolean
          completed_at?: string | null
          created_at?: string
          firewall_preset?: string
          id?: string
          os_type?: string
          payment_method?: string
          plan_id?: string | null
          purchase_code?: string
          region_code?: string
          server_id?: string | null
          server_name?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "server_purchases_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "server_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "server_purchases_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "server_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      server_regions: {
        Row: {
          compliance: string[]
          country_flag: string | null
          created_at: string
          id: string
          is_active: boolean
          latency_ms: number
          region_code: string
          region_name: string
        }
        Insert: {
          compliance?: string[]
          country_flag?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          latency_ms?: number
          region_code: string
          region_name: string
        }
        Update: {
          compliance?: string[]
          country_flag?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          latency_ms?: number
          region_code?: string
          region_name?: string
        }
        Relationships: []
      }
      server_restore_points: {
        Row: {
          backup_type: string
          captured_at: string
          created_at: string
          id: string
          point_code: string
          point_name: string
          retention_days: number
          server_id: string | null
          size_gb: number
          verified: boolean
        }
        Insert: {
          backup_type?: string
          captured_at?: string
          created_at?: string
          id?: string
          point_code: string
          point_name: string
          retention_days?: number
          server_id?: string | null
          size_gb?: number
          verified?: boolean
        }
        Update: {
          backup_type?: string
          captured_at?: string
          created_at?: string
          id?: string
          point_code?: string
          point_name?: string
          retention_days?: number
          server_id?: string | null
          size_gb?: number
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "server_restore_points_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "server_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      server_rolling_updates: {
        Row: {
          component: string
          created_at: string
          current_version: string
          id: string
          progress: number
          servers_count: number
          status: string
          target_version: string
        }
        Insert: {
          component: string
          created_at?: string
          current_version: string
          id?: string
          progress?: number
          servers_count?: number
          status?: string
          target_version: string
        }
        Update: {
          component?: string
          created_at?: string
          current_version?: string
          id?: string
          progress?: number
          servers_count?: number
          status?: string
          target_version?: string
        }
        Relationships: []
      }
      server_services: {
        Row: {
          cpu_percent: number
          created_at: string
          id: string
          memory_mb: number
          port: number | null
          restart_policy: string
          server_id: string | null
          service_name: string
          sla_percent: number
          status: string
          updated_at: string
          uptime_percent: number
          version: string | null
        }
        Insert: {
          cpu_percent?: number
          created_at?: string
          id?: string
          memory_mb?: number
          port?: number | null
          restart_policy?: string
          server_id?: string | null
          service_name: string
          sla_percent?: number
          status?: string
          updated_at?: string
          uptime_percent?: number
          version?: string | null
        }
        Update: {
          cpu_percent?: number
          created_at?: string
          id?: string
          memory_mb?: number
          port?: number | null
          restart_policy?: string
          server_id?: string | null
          service_name?: string
          sla_percent?: number
          status?: string
          updated_at?: string
          uptime_percent?: number
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "server_services_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "server_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      server_settings: {
        Row: {
          category: string
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
        }
        Insert: {
          category?: string
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string
        }
        Update: {
          category?: string
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
        }
        Relationships: []
      }
      server_sla_breaches: {
        Row: {
          breach_date: string
          created_at: string
          duration_minutes: number
          id: string
          reason: string
          service_name: string
        }
        Insert: {
          breach_date: string
          created_at?: string
          duration_minutes: number
          id?: string
          reason: string
          service_name: string
        }
        Update: {
          breach_date?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          reason?: string
          service_name?: string
        }
        Relationships: []
      }
      server_ssh_keys: {
        Row: {
          added_at: string
          created_at: string
          fingerprint: string
          id: string
          is_active: boolean
          key_code: string
          key_name: string
          key_type: string
          servers_count: number
        }
        Insert: {
          added_at?: string
          created_at?: string
          fingerprint: string
          id?: string
          is_active?: boolean
          key_code: string
          key_name: string
          key_type?: string
          servers_count?: number
        }
        Update: {
          added_at?: string
          created_at?: string
          fingerprint?: string
          id?: string
          is_active?: boolean
          key_code?: string
          key_name?: string
          key_type?: string
          servers_count?: number
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
      storefront_floating_elements: {
        Row: {
          action_target: string | null
          action_type: string
          audience: string
          created_at: string
          created_by: string | null
          desktop_enabled: boolean
          element_type: string
          enabled: boolean
          ends_at: string | null
          icon: string | null
          id: string
          key: string
          label: string
          mobile_enabled: boolean
          name: string
          offset_x: number
          offset_y: number
          page_scope: string
          position: string
          priority: number
          starts_at: string | null
          tablet_enabled: boolean
          theme: string
          trigger_type: string
          trigger_value: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          action_target?: string | null
          action_type?: string
          audience?: string
          created_at?: string
          created_by?: string | null
          desktop_enabled?: boolean
          element_type: string
          enabled?: boolean
          ends_at?: string | null
          icon?: string | null
          id?: string
          key: string
          label: string
          mobile_enabled?: boolean
          name: string
          offset_x?: number
          offset_y?: number
          page_scope?: string
          position?: string
          priority?: number
          starts_at?: string | null
          tablet_enabled?: boolean
          theme?: string
          trigger_type?: string
          trigger_value?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          action_target?: string | null
          action_type?: string
          audience?: string
          created_at?: string
          created_by?: string | null
          desktop_enabled?: boolean
          element_type?: string
          enabled?: boolean
          ends_at?: string | null
          icon?: string | null
          id?: string
          key?: string
          label?: string
          mobile_enabled?: boolean
          name?: string
          offset_x?: number
          offset_y?: number
          page_scope?: string
          position?: string
          priority?: number
          starts_at?: string | null
          tablet_enabled?: boolean
          theme?: string
          trigger_type?: string
          trigger_value?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      storefront_footer_columns: {
        Row: {
          created_at: string
          created_by: string | null
          enabled: boolean
          heading: string
          id: string
          key: string
          position: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          heading: string
          id?: string
          key: string
          position: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          heading?: string
          id?: string
          key?: string
          position?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      storefront_footer_links: {
        Row: {
          audience: string
          column_id: string
          created_at: string
          created_by: string | null
          enabled: boolean
          href: string | null
          id: string
          label: string
          legal_policy_type: string | null
          link_type: string
          open_in_new: boolean
          position: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          audience?: string
          column_id: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          href?: string | null
          id?: string
          label: string
          legal_policy_type?: string | null
          link_type?: string
          open_in_new?: boolean
          position: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          audience?: string
          column_id?: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          href?: string | null
          id?: string
          label?: string
          legal_policy_type?: string | null
          link_type?: string
          open_in_new?: boolean
          position?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "storefront_footer_links_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "storefront_footer_columns"
            referencedColumns: ["id"]
          },
        ]
      }
      storefront_footer_settings: {
        Row: {
          id: boolean
          newsletter_consent: string | null
          newsletter_description: string | null
          newsletter_enabled: boolean
          newsletter_list_id: string | null
          newsletter_placeholder: string
          newsletter_provider: string | null
          newsletter_success: string
          newsletter_title: string
          show_footer: boolean
          trust_strip_enabled: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: boolean
          newsletter_consent?: string | null
          newsletter_description?: string | null
          newsletter_enabled?: boolean
          newsletter_list_id?: string | null
          newsletter_placeholder?: string
          newsletter_provider?: string | null
          newsletter_success?: string
          newsletter_title?: string
          show_footer?: boolean
          trust_strip_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: boolean
          newsletter_consent?: string | null
          newsletter_description?: string | null
          newsletter_enabled?: boolean
          newsletter_list_id?: string | null
          newsletter_placeholder?: string
          newsletter_provider?: string | null
          newsletter_success?: string
          newsletter_title?: string
          show_footer?: boolean
          trust_strip_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      storefront_published_config: {
        Row: {
          id: string
          is_live: boolean
          kind: string
          note: string | null
          published_at: string
          published_by: string | null
          snapshot: Json
          version: number
        }
        Insert: {
          id?: string
          is_live?: boolean
          kind: string
          note?: string | null
          published_at?: string
          published_by?: string | null
          snapshot: Json
          version: number
        }
        Update: {
          id?: string
          is_live?: boolean
          kind?: string
          note?: string | null
          published_at?: string
          published_by?: string | null
          snapshot?: Json
          version?: number
        }
        Relationships: []
      }
      storefront_social_links: {
        Row: {
          created_at: string
          created_by: string | null
          enabled: boolean
          handle: string | null
          id: string
          platform: string
          position: number
          updated_at: string
          updated_by: string | null
          url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          handle?: string | null
          id?: string
          platform: string
          position: number
          updated_at?: string
          updated_by?: string | null
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          handle?: string | null
          id?: string
          platform?: string
          position?: number
          updated_at?: string
          updated_by?: string | null
          url?: string
        }
        Relationships: []
      }
      storefront_trust_items: {
        Row: {
          alt_text: string
          created_at: string
          created_by: string | null
          enabled: boolean
          href: string | null
          icon: string | null
          id: string
          kind: string
          name: string
          position: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          alt_text: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          href?: string | null
          icon?: string | null
          id?: string
          kind: string
          name: string
          position: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          alt_text?: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          href?: string | null
          icon?: string | null
          id?: string
          kind?: string
          name?: string
          position?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      support_escalations: {
        Row: {
          assigned_to: string | null
          created_at: string
          id: string
          level: number
          raised_by: string | null
          reason: string
          reference: string
          resolution_notes: string | null
          status: string
          ticket_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          id?: string
          level?: number
          raised_by?: string | null
          reason: string
          reference: string
          resolution_notes?: string | null
          status?: string
          ticket_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          id?: string
          level?: number
          raised_by?: string | null
          reason?: string
          reference?: string
          resolution_notes?: string | null
          status?: string
          ticket_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_escalations_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_escalations_raised_by_fkey"
            columns: ["raised_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_escalations_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: string
          channel: string
          created_at: string
          csat: number | null
          customer_id: string | null
          customer_name: string
          description: string | null
          first_response_at: string | null
          id: string
          priority: string
          reference: string
          resolved_at: string | null
          sla_breached: boolean
          sla_minutes_remaining: number
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string
          channel?: string
          created_at?: string
          csat?: number | null
          customer_id?: string | null
          customer_name: string
          description?: string | null
          first_response_at?: string | null
          id?: string
          priority?: string
          reference: string
          resolved_at?: string | null
          sla_breached?: boolean
          sla_minutes_remaining?: number
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          channel?: string
          created_at?: string
          csat?: number | null
          customer_id?: string | null
          customer_name?: string
          description?: string | null
          first_response_at?: string | null
          id?: string
          priority?: string
          reference?: string
          resolved_at?: string | null
          sla_breached?: boolean
          sla_minutes_remaining?: number
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
        ]
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
      team_members: {
        Row: {
          achieved_amount: number
          avatar_initials: string | null
          avg_response_minutes: number
          created_at: string
          csat: number
          department: string
          email: string
          full_name: string
          id: string
          leads_handled: number
          role_title: string
          shift: string
          status: string
          target_amount: number
          tickets_handled: number
          updated_at: string
        }
        Insert: {
          achieved_amount?: number
          avatar_initials?: string | null
          avg_response_minutes?: number
          created_at?: string
          csat?: number
          department?: string
          email: string
          full_name: string
          id?: string
          leads_handled?: number
          role_title?: string
          shift?: string
          status?: string
          target_amount?: number
          tickets_handled?: number
          updated_at?: string
        }
        Update: {
          achieved_amount?: number
          avatar_initials?: string | null
          avg_response_minutes?: number
          created_at?: string
          csat?: number
          department?: string
          email?: string
          full_name?: string
          id?: string
          leads_handled?: number
          role_title?: string
          shift?: string
          status?: string
          target_amount?: number
          tickets_handled?: number
          updated_at?: string
        }
        Relationships: []
      }
      territories: {
        Row: {
          business_density: string
          city: string
          code: string
          country: string
          created_at: string
          exclusivity: string
          id: string
          lat: number
          lng: number
          name: string
          overlapping_with: string[]
          population: number
          potential_score: number
          region: string
          state: string
          status: string
          updated_at: string
        }
        Insert: {
          business_density?: string
          city: string
          code: string
          country?: string
          created_at?: string
          exclusivity?: string
          id?: string
          lat?: number
          lng?: number
          name: string
          overlapping_with?: string[]
          population?: number
          potential_score?: number
          region: string
          state: string
          status?: string
          updated_at?: string
        }
        Update: {
          business_density?: string
          city?: string
          code?: string
          country?: string
          created_at?: string
          exclusivity?: string
          id?: string
          lat?: number
          lng?: number
          name?: string
          overlapping_with?: string[]
          population?: number
          potential_score?: number
          region?: string
          state?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      tm_activity: {
        Row: {
          action: string
          action_type: string
          actor_id: string | null
          actor_name: string
          actor_role: string
          created_at: string
          details: string | null
          from_value: string | null
          id: string
          meta: Json
          task_id: string | null
          to_value: string | null
          updated_at: string
        }
        Insert: {
          action: string
          action_type?: string
          actor_id?: string | null
          actor_name?: string
          actor_role?: string
          created_at?: string
          details?: string | null
          from_value?: string | null
          id?: string
          meta?: Json
          task_id?: string | null
          to_value?: string | null
          updated_at?: string
        }
        Update: {
          action?: string
          action_type?: string
          actor_id?: string | null
          actor_name?: string
          actor_role?: string
          created_at?: string
          details?: string | null
          from_value?: string | null
          id?: string
          meta?: Json
          task_id?: string | null
          to_value?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tm_activity_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tm_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tm_approvals: {
        Row: {
          approver_id: string | null
          approver_name: string
          created_at: string
          decided_at: string | null
          id: string
          position: number
          remarks: string | null
          stage: string
          status: string
          task_id: string
          updated_at: string
        }
        Insert: {
          approver_id?: string | null
          approver_name: string
          created_at?: string
          decided_at?: string | null
          id?: string
          position?: number
          remarks?: string | null
          stage?: string
          status?: string
          task_id: string
          updated_at?: string
        }
        Update: {
          approver_id?: string | null
          approver_name?: string
          created_at?: string
          decided_at?: string | null
          id?: string
          position?: number
          remarks?: string | null
          stage?: string
          status?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tm_approvals_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "tm_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tm_approvals_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tm_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tm_attachments: {
        Row: {
          created_at: string
          file_type: string
          id: string
          name: string
          size_kb: number
          task_id: string
          updated_at: string
          uploaded_by: string
          url: string
        }
        Insert: {
          created_at?: string
          file_type?: string
          id?: string
          name: string
          size_kb?: number
          task_id: string
          updated_at?: string
          uploaded_by?: string
          url?: string
        }
        Update: {
          created_at?: string
          file_type?: string
          id?: string
          name?: string
          size_kb?: number
          task_id?: string
          updated_at?: string
          uploaded_by?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "tm_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tm_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tm_automations: {
        Row: {
          action_config: Json
          action_type: string
          condition_json: Json
          created_at: string
          description: string
          enabled: boolean
          id: string
          last_run_at: string | null
          name: string
          run_count: number
          trigger_type: string
          updated_at: string
        }
        Insert: {
          action_config?: Json
          action_type: string
          condition_json?: Json
          created_at?: string
          description?: string
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          name: string
          run_count?: number
          trigger_type: string
          updated_at?: string
        }
        Update: {
          action_config?: Json
          action_type?: string
          condition_json?: Json
          created_at?: string
          description?: string
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          name?: string
          run_count?: number
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      tm_comments: {
        Row: {
          author_id: string | null
          author_name: string
          author_role: string
          created_at: string
          id: string
          is_system: boolean
          message: string
          task_id: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          author_name: string
          author_role?: string
          created_at?: string
          id?: string
          is_system?: boolean
          message: string
          task_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          author_name?: string
          author_role?: string
          created_at?: string
          id?: string
          is_system?: boolean
          message?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tm_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "tm_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tm_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tm_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tm_dependencies: {
        Row: {
          created_at: string
          dependency_type: string
          depends_on_task_id: string
          id: string
          status: string
          task_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dependency_type?: string
          depends_on_task_id: string
          id?: string
          status?: string
          task_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dependency_type?: string
          depends_on_task_id?: string
          id?: string
          status?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tm_dependencies_depends_on_task_id_fkey"
            columns: ["depends_on_task_id"]
            isOneToOne: false
            referencedRelation: "tm_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tm_dependencies_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tm_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tm_escalations: {
        Row: {
          created_at: string
          id: string
          level: number
          raised_by: string
          raised_to: string
          reason: string
          resolution: string | null
          resolved_at: string | null
          status: string
          task_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          level?: number
          raised_by?: string
          raised_to?: string
          reason: string
          resolution?: string | null
          resolved_at?: string | null
          status?: string
          task_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          level?: number
          raised_by?: string
          raised_to?: string
          reason?: string
          resolution?: string | null
          resolved_at?: string | null
          status?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tm_escalations_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tm_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tm_members: {
        Row: {
          active: boolean
          capacity_hours: number
          created_at: string
          department: string
          email: string
          full_name: string
          id: string
          role: string
          skills: string[]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          capacity_hours?: number
          created_at?: string
          department?: string
          email: string
          full_name: string
          id?: string
          role?: string
          skills?: string[]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          capacity_hours?: number
          created_at?: string
          department?: string
          email?: string
          full_name?: string
          id?: string
          role?: string
          skills?: string[]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      tm_notifications: {
        Row: {
          channel: string
          created_at: string
          id: string
          level: string
          message: string
          read: boolean
          task_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          channel?: string
          created_at?: string
          id?: string
          level?: string
          message: string
          read?: boolean
          task_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          level?: string
          message?: string
          read?: boolean
          task_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tm_notifications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tm_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tm_reviews: {
        Row: {
          created_at: string
          id: string
          quality_score: number
          remarks: string | null
          reviewer_id: string | null
          reviewer_name: string
          task_id: string
          timeliness_score: number
          updated_at: string
          verdict: string
        }
        Insert: {
          created_at?: string
          id?: string
          quality_score?: number
          remarks?: string | null
          reviewer_id?: string | null
          reviewer_name: string
          task_id: string
          timeliness_score?: number
          updated_at?: string
          verdict?: string
        }
        Update: {
          created_at?: string
          id?: string
          quality_score?: number
          remarks?: string | null
          reviewer_id?: string | null
          reviewer_name?: string
          task_id?: string
          timeliness_score?: number
          updated_at?: string
          verdict?: string
        }
        Relationships: [
          {
            foreignKeyName: "tm_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "tm_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tm_reviews_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tm_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tm_settings: {
        Row: {
          ai_review_enabled: boolean
          auto_assign: boolean
          auto_escalate: boolean
          buzzer_enabled: boolean
          buzzer_repeat_minutes: number
          critical_sla_hours: number
          default_sla_hours: number
          escalation_matrix: Json
          id: string
          require_approval: boolean
          singleton: boolean
          sla_warning_percent: number
          timezone: string
          updated_at: string
          working_hours_end: string
          working_hours_start: string
        }
        Insert: {
          ai_review_enabled?: boolean
          auto_assign?: boolean
          auto_escalate?: boolean
          buzzer_enabled?: boolean
          buzzer_repeat_minutes?: number
          critical_sla_hours?: number
          default_sla_hours?: number
          escalation_matrix?: Json
          id?: string
          require_approval?: boolean
          singleton?: boolean
          sla_warning_percent?: number
          timezone?: string
          updated_at?: string
          working_hours_end?: string
          working_hours_start?: string
        }
        Update: {
          ai_review_enabled?: boolean
          auto_assign?: boolean
          auto_escalate?: boolean
          buzzer_enabled?: boolean
          buzzer_repeat_minutes?: number
          critical_sla_hours?: number
          default_sla_hours?: number
          escalation_matrix?: Json
          id?: string
          require_approval?: boolean
          singleton?: boolean
          sla_warning_percent?: number
          timezone?: string
          updated_at?: string
          working_hours_end?: string
          working_hours_start?: string
        }
        Relationships: []
      }
      tm_subtasks: {
        Row: {
          completed: boolean
          created_at: string
          id: string
          position: number
          task_id: string
          title: string
          updated_at: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          id?: string
          position?: number
          task_id: string
          title: string
          updated_at?: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          id?: string
          position?: number
          task_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tm_subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tm_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tm_tasks: {
        Row: {
          accepted_at: string | null
          acknowledged_by: string | null
          actual_minutes: number
          ai_generated: boolean
          approval_status: string
          approved_at: string | null
          assigned_role: string | null
          assigned_to: string | null
          billable: boolean
          billing_status: string
          blocked_reason: string | null
          buzzer_acknowledged_at: string | null
          buzzer_active: boolean
          category: string
          claimed_at: string | null
          client_name: string | null
          closed_at: string | null
          code: string
          completed_at: string | null
          cost: number
          created_at: string
          created_by: string | null
          currency: string
          deadline: string | null
          description: string
          difficulty: string
          escalation_level: number
          estimated_hours: number
          hold_reason: string | null
          hold_until: string | null
          id: string
          invoice_reference: string | null
          metadata: Json
          module: string | null
          paused_at: string | null
          payment_reference: string | null
          priority: string
          progress: number
          project_name: string | null
          promised_at: string | null
          quality_score: number | null
          reviewed_at: string | null
          settled_at: string | null
          severity: string
          sla_hours: number
          sla_policy: string | null
          source_reference: string | null
          started_at: string | null
          status: string
          submitted_at: string | null
          tags: string[]
          task_type: string | null
          timer_running: boolean
          title: string
          total_paused_minutes: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          accepted_at?: string | null
          acknowledged_by?: string | null
          actual_minutes?: number
          ai_generated?: boolean
          approval_status?: string
          approved_at?: string | null
          assigned_role?: string | null
          assigned_to?: string | null
          billable?: boolean
          billing_status?: string
          blocked_reason?: string | null
          buzzer_acknowledged_at?: string | null
          buzzer_active?: boolean
          category?: string
          claimed_at?: string | null
          client_name?: string | null
          closed_at?: string | null
          code: string
          completed_at?: string | null
          cost?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          deadline?: string | null
          description?: string
          difficulty?: string
          escalation_level?: number
          estimated_hours?: number
          hold_reason?: string | null
          hold_until?: string | null
          id?: string
          invoice_reference?: string | null
          metadata?: Json
          module?: string | null
          paused_at?: string | null
          payment_reference?: string | null
          priority?: string
          progress?: number
          project_name?: string | null
          promised_at?: string | null
          quality_score?: number | null
          reviewed_at?: string | null
          settled_at?: string | null
          severity?: string
          sla_hours?: number
          sla_policy?: string | null
          source_reference?: string | null
          started_at?: string | null
          status?: string
          submitted_at?: string | null
          tags?: string[]
          task_type?: string | null
          timer_running?: boolean
          title: string
          total_paused_minutes?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          accepted_at?: string | null
          acknowledged_by?: string | null
          actual_minutes?: number
          ai_generated?: boolean
          approval_status?: string
          approved_at?: string | null
          assigned_role?: string | null
          assigned_to?: string | null
          billable?: boolean
          billing_status?: string
          blocked_reason?: string | null
          buzzer_acknowledged_at?: string | null
          buzzer_active?: boolean
          category?: string
          claimed_at?: string | null
          client_name?: string | null
          closed_at?: string | null
          code?: string
          completed_at?: string | null
          cost?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          deadline?: string | null
          description?: string
          difficulty?: string
          escalation_level?: number
          estimated_hours?: number
          hold_reason?: string | null
          hold_until?: string | null
          id?: string
          invoice_reference?: string | null
          metadata?: Json
          module?: string | null
          paused_at?: string | null
          payment_reference?: string | null
          priority?: string
          progress?: number
          project_name?: string | null
          promised_at?: string | null
          quality_score?: number | null
          reviewed_at?: string | null
          settled_at?: string | null
          severity?: string
          sla_hours?: number
          sla_policy?: string | null
          source_reference?: string | null
          started_at?: string | null
          status?: string
          submitted_at?: string | null
          tags?: string[]
          task_type?: string | null
          timer_running?: boolean
          title?: string
          total_paused_minutes?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tm_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "tm_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tm_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "tm_members"
            referencedColumns: ["id"]
          },
        ]
      }
      tm_time_logs: {
        Row: {
          action: string
          created_at: string
          ended_at: string | null
          id: string
          member_id: string | null
          note: string | null
          seconds: number
          started_at: string
          task_id: string
          updated_at: string
        }
        Insert: {
          action: string
          created_at?: string
          ended_at?: string | null
          id?: string
          member_id?: string | null
          note?: string | null
          seconds?: number
          started_at?: string
          task_id: string
          updated_at?: string
        }
        Update: {
          action?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          member_id?: string | null
          note?: string | null
          seconds?: number
          started_at?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tm_time_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "tm_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tm_time_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tm_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      trophies: {
        Row: {
          color: string | null
          conditions: Json
          created_at: string
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          image_url: string | null
          name: string
          slug: string
          status: Database["public"]["Enums"]["entity_status"]
          tier: Database["public"]["Enums"]["trophy_tier"]
          updated_at: string
        }
        Insert: {
          color?: string | null
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          name: string
          slug: string
          status?: Database["public"]["Enums"]["entity_status"]
          tier?: Database["public"]["Enums"]["trophy_tier"]
          updated_at?: string
        }
        Update: {
          color?: string | null
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          name?: string
          slug?: string
          status?: Database["public"]["Enums"]["entity_status"]
          tier?: Database["public"]["Enums"]["trophy_tier"]
          updated_at?: string
        }
        Relationships: []
      }
      trust_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          after_state: Json | null
          badge_key: string | null
          before_state: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          reason: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_state?: Json | null
          badge_key?: string | null
          before_state?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          reason?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_state?: Json | null
          badge_key?: string | null
          before_state?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trust_audit_logs_badge_key_fkey"
            columns: ["badge_key"]
            isOneToOne: false
            referencedRelation: "trust_badges"
            referencedColumns: ["key"]
          },
        ]
      }
      trust_badges: {
        Row: {
          created_at: string
          description: string
          display_locations: string[]
          enabled: boolean
          icon: string | null
          key: string
          label: string
          priority: number
          rule_summary: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          display_locations?: string[]
          enabled?: boolean
          icon?: string | null
          key: string
          label: string
          priority?: number
          rule_summary: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          display_locations?: string[]
          enabled?: boolean
          icon?: string | null
          key?: string
          label?: string
          priority?: number
          rule_summary?: string
          updated_at?: string
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
      user_achievements: {
        Row: {
          achievement_id: string
          id: string
          metadata: Json | null
          progress: number
          unlocked_at: string | null
          user_id: string
        }
        Insert: {
          achievement_id: string
          id?: string
          metadata?: Json | null
          progress?: number
          unlocked_at?: string | null
          user_id: string
        }
        Update: {
          achievement_id?: string
          id?: string
          metadata?: Json | null
          progress?: number
          unlocked_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      user_awards: {
        Row: {
          award_id: string
          claimed_at: string | null
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          award_id: string
          claimed_at?: string | null
          earned_at?: string
          id?: string
          user_id: string
        }
        Update: {
          award_id?: string
          claimed_at?: string | null
          earned_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_awards_award_id_fkey"
            columns: ["award_id"]
            isOneToOne: false
            referencedRelation: "awards"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_id: string
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string
          id?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_mission_progress: {
        Row: {
          completed_at: string | null
          id: string
          mission_id: string
          period_key: string | null
          progress: number
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          mission_id: string
          period_key?: string | null
          progress?: number
          user_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          mission_id?: string
          period_key?: string | null
          progress?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_mission_progress_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notifications: {
        Row: {
          action_label: string | null
          action_url: string | null
          created_at: string
          dismissed_at: string | null
          event_type: string | null
          id: string
          is_buzzer: boolean | null
          is_dismissed: boolean | null
          is_read: boolean | null
          message: string
          read_at: string | null
          role_target: string[] | null
          type: string
          user_id: string
        }
        Insert: {
          action_label?: string | null
          action_url?: string | null
          created_at?: string
          dismissed_at?: string | null
          event_type?: string | null
          id?: string
          is_buzzer?: boolean | null
          is_dismissed?: boolean | null
          is_read?: boolean | null
          message: string
          read_at?: string | null
          role_target?: string[] | null
          type: string
          user_id: string
        }
        Update: {
          action_label?: string | null
          action_url?: string | null
          created_at?: string
          dismissed_at?: string | null
          event_type?: string | null
          id?: string
          is_buzzer?: boolean | null
          is_dismissed?: boolean | null
          is_read?: boolean | null
          message?: string
          read_at?: string | null
          role_target?: string[] | null
          type?: string
          user_id?: string
        }
        Relationships: []
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
      user_streaks: {
        Row: {
          current_streak: number
          last_active_date: string | null
          longest_streak: number
          updated_at: string
          user_id: string
        }
        Insert: {
          current_streak?: number
          last_active_date?: string | null
          longest_streak?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          current_streak?: number
          last_active_date?: string | null
          longest_streak?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_trophies: {
        Row: {
          earned_at: string
          id: string
          trophy_id: string
          user_id: string
        }
        Insert: {
          earned_at?: string
          id?: string
          trophy_id: string
          user_id: string
        }
        Update: {
          earned_at?: string
          id?: string
          trophy_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_trophies_trophy_id_fkey"
            columns: ["trophy_id"]
            isOneToOne: false
            referencedRelation: "trophies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_xp: {
        Row: {
          current_level: number
          current_rank: number
          total_xp: number
          updated_at: string
          user_id: string
        }
        Insert: {
          current_level?: number
          current_rank?: number
          total_xp?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          current_level?: number
          current_rank?: number
          total_xp?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vala_tv_categories: {
        Row: {
          archived: boolean
          created_at: string
          id: string
          name: string
          position: number
          slug: string
          updated_at: string
          visible: boolean
        }
        Insert: {
          archived?: boolean
          created_at?: string
          id?: string
          name: string
          position?: number
          slug: string
          updated_at?: string
          visible?: boolean
        }
        Update: {
          archived?: boolean
          created_at?: string
          id?: string
          name?: string
          position?: number
          slug?: string
          updated_at?: string
          visible?: boolean
        }
        Relationships: []
      }
      vala_tv_videos: {
        Row: {
          category_id: string | null
          country: string | null
          created_at: string
          created_by: string | null
          description: string | null
          duration: string | null
          featured: boolean
          id: string
          language: string | null
          position: number
          product_id: string | null
          publish_at: string | null
          published_at: string | null
          seo_description: string | null
          seo_title: string | null
          status: string
          thumbnail_url: string | null
          title: string
          updated_at: string
          updated_by: string | null
          url: string | null
        }
        Insert: {
          category_id?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration?: string | null
          featured?: boolean
          id?: string
          language?: string | null
          position?: number
          product_id?: string | null
          publish_at?: string | null
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          status?: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
          url?: string | null
        }
        Update: {
          category_id?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration?: string | null
          featured?: boolean
          id?: string
          language?: string | null
          position?: number
          product_id?: string | null
          publish_at?: string | null
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          status?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vala_tv_videos_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "vala_tv_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vala_tv_videos_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      vala_tv_views: {
        Row: {
          completed: boolean
          created_at: string
          id: string
          session_id: string | null
          user_id: string | null
          video_id: string
          watched_ms: number | null
        }
        Insert: {
          completed?: boolean
          created_at?: string
          id?: string
          session_id?: string | null
          user_id?: string | null
          video_id: string
          watched_ms?: number | null
        }
        Update: {
          completed?: boolean
          created_at?: string
          id?: string
          session_id?: string | null
          user_id?: string | null
          video_id?: string
          watched_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vala_tv_views_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "vala_tv_videos"
            referencedColumns: ["id"]
          },
        ]
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
      wiki_articles: {
        Row: {
          body: string | null
          category: string
          created_at: string
          helpful_count: number
          id: string
          status: string
          summary: string | null
          title: string
          updated_at: string
          views: number
        }
        Insert: {
          body?: string | null
          category?: string
          created_at?: string
          helpful_count?: number
          id?: string
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
          views?: number
        }
        Update: {
          body?: string | null
          category?: string
          created_at?: string
          helpful_count?: number
          id?: string
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
          views?: number
        }
        Relationships: []
      }
      xp_rules: {
        Row: {
          conditions: Json
          cooldown_seconds: number | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          max_per_day: number | null
          multiplier: number
          name: string
          source_id: string | null
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
          xp_value: number
        }
        Insert: {
          conditions?: Json
          cooldown_seconds?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          max_per_day?: number | null
          multiplier?: number
          name: string
          source_id?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          xp_value?: number
        }
        Update: {
          conditions?: Json
          cooldown_seconds?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          max_per_day?: number | null
          multiplier?: number
          name?: string
          source_id?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          xp_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "xp_rules_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "xp_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      xp_sources: {
        Row: {
          created_at: string
          default_xp: number
          description: string | null
          id: string
          name: string
          slug: string
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_xp?: number
          description?: string | null
          id?: string
          name: string
          slug: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_xp?: number
          description?: string | null
          id?: string
          name?: string
          slug?: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: []
      }
      xp_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          metadata: Json | null
          reason: string | null
          rule_id: string | null
          source_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          metadata?: Json | null
          reason?: string | null
          rule_id?: string | null
          source_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          metadata?: Json | null
          reason?: string | null
          rule_id?: string | null
          source_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "xp_transactions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "xp_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_transactions_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "xp_sources"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      ai_content_audit_logs: {
        Row: {
          action: string | null
          actor: string | null
          actor_id: string | null
          actor_role: string | null
          after_state: Json | null
          before_state: Json | null
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string | null
          metadata: Json | null
          reason: string | null
        }
        Insert: {
          action?: string | null
          actor?: string | null
          actor_id?: string | null
          actor_role?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string | null
          metadata?: Json | null
          reason?: string | null
        }
        Update: {
          action?: string | null
          actor?: string | null
          actor_id?: string | null
          actor_role?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string | null
          metadata?: Json | null
          reason?: string | null
        }
        Relationships: []
      }
      founder_sales_agent_totals: {
        Row: {
          agent_id: string | null
          agent_key: string | null
          follow_ups_assigned: number | null
          follow_ups_completed: number | null
          follow_ups_overdue: number | null
          languages: string[] | null
          last_completed_at: string | null
          lifecycle: string | null
          market: string | null
          name: string | null
          region: string | null
          runs: number | null
          runs_verified: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      activate_reseller_membership: {
        Args: { p_actor: string; p_order_id: string }
        Returns: string
      }
      affiliate_dashboard_stats: { Args: never; Returns: Json }
      affiliate_top: {
        Args: { _limit?: number }
        Returns: {
          commission_cents: number
          conversions: number
          country: string
          display_name: string
          id: string
          revenue_cents: number
          status: string
        }[]
      }
      ams_asset_state: {
        Args: {
          p_claimed: boolean
          p_earned: boolean
          p_min_xp: number
          p_stage: number
          p_user: string
          p_xp: number
        }
        Returns: string
      }
      ams_claim_award: { Args: { p_award_slug: string }; Returns: Json }
      ams_evaluate_user: { Args: { p_user_id: string }; Returns: Json }
      ams_ingest_event: {
        Args: {
          p_entity_id?: string
          p_entity_type?: string
          p_event_key: string
          p_occurred_at?: string
          p_payload?: Json
          p_source?: string
          p_user_id: string
          p_value?: number
        }
        Returns: Json
      }
      ams_is_operator: { Args: never; Returns: boolean }
      ams_issue_awards: {
        Args: { p_role: string; p_stage: number; p_user_id: string }
        Returns: number
      }
      ams_recompute: { Args: { p_user_id: string }; Returns: Json }
      ams_role_chain: {
        Args: { p_role: string; p_user_id?: string }
        Returns: Json
      }
      ams_sweep: { Args: never; Returns: Json }
      application_staff: { Args: never; Returns: boolean }
      apply_gateway_payment: {
        Args: {
          p_amount: number
          p_brand?: string
          p_currency: string
          p_gateway: string
          p_intent_id?: string
          p_last4?: string
          p_order_id?: string
          p_payment_id: string
          p_status: string
        }
        Returns: Json
      }
      approve_influencer_earning: {
        Args: { p_earning_id: string }
        Returns: Json
      }
      assist_audit: {
        Args: {
          p_action: string
          p_new?: Json
          p_old?: Json
          p_reason?: string
          p_result?: string
          p_session_id?: string
          p_severity?: string
          p_target?: string
        }
        Returns: string
      }
      assist_can_see_session: {
        Args: { p_session_id: string }
        Returns: boolean
      }
      assist_decide_approval: {
        Args: { p_approval_id: string; p_decision: string; p_note?: string }
        Returns: Json
      }
      assist_emergency_stop: {
        Args: { p_all?: boolean; p_reason: string; p_session_id: string }
        Returns: Json
      }
      assist_grant_consent: { Args: { p_session_id: string }; Returns: Json }
      assist_is_agent: { Args: never; Returns: boolean }
      assist_is_operator: { Args: never; Returns: boolean }
      assist_request_from: {
        Args: {
          p_duration_minutes?: number
          p_priority?: string
          p_purpose: string
          p_scope?: string
          p_source_id: string
          p_source_module: string
          p_target_user_id: string
        }
        Returns: Json
      }
      assist_revoke_consent: {
        Args: { p_reason?: string; p_session_id: string }
        Returns: Json
      }
      assist_session_is_live: {
        Args: { p_session_id: string }
        Returns: boolean
      }
      assist_start_session: { Args: { p_session_id: string }; Returns: Json }
      assist_status_for: {
        Args: { p_module: string; p_record_id: string }
        Returns: Json
      }
      calculate_influencer_earning: {
        Args: { p_activity_id: string }
        Returns: Json
      }
      can_post_in_chat: {
        Args: { _conv: string; _user: string }
        Returns: boolean
      }
      claim_influencer_profile: { Args: never; Returns: Json }
      create_influencer_payout: {
        Args: {
          p_amount: number
          p_currency: string
          p_idempotency_key: string
          p_profile_id: string
        }
        Returns: Json
      }
      create_payment_intent: {
        Args: {
          p_amount: number
          p_currency?: string
          p_item_id: string
          p_item_type: string
        }
        Returns: Json
      }
      create_payment_intent_secure: {
        Args: {
          p_amount: number
          p_currency: string
          p_device_id: string
          p_idempotency_key: string
          p_item_id: string
          p_item_type: string
          p_session_id: string
          p_source_ip: string
        }
        Returns: Json
      }
      create_remote_assist_session: { Args: never; Returns: Json }
      create_reseller_membership_order: {
        Args: { p_idempotency_key: string; p_plan_code: string }
        Returns: Json
      }
      dev_manager_is_operator: { Args: never; Returns: boolean }
      end_remote_assist_session: {
        Args: { p_reason?: string; p_session_id: string }
        Returns: Json
      }
      finance_adjust_wallet_atomic: {
        Args: {
          p_actor: string
          p_amount: number
          p_entry_type: string
          p_reason: string
          p_reference: string
          p_wallet_id: string
        }
        Returns: {
          balance: number
          created_at: string
          currency: string
          id: string
          last_activity_at: string
          low_balance_threshold: number
          owner_code: string
          owner_name: string
          owner_type: string
          region: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "finance_wallets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      finance_is_operator: { Args: never; Returns: boolean }
      franchise_has_access: {
        Args: { p_franchise_id: string }
        Returns: boolean
      }
      franchise_is_admin: { Args: never; Returns: boolean }
      generate_session_code: { Args: never; Returns: string }
      generate_verification_code: { Args: never; Returns: string }
      get_my_permissions: { Args: never; Returns: Json }
      give_remote_assist_consent: {
        Args: { p_session_id: string }
        Returns: Json
      }
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
      i18n_claim_translation_jobs: {
        Args: { p_lease_seconds?: number; p_limit: number; p_worker: string }
        Returns: {
          attempts: number
          context: string | null
          context_hash: string
          created_at: string
          finished_at: string | null
          id: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          namespace: string
          priority: number
          quality_score: number | null
          refresh: boolean
          requested_by: string | null
          result_status: string | null
          run_after: string
          source_hash: string
          source_language: string
          source_text: string
          status: string
          target_language: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "i18n_translation_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      i18n_consume_quota: {
        Args: {
          p_limit: number
          p_subject: string
          p_units: number
          p_window_seconds: number
        }
        Returns: boolean
      }
      i18n_enqueue_translation_jobs: { Args: { p_jobs: Json }; Returns: number }
      i18n_finish_translation_job: {
        Args: {
          p_error: string
          p_id: string
          p_ok: boolean
          p_quality: number
          p_result_status: string
          p_worker: string
        }
        Returns: undefined
      }
      i18n_job_summary: {
        Args: never
        Returns: {
          jobs: number
          status: string
          target_language: string
        }[]
      }
      i18n_mark_stale: {
        Args: {
          p_context: string
          p_current_hashes: string[]
          p_namespace: string
        }
        Returns: number
      }
      i18n_prune: {
        Args: { p_job_days?: number; p_quota_hours?: number }
        Returns: {
          jobs_deleted: number
          quota_windows_deleted: number
        }[]
      }
      i18n_resolve_language: {
        Args: { p_input: string; p_legacy?: boolean }
        Returns: string
      }
      i18n_translation_coverage: {
        Args: never
        Returns: {
          legacy: number
          machine: number
          needs_review: number
          rejected: number
          target_language: string
          verified: number
        }[]
      }
      influencer_manager_access: { Args: never; Returns: boolean }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_chat_participant: {
        Args: { _conv: string; _user: string }
        Returns: boolean
      }
      is_crm_staff: { Args: { _user_id: string }; Returns: boolean }
      is_franchise_staff: { Args: never; Returns: boolean }
      is_participant: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      is_platform_operator: { Args: never; Returns: boolean }
      is_support_staff: { Args: { _user_id: string }; Returns: boolean }
      join_remote_assist_session: {
        Args: { p_session_code: string }
        Returns: Json
      }
      legal_gate_status: { Args: { p_user_id?: string }; Returns: Json }
      legal_is_operator: { Args: never; Returns: boolean }
      legal_is_reviewer: { Args: never; Returns: boolean }
      legal_log: {
        Args: {
          p_action: string
          p_entity_id?: string
          p_entity_type?: string
          p_new?: Json
          p_old?: Json
          p_reason?: string
          p_result?: string
          p_severity?: string
        }
        Returns: string
      }
      legal_pending_acceptances: {
        Args: { p_user_id?: string }
        Returns: {
          agreement_id: string
          agreement_name: string
          agreement_ref: string
          body: string
          body_sha256: string
          reason: string
          version: string
          version_id: string
        }[]
      }
      legal_publish_version: {
        Args: { p_reason?: string; p_version_id: string }
        Returns: Json
      }
      legal_record_acceptance: {
        Args: {
          p_decision?: string
          p_ip?: string
          p_scrolled_to_end?: boolean
          p_session_reference?: string
          p_user_agent?: string
          p_version_id: string
        }
        Returns: Json
      }
      list_my_payments: {
        Args: never
        Returns: {
          amount: number
          auto_verified: boolean
          brand: string | null
          country: string | null
          created_at: string
          currency: string | null
          deleted_at: string | null
          device_id: string | null
          gateway: string | null
          id: string
          intent_id: string | null
          item_id: string
          item_type: string
          last_checked_at: string | null
          last4: string | null
          mismatch_flag: boolean
          order_id: string | null
          payment_id: string | null
          payment_type: string
          reference_id: string
          retry_count: number
          screenshot: string | null
          source_ip: unknown
          status: string
          submitted_amount: number | null
          tags: string[]
          transaction_hash: string | null
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      log_safe_assist_ai_event: {
        Args: {
          p_analysis: Json
          p_auto_handle?: boolean
          p_event_type: string
          p_recommended_action: string
          p_risk_level: string
          p_session_id: string
        }
        Returns: string
      }
      marketing_audit: {
        Args: {
          p_action: string
          p_after?: Json
          p_before?: Json
          p_entity_id?: string
          p_entity_type: string
          p_module?: string
          p_result?: string
          p_severity?: string
        }
        Returns: string
      }
      marketing_is_operator: { Args: never; Returns: boolean }
      marketing_make_promise: {
        Args: {
          p_deadline: string
          p_entity_id: string
          p_entity_type: string
          p_priority?: string
          p_receiver: string
          p_title: string
        }
        Returns: Json
      }
      marketing_notify: {
        Args: {
          p_audience: string
          p_body: string
          p_entity_id?: string
          p_kind?: string
          p_title: string
        }
        Returns: number
      }
      marketing_open_task: {
        Args: {
          p_deadline?: string
          p_description?: string
          p_entity_id: string
          p_entity_type: string
          p_priority?: string
          p_title: string
        }
        Returns: Json
      }
      marketing_seed_summary: { Args: never; Returns: Json }
      marketplace_add_to_cart: {
        Args: {
          p_product_id: string
          p_quantity?: number
          p_variant_id?: string
        }
        Returns: Json
      }
      marketplace_cart_quote: { Args: never; Returns: Json }
      marketplace_countries: {
        Args: never
        Returns: {
          country: string
          product_count: number
        }[]
      }
      marketplace_country_categories: {
        Args: { target: string }
        Returns: {
          category_id: string
          category_name: string
          category_slug: string
          product_count: number
        }[]
      }
      marketplace_create_checkout: {
        Args: { p_idempotency_key: string }
        Returns: Json
      }
      marketplace_get_or_create_cart: { Args: never; Returns: string }
      marketplace_is_admin: { Args: never; Returns: boolean }
      marketplace_is_finance: { Args: never; Returns: boolean }
      marketplace_is_seller_member: {
        Args: { p_seller_id: string }
        Returns: boolean
      }
      marketplace_quote_product: { Args: { p_product: string }; Returns: Json }
      marketplace_record_commission_reversal: {
        Args: {
          p_amount: number
          p_commission_id: string
          p_reason?: string
          p_refund_id: string
        }
        Returns: string
      }
      marketplace_record_payment_event: {
        Args: {
          p_event_type: string
          p_payload?: Json
          p_payment_intent_id: string
          p_provider: string
          p_provider_event_id: string
          p_signature_verified: boolean
        }
        Returns: Json
      }
      mm_active_rows: {
        Args: { p_surface?: string }
        Returns: {
          category_id: string
          collection_key: string
          cta_href: string
          cta_label: string
          id: string
          item_limit: number
          key: string
          manual_product_ids: string[]
          row_type: string
          sort_by: string
          sort_order: number
          source: string
          subtitle: string
          title: string
        }[]
      }
      mm_ai_bulk_cancel: {
        Args: { p_job: string; p_reason?: string }
        Returns: Json
      }
      mm_ai_bulk_claim: {
        Args: { p_job: string; p_limit?: number }
        Returns: Json
      }
      mm_ai_bulk_create: {
        Args: {
          p_filters?: Json
          p_language?: string
          p_scope: string
          p_types: string[]
        }
        Returns: Json
      }
      mm_ai_bulk_mark: {
        Args: {
          p_error?: string
          p_generation?: string
          p_job: string
          p_product: string
          p_skip_reason?: string
          p_status: string
        }
        Returns: Json
      }
      mm_ai_bulk_retry: { Args: { p_job: string }; Returns: Json }
      mm_ai_can_approve: { Args: never; Returns: boolean }
      mm_ai_content_console: { Args: { p_query?: Json }; Returns: Json }
      mm_ai_context: { Args: { p_product: string }; Returns: Json }
      mm_ai_context_hash: { Args: { p_product: string }; Returns: string }
      mm_ai_duplicate_check: {
        Args: { p_product: string; p_text: string }
        Returns: Json
      }
      mm_ai_generation_finish: {
        Args: {
          p_error?: Json
          p_generation: string
          p_parsed?: Json
          p_raw?: Json
          p_status: string
          p_usage?: Json
        }
        Returns: Json
      }
      mm_ai_generation_start: {
        Args: {
          p_job?: string
          p_language?: string
          p_product: string
          p_types: string[]
        }
        Returns: Json
      }
      mm_ai_item_approve: {
        Args: { p_item: string; p_note?: string }
        Returns: Json
      }
      mm_ai_item_archive: {
        Args: { p_item: string; p_reason?: string }
        Returns: Json
      }
      mm_ai_item_edit: {
        Args: {
          p_content?: string
          p_item: string
          p_json?: Json
          p_note?: string
        }
        Returns: Json
      }
      mm_ai_item_publish: {
        Args: { p_auto?: boolean; p_item: string }
        Returns: Json
      }
      mm_ai_item_reject: {
        Args: { p_code: string; p_item: string; p_reason?: string }
        Returns: Json
      }
      mm_ai_item_submit: {
        Args: { p_item: string; p_note?: string }
        Returns: Json
      }
      mm_ai_item_unpublish: {
        Args: { p_item: string; p_reason?: string }
        Returns: Json
      }
      mm_ai_item_versions: { Args: { p_item: string }; Returns: Json }
      mm_ai_legal_decide: {
        Args: { p_item: string; p_reason?: string; p_to: string }
        Returns: Json
      }
      mm_ai_legal_scan: { Args: { p_text: string }; Returns: Json }
      mm_ai_products: { Args: { p_query?: Json }; Returns: Json }
      mm_ai_provider_binding: { Args: never; Returns: Json }
      mm_ai_settings_set: { Args: { p_patch: Json }; Returns: Json }
      mm_ai_usage_record: {
        Args: {
          p_model: string
          p_provider: string
          p_status: string
          p_usage: Json
        }
        Returns: undefined
      }
      mm_ai_validate: { Args: { p_item: string }; Returns: Json }
      mm_ai_version_rollback: {
        Args: { p_item: string; p_version: number }
        Returns: Json
      }
      mm_approval_rule_set: {
        Args: { p_key: string; p_patch: Json }
        Returns: Json
      }
      mm_approval_sla_run: { Args: never; Returns: Json }
      mm_approval_sla_set: { Args: { p_patch: Json }; Returns: Json }
      mm_attention_center: { Args: never; Returns: Json }
      mm_audience: {
        Args: { p_channel?: string; p_segment?: string }
        Returns: Json
      }
      mm_audit: {
        Args: {
          p_action: string
          p_after?: Json
          p_before?: Json
          p_entity_id?: string
          p_entity_type: string
          p_reason?: string
        }
        Returns: string
      }
      mm_brand_asset_verify: {
        Args: {
          p_key: string
          p_observed_bytes?: number
          p_observed_sha: string
        }
        Returns: Json
      }
      mm_brand_case_escalate: {
        Args: { p_case: string; p_reason: string }
        Returns: Json
      }
      mm_brand_detect: { Args: { p_product: string }; Returns: Json }
      mm_brand_enforce: {
        Args: { p_limit?: number; p_product?: string }
        Returns: Json
      }
      mm_brand_policy_set: { Args: { p_patch: Json }; Returns: Json }
      mm_brand_protection: { Args: { p_query?: Json }; Returns: Json }
      mm_brand_whitelist_decide: {
        Args: { p_id: string; p_reason?: string; p_to: string }
        Returns: Json
      }
      mm_brand_whitelist_expire: { Args: never; Returns: Json }
      mm_brand_whitelist_request: {
        Args: {
          p_expires?: string
          p_product: string
          p_reason: string
          p_rule: string
        }
        Returns: Json
      }
      mm_campaign_allowed: {
        Args: { p_from: string; p_to: string }
        Returns: boolean
      }
      mm_campaign_transition: {
        Args: { p_id: string; p_reason?: string; p_to: string }
        Returns: Json
      }
      mm_card_coverage: { Args: never; Returns: Json }
      mm_card_field_set: {
        Args: { p_enabled: boolean; p_key: string }
        Returns: Json
      }
      mm_card_fields: { Args: never; Returns: Json }
      mm_card_reorder: {
        Args: { p_keys: string[]; p_kind: string }
        Returns: Json
      }
      mm_catalog_audit: { Args: { p_limit?: number }; Returns: Json }
      mm_consent_set: {
        Args: {
          p_channel: string
          p_granted: boolean
          p_source?: string
          p_user: string
        }
        Returns: Json
      }
      mm_customer_profile: { Args: { p_user: string }; Returns: Json }
      mm_customers: { Args: { p_query?: Json }; Returns: Json }
      mm_customers_overview: { Args: never; Returns: Json }
      mm_dashboard: { Args: never; Returns: Json }
      mm_demo_domains: { Args: { p_query?: Json }; Returns: Json }
      mm_demo_eligibility: { Args: { p_product: string }; Returns: Json }
      mm_demo_expiry_run: { Args: never; Returns: Json }
      mm_demo_operation: {
        Args: { p_demo: string; p_op: string; p_reason?: string }
        Returns: Json
      }
      mm_demo_password_set: {
        Args: { p_demo: string; p_password: string }
        Returns: Json
      }
      mm_demo_provider_status: { Args: never; Returns: Json }
      mm_demo_provision: {
        Args: { p_pattern?: string; p_product: string }
        Returns: Json
      }
      mm_demo_settings_set: { Args: { p_patch: Json }; Returns: Json }
      mm_demo_slug: { Args: { p_product: string }; Returns: Json }
      mm_dispute_open: {
        Args: { p_amount?: number; p_order_id: string; p_reason: string }
        Returns: Json
      }
      mm_dispute_resolve: {
        Args: { p_dispute_id: string; p_resolution: string; p_status: string }
        Returns: Json
      }
      mm_duplicate_decide: {
        Args: { p_candidate: string; p_decision: string; p_reason?: string }
        Returns: Json
      }
      mm_duplicate_scan: { Args: { p_threshold?: number }; Returns: Json }
      mm_faq_facts: { Args: never; Returns: Json }
      mm_faq_rollback: {
        Args: { p_id: string; p_version: number }
        Returns: Json
      }
      mm_faq_save: { Args: { p_patch: Json }; Returns: Json }
      mm_faq_transition: {
        Args: { p_id: string; p_reason?: string; p_to: string; p_when?: string }
        Returns: Json
      }
      mm_faqs: { Args: { p_query?: Json }; Returns: Json }
      mm_filter_set: { Args: { p_key: string; p_patch: Json }; Returns: Json }
      mm_filter_values: { Args: { p_key: string }; Returns: Json }
      mm_filters: { Args: never; Returns: Json }
      mm_health_checks: {
        Args: never
        Returns: {
          affected: number
          check_key: string
          destination: string
          label: string
          sample_ids: string[]
          severity: string
        }[]
      }
      mm_homepage_sections: { Args: never; Returns: Json }
      mm_influencer_code_create: {
        Args: { p_code?: string; p_profile: string }
        Returns: Json
      }
      mm_influencer_status: {
        Args: { p_profile: string; p_reason?: string; p_to: string }
        Returns: Json
      }
      mm_influencers: { Args: { p_query?: Json }; Returns: Json }
      mm_is_operator: { Args: never; Returns: boolean }
      mm_issue_for_order: { Args: { p_order_id: string }; Returns: Json }
      mm_license_overview: { Args: { p_window?: string }; Returns: Json }
      mm_marketing_summary: { Args: never; Returns: Json }
      mm_marketplace_score: { Args: never; Returns: Json }
      mm_moderation: { Args: { p_query?: Json }; Returns: Json }
      mm_moderation_policy_set: { Args: { p_patch: Json }; Returns: Json }
      mm_new_license_key: { Args: never; Returns: string }
      mm_notification_channels: { Args: never; Returns: Json }
      mm_notification_read: {
        Args: { p_dismiss?: boolean; p_id: string }
        Returns: Json
      }
      mm_notifications: { Args: { p_limit?: number }; Returns: Json }
      mm_notify: {
        Args: {
          p_action_label?: string
          p_action_url?: string
          p_dedupe_minutes?: number
          p_event: string
          p_message: string
          p_role_target?: string[]
          p_severity?: string
          p_title: string
          p_user?: string
        }
        Returns: Json
      }
      mm_offer_is_live: { Args: { p_id: string }; Returns: boolean }
      mm_offer_save: { Args: { p_patch: Json }; Returns: Json }
      mm_offer_transition: {
        Args: { p_id: string; p_reason?: string; p_to: string }
        Returns: Json
      }
      mm_offers: { Args: { p_query?: Json }; Returns: Json }
      mm_order_detail: { Args: { p_order_id: string }; Returns: Json }
      mm_order_docs: {
        Args: { p_limit?: number; p_tab: string }
        Returns: Json
      }
      mm_orders_list: { Args: { p_query?: Json }; Returns: Json }
      mm_product_checks: { Args: { p_product: string }; Returns: Json }
      mm_product_clone: { Args: { p_id: string }; Returns: Json }
      mm_product_content: { Args: { p_slug: string }; Returns: Json }
      mm_product_is_public: { Args: { p_product: string }; Returns: boolean }
      mm_product_merge: {
        Args: {
          p_candidate?: string
          p_canonical: string
          p_duplicate: string
          p_reason: string
        }
        Returns: Json
      }
      mm_product_moderate: {
        Args: {
          p_evidence?: Json
          p_id: string
          p_lock?: number
          p_reason?: string
          p_to: string
        }
        Returns: Json
      }
      mm_product_moderation_detail: { Args: { p_id: string }; Returns: Json }
      mm_product_purge_execute: { Args: { p_request: string }; Returns: Json }
      mm_product_purge_request: {
        Args: { p_id: string; p_reason: string }
        Returns: Json
      }
      mm_product_rating_refresh: { Args: { p_product: string }; Returns: Json }
      mm_product_report: {
        Args: {
          p_detail?: string
          p_product: string
          p_reason: string
          p_severity?: string
        }
        Returns: Json
      }
      mm_product_share: { Args: { p_product: string }; Returns: Json }
      mm_product_urls: { Args: { p_query?: Json }; Returns: Json }
      mm_products_bulk: {
        Args: {
          p_ids: string[]
          p_op: string
          p_reason?: string
          p_target?: string
        }
        Returns: Json
      }
      mm_qr_create: {
        Args: { p_product: string; p_short_link?: string }
        Returns: Json
      }
      mm_qr_scan: {
        Args: {
          p_browser?: string
          p_campaign?: string
          p_country?: string
          p_device?: string
          p_qr_code: string
          p_visitor_hash?: string
        }
        Returns: Json
      }
      mm_recommend: {
        Args: { p_key: string; p_limit?: number; p_product_id?: string }
        Returns: Json
      }
      mm_recommendation_configure: {
        Args: { p_key: string; p_patch: Json }
        Returns: Json
      }
      mm_recommendation_engines: { Args: never; Returns: Json }
      mm_refund_request: {
        Args: { p_amount: number; p_order_id: string; p_reason: string }
        Returns: Json
      }
      mm_release_overview: { Args: never; Returns: Json }
      mm_report_transition: {
        Args: {
          p_escalate_legal?: boolean
          p_report: string
          p_resolution?: string
          p_to: string
        }
        Returns: Json
      }
      mm_reseller_attention: { Args: never; Returns: Json }
      mm_reseller_code_create: {
        Args: { p_code?: string; p_id: string }
        Returns: Json
      }
      mm_reseller_detail: { Args: { p_id: string }; Returns: Json }
      mm_reseller_earnings_release: { Args: { p_id?: string }; Returns: Json }
      mm_reseller_operator: { Args: never; Returns: boolean }
      mm_reseller_payout_create: {
        Args: { p_id: string; p_reason?: string }
        Returns: Json
      }
      mm_reseller_payout_status: {
        Args: {
          p_payout: string
          p_reason?: string
          p_reference?: string
          p_to: string
        }
        Returns: Json
      }
      mm_reseller_plan: {
        Args: { p_id: string; p_plan: string; p_reason?: string }
        Returns: Json
      }
      mm_reseller_schedule_set: { Args: { p_patch: Json }; Returns: Json }
      mm_reseller_status: {
        Args: { p_id: string; p_reason?: string; p_to: string }
        Returns: Json
      }
      mm_resellers: { Args: { p_query?: Json }; Returns: Json }
      mm_review_analytics: { Args: { p_days?: number }; Returns: Json }
      mm_review_moderate: {
        Args: { p_id: string; p_note?: string; p_to: string }
        Returns: Json
      }
      mm_review_reply: {
        Args: { p_content: string; p_review: string; p_role?: string }
        Returns: Json
      }
      mm_review_report_resolve: {
        Args: { p_report: string; p_resolution: string; p_to: string }
        Returns: Json
      }
      mm_reviews: { Args: { p_query?: Json }; Returns: Json }
      mm_row_analytics: { Args: { p_key: string }; Returns: Json }
      mm_row_configure: {
        Args: { p_key: string; p_patch: Json }
        Returns: Json
      }
      mm_row_create: { Args: { p_spec: Json }; Returns: Json }
      mm_row_duplicate: { Args: { p_row_id: string }; Returns: Json }
      mm_row_is_live: { Args: { p_key: string }; Returns: boolean }
      mm_row_products: { Args: { p_key: string }; Returns: Json }
      mm_row_reorder: { Args: { p_ordered_ids: string[] }; Returns: Json }
      mm_row_resolve: {
        Args: { p_key: string }
        Returns: {
          allow_cross: boolean
          allow_dupes: boolean
          auto_rule: string
          category_id: string
          ends_at: string
          hidden: boolean
          kind: string
          max_products: number
          row_id: string
          source_mode: string
          starts_at: string
          status: string
          title: string
        }[]
      }
      mm_row_set_status: {
        Args: { p_reason?: string; p_row_id: string; p_status: string }
        Returns: Json
      }
      mm_rows_list: { Args: never; Returns: Json }
      mm_rows_reorder: { Args: { p_keys: string[] }; Returns: Json }
      mm_sandbox_activity: {
        Args: {
          p_kind?: string
          p_latency?: number
          p_path?: string
          p_sandbox: string
          p_status?: number
        }
        Returns: Json
      }
      mm_sandbox_capabilities: { Args: never; Returns: Json }
      mm_sandbox_cleanup_run: { Args: never; Returns: Json }
      mm_sandbox_create: { Args: { p_demo: string }; Returns: Json }
      mm_sandbox_expiry_run: { Args: never; Returns: Json }
      mm_sandbox_extend: {
        Args: { p_hours: number; p_sandbox: string }
        Returns: Json
      }
      mm_sandbox_reset: {
        Args: { p_sandbox: string; p_trigger?: string }
        Returns: Json
      }
      mm_sandbox_rotate_credential: {
        Args: { p_role: string; p_sandbox: string }
        Returns: Json
      }
      mm_sandbox_settings_set: { Args: { p_patch: Json }; Returns: Json }
      mm_sandbox_sync: { Args: { p_demo: string }; Returns: Json }
      mm_sandboxes: { Args: { p_query?: Json }; Returns: Json }
      mm_section_set_enabled: {
        Args: { p_enabled: boolean; p_key: string }
        Returns: Json
      }
      mm_sections_reorder: { Args: { p_order: Json }; Returns: number }
      mm_security_finding_add: {
        Args: {
          p_category: string
          p_confidence?: number
          p_evidence?: Json
          p_job: string
          p_result: string
          p_severity?: string
          p_source?: string
          p_title: string
        }
        Returns: Json
      }
      mm_security_provider_status: { Args: never; Returns: Json }
      mm_security_quarantine_decide: {
        Args: {
          p_asset: string
          p_discard_payload?: boolean
          p_reason: string
          p_to: string
        }
        Returns: Json
      }
      mm_security_scan_error: {
        Args: { p_category: string; p_detail: string; p_job: string }
        Returns: Json
      }
      mm_security_scan_finish: { Args: { p_job: string }; Returns: Json }
      mm_security_scan_start: {
        Args: { p_asset: string; p_reuse?: boolean }
        Returns: Json
      }
      mm_seller_commission_set: {
        Args: {
          p_currency?: string
          p_fixed?: number
          p_rate: number
          p_reason?: string
          p_seller: string
        }
        Returns: Json
      }
      mm_seller_detail: { Args: { p_id: string }; Returns: Json }
      mm_seller_earnings_release: { Args: { p_seller?: string }; Returns: Json }
      mm_seller_kind: { Args: { p_id: string; p_kind: string }; Returns: Json }
      mm_seller_operator: { Args: never; Returns: boolean }
      mm_seller_payout_create: {
        Args: { p_reason?: string; p_seller: string }
        Returns: Json
      }
      mm_seller_payout_status: {
        Args: {
          p_id: string
          p_reason?: string
          p_reference?: string
          p_to: string
        }
        Returns: Json
      }
      mm_seller_schedule_set: { Args: { p_patch: Json }; Returns: Json }
      mm_seller_status: {
        Args: { p_id: string; p_reason?: string; p_to: string }
        Returns: Json
      }
      mm_sellers: { Args: { p_query?: Json }; Returns: Json }
      mm_seo_health: { Args: never; Returns: Json }
      mm_share_record: {
        Args: { p_channel: string; p_kind?: string; p_product: string }
        Returns: Json
      }
      mm_short_link_create: {
        Args: { p_campaign?: string; p_product: string }
        Returns: Json
      }
      mm_short_link_resolve: {
        Args: {
          p_browser?: string
          p_code: string
          p_country?: string
          p_device?: string
          p_referrer?: string
          p_utm?: Json
          p_visitor_hash?: string
        }
        Returns: Json
      }
      mm_short_link_url: { Args: { p_code: string }; Returns: string }
      mm_slot_assign: {
        Args: {
          p_key: string
          p_override?: boolean
          p_position: number
          p_product_id: string
        }
        Returns: Json
      }
      mm_slot_move: {
        Args: { p_from: number; p_key: string; p_to: number }
        Returns: Json
      }
      mm_slot_pin: {
        Args: { p_key: string; p_pinned: boolean; p_position: number }
        Returns: Json
      }
      mm_slot_remove: {
        Args: { p_key: string; p_position: number }
        Returns: Json
      }
      mm_submission_checks: { Args: { p_submission: string }; Returns: Json }
      mm_submission_create: {
        Args: { p_product: string; p_type?: string; p_version?: string }
        Returns: Json
      }
      mm_submission_detail: { Args: { p_id: string }; Returns: Json }
      mm_submission_evidence_add: {
        Args: {
          p_detail?: string
          p_kind: string
          p_label: string
          p_submission: string
          p_url?: string
        }
        Returns: Json
      }
      mm_submission_risk: { Args: { p_submission: string }; Returns: Json }
      mm_submission_risk_refresh: {
        Args: { p_submission: string }
        Returns: Json
      }
      mm_submission_transition: {
        Args: {
          p_comment?: string
          p_id: string
          p_lock?: number
          p_override?: boolean
          p_reason?: string
          p_to: string
        }
        Returns: Json
      }
      mm_submissions: { Args: { p_query?: Json }; Returns: Json }
      mm_submissions_bulk: {
        Args: { p_ids: string[]; p_reason?: string; p_to: string }
        Returns: Json
      }
      mm_topbar_configure: {
        Args: { p_key: string; p_patch: Json }
        Returns: Json
      }
      mm_topbar_modules: { Args: never; Returns: Json }
      mm_topbar_reorder: { Args: { p_keys: string[] }; Returns: Json }
      mm_trust_badge_set: {
        Args: { p_key: string; p_patch: Json }
        Returns: Json
      }
      mm_trust_badges: { Args: never; Returns: Json }
      mm_url_bulk: {
        Args: {
          p_batch?: number
          p_ids?: string[]
          p_job?: string
          p_scope?: string
        }
        Returns: Json
      }
      mm_url_generate: {
        Args: { p_correlation?: string; p_product: string; p_reason?: string }
        Returns: Json
      }
      mm_url_path: {
        Args: { p_product: string; p_slug: string }
        Returns: Json
      }
      mm_url_resolve: { Args: { p_path: string }; Returns: Json }
      mm_url_settings_set: { Args: { p_patch: Json }; Returns: Json }
      mm_url_slugify: {
        Args: { p_product?: string; p_text: string }
        Returns: Json
      }
      mm_vala_tv: { Args: never; Returns: Json }
      mm_vala_tv_save: { Args: { p_patch: Json }; Returns: Json }
      mm_vala_tv_status: {
        Args: { p_id: string; p_reason?: string; p_to: string }
        Returns: Json
      }
      my_saved_products: {
        Args: { _list?: string }
        Returns: {
          created_at: string
          icon: string
          id: string
          industry_label: string
          name: string
          price_label: string
          product_id: string
          product_slug: string
          visible: boolean
        }[]
      }
      owns_partner: {
        Args: {
          _kind: Database["public"]["Enums"]["partner_kind"]
          _partner_id: string
        }
        Returns: boolean
      }
      partner_earnings_summary: {
        Args: {
          _kind: Database["public"]["Enums"]["partner_kind"]
          _partner_id: string
        }
        Returns: Json
      }
      payment_admin_refund: {
        Args: { p_payment_id: string; p_reason: string }
        Returns: Json
      }
      payment_gate_is_open: {
        Args: { p_country?: string; p_method?: string }
        Returns: boolean
      }
      payment_intent_amount: {
        Args: { p_item_id: string; p_item_type: string }
        Returns: number
      }
      process_payment_success_events: {
        Args: { p_limit?: number }
        Returns: Json
      }
      pt_allowed_transitions: { Args: { p_from: string }; Returns: string[] }
      pt_apply_fine: {
        Args: {
          p_actor?: string
          p_basis?: number
          p_note?: string
          p_promise_id: string
          p_rule_id: string
        }
        Returns: Json
      }
      pt_apply_insight: {
        Args: { p_action?: string; p_insight_id: string }
        Returns: Json
      }
      pt_audit: {
        Args: {
          p_action: string
          p_details?: string
          p_new?: string
          p_old?: string
          p_promise_id?: string
          p_source?: string
          p_system?: boolean
        }
        Returns: string
      }
      pt_business_minutes: {
        Args: { p_from: string; p_to: string }
        Returns: number
      }
      pt_can_see_promise: { Args: { p_promise_id: string }; Returns: boolean }
      pt_decide_approval: {
        Args: { p_decision: string; p_note?: string; p_promise_id: string }
        Returns: Json
      }
      pt_dismiss_insight: {
        Args: { p_insight_id: string; p_reason?: string }
        Returns: Json
      }
      pt_escalate: {
        Args: {
          p_level: number
          p_promise_id: string
          p_raised_by?: string
          p_reason?: string
        }
        Returns: Json
      }
      pt_escalation_label: { Args: { p_level: number }; Returns: string }
      pt_is_manager: { Args: never; Returns: boolean }
      pt_is_operator: { Args: never; Returns: boolean }
      pt_link: {
        Args: {
          p_label?: string
          p_module: string
          p_promise_id: string
          p_record_id: string
          p_relation?: string
        }
        Returns: Json
      }
      pt_next_code: { Args: never; Returns: string }
      pt_notify: {
        Args: {
          p_audience: string
          p_body: string
          p_kind?: string
          p_promise_id: string
          p_title: string
        }
        Returns: number
      }
      pt_owner_scorecard: { Args: { p_user_id: string }; Returns: Json }
      pt_promises_for: {
        Args: { p_module: string; p_record_id: string }
        Returns: {
          code: string
          deadline: string
          escalation_level: number
          fine_amount: number
          owner: string
          priority: string
          promise_id: string
          receiver: string
          relation: string
          status: string
          tip_amount: number
          title: string
        }[]
      }
      pt_prune_health_events: { Args: never; Returns: undefined }
      pt_release_tip: {
        Args: {
          p_actor?: string
          p_basis?: number
          p_note?: string
          p_promise_id: string
          p_rule_id: string
        }
        Returns: Json
      }
      pt_resolve_identity: { Args: { p_needle: string }; Returns: string }
      pt_rule_amount:
        | {
            Args: {
              p_basis: number
              p_rule: Database["public"]["Tables"]["promise_rules"]["Row"]
            }
            Returns: number
          }
        | {
            Args: {
              p_basis: number
              p_delay_days?: number
              p_rule: Database["public"]["Tables"]["promise_rules"]["Row"]
            }
            Returns: number
          }
      pt_sweep: { Args: never; Returns: Json }
      pt_task_completed: { Args: { p_task_id: string }; Returns: Json }
      reconcile_payment_intents: { Args: never; Returns: Json }
      reseller_commissions_for_order: {
        Args: { p_order: string }
        Returns: Json
      }
      reseller_commissions_reverse: {
        Args: { p_order: string; p_reason?: string }
        Returns: Json
      }
      reseller_discount_amount: {
        Args: { p_amount: number; p_percent: number }
        Returns: number
      }
      reseller_is_finance: { Args: never; Returns: boolean }
      reseller_owned_by_user: {
        Args: { _reseller_id: string; _user_id: string }
        Returns: boolean
      }
      reseller_pricing_for: { Args: { p_user: string }; Returns: Json }
      reseller_rate_for: {
        Args: { p_category: string; p_product: string; p_reseller: string }
        Returns: Json
      }
      reverse_partner_commission: {
        Args: { _id: string; _reason: string }
        Returns: Json
      }
      review_developer_submission: {
        Args: { _decision: string; _notes: string; _submission_id: string }
        Returns: Json
      }
      review_franchise_application: {
        Args: { p_id: string; p_notes?: string; p_status: string }
        Returns: Json
      }
      review_influencer_application: {
        Args: {
          p_application_id: string
          p_rejection_reason?: string
          p_status: string
        }
        Returns: Json
      }
      role_application_missing: {
        Args: { p_application: Json; p_required: string[] }
        Returns: string[]
      }
      server_is_operator: { Args: never; Returns: boolean }
      set_default_payment_method: {
        Args: { p_method_id: string }
        Returns: Json
      }
      sf_active_offers: { Args: never; Returns: Json }
      sf_config_draft: { Args: { p_kind: string }; Returns: Json }
      sf_config_live: { Args: { p_kind: string }; Returns: Json }
      sf_faq_schema: { Args: never; Returns: Json }
      sf_faqs: { Args: never; Returns: Json }
      sf_floating_save: {
        Args: { p_key: string; p_patch: Json }
        Returns: Json
      }
      sf_footer_link_remove: {
        Args: { p_hard?: boolean; p_id: string }
        Returns: Json
      }
      sf_footer_link_save: { Args: { p_patch: Json }; Returns: Json }
      sf_footer_links_reorder: {
        Args: { p_column_id: string; p_ids: string[] }
        Returns: Json
      }
      sf_footer_settings_save: { Args: { p_patch: Json }; Returns: Json }
      sf_legal_href: { Args: { p_policy_type: string }; Returns: string }
      sf_publish: { Args: { p_kind: string; p_note?: string }; Returns: Json }
      sf_rollback: {
        Args: { p_kind: string; p_version: number }
        Returns: Json
      }
      sf_social_save: { Args: { p_patch: Json }; Returns: Json }
      sf_trust_save: { Args: { p_patch: Json }; Returns: Json }
      sf_vala_tv: { Args: never; Returns: Json }
      sf_vala_tv_view: {
        Args: {
          p_completed?: boolean
          p_session: string
          p_video: string
          p_watched_ms?: number
        }
        Returns: Json
      }
      sf_validate: { Args: { p_kind: string }; Returns: Json }
      sf_versions: { Args: { p_kind: string; p_limit?: number }; Returns: Json }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      submit_franchise_application: {
        Args: { p_application: Json }
        Returns: Json
      }
      submit_influencer_application: {
        Args: {
          p_agreement_accepted: boolean
          p_consent_accepted: boolean
          p_content_types: string[]
          p_country: string
          p_email: string
          p_engagement_rate: number
          p_followers: number
          p_full_name: string
          p_niche: string
          p_payment_details: Json
          p_phone: string
          p_region: string
          p_social_profiles: Json
          p_tax_details: Json
          p_terms_accepted: boolean
        }
        Returns: Json
      }
      submit_payment_proof: {
        Args: {
          p_amount: number
          p_country?: string
          p_currency: string
          p_intent_id: string
          p_method: string
          p_reference_id: string
          p_screenshot: string
        }
        Returns: Json
      }
      submit_payment_proof_secure: {
        Args: {
          p_amount: number
          p_currency: string
          p_device_id: string
          p_intent_id: string
          p_method: string
          p_reference_id: string
          p_screenshot: string
          p_session_id: string
          p_source_ip: string
        }
        Returns: Json
      }
      submit_reseller_application: {
        Args: { p_application: Json }
        Returns: Json
      }
      submit_reseller_membership_payment: {
        Args: {
          p_order_id: string
          p_proof?: string
          p_rail_code: string
          p_reference: string
        }
        Returns: Json
      }
      submit_seller_application: {
        Args: { p_application: Json; p_kind: string }
        Returns: Json
      }
      submit_unified_payment: {
        Args: {
          p_amount: number
          p_item_id: string
          p_item_type: string
          p_method: string
          p_reference_id: string
          p_screenshot: string
        }
        Returns: Json
      }
      tm_allowed_transitions: { Args: { p_from: string }; Returns: string[] }
      tm_assignment_candidates: {
        Args: { p_task_id: string }
        Returns: {
          available: boolean
          capacity_hours: number
          committed_hours: number
          department: string
          full_name: string
          load_percent: number
          member_id: string
          open_tasks: number
          reasons: string[]
          role: string
          role_matches: boolean
          score: number
          skill_matches: string[]
          skills: string[]
        }[]
      }
      tm_claim_task: { Args: { p_task_id: string }; Returns: Json }
      tm_condition_matches: {
        Args: { p_condition: Json; p_task: Json }
        Returns: boolean
      }
      tm_dependency_would_cycle: {
        Args: { p_depends_on: string; p_task: string }
        Returns: boolean
      }
      tm_developer_for_member: {
        Args: { p_member_id: string }
        Returns: string
      }
      tm_is_operator: { Args: never; Returns: boolean }
      tm_member_for_developer: {
        Args: { p_developer_id: string }
        Returns: string
      }
      tm_my_member_id: { Args: never; Returns: string }
      tm_open_developer_task: {
        Args: {
          p_amount?: number
          p_deadline?: string
          p_description?: string
          p_developer_id?: string
          p_module?: string
          p_priority?: string
          p_title: string
        }
        Returns: Json
      }
      tm_pool_statuses: { Args: never; Returns: string[] }
      tm_route_task: {
        Args: { p_role: string; p_task_id: string }
        Returns: Json
      }
      tm_run_automations: {
        Args: { p_task_id: string; p_trigger: string }
        Returns: Json
      }
      tm_sla_state: { Args: { p_task_id: string }; Returns: Json }
      tm_sla_sweep: { Args: never; Returns: Json }
      tm_status_from_developer: { Args: { p: string }; Returns: string }
      tm_status_to_developer: { Args: { p: string }; Returns: string }
      tm_task_blockers: {
        Args: { p_task_id: string }
        Returns: {
          blocking_code: string
          blocking_status: string
          blocking_task_id: string
          blocking_title: string
          dependency_id: string
          dependency_type: string
          resolved: boolean
        }[]
      }
      toggle_saved_product: {
        Args: { _list?: string; _product_id?: string; _product_slug: string }
        Returns: Json
      }
      trust_evaluate: {
        Args: { p_product: string; p_surface?: string }
        Returns: Json
      }
      uuid_v7: { Args: never; Returns: string }
      verify_reseller_membership_payment: {
        Args: {
          p_order_id: string
          p_provider_reference?: string
          p_status: string
        }
        Returns: Json
      }
      verify_safe_assist_connection: {
        Args: {
          p_agent_code: string
          p_is_agent: boolean
          p_session_id: string
          p_user_code: string
        }
        Returns: Json
      }
    }
    Enums: {
      agent_status: "online" | "busy" | "offline"
      ams_chat_channel:
        | "support"
        | "developer"
        | "qa"
        | "boss"
        | "ai"
        | "customer"
      ams_event_kind:
        | "created"
        | "updated"
        | "status_changed"
        | "assigned"
        | "reassigned"
        | "transferred"
        | "commented"
        | "internal_note"
        | "escalated"
        | "resolved"
        | "closed"
        | "reopened"
        | "archived"
        | "restored"
        | "attachment_added"
        | "attachment_removed"
      ams_priority: "low" | "medium" | "high" | "critical"
      ams_status:
        | "draft"
        | "submitted"
        | "assigned"
        | "accepted"
        | "in_progress"
        | "waiting_customer"
        | "waiting_developer"
        | "waiting_qa"
        | "testing"
        | "resolved"
        | "closed"
        | "reopened"
        | "cancelled"
        | "archived"
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
        | "boss_owner"
        | "super_admin"
        | "sales_support_manager"
        | "client"
        | "legal"
      claim_status: "pending" | "approved" | "rejected" | "fulfilled"
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
      entity_status: "active" | "inactive" | "archived" | "draft"
      founder_actor: "HUMAN" | "AI" | "SYSTEM" | "EXTERNAL"
      founder_confidence: "MEASURED" | "ESTIMATED" | "STALE" | "UNKNOWN"
      founder_health: "HEALTHY" | "WATCH" | "AT_RISK" | "CRITICAL" | "UNKNOWN"
      founder_severity: "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
      lead_industry:
        | "retail"
        | "healthcare"
        | "finance"
        | "education"
        | "real_estate"
        | "manufacturing"
        | "hospitality"
        | "logistics"
        | "technology"
        | "other"
      lead_priority: "critical" | "high" | "medium" | "low"
      lead_source_type:
        | "website"
        | "seo"
        | "social"
        | "ads"
        | "marketplace"
        | "referral"
        | "manual"
        | "api"
        | "whatsapp"
      lead_status_type:
        | "new"
        | "contacted"
        | "interested"
        | "follow_up"
        | "negotiation"
        | "won"
        | "lost"
        | "spam"
      lead_temperature: "hot" | "warm" | "cold"
      mission_cadence: "daily" | "weekly" | "monthly" | "seasonal"
      partner_kind: "affiliate" | "author" | "vendor" | "influencer"
      rarity_tier:
        | "common"
        | "uncommon"
        | "rare"
        | "epic"
        | "elite"
        | "legendary"
        | "mythic"
        | "founder"
      remote_assist_mode: "view_only" | "guided_cursor"
      remote_assist_status:
        | "pending"
        | "connected"
        | "active"
        | "ended"
        | "expired"
        | "cancelled"
        | "terminated"
      trophy_tier: "bronze" | "silver" | "gold" | "platinum"
      wallet_kind: "coins" | "tokens" | "rewards"
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
    Enums: {
      agent_status: ["online", "busy", "offline"],
      ams_chat_channel: [
        "support",
        "developer",
        "qa",
        "boss",
        "ai",
        "customer",
      ],
      ams_event_kind: [
        "created",
        "updated",
        "status_changed",
        "assigned",
        "reassigned",
        "transferred",
        "commented",
        "internal_note",
        "escalated",
        "resolved",
        "closed",
        "reopened",
        "archived",
        "restored",
        "attachment_added",
        "attachment_removed",
      ],
      ams_priority: ["low", "medium", "high", "critical"],
      ams_status: [
        "draft",
        "submitted",
        "assigned",
        "accepted",
        "in_progress",
        "waiting_customer",
        "waiting_developer",
        "waiting_qa",
        "testing",
        "resolved",
        "closed",
        "reopened",
        "cancelled",
        "archived",
      ],
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
        "boss_owner",
        "super_admin",
        "sales_support_manager",
        "client",
        "legal",
      ],
      claim_status: ["pending", "approved", "rejected", "fulfilled"],
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
      entity_status: ["active", "inactive", "archived", "draft"],
      founder_actor: ["HUMAN", "AI", "SYSTEM", "EXTERNAL"],
      founder_confidence: ["MEASURED", "ESTIMATED", "STALE", "UNKNOWN"],
      founder_health: ["HEALTHY", "WATCH", "AT_RISK", "CRITICAL", "UNKNOWN"],
      founder_severity: ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"],
      lead_industry: [
        "retail",
        "healthcare",
        "finance",
        "education",
        "real_estate",
        "manufacturing",
        "hospitality",
        "logistics",
        "technology",
        "other",
      ],
      lead_priority: ["critical", "high", "medium", "low"],
      lead_source_type: [
        "website",
        "seo",
        "social",
        "ads",
        "marketplace",
        "referral",
        "manual",
        "api",
        "whatsapp",
      ],
      lead_status_type: [
        "new",
        "contacted",
        "interested",
        "follow_up",
        "negotiation",
        "won",
        "lost",
        "spam",
      ],
      lead_temperature: ["hot", "warm", "cold"],
      mission_cadence: ["daily", "weekly", "monthly", "seasonal"],
      partner_kind: ["affiliate", "author", "vendor", "influencer"],
      rarity_tier: [
        "common",
        "uncommon",
        "rare",
        "epic",
        "elite",
        "legendary",
        "mythic",
        "founder",
      ],
      remote_assist_mode: ["view_only", "guided_cursor"],
      remote_assist_status: [
        "pending",
        "connected",
        "active",
        "ended",
        "expired",
        "cancelled",
        "terminated",
      ],
      trophy_tier: ["bronze", "silver", "gold", "platinum"],
      wallet_kind: ["coins", "tokens", "rewards"],
    },
  },
} as const
