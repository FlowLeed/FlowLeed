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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      auth_verification_tokens: {
        Row: {
          created_at: string | null
          email: string
          expires_at: string
          id: string
          token_hash: string
          token_type: string
          used_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          token_hash: string
          token_type: string
          used_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          token_hash?: string
          token_type?: string
          used_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      call_records: {
        Row: {
          answered_at: string | null
          call_type: string
          contact_id: string
          created_at: string
          direction: string
          duration: number | null
          ended_at: string | null
          error_code: string | null
          error_message: string | null
          from_number: string
          id: string
          initiated_by_user_id: string | null
          metadata: Json | null
          organization_id: string
          recording_sid: string | null
          recording_url: string | null
          status: string
          to_number: string
          transcription: string | null
          twilio_call_sid: string
          twilio_phone_number_id: string | null
          updated_at: string
        }
        Insert: {
          answered_at?: string | null
          call_type: string
          contact_id: string
          created_at?: string
          direction: string
          duration?: number | null
          ended_at?: string | null
          error_code?: string | null
          error_message?: string | null
          from_number: string
          id?: string
          initiated_by_user_id?: string | null
          metadata?: Json | null
          organization_id: string
          recording_sid?: string | null
          recording_url?: string | null
          status?: string
          to_number: string
          transcription?: string | null
          twilio_call_sid: string
          twilio_phone_number_id?: string | null
          updated_at?: string
        }
        Update: {
          answered_at?: string | null
          call_type?: string
          contact_id?: string
          created_at?: string
          direction?: string
          duration?: number | null
          ended_at?: string | null
          error_code?: string | null
          error_message?: string | null
          from_number?: string
          id?: string
          initiated_by_user_id?: string | null
          metadata?: Json | null
          organization_id?: string
          recording_sid?: string | null
          recording_url?: string | null
          status?: string
          to_number?: string
          transcription?: string | null
          twilio_call_sid?: string
          twilio_phone_number_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_records_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_records_twilio_phone_number_id_fkey"
            columns: ["twilio_phone_number_id"]
            isOneToOne: false
            referencedRelation: "twilio_phone_numbers"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_addresses: {
        Row: {
          address_type: string
          city: string | null
          contact_id: string
          country: string | null
          created_at: string
          id: string
          is_primary: boolean | null
          state: string | null
          street_address: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address_type?: string
          city?: string | null
          contact_id: string
          country?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean | null
          state?: string | null
          street_address?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address_type?: string
          city?: string | null
          contact_id?: string
          country?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean | null
          state?: string | null
          street_address?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      contact_demographics: {
        Row: {
          birthday: string | null
          contact_id: string
          created_at: string
          gender: string | null
          id: string
          marital_status: string | null
          occupation: string | null
          updated_at: string
        }
        Insert: {
          birthday?: string | null
          contact_id: string
          created_at?: string
          gender?: string | null
          id?: string
          marital_status?: string | null
          occupation?: string | null
          updated_at?: string
        }
        Update: {
          birthday?: string | null
          contact_id?: string
          created_at?: string
          gender?: string | null
          id?: string
          marital_status?: string | null
          occupation?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      contact_family_members: {
        Row: {
          avatar: string | null
          birthday: string | null
          contact_id: string
          created_at: string
          id: string
          is_child: boolean | null
          name: string
          notes: string | null
          pc_person_id: string | null
          relationship: string
          updated_at: string
        }
        Insert: {
          avatar?: string | null
          birthday?: string | null
          contact_id: string
          created_at?: string
          id?: string
          is_child?: boolean | null
          name: string
          notes?: string | null
          pc_person_id?: string | null
          relationship: string
          updated_at?: string
        }
        Update: {
          avatar?: string | null
          birthday?: string | null
          contact_id?: string
          created_at?: string
          id?: string
          is_child?: boolean | null
          name?: string
          notes?: string | null
          pc_person_id?: string | null
          relationship?: string
          updated_at?: string
        }
        Relationships: []
      }
      contact_interactions: {
        Row: {
          assigned_to_user_id: string | null
          completed_at: string | null
          contact_id: string
          created_at: string
          created_by_user_id: string
          details: string | null
          id: string
          interaction_type: string
          metadata: Json | null
          outcome: string | null
          pipeline_id: string | null
          previous_stage_id: string | null
          scheduled_at: string | null
          stage_id: string | null
          subject: string | null
          updated_at: string
        }
        Insert: {
          assigned_to_user_id?: string | null
          completed_at?: string | null
          contact_id: string
          created_at?: string
          created_by_user_id: string
          details?: string | null
          id?: string
          interaction_type: string
          metadata?: Json | null
          outcome?: string | null
          pipeline_id?: string | null
          previous_stage_id?: string | null
          scheduled_at?: string | null
          stage_id?: string | null
          subject?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to_user_id?: string | null
          completed_at?: string | null
          contact_id?: string
          created_at?: string
          created_by_user_id?: string
          details?: string | null
          id?: string
          interaction_type?: string
          metadata?: Json | null
          outcome?: string | null
          pipeline_id?: string | null
          previous_stage_id?: string | null
          scheduled_at?: string | null
          stage_id?: string | null
          subject?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      contact_notes: {
        Row: {
          contact_id: string
          content: string
          created_at: string
          created_by_user_id: string
          id: string
          is_private: boolean | null
          note_type: string | null
          pipeline_id: string | null
          updated_at: string
        }
        Insert: {
          contact_id: string
          content: string
          created_at?: string
          created_by_user_id: string
          id?: string
          is_private?: boolean | null
          note_type?: string | null
          pipeline_id?: string | null
          updated_at?: string
        }
        Update: {
          contact_id?: string
          content?: string
          created_at?: string
          created_by_user_id?: string
          id?: string
          is_private?: boolean | null
          note_type?: string | null
          pipeline_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      contact_prayer_requests: {
        Row: {
          answer_description: string | null
          answered_at: string | null
          contact_id: string
          created_at: string
          created_by_user_id: string
          description: string | null
          id: string
          status: string | null
          title: string
          updated_at: string
        }
        Insert: {
          answer_description?: string | null
          answered_at?: string | null
          contact_id: string
          created_at?: string
          created_by_user_id: string
          description?: string | null
          id?: string
          status?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          answer_description?: string | null
          answered_at?: string | null
          contact_id?: string
          created_at?: string
          created_by_user_id?: string
          description?: string | null
          id?: string
          status?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      contact_tags: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          tag: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          tag: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_contact_tags_contact_id"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          assigned_to_user_id: string | null
          avatar: string | null
          created_at: string
          email: string | null
          id: string
          last_synced_at: string | null
          name: string
          notes: string | null
          organization_id: string
          pc_person_id: string | null
          phone: string | null
          source_type: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to_user_id?: string | null
          avatar?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_synced_at?: string | null
          name: string
          notes?: string | null
          organization_id: string
          pc_person_id?: string | null
          phone?: string | null
          source_type?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to_user_id?: string | null
          avatar?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_synced_at?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          pc_person_id?: string | null
          phone?: string | null
          source_type?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      impersonation_actions: {
        Row: {
          action_description: string
          action_type: string
          affected_record_id: string | null
          affected_table: string | null
          after_value: Json | null
          before_value: Json | null
          id: string
          impersonation_session_id: string
          metadata: Json | null
          page_url: string | null
          timestamp: string
        }
        Insert: {
          action_description: string
          action_type: string
          affected_record_id?: string | null
          affected_table?: string | null
          after_value?: Json | null
          before_value?: Json | null
          id?: string
          impersonation_session_id: string
          metadata?: Json | null
          page_url?: string | null
          timestamp?: string
        }
        Update: {
          action_description?: string
          action_type?: string
          affected_record_id?: string | null
          affected_table?: string | null
          after_value?: Json | null
          before_value?: Json | null
          id?: string
          impersonation_session_id?: string
          metadata?: Json | null
          page_url?: string | null
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "impersonation_actions_impersonation_session_id_fkey"
            columns: ["impersonation_session_id"]
            isOneToOne: false
            referencedRelation: "impersonation_audit_log"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "impersonation_actions_impersonation_session_id_fkey"
            columns: ["impersonation_session_id"]
            isOneToOne: false
            referencedRelation: "impersonation_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      impersonation_sessions: {
        Row: {
          actions_performed: Json | null
          created_at: string | null
          ended_at: string | null
          id: string
          ip_address: string | null
          is_active: boolean | null
          pages_visited: string[] | null
          reason: string
          started_at: string
          system_admin_user_id: string
          target_organization_id: string
          target_user_id: string
          updated_at: string | null
          user_agent: string | null
        }
        Insert: {
          actions_performed?: Json | null
          created_at?: string | null
          ended_at?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean | null
          pages_visited?: string[] | null
          reason: string
          started_at?: string
          system_admin_user_id: string
          target_organization_id: string
          target_user_id: string
          updated_at?: string | null
          user_agent?: string | null
        }
        Update: {
          actions_performed?: Json | null
          created_at?: string | null
          ended_at?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean | null
          pages_visited?: string[] | null
          reason?: string
          started_at?: string
          system_admin_user_id?: string
          target_organization_id?: string
          target_user_id?: string
          updated_at?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "impersonation_sessions_target_organization_id_fkey"
            columns: ["target_organization_id"]
            isOneToOne: false
            referencedRelation: "organization_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impersonation_sessions_target_organization_id_fkey"
            columns: ["target_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_list_mappings: {
        Row: {
          auto_sync: boolean
          created_at: string
          display_order: number
          external_list_id: string
          external_list_name: string
          id: string
          integration_id: string
          last_sync_at: string | null
          pipeline_id: string
          stage_id: string
          updated_at: string
        }
        Insert: {
          auto_sync?: boolean
          created_at?: string
          display_order?: number
          external_list_id: string
          external_list_name: string
          id?: string
          integration_id: string
          last_sync_at?: string | null
          pipeline_id: string
          stage_id: string
          updated_at?: string
        }
        Update: {
          auto_sync?: boolean
          created_at?: string
          display_order?: number
          external_list_id?: string
          external_list_name?: string
          id?: string
          integration_id?: string
          last_sync_at?: string | null
          pipeline_id?: string
          stage_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_list_mappings_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_list_mappings_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_list_mappings_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_list_metadata: {
        Row: {
          cached_at: string
          created_at: string
          description: string | null
          external_list_id: string
          id: string
          integration_id: string
          last_updated_at: string | null
          list_type: string | null
          member_count: number | null
          name: string
          updated_at: string
        }
        Insert: {
          cached_at?: string
          created_at?: string
          description?: string | null
          external_list_id: string
          id?: string
          integration_id: string
          last_updated_at?: string | null
          list_type?: string | null
          member_count?: number | null
          name: string
          updated_at?: string
        }
        Update: {
          cached_at?: string
          created_at?: string
          description?: string | null
          external_list_id?: string
          id?: string
          integration_id?: string
          last_updated_at?: string | null
          list_type?: string | null
          member_count?: number | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      integration_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          integration_id: string
          message: string | null
          status: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          integration_id: string
          message?: string | null
          status: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          integration_id?: string
          message?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_logs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          created_at: string
          credentials: Json
          id: string
          last_sync_at: string | null
          organization_id: string
          service_name: string
          settings: Json
          status: string
          sync_frequency: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credentials?: Json
          id?: string
          last_sync_at?: string | null
          organization_id: string
          service_name: string
          settings?: Json
          status?: string
          sync_frequency?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credentials?: Json
          id?: string
          last_sync_at?: string | null
          organization_id?: string
          service_name?: string
          settings?: Json
          status?: string
          sync_frequency?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by_user_id: string
          organization_id: string
          role: string
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by_user_id: string
          organization_id: string
          role?: string
          token: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by_user_id?: string
          organization_id?: string
          role?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_invited_by_user_id_fkey"
            columns: ["invited_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_activity_stats: {
        Row: {
          ai_descriptions_generated: number | null
          ai_messages_generated: number | null
          ai_suggestions_used: number | null
          contacts_count: number | null
          created_at: string | null
          daily_activity_score: number | null
          date: string
          flows_count: number | null
          id: string
          interactions_count: number | null
          last_login_at: string | null
          last_pco_sync: string | null
          notes_created: number | null
          organization_id: string
          pco_sync_count: number | null
          total_ai_uses: number | null
          total_logins: number | null
          unique_active_users: number | null
          updated_at: string | null
        }
        Insert: {
          ai_descriptions_generated?: number | null
          ai_messages_generated?: number | null
          ai_suggestions_used?: number | null
          contacts_count?: number | null
          created_at?: string | null
          daily_activity_score?: number | null
          date?: string
          flows_count?: number | null
          id?: string
          interactions_count?: number | null
          last_login_at?: string | null
          last_pco_sync?: string | null
          notes_created?: number | null
          organization_id: string
          pco_sync_count?: number | null
          total_ai_uses?: number | null
          total_logins?: number | null
          unique_active_users?: number | null
          updated_at?: string | null
        }
        Update: {
          ai_descriptions_generated?: number | null
          ai_messages_generated?: number | null
          ai_suggestions_used?: number | null
          contacts_count?: number | null
          created_at?: string | null
          daily_activity_score?: number | null
          date?: string
          flows_count?: number | null
          id?: string
          interactions_count?: number | null
          last_login_at?: string | null
          last_pco_sync?: string | null
          notes_created?: number | null
          organization_id?: string
          pco_sync_count?: number | null
          total_ai_uses?: number | null
          total_logins?: number | null
          unique_active_users?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_activity_stats_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_activity_stats_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_health_history: {
        Row: {
          calculated_at: string
          created_at: string
          id: string
          metrics: Json
          organization_id: string
          previous_score: number | null
          score_breakdown: Json
          score_change: number | null
          total_score: number
        }
        Insert: {
          calculated_at?: string
          created_at?: string
          id?: string
          metrics: Json
          organization_id: string
          previous_score?: number | null
          score_breakdown: Json
          score_change?: number | null
          total_score: number
        }
        Update: {
          calculated_at?: string
          created_at?: string
          id?: string
          metrics?: Json
          organization_id?: string
          previous_score?: number | null
          score_breakdown?: Json
          score_change?: number | null
          total_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "organization_health_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_health_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          billing_email: string | null
          created_at: string
          fl_admin_assigned_to: string | null
          fl_admin_notes: string | null
          health_score: number | null
          id: string
          last_activity_at: string | null
          last_payment_date: string | null
          name: string
          next_billing_date: string | null
          notes: string | null
          onboarding_completed: boolean | null
          onboarding_progress: Json | null
          onboarding_stage_entered_at: string | null
          onboarding_step: string | null
          plan_price: number | null
          plan_tier: string | null
          primary_contact_email: string | null
          primary_contact_name: string | null
          primary_contact_phone: string | null
          slug: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          tags: string[] | null
          total_revenue: number | null
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          billing_email?: string | null
          created_at?: string
          fl_admin_assigned_to?: string | null
          fl_admin_notes?: string | null
          health_score?: number | null
          id?: string
          last_activity_at?: string | null
          last_payment_date?: string | null
          name: string
          next_billing_date?: string | null
          notes?: string | null
          onboarding_completed?: boolean | null
          onboarding_progress?: Json | null
          onboarding_stage_entered_at?: string | null
          onboarding_step?: string | null
          plan_price?: number | null
          plan_tier?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          slug: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          tags?: string[] | null
          total_revenue?: number | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          billing_email?: string | null
          created_at?: string
          fl_admin_assigned_to?: string | null
          fl_admin_notes?: string | null
          health_score?: number | null
          id?: string
          last_activity_at?: string | null
          last_payment_date?: string | null
          name?: string
          next_billing_date?: string | null
          notes?: string | null
          onboarding_completed?: boolean | null
          onboarding_progress?: Json | null
          onboarding_stage_entered_at?: string | null
          onboarding_step?: string | null
          plan_price?: number | null
          plan_tier?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          slug?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          tags?: string[] | null
          total_revenue?: number | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_fl_admin_assigned_to_fkey"
            columns: ["fl_admin_assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      pipeline_contacts: {
        Row: {
          assigned_to_user_id: string | null
          completed_end_at: string | null
          contact_id: string
          created_at: string
          entered_start_at: string | null
          id: string
          pipeline_id: string
          source_id: string | null
          source_type: string | null
          stage_id: string
          stage_order: number
          updated_at: string
        }
        Insert: {
          assigned_to_user_id?: string | null
          completed_end_at?: string | null
          contact_id: string
          created_at?: string
          entered_start_at?: string | null
          id?: string
          pipeline_id: string
          source_id?: string | null
          source_type?: string | null
          stage_id: string
          stage_order?: number
          updated_at?: string
        }
        Update: {
          assigned_to_user_id?: string | null
          completed_end_at?: string | null
          contact_id?: string
          created_at?: string
          entered_start_at?: string | null
          id?: string
          pipeline_id?: string
          source_id?: string | null
          source_type?: string | null
          stage_id?: string
          stage_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_pipeline_contacts_contact_id"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_pipeline_contacts_pipeline_id"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_pipeline_contacts_stage_id"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          color: string | null
          created_at: string
          id: string
          is_end_step: boolean
          is_start_step: boolean
          name: string
          pipeline_id: string
          stage_order: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          is_end_step?: boolean
          is_start_step?: boolean
          name: string
          pipeline_id: string
          stage_order: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          is_end_step?: boolean
          is_start_step?: boolean
          name?: string
          pipeline_id?: string
          stage_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_pipeline_stages_pipeline_id"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_team_members: {
        Row: {
          created_at: string
          id: string
          pipeline_id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pipeline_id: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pipeline_id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_team_members_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      pipelines: {
        Row: {
          created_at: string
          description: string | null
          flow_order: number | null
          icon: string | null
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          flow_order?: number | null
          icon?: string | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          flow_order?: number | null
          icon?: string | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          department: string | null
          email: string
          full_name: string | null
          id: string
          job_title: string | null
          location: string | null
          onboarding_completed: boolean | null
          onboarding_dismissed: boolean | null
          onboarding_progress: Json | null
          phone: string | null
          updated_at: string
          use_twilio_integration: boolean | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          department?: string | null
          email: string
          full_name?: string | null
          id?: string
          job_title?: string | null
          location?: string | null
          onboarding_completed?: boolean | null
          onboarding_dismissed?: boolean | null
          onboarding_progress?: Json | null
          phone?: string | null
          updated_at?: string
          use_twilio_integration?: boolean | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          department?: string | null
          email?: string
          full_name?: string | null
          id?: string
          job_title?: string | null
          location?: string | null
          onboarding_completed?: boolean | null
          onboarding_dismissed?: boolean | null
          onboarding_progress?: Json | null
          phone?: string | null
          updated_at?: string
          use_twilio_integration?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      sms_messages: {
        Row: {
          body: string
          contact_id: string
          created_at: string
          direction: string
          error_code: string | null
          error_message: string | null
          from_number: string
          id: string
          media_urls: Json | null
          metadata: Json | null
          organization_id: string
          sent_by_user_id: string | null
          status: string
          to_number: string
          twilio_message_sid: string
          twilio_phone_number_id: string | null
          updated_at: string
        }
        Insert: {
          body: string
          contact_id: string
          created_at?: string
          direction: string
          error_code?: string | null
          error_message?: string | null
          from_number: string
          id?: string
          media_urls?: Json | null
          metadata?: Json | null
          organization_id: string
          sent_by_user_id?: string | null
          status?: string
          to_number: string
          twilio_message_sid: string
          twilio_phone_number_id?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          contact_id?: string
          created_at?: string
          direction?: string
          error_code?: string | null
          error_message?: string | null
          from_number?: string
          id?: string
          media_urls?: Json | null
          metadata?: Json | null
          organization_id?: string
          sent_by_user_id?: string | null
          status?: string
          to_number?: string
          twilio_message_sid?: string
          twilio_phone_number_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_twilio_phone_number_id_fkey"
            columns: ["twilio_phone_number_id"]
            isOneToOne: false
            referencedRelation: "twilio_phone_numbers"
            referencedColumns: ["id"]
          },
        ]
      }
      system_user_roles: {
        Row: {
          granted_at: string | null
          granted_by: string | null
          id: string
          notes: string | null
          role: Database["public"]["Enums"]["system_role"]
          user_id: string
        }
        Insert: {
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          notes?: string | null
          role: Database["public"]["Enums"]["system_role"]
          user_id: string
        }
        Update: {
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          notes?: string | null
          role?: Database["public"]["Enums"]["system_role"]
          user_id?: string
        }
        Relationships: []
      }
      twilio_phone_numbers: {
        Row: {
          assigned_to_user_id: string | null
          capabilities: Json | null
          created_at: string
          friendly_name: string | null
          id: string
          is_primary: boolean | null
          organization_id: string
          phone_number: string
          provisioned_at: string
          released_at: string | null
          sid: string
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to_user_id?: string | null
          capabilities?: Json | null
          created_at?: string
          friendly_name?: string | null
          id?: string
          is_primary?: boolean | null
          organization_id: string
          phone_number: string
          provisioned_at?: string
          released_at?: string | null
          sid: string
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to_user_id?: string | null
          capabilities?: Json | null
          created_at?: string
          friendly_name?: string | null
          id?: string
          is_primary?: boolean | null
          organization_id?: string
          phone_number?: string
          provisioned_at?: string
          released_at?: string | null
          sid?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "twilio_phone_numbers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "twilio_phone_numbers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_login_events: {
        Row: {
          id: string
          logged_in_at: string | null
          organization_id: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          logged_in_at?: string | null
          organization_id?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          logged_in_at?: string | null
          organization_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_login_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_login_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_logins: {
        Row: {
          date: string
          id: string
          logged_in_at: string
          organization_id: string
          user_id: string
        }
        Insert: {
          date?: string
          id?: string
          logged_in_at?: string
          organization_id: string
          user_id: string
        }
        Update: {
          date?: string
          id?: string
          logged_in_at?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_logins_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_logins_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      impersonation_audit_log: {
        Row: {
          actions_count: number | null
          admin_email: string | null
          admin_name: string | null
          duration_minutes: number | null
          ended_at: string | null
          ip_address: string | null
          is_active: boolean | null
          organization_name: string | null
          reason: string | null
          session_id: string | null
          started_at: string | null
          target_user_email: string | null
          target_user_name: string | null
        }
        Relationships: []
      }
      organization_health_view: {
        Row: {
          active_users: number | null
          admin_email: string | null
          admin_name: string | null
          admin_user_id: string | null
          ai_uses_30d: number | null
          avg_weekly_activity: number | null
          contacts_count: number | null
          created_at: string | null
          flows_count: number | null
          health_score: number | null
          id: string | null
          last_login: string | null
          last_pco_sync: string | null
          name: string | null
          plan_tier: string | null
          slug: string | null
          subscription_status: string | null
          total_logins_30d: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      calculate_health_score_v2: { Args: { org_id: string }; Returns: Json }
      calculate_organization_health_score: {
        Args: { org_id: string }
        Returns: number
      }
      create_default_pipelines: { Args: { org_id: string }; Returns: undefined }
      end_impersonation_session: {
        Args: { _session_id: string }
        Returns: boolean
      }
      get_flow_role: {
        Args: { _pipeline_id: string; _user_id: string }
        Returns: string
      }
      get_organizations_health_data: {
        Args: never
        Returns: {
          active_users: number
          admin_email: string
          admin_name: string
          admin_user_id: string
          ai_uses_30d: number
          avg_weekly_activity: number
          contacts_count: number
          created_at: string
          flows_count: number
          health_score: number
          id: string
          last_login: string
          last_pco_sync: string
          name: string
          plan_tier: string
          slug: string
          subscription_status: string
          total_logins_30d: number
        }[]
      }
      get_user_organization_role: {
        Args: { _organization_id: string; _user_id: string }
        Returns: string
      }
      get_user_system_role: { Args: { _user_id: string }; Returns: string }
      increment_ai_stat: {
        Args: { org_id: string; stat_column: string }
        Returns: undefined
      }
      is_currently_impersonating: {
        Args: { _admin_user_id: string }
        Returns: boolean
      }
      is_flow_team_member: {
        Args: { _pipeline_id: string; _user_id: string }
        Returns: boolean
      }
      is_system_admin: { Args: { _user_id: string }; Returns: boolean }
      is_user_in_organization: {
        Args: { _organization_id: string; _user_id: string }
        Returns: boolean
      }
      log_impersonation_action: {
        Args: {
          _action_description: string
          _action_type: string
          _metadata?: Json
          _page_url?: string
          _session_id: string
        }
        Returns: string
      }
      start_impersonation_session: {
        Args: {
          _ip_address?: string
          _reason: string
          _target_org_id: string
          _user_agent?: string
        }
        Returns: string
      }
      track_pco_sync: {
        Args: { p_org_id: string; p_sync_type?: string }
        Returns: undefined
      }
      track_user_login: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      system_role: "super_admin" | "support_admin" | "viewer"
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
      system_role: ["super_admin", "support_admin", "viewer"],
    },
  },
} as const
