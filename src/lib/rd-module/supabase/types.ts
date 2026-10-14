export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      pm_ai_conversations: {
        Row: {
          code: string;
          created_at: string;
          id: string;
          language: string;
          resolution: string;
          status: string;
          topic: string;
          updated_at: string;
          user_code: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          id?: string;
          language?: string;
          resolution?: string;
          status?: string;
          topic?: string;
          updated_at?: string;
          user_code: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          id?: string;
          language?: string;
          resolution?: string;
          status?: string;
          topic?: string;
          updated_at?: string;
          user_code?: string;
        };
        Relationships: [];
      };
      pm_ai_messages: {
        Row: {
          content: string;
          conversation_id: string;
          created_at: string;
          id: string;
          role: string;
        };
        Insert: {
          content: string;
          conversation_id: string;
          created_at?: string;
          id?: string;
          role: string;
        };
        Update: {
          content?: string;
          conversation_id?: string;
          created_at?: string;
          id?: string;
          role?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pm_ai_messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "pm_ai_conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      pm_alerts: {
        Row: {
          acknowledged: boolean;
          code: string;
          created_at: string;
          id: string;
          message: string;
          severity: string;
          type: string;
        };
        Insert: {
          acknowledged?: boolean;
          code: string;
          created_at?: string;
          id?: string;
          message?: string;
          severity?: string;
          type?: string;
        };
        Update: {
          acknowledged?: boolean;
          code?: string;
          created_at?: string;
          id?: string;
          message?: string;
          severity?: string;
          type?: string;
        };
        Relationships: [];
      };
      pm_assist_sessions: {
        Row: {
          code: string;
          created_at: string;
          duration_minutes: number;
          id: string;
          mode: string;
          status: string;
          updated_at: string;
          user_code: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          duration_minutes?: number;
          id?: string;
          mode?: string;
          status?: string;
          updated_at?: string;
          user_code: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          duration_minutes?: number;
          id?: string;
          mode?: string;
          status?: string;
          updated_at?: string;
          user_code?: string;
        };
        Relationships: [];
      };
      pm_audit_logs: {
        Row: {
          action: string;
          actor: string;
          category: string;
          created_at: string;
          details: string;
          id: string;
          ip: string;
          status: string;
          target: string;
        };
        Insert: {
          action: string;
          actor?: string;
          category?: string;
          created_at?: string;
          details?: string;
          id?: string;
          ip?: string;
          status?: string;
          target?: string;
        };
        Update: {
          action?: string;
          actor?: string;
          category?: string;
          created_at?: string;
          details?: string;
          id?: string;
          ip?: string;
          status?: string;
          target?: string;
        };
        Relationships: [];
      };
      pm_communication_logs: {
        Row: {
          code: string;
          content: string;
          created_at: string;
          id: string;
          type: string;
          user_code: string;
        };
        Insert: {
          code: string;
          content?: string;
          created_at?: string;
          id?: string;
          type?: string;
          user_code?: string;
        };
        Update: {
          code?: string;
          content?: string;
          created_at?: string;
          id?: string;
          type?: string;
          user_code?: string;
        };
        Relationships: [];
      };
      pm_compliance: {
        Row: {
          agreement_accepted: boolean;
          created_at: string;
          id: string;
          legal_flag: boolean;
          updated_at: string;
          user_code: string;
          violations: number;
        };
        Insert: {
          agreement_accepted?: boolean;
          created_at?: string;
          id?: string;
          legal_flag?: boolean;
          updated_at?: string;
          user_code: string;
          violations?: number;
        };
        Update: {
          agreement_accepted?: boolean;
          created_at?: string;
          id?: string;
          legal_flag?: boolean;
          updated_at?: string;
          user_code?: string;
          violations?: number;
        };
        Relationships: [];
      };
      pm_decisions: {
        Row: {
          amount: number | null;
          code: string;
          decision_note: string;
          description: string;
          id: string;
          is_financial: boolean;
          priority: string;
          requested_at: string;
          requested_by: string;
          status: string;
          subject: string;
          type: string;
          updated_at: string;
        };
        Insert: {
          amount?: number | null;
          code: string;
          decision_note?: string;
          description?: string;
          id?: string;
          is_financial?: boolean;
          priority?: string;
          requested_at?: string;
          requested_by?: string;
          status?: string;
          subject: string;
          type?: string;
          updated_at?: string;
        };
        Update: {
          amount?: number | null;
          code?: string;
          decision_note?: string;
          description?: string;
          id?: string;
          is_financial?: boolean;
          priority?: string;
          requested_at?: string;
          requested_by?: string;
          status?: string;
          subject?: string;
          type?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pm_escalations: {
        Row: {
          code: string;
          created_at: string;
          created_by: string;
          decision_note: string;
          description: string;
          evidence: string[];
          id: string;
          priority: string;
          source: string;
          source_id: string;
          status: string;
          subject: string;
          updated_at: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          created_by?: string;
          decision_note?: string;
          description?: string;
          evidence?: string[];
          id?: string;
          priority?: string;
          source?: string;
          source_id?: string;
          status?: string;
          subject: string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          created_by?: string;
          decision_note?: string;
          description?: string;
          evidence?: string[];
          id?: string;
          priority?: string;
          source?: string;
          source_id?: string;
          status?: string;
          subject?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pm_health_metrics: {
        Row: {
          code: string;
          description: string;
          id: string;
          name: string;
          status: string;
          trend: string;
          updated_at: string;
          value: string;
        };
        Insert: {
          code: string;
          description?: string;
          id?: string;
          name: string;
          status?: string;
          trend?: string;
          updated_at?: string;
          value?: string;
        };
        Update: {
          code?: string;
          description?: string;
          id?: string;
          name?: string;
          status?: string;
          trend?: string;
          updated_at?: string;
          value?: string;
        };
        Relationships: [];
      };
      pm_issues: {
        Row: {
          ai_attempts: number;
          build: string;
          code: string;
          created_at: string;
          id: string;
          last_attempt_at: string | null;
          status: string;
          summary: string;
          updated_at: string;
        };
        Insert: {
          ai_attempts?: number;
          build?: string;
          code: string;
          created_at?: string;
          id?: string;
          last_attempt_at?: string | null;
          status?: string;
          summary?: string;
          updated_at?: string;
        };
        Update: {
          ai_attempts?: number;
          build?: string;
          code?: string;
          created_at?: string;
          id?: string;
          last_attempt_at?: string | null;
          status?: string;
          summary?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pm_licenses: {
        Row: {
          created_at: string;
          domain: string;
          domain_status: string;
          expiry: string;
          id: string;
          license_type: string;
          transfer_status: string;
          updated_at: string;
          user_code: string;
        };
        Insert: {
          created_at?: string;
          domain?: string;
          domain_status?: string;
          expiry?: string;
          id?: string;
          license_type?: string;
          transfer_status?: string;
          updated_at?: string;
          user_code: string;
        };
        Update: {
          created_at?: string;
          domain?: string;
          domain_status?: string;
          expiry?: string;
          id?: string;
          license_type?: string;
          transfer_status?: string;
          updated_at?: string;
          user_code?: string;
        };
        Relationships: [];
      };
      pm_manager_metrics: {
        Row: {
          avg_resolution_time: string;
          escalations_handled: number;
          escalations_pending: number;
          id: string;
          manager_code: string;
          role: string;
          sla_compliance: number;
          status: string;
          trend: string;
          updated_at: string;
        };
        Insert: {
          avg_resolution_time?: string;
          escalations_handled?: number;
          escalations_pending?: number;
          id?: string;
          manager_code: string;
          role?: string;
          sla_compliance?: number;
          status?: string;
          trend?: string;
          updated_at?: string;
        };
        Update: {
          avg_resolution_time?: string;
          escalations_handled?: number;
          escalations_pending?: number;
          id?: string;
          manager_code?: string;
          role?: string;
          sla_compliance?: number;
          status?: string;
          trend?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pm_products: {
        Row: {
          created_at: string;
          custom_changes: string;
          id: string;
          modules: string[];
          product: string;
          updated_at: string;
          user_code: string;
          version: string;
        };
        Insert: {
          created_at?: string;
          custom_changes?: string;
          id?: string;
          modules?: string[];
          product: string;
          updated_at?: string;
          user_code: string;
          version?: string;
        };
        Update: {
          created_at?: string;
          custom_changes?: string;
          id?: string;
          modules?: string[];
          product?: string;
          updated_at?: string;
          user_code?: string;
          version?: string;
        };
        Relationships: [];
      };
      pm_promises: {
        Row: {
          action: string;
          code: string;
          created_at: string;
          deadline: string;
          developer_code: string;
          id: string;
          owner: string;
          priority: string;
          status: string;
          task_code: string;
          type: string;
          updated_at: string;
        };
        Insert: {
          action: string;
          code: string;
          created_at?: string;
          deadline?: string;
          developer_code?: string;
          id?: string;
          owner?: string;
          priority?: string;
          status?: string;
          task_code?: string;
          type?: string;
          updated_at?: string;
        };
        Update: {
          action?: string;
          code?: string;
          created_at?: string;
          deadline?: string;
          developer_code?: string;
          id?: string;
          owner?: string;
          priority?: string;
          status?: string;
          task_code?: string;
          type?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pm_quality_alerts: {
        Row: {
          acknowledged: boolean;
          affected_entity: string;
          code: string;
          confidence: number;
          description: string;
          detected_at: string;
          entity_type: string;
          id: string;
          pattern: string;
          reasoning: string;
          severity: string;
          suggested_action: string;
          updated_at: string;
        };
        Insert: {
          acknowledged?: boolean;
          affected_entity?: string;
          code: string;
          confidence?: number;
          description?: string;
          detected_at?: string;
          entity_type?: string;
          id?: string;
          pattern: string;
          reasoning?: string;
          severity?: string;
          suggested_action?: string;
          updated_at?: string;
        };
        Update: {
          acknowledged?: boolean;
          affected_entity?: string;
          code?: string;
          confidence?: number;
          description?: string;
          detected_at?: string;
          entity_type?: string;
          id?: string;
          pattern?: string;
          reasoning?: string;
          severity?: string;
          suggested_action?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pm_renewals: {
        Row: {
          code: string;
          created_at: string;
          expiry: string;
          grace: string;
          id: string;
          product: string;
          status: string;
          updated_at: string;
          user_code: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          expiry?: string;
          grace?: string;
          id?: string;
          product?: string;
          status?: string;
          updated_at?: string;
          user_code: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          expiry?: string;
          grace?: string;
          id?: string;
          product?: string;
          status?: string;
          updated_at?: string;
          user_code?: string;
        };
        Relationships: [];
      };
      pm_reports: {
        Row: {
          code: string;
          generated_at: string;
          id: string;
          name: string;
          size: string;
          type: string;
        };
        Insert: {
          code: string;
          generated_at?: string;
          id?: string;
          name: string;
          size?: string;
          type?: string;
        };
        Update: {
          code?: string;
          generated_at?: string;
          id?: string;
          name?: string;
          size?: string;
          type?: string;
        };
        Relationships: [];
      };
      pm_satisfaction: {
        Row: {
          ai_prediction: string;
          created_at: string;
          csat: number;
          feedback: string;
          id: string;
          risk: string;
          updated_at: string;
          user_code: string;
        };
        Insert: {
          ai_prediction?: string;
          created_at?: string;
          csat?: number;
          feedback?: string;
          id?: string;
          risk?: string;
          updated_at?: string;
          user_code: string;
        };
        Update: {
          ai_prediction?: string;
          created_at?: string;
          csat?: number;
          feedback?: string;
          id?: string;
          risk?: string;
          updated_at?: string;
          user_code?: string;
        };
        Relationships: [];
      };
      pm_settings: {
        Row: {
          enabled: boolean;
          id: string;
          key: string;
          label: string;
          locked: boolean;
          section: string;
          updated_at: string;
        };
        Insert: {
          enabled?: boolean;
          id?: string;
          key: string;
          label: string;
          locked?: boolean;
          section?: string;
          updated_at?: string;
        };
        Update: {
          enabled?: boolean;
          id?: string;
          key?: string;
          label?: string;
          locked?: boolean;
          section?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pm_tickets: {
        Row: {
          code: string;
          id: string;
          opened_at: string;
          product: string;
          severity: string;
          status: string;
          subject: string;
          type: string;
          updated_at: string;
          user_code: string;
        };
        Insert: {
          code: string;
          id?: string;
          opened_at?: string;
          product?: string;
          severity?: string;
          status?: string;
          subject?: string;
          type?: string;
          updated_at?: string;
          user_code?: string;
        };
        Update: {
          code?: string;
          id?: string;
          opened_at?: string;
          product?: string;
          severity?: string;
          status?: string;
          subject?: string;
          type?: string;
          updated_at?: string;
          user_code?: string;
        };
        Relationships: [];
      };
      pm_upgrades: {
        Row: {
          code: string;
          created_at: string;
          id: string;
          item: string;
          status: string;
          type: string;
          updated_at: string;
          user_code: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          id?: string;
          item?: string;
          status?: string;
          type?: string;
          updated_at?: string;
          user_code: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          id?: string;
          item?: string;
          status?: string;
          type?: string;
          updated_at?: string;
          user_code?: string;
        };
        Relationships: [];
      };
      pm_usage: {
        Row: {
          ai_calls_pct: number;
          api_pct: number;
          created_at: string;
          fair_usage_alert: boolean;
          id: string;
          storage_pct: number;
          updated_at: string;
          user_code: string;
        };
        Insert: {
          ai_calls_pct?: number;
          api_pct?: number;
          created_at?: string;
          fair_usage_alert?: boolean;
          id?: string;
          storage_pct?: number;
          updated_at?: string;
          user_code: string;
        };
        Update: {
          ai_calls_pct?: number;
          api_pct?: number;
          created_at?: string;
          fair_usage_alert?: boolean;
          id?: string;
          storage_pct?: number;
          updated_at?: string;
          user_code?: string;
        };
        Relationships: [];
      };
      pm_users: {
        Row: {
          code: string;
          created_at: string;
          id: string;
          license: string;
          product: string;
          region: string;
          status: string;
          tier: string;
          updated_at: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          id?: string;
          license?: string;
          product: string;
          region?: string;
          status?: string;
          tier?: string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          id?: string;
          license?: string;
          product?: string;
          region?: string;
          status?: string;
          tier?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      rd_evaluations: {
        Row: {
          decision: string;
          decision_reason: string;
          evidence: string;
          id: string;
          notes: string;
          opportunity_id: string;
          research_links: string[];
          scores: Json;
          updated_at: string;
        };
        Insert: {
          decision?: string;
          decision_reason?: string;
          evidence?: string;
          id?: string;
          notes?: string;
          opportunity_id: string;
          research_links?: string[];
          scores?: Json;
          updated_at?: string;
        };
        Update: {
          decision?: string;
          decision_reason?: string;
          evidence?: string;
          id?: string;
          notes?: string;
          opportunity_id?: string;
          research_links?: string[];
          scores?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rd_evaluations_opportunity_id_fkey";
            columns: ["opportunity_id"];
            isOneToOne: true;
            referencedRelation: "rd_opportunities";
            referencedColumns: ["id"];
          },
        ];
      };
      rd_opportunities: {
        Row: {
          assigned_to: string;
          attachments: Json;
          category: string;
          cluster_key: string;
          company: string;
          contact_email: string;
          contact_name: string;
          contact_phone: string;
          country: string;
          created_at: string;
          description: string;
          details: Json;
          id: string;
          priority: string;
          public_request_id: string;
          related_ref: string;
          source: string;
          status: string;
          submitter_fingerprint: string;
          title: string;
          type: string;
          updated_at: string;
        };
        Insert: {
          assigned_to?: string;
          attachments?: Json;
          category?: string;
          cluster_key?: string;
          company?: string;
          contact_email: string;
          contact_name: string;
          contact_phone?: string;
          country?: string;
          created_at?: string;
          description?: string;
          details?: Json;
          id?: string;
          priority?: string;
          public_request_id: string;
          related_ref?: string;
          source?: string;
          status?: string;
          submitter_fingerprint?: string;
          title: string;
          type: string;
          updated_at?: string;
        };
        Update: {
          assigned_to?: string;
          attachments?: Json;
          category?: string;
          cluster_key?: string;
          company?: string;
          contact_email?: string;
          contact_name?: string;
          contact_phone?: string;
          country?: string;
          created_at?: string;
          description?: string;
          details?: Json;
          id?: string;
          priority?: string;
          public_request_id?: string;
          related_ref?: string;
          source?: string;
          status?: string;
          submitter_fingerprint?: string;
          title?: string;
          type?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      rd_opportunity_events: {
        Row: {
          actor: string;
          body: string;
          created_at: string;
          from_value: string;
          id: string;
          kind: string;
          opportunity_id: string;
          to_value: string;
        };
        Insert: {
          actor?: string;
          body?: string;
          created_at?: string;
          from_value?: string;
          id?: string;
          kind: string;
          opportunity_id: string;
          to_value?: string;
        };
        Update: {
          actor?: string;
          body?: string;
          created_at?: string;
          from_value?: string;
          id?: string;
          kind?: string;
          opportunity_id?: string;
          to_value?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rd_opportunity_events_opportunity_id_fkey";
            columns: ["opportunity_id"];
            isOneToOne: false;
            referencedRelation: "rd_opportunities";
            referencedColumns: ["id"];
          },
        ];
      };
      rd_projects: {
        Row: {
          acceptance_criteria: string;
          commercial_terms: string;
          created_at: string;
          findings: string;
          id: string;
          kind: string;
          name: string;
          objective: string;
          opportunity_id: string;
          owner: string;
          pipeline_item_id: string | null;
          recommendation: string;
          research_question: string;
          results: string;
          stage: string;
          status: string;
          team: string[];
          technical_notes: string;
          timeline: string;
          updated_at: string;
        };
        Insert: {
          acceptance_criteria?: string;
          commercial_terms?: string;
          created_at?: string;
          findings?: string;
          id?: string;
          kind: string;
          name: string;
          objective?: string;
          opportunity_id: string;
          owner?: string;
          pipeline_item_id?: string | null;
          recommendation?: string;
          research_question?: string;
          results?: string;
          stage?: string;
          status?: string;
          team?: string[];
          technical_notes?: string;
          timeline?: string;
          updated_at?: string;
        };
        Update: {
          acceptance_criteria?: string;
          commercial_terms?: string;
          created_at?: string;
          findings?: string;
          id?: string;
          kind?: string;
          name?: string;
          objective?: string;
          opportunity_id?: string;
          owner?: string;
          pipeline_item_id?: string | null;
          recommendation?: string;
          research_question?: string;
          results?: string;
          stage?: string;
          status?: string;
          team?: string[];
          technical_notes?: string;
          timeline?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rd_projects_opportunity_id_fkey";
            columns: ["opportunity_id"];
            isOneToOne: false;
            referencedRelation: "rd_opportunities";
            referencedColumns: ["id"];
          },
        ];
      };
      rd_team_members: {
        Row: {
          active: boolean;
          created_at: string;
          email: string;
          id: string;
          invite_code_hash: string | null;
          last_login_at: string | null;
          name: string;
          password_hash: string | null;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          email: string;
          id?: string;
          invite_code_hash?: string | null;
          last_login_at?: string | null;
          name?: string;
          password_hash?: string | null;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          email?: string;
          id?: string;
          invite_code_hash?: string | null;
          last_login_at?: string | null;
          name?: string;
          password_hash?: string | null;
        };
        Relationships: [];
      };
      rnd_ai_messages: {
        Row: {
          content: string;
          created_at: string;
          id: string;
          role: string;
          session_id: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          id?: string;
          role: string;
          session_id: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          id?: string;
          role?: string;
          session_id?: string;
        };
        Relationships: [];
      };
      rnd_budgets: {
        Row: {
          created_at: string;
          currency: string;
          id: string;
          is_current: boolean;
          period: string;
          total_budget: number;
        };
        Insert: {
          created_at?: string;
          currency?: string;
          id?: string;
          is_current?: boolean;
          period: string;
          total_budget?: number;
        };
        Update: {
          created_at?: string;
          currency?: string;
          id?: string;
          is_current?: boolean;
          period?: string;
          total_budget?: number;
        };
        Relationships: [];
      };
      rnd_decisions: {
        Row: {
          ai_score: number;
          estimated_cost: number;
          estimated_time: string;
          id: string;
          priority: string;
          status: string;
          submitted_at: string;
          submitted_by: string;
          title: string;
          type: string;
          votes_approve: number;
          votes_hold: number;
          votes_reject: number;
        };
        Insert: {
          ai_score?: number;
          estimated_cost?: number;
          estimated_time?: string;
          id?: string;
          priority?: string;
          status?: string;
          submitted_at?: string;
          submitted_by?: string;
          title: string;
          type?: string;
          votes_approve?: number;
          votes_hold?: number;
          votes_reject?: number;
        };
        Update: {
          ai_score?: number;
          estimated_cost?: number;
          estimated_time?: string;
          id?: string;
          priority?: string;
          status?: string;
          submitted_at?: string;
          submitted_by?: string;
          title?: string;
          type?: string;
          votes_approve?: number;
          votes_hold?: number;
          votes_reject?: number;
        };
        Relationships: [];
      };
      rnd_feedback: {
        Row: {
          category: string;
          content: string;
          created_at: string;
          id: string;
          sentiment: string;
          sentiment_score: number;
          source: string;
          status: string;
          votes: number;
        };
        Insert: {
          category?: string;
          content: string;
          created_at?: string;
          id?: string;
          sentiment?: string;
          sentiment_score?: number;
          source?: string;
          status?: string;
          votes?: number;
        };
        Update: {
          category?: string;
          content?: string;
          created_at?: string;
          id?: string;
          sentiment?: string;
          sentiment_score?: number;
          source?: string;
          status?: string;
          votes?: number;
        };
        Relationships: [];
      };
      rnd_feedback_insights: {
        Row: {
          created_at: string;
          feedback_count: number;
          id: string;
          improvements: Json;
          model: string;
          summary: string;
          themes: Json;
        };
        Insert: {
          created_at?: string;
          feedback_count?: number;
          id?: string;
          improvements?: Json;
          model?: string;
          summary?: string;
          themes?: Json;
        };
        Update: {
          created_at?: string;
          feedback_count?: number;
          id?: string;
          improvements?: Json;
          model?: string;
          summary?: string;
          themes?: Json;
        };
        Relationships: [];
      };
      rnd_idea_evaluations: {
        Row: {
          ai_analysis: string;
          category: string;
          created_at: string;
          description: string;
          id: string;
          scores: Json;
          title: string;
        };
        Insert: {
          ai_analysis?: string;
          category?: string;
          created_at?: string;
          description?: string;
          id?: string;
          scores?: Json;
          title: string;
        };
        Update: {
          ai_analysis?: string;
          category?: string;
          created_at?: string;
          description?: string;
          id?: string;
          scores?: Json;
          title?: string;
        };
        Relationships: [];
      };
      rnd_ideas: {
        Row: {
          author: string;
          category: string;
          created_at: string;
          description: string;
          feasibility: number;
          id: string;
          priority: string;
          research_links: number;
          status: string;
          title: string;
          updated_at: string;
          votes: number;
        };
        Insert: {
          author?: string;
          category?: string;
          created_at?: string;
          description?: string;
          feasibility?: number;
          id?: string;
          priority?: string;
          research_links?: number;
          status?: string;
          title: string;
          updated_at?: string;
          votes?: number;
        };
        Update: {
          author?: string;
          category?: string;
          created_at?: string;
          description?: string;
          feasibility?: number;
          id?: string;
          priority?: string;
          research_links?: number;
          status?: string;
          title?: string;
          updated_at?: string;
          votes?: number;
        };
        Relationships: [];
      };
      rnd_impact_analyses: {
        Row: {
          ai_recommendation: string;
          created_at: string;
          effort_level: string;
          feature: string;
          id: string;
          maintenance_cost: string;
          performance_load: number;
          revenue_impact: string;
          score_demand: number;
          score_effort: number;
          score_revenue: number;
          score_risk: number;
          technical_risk: string;
          user_demand: number;
        };
        Insert: {
          ai_recommendation?: string;
          created_at?: string;
          effort_level?: string;
          feature: string;
          id?: string;
          maintenance_cost?: string;
          performance_load?: number;
          revenue_impact?: string;
          score_demand?: number;
          score_effort?: number;
          score_revenue?: number;
          score_risk?: number;
          technical_risk?: string;
          user_demand?: number;
        };
        Update: {
          ai_recommendation?: string;
          created_at?: string;
          effort_level?: string;
          feature?: string;
          id?: string;
          maintenance_cost?: string;
          performance_load?: number;
          revenue_impact?: string;
          score_demand?: number;
          score_effort?: number;
          score_revenue?: number;
          score_risk?: number;
          technical_risk?: string;
          user_demand?: number;
        };
        Relationships: [];
      };
      rnd_market_gaps: {
        Row: {
          created_at: string;
          difficulty: string;
          gap: string;
          id: string;
          potential: string;
        };
        Insert: {
          created_at?: string;
          difficulty?: string;
          gap: string;
          id?: string;
          potential?: string;
        };
        Update: {
          created_at?: string;
          difficulty?: string;
          gap?: string;
          id?: string;
          potential?: string;
        };
        Relationships: [];
      };
      rnd_notifications: {
        Row: {
          created_at: string;
          dismissed: boolean;
          id: string;
          message: string;
          read: boolean;
          title: string;
          type: string;
        };
        Insert: {
          created_at?: string;
          dismissed?: boolean;
          id?: string;
          message?: string;
          read?: boolean;
          title: string;
          type?: string;
        };
        Update: {
          created_at?: string;
          dismissed?: boolean;
          id?: string;
          message?: string;
          read?: boolean;
          title?: string;
          type?: string;
        };
        Relationships: [];
      };
      rnd_pipeline_items: {
        Row: {
          ai_score: number | null;
          assignee: string;
          created_at: string;
          description: string;
          due_date: string | null;
          id: string;
          priority: string;
          progress: number;
          stage: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          ai_score?: number | null;
          assignee?: string;
          created_at?: string;
          description?: string;
          due_date?: string | null;
          id?: string;
          priority?: string;
          progress?: number;
          stage?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          ai_score?: number | null;
          assignee?: string;
          created_at?: string;
          description?: string;
          due_date?: string | null;
          id?: string;
          priority?: string;
          progress?: number;
          stage?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      rnd_prototypes: {
        Row: {
          completed_hours: number;
          created_at: string;
          estimated_hours: number;
          id: string;
          integrations: string[];
          modules: string[];
          name: string;
          progress: number;
          status: string;
          team: string[];
          updated_at: string;
        };
        Insert: {
          completed_hours?: number;
          created_at?: string;
          estimated_hours?: number;
          id?: string;
          integrations?: string[];
          modules?: string[];
          name: string;
          progress?: number;
          status?: string;
          team?: string[];
          updated_at?: string;
        };
        Update: {
          completed_hours?: number;
          created_at?: string;
          estimated_hours?: number;
          id?: string;
          integrations?: string[];
          modules?: string[];
          name?: string;
          progress?: number;
          status?: string;
          team?: string[];
          updated_at?: string;
        };
        Relationships: [];
      };
      rnd_team_feedback: {
        Row: {
          area: string;
          content: string;
          created_at: string;
          id: string;
          member: string;
        };
        Insert: {
          area?: string;
          content: string;
          created_at?: string;
          id?: string;
          member: string;
        };
        Update: {
          area?: string;
          content?: string;
          created_at?: string;
          id?: string;
          member?: string;
        };
        Relationships: [];
      };
      rnd_technologies: {
        Row: {
          category: string;
          created_at: string;
          description: string;
          id: string;
          name: string;
          relevance: number;
          ring: string;
        };
        Insert: {
          category?: string;
          created_at?: string;
          description?: string;
          id?: string;
          name: string;
          relevance?: number;
          ring?: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          description?: string;
          id?: string;
          name?: string;
          relevance?: number;
          ring?: string;
        };
        Relationships: [];
      };
      rnd_transactions: {
        Row: {
          amount: number;
          budget_id: string;
          created_at: string;
          description: string;
          id: string;
          occurred_on: string;
          status: string;
          type: string;
        };
        Insert: {
          amount: number;
          budget_id: string;
          created_at?: string;
          description: string;
          id?: string;
          occurred_on?: string;
          status?: string;
          type?: string;
        };
        Update: {
          amount?: number;
          budget_id?: string;
          created_at?: string;
          description?: string;
          id?: string;
          occurred_on?: string;
          status?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rnd_transactions_budget_id_fkey";
            columns: ["budget_id"];
            isOneToOne: false;
            referencedRelation: "rnd_budgets";
            referencedColumns: ["id"];
          },
        ];
      };
      rnd_trends: {
        Row: {
          competitors: string[];
          detected_at: string;
          id: string;
          impact: string;
          opportunity: string;
          relevance: number;
          source: string;
          status: string;
          title: string;
        };
        Insert: {
          competitors?: string[];
          detected_at?: string;
          id?: string;
          impact?: string;
          opportunity?: string;
          relevance?: number;
          source?: string;
          status?: string;
          title: string;
        };
        Update: {
          competitors?: string[];
          detected_at?: string;
          id?: string;
          impact?: string;
          opportunity?: string;
          relevance?: number;
          source?: string;
          status?: string;
          title?: string;
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
