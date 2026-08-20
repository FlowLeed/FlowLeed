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
      ai_suggestion_feedback: {
        Row: {
          action_taken: string | null
          contact_id: string
          created_at: string
          feedback_type: string
          id: string
          metadata: Json | null
          notes: string | null
          organization_id: string
          suggestion_description: string
          suggestion_title: string
          suggestion_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_taken?: string | null
          contact_id: string
          created_at?: string
          feedback_type: string
          id?: string
          metadata?: Json | null
          notes?: string | null
          organization_id: string
          suggestion_description: string
          suggestion_title: string
          suggestion_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_taken?: string | null
          contact_id?: string
          created_at?: string
          feedback_type?: string
          id?: string
          metadata?: Json | null
          notes?: string | null
          organization_id?: string
          suggestion_description?: string
          suggestion_title?: string
          suggestion_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_suggestion_feedback_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_suggestion_feedback_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_suggestion_feedback_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
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
      campuses: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          id: string
          is_primary: boolean | null
          name: string
          organization_id: string
          pco_campus_id: string
          state: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean | null
          name: string
          organization_id: string
          pco_campus_id: string
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean | null
          name?: string
          organization_id?: string
          pco_campus_id?: string
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campuses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campuses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          created_at: string
          id: string
          messages: Json
          organization_id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          messages?: Json
          organization_id: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          messages?: Json
          organization_id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      church_health_findings: {
        Row: {
          contact_ids: string[]
          created_at: string
          description: string | null
          id: string
          key: string
          metric_label: string | null
          metric_value: number | null
          report_id: string
          section: string
          severity: string
          sort_order: number
          title: string
        }
        Insert: {
          contact_ids?: string[]
          created_at?: string
          description?: string | null
          id?: string
          key: string
          metric_label?: string | null
          metric_value?: number | null
          report_id: string
          section: string
          severity?: string
          sort_order?: number
          title: string
        }
        Update: {
          contact_ids?: string[]
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          metric_label?: string | null
          metric_value?: number | null
          report_id?: string
          section?: string
          severity?: string
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "church_health_findings_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "church_health_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      church_health_reports: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          error: string | null
          generated_at: string | null
          id: string
          metrics: Json
          organization_id: string
          overall_score: number | null
          pdf_storage_path: string | null
          section_scores: Json
          share_enabled: boolean
          share_token: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          error?: string | null
          generated_at?: string | null
          id?: string
          metrics?: Json
          organization_id: string
          overall_score?: number | null
          pdf_storage_path?: string | null
          section_scores?: Json
          share_enabled?: boolean
          share_token?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          error?: string | null
          generated_at?: string | null
          id?: string
          metrics?: Json
          organization_id?: string
          overall_score?: number | null
          pdf_storage_path?: string | null
          section_scores?: Json
          share_enabled?: boolean
          share_token?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "church_health_reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "church_health_reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      church_online_events: {
        Row: {
          contact_id: string | null
          created_at: string
          data: Json
          error_message: string | null
          event_id: string
          event_type: string
          id: string
          integration_id: string
          organization_id: string
          processed_at: string | null
          subject: string | null
          updated_at: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          data?: Json
          error_message?: string | null
          event_id: string
          event_type: string
          id?: string
          integration_id: string
          organization_id: string
          processed_at?: string | null
          subject?: string | null
          updated_at?: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          data?: Json
          error_message?: string | null
          event_id?: string
          event_type?: string
          id?: string
          integration_id?: string
          organization_id?: string
          processed_at?: string | null
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "church_online_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "church_online_events_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "church_online_events_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "church_online_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "church_online_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      church_online_flow_automations: {
        Row: {
          create_contact_if_missing: boolean
          created_at: string
          event_filter: Json | null
          event_type: string
          flow_moment_type_id: string | null
          id: string
          integration_id: string
          is_active: boolean
          organization_id: string
          pipeline_id: string | null
          stage_id: string | null
          updated_at: string
        }
        Insert: {
          create_contact_if_missing?: boolean
          created_at?: string
          event_filter?: Json | null
          event_type: string
          flow_moment_type_id?: string | null
          id?: string
          integration_id: string
          is_active?: boolean
          organization_id: string
          pipeline_id?: string | null
          stage_id?: string | null
          updated_at?: string
        }
        Update: {
          create_contact_if_missing?: boolean
          created_at?: string
          event_filter?: Json | null
          event_type?: string
          flow_moment_type_id?: string | null
          id?: string
          integration_id?: string
          is_active?: boolean
          organization_id?: string
          pipeline_id?: string | null
          stage_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "church_online_flow_automations_flow_moment_type_id_fkey"
            columns: ["flow_moment_type_id"]
            isOneToOne: false
            referencedRelation: "flow_moment_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "church_online_flow_automations_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "church_online_flow_automations_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "church_online_flow_automations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "church_online_flow_automations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "church_online_flow_automations_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "church_online_flow_automations_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
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
      contact_engagement_scores: {
        Row: {
          contact_id: string
          engagement_level: string | null
          last_checkin_at: string | null
          organization_id: string
          score: number | null
          signal: string | null
          streak_weeks: number | null
          total_checkins_30d: number | null
          total_checkins_90d: number | null
          updated_at: string
          volunteer_checkins_90d: number | null
          weeks_attended_last_12: number | null
        }
        Insert: {
          contact_id: string
          engagement_level?: string | null
          last_checkin_at?: string | null
          organization_id: string
          score?: number | null
          signal?: string | null
          streak_weeks?: number | null
          total_checkins_30d?: number | null
          total_checkins_90d?: number | null
          updated_at?: string
          volunteer_checkins_90d?: number | null
          weeks_attended_last_12?: number | null
        }
        Update: {
          contact_id?: string
          engagement_level?: string | null
          last_checkin_at?: string | null
          organization_id?: string
          score?: number | null
          signal?: string | null
          streak_weeks?: number | null
          total_checkins_30d?: number | null
          total_checkins_90d?: number | null
          updated_at?: string
          volunteer_checkins_90d?: number | null
          weeks_attended_last_12?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_engagement_scores_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_engagement_scores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_engagement_scores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      contact_import_rows: {
        Row: {
          contact_id: string | null
          created_at: string
          id: string
          import_id: string
          outcome: string
          raw: Json | null
          reason: string | null
          row_number: number
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          id?: string
          import_id: string
          outcome: string
          raw?: Json | null
          reason?: string | null
          row_number: number
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          id?: string
          import_id?: string
          outcome?: string
          raw?: Json | null
          reason?: string | null
          row_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "contact_import_rows_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_import_rows_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "contact_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_imports: {
        Row: {
          created_at: string
          created_by_user_id: string
          created_count: number
          enrolled_count: number
          error_message: string | null
          file_name: string
          id: string
          import_tag: string | null
          mapping: Json
          options: Json
          organization_id: string
          pipeline_id: string | null
          skipped_count: number
          stage_id: string | null
          status: string
          total_rows: number
          undone_at: string | null
          updated_at: string
          updated_count: number
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          created_count?: number
          enrolled_count?: number
          error_message?: string | null
          file_name: string
          id?: string
          import_tag?: string | null
          mapping?: Json
          options?: Json
          organization_id: string
          pipeline_id?: string | null
          skipped_count?: number
          stage_id?: string | null
          status?: string
          total_rows?: number
          undone_at?: string | null
          updated_at?: string
          updated_count?: number
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          created_count?: number
          enrolled_count?: number
          error_message?: string | null
          file_name?: string
          id?: string
          import_tag?: string | null
          mapping?: Json
          options?: Json
          organization_id?: string
          pipeline_id?: string | null
          skipped_count?: number
          stage_id?: string | null
          status?: string
          total_rows?: number
          undone_at?: string | null
          updated_at?: string
          updated_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "contact_imports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_imports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_imports_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_imports_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
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
      contact_markers: {
        Row: {
          computed_at: string
          contact_id: string
          id: string
          marker_key: string
          organization_id: string
          polarity: string
          value_numeric: number | null
          value_text: string | null
        }
        Insert: {
          computed_at?: string
          contact_id: string
          id?: string
          marker_key: string
          organization_id: string
          polarity: string
          value_numeric?: number | null
          value_text?: string | null
        }
        Update: {
          computed_at?: string
          contact_id?: string
          id?: string
          marker_key?: string
          organization_id?: string
          polarity?: string
          value_numeric?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_markers_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_markers_marker_key_fkey"
            columns: ["marker_key"]
            isOneToOne: false
            referencedRelation: "marker_definitions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "contact_markers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_markers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          campus_id: string | null
          created_at: string
          email: string | null
          id: string
          is_demo: boolean
          last_synced_at: string | null
          name: string
          notes: string | null
          organization_id: string
          pc_household_id: string | null
          pc_membership: string | null
          pc_person_id: string | null
          phone: string | null
          source_type: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to_user_id?: string | null
          avatar?: string | null
          campus_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_demo?: boolean
          last_synced_at?: string | null
          name: string
          notes?: string | null
          organization_id: string
          pc_household_id?: string | null
          pc_membership?: string | null
          pc_person_id?: string | null
          phone?: string | null
          source_type?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to_user_id?: string | null
          avatar?: string | null
          campus_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_demo?: boolean
          last_synced_at?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          pc_household_id?: string | null
          pc_membership?: string | null
          pc_person_id?: string | null
          phone?: string | null
          source_type?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
        ]
      }
      content_analyses: {
        Row: {
          created_at: string
          generated_at: string
          id: string
          impact_score: number | null
          key_quotes: Json | null
          model: string | null
          organization_id: string
          story_patterns: Json | null
          summary: string | null
          themes: string[] | null
          video_id: string
        }
        Insert: {
          created_at?: string
          generated_at?: string
          id?: string
          impact_score?: number | null
          key_quotes?: Json | null
          model?: string | null
          organization_id: string
          story_patterns?: Json | null
          summary?: string | null
          themes?: string[] | null
          video_id: string
        }
        Update: {
          created_at?: string
          generated_at?: string
          id?: string
          impact_score?: number | null
          key_quotes?: Json | null
          model?: string | null
          organization_id?: string
          story_patterns?: Json | null
          summary?: string | null
          themes?: string[] | null
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_analyses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_analyses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_analyses_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "content_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      content_chat_messages: {
        Row: {
          citations: Json | null
          content: string
          created_at: string
          id: string
          role: string
          session_id: string
        }
        Insert: {
          citations?: Json | null
          content: string
          created_at?: string
          id?: string
          role: string
          session_id: string
        }
        Update: {
          citations?: Json | null
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "content_chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      content_chat_sessions: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          title: string | null
          updated_at: string
          user_id: string
          video_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          title?: string | null
          updated_at?: string
          user_id: string
          video_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_chat_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_chat_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_chat_sessions_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "content_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      content_transcript_chunks: {
        Row: {
          chunk_index: number
          created_at: string
          embedding: string | null
          end_seconds: number
          id: string
          organization_id: string
          start_seconds: number
          text: string
          video_id: string
        }
        Insert: {
          chunk_index: number
          created_at?: string
          embedding?: string | null
          end_seconds?: number
          id?: string
          organization_id: string
          start_seconds?: number
          text: string
          video_id: string
        }
        Update: {
          chunk_index?: number
          created_at?: string
          embedding?: string | null
          end_seconds?: number
          id?: string
          organization_id?: string
          start_seconds?: number
          text?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_transcript_chunks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_transcript_chunks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_transcript_chunks_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "content_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      content_videos: {
        Row: {
          channel_id: string | null
          channel_name: string | null
          consent_level: Database["public"]["Enums"]["content_consent_level"]
          created_at: string
          description: string | null
          duration_seconds: number | null
          error_message: string | null
          id: string
          ingest_status: Database["public"]["Enums"]["content_ingest_status"]
          ingested_by: string | null
          is_featured: boolean
          last_retry_at: string | null
          organization_id: string
          published_at: string | null
          retry_count: number
          short_description: string | null
          thumbnail_url: string | null
          title: string | null
          updated_at: string
          url: string
          youtube_id: string
        }
        Insert: {
          channel_id?: string | null
          channel_name?: string | null
          consent_level?: Database["public"]["Enums"]["content_consent_level"]
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          ingest_status?: Database["public"]["Enums"]["content_ingest_status"]
          ingested_by?: string | null
          is_featured?: boolean
          last_retry_at?: string | null
          organization_id: string
          published_at?: string | null
          retry_count?: number
          short_description?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          url: string
          youtube_id: string
        }
        Update: {
          channel_id?: string | null
          channel_name?: string | null
          consent_level?: Database["public"]["Enums"]["content_consent_level"]
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          ingest_status?: Database["public"]["Enums"]["content_ingest_status"]
          ingested_by?: string | null
          is_featured?: boolean
          last_retry_at?: string | null
          organization_id?: string
          published_at?: string | null
          retry_count?: number
          short_description?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          url?: string
          youtube_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_videos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_videos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_signal_contacts: {
        Row: {
          cleared_at: string | null
          contact_id: string
          id: string
          matched_at: string
          organization_id: string
          signal_id: string
        }
        Insert: {
          cleared_at?: string | null
          contact_id: string
          id?: string
          matched_at?: string
          organization_id: string
          signal_id: string
        }
        Update: {
          cleared_at?: string | null
          contact_id?: string
          id?: string
          matched_at?: string
          organization_id?: string
          signal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_signal_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_signal_contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_signal_contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_signal_contacts_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "custom_signals"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_signal_rules: {
        Row: {
          conditions: Json
          created_at: string
          id: string
          rule_combinator: string
          signal_id: string
          updated_at: string
        }
        Insert: {
          conditions?: Json
          created_at?: string
          id?: string
          rule_combinator?: string
          signal_id: string
          updated_at?: string
        }
        Update: {
          conditions?: Json
          created_at?: string
          id?: string
          rule_combinator?: string
          signal_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_signal_rules_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: true
            referencedRelation: "custom_signals"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_signals: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          enabled: boolean
          id: string
          key: string
          label: string
          organization_id: string
          polarity: string
          severity: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean
          id?: string
          key: string
          label: string
          organization_id: string
          polarity?: string
          severity?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean
          id?: string
          key?: string
          label?: string
          organization_id?: string
          polarity?: string
          severity?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_signals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_signals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_verification_tokens: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          metadata: Json | null
          new_email: string
          token: string
          token_hash: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          metadata?: Json | null
          new_email: string
          token: string
          token_hash: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          metadata?: Json | null
          new_email?: string
          token?: string
          token_hash?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      flow_moment_types: {
        Row: {
          category: string
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
          weight: number
        }
        Insert: {
          category?: string
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
          weight?: number
        }
        Update: {
          category?: string
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "flow_moment_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_moment_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_moments: {
        Row: {
          contact_id: string
          created_at: string
          created_by_user_id: string | null
          flow_moment_type_id: string
          id: string
          metadata: Json | null
          occurred_at: string
          source_reference: string
          source_system: string
          updated_at: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          created_by_user_id?: string | null
          flow_moment_type_id: string
          id?: string
          metadata?: Json | null
          occurred_at?: string
          source_reference: string
          source_system?: string
          updated_at?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          created_by_user_id?: string | null
          flow_moment_type_id?: string
          id?: string
          metadata?: Json | null
          occurred_at?: string
          source_reference?: string
          source_system?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flow_moments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_moments_flow_moment_type_id_fkey"
            columns: ["flow_moment_type_id"]
            isOneToOne: false
            referencedRelation: "flow_moment_types"
            referencedColumns: ["id"]
          },
        ]
      }
      form_fields: {
        Row: {
          created_at: string
          field_key: string
          field_type: string
          form_id: string
          help_text: string | null
          id: string
          label: string
          options: Json | null
          placeholder: string | null
          required: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          field_key: string
          field_type: string
          form_id: string
          help_text?: string | null
          id?: string
          label: string
          options?: Json | null
          placeholder?: string | null
          required?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          field_key?: string
          field_type?: string
          form_id?: string
          help_text?: string | null
          id?: string
          label?: string
          options?: Json | null
          placeholder?: string | null
          required?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_fields_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          contact_id: string | null
          created_at: string
          data: Json
          form_id: string
          id: string
          ip: string | null
          is_preview: boolean
          organization_id: string
          user_agent: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          data?: Json
          form_id: string
          id?: string
          ip?: string | null
          is_preview?: boolean
          organization_id: string
          user_agent?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          data?: Json
          form_id?: string
          id?: string
          ip?: string | null
          is_preview?: boolean
          organization_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          brand_color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_published: boolean
          logo_url: string | null
          name: string
          organization_id: string
          pipeline_id: string | null
          redirect_url: string | null
          routing_rules: Json | null
          slug: string
          stage_id: string | null
          submission_count: number
          success_message: string | null
          updated_at: string
        }
        Insert: {
          brand_color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_published?: boolean
          logo_url?: string | null
          name: string
          organization_id: string
          pipeline_id?: string | null
          redirect_url?: string | null
          routing_rules?: Json | null
          slug: string
          stage_id?: string | null
          submission_count?: number
          success_message?: string | null
          updated_at?: string
        }
        Update: {
          brand_color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_published?: boolean
          logo_url?: string | null
          name?: string
          organization_id?: string
          pipeline_id?: string | null
          redirect_url?: string | null
          routing_rules?: Json | null
          slug?: string
          stage_id?: string | null
          submission_count?: number
          success_message?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forms_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forms_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      group_attendance: {
        Row: {
          checked_in_at: string | null
          checked_in_by_user_id: string | null
          contact_id: string | null
          created_at: string
          group_meeting_id: string
          group_member_id: string | null
          id: string
          notes: string | null
          pc_person_id: string | null
          pco_attendance_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          checked_in_at?: string | null
          checked_in_by_user_id?: string | null
          contact_id?: string | null
          created_at?: string
          group_meeting_id: string
          group_member_id?: string | null
          id?: string
          notes?: string | null
          pc_person_id?: string | null
          pco_attendance_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          checked_in_at?: string | null
          checked_in_by_user_id?: string | null
          contact_id?: string | null
          created_at?: string
          group_meeting_id?: string
          group_member_id?: string | null
          id?: string
          notes?: string | null
          pc_person_id?: string | null
          pco_attendance_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_attendance_checked_in_by_user_id_fkey"
            columns: ["checked_in_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "group_attendance_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_attendance_group_meeting_id_fkey"
            columns: ["group_meeting_id"]
            isOneToOne: false
            referencedRelation: "group_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_attendance_group_member_id_fkey"
            columns: ["group_member_id"]
            isOneToOne: false
            referencedRelation: "group_members"
            referencedColumns: ["id"]
          },
        ]
      }
      group_campuses: {
        Row: {
          campus_id: string
          created_at: string
          group_id: string
        }
        Insert: {
          campus_id: string
          created_at?: string
          group_id: string
        }
        Update: {
          campus_id?: string
          created_at?: string
          group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_campuses_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_campuses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_meetings: {
        Row: {
          attendance_submitted: boolean
          created_at: string
          created_by_user_id: string | null
          description: string | null
          duration_minutes: number | null
          group_id: string
          id: string
          location: string | null
          meeting_date: string
          meeting_type: string | null
          notes: string | null
          pco_event_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          attendance_submitted?: boolean
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          duration_minutes?: number | null
          group_id: string
          id?: string
          location?: string | null
          meeting_date: string
          meeting_type?: string | null
          notes?: string | null
          pco_event_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          attendance_submitted?: boolean
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          duration_minutes?: number | null
          group_id?: string
          id?: string
          location?: string | null
          meeting_date?: string
          meeting_type?: string | null
          notes?: string | null
          pco_event_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_meetings_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "group_meetings_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          attendance_count: number | null
          contact_id: string
          created_at: string
          group_id: string
          id: string
          joined_at: string
          last_attended_at: string | null
          notes: string | null
          pco_membership_id: string | null
          pco_person_id: string | null
          role: string
          status: string
          synced_at: string | null
          updated_at: string
        }
        Insert: {
          attendance_count?: number | null
          contact_id: string
          created_at?: string
          group_id: string
          id?: string
          joined_at?: string
          last_attended_at?: string | null
          notes?: string | null
          pco_membership_id?: string | null
          pco_person_id?: string | null
          role?: string
          status?: string
          synced_at?: string | null
          updated_at?: string
        }
        Update: {
          attendance_count?: number | null
          contact_id?: string
          created_at?: string
          group_id?: string
          id?: string
          joined_at?: string
          last_attended_at?: string | null
          notes?: string | null
          pco_membership_id?: string | null
          pco_person_id?: string | null
          role?: string
          status?: string
          synced_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_settings: {
        Row: {
          attendance_reminder_day: number | null
          attendance_reminder_enabled: boolean
          auto_inactive_weeks: number | null
          communication_reply_to: string | null
          created_at: string
          default_allow_public_signup: boolean | null
          default_capacity: number | null
          default_meeting_frequency: string | null
          default_visibility: string | null
          directory_enabled: boolean
          directory_hero_subtitle: string | null
          directory_hero_title: string | null
          directory_show_capacity: boolean
          directory_show_location: boolean
          directory_show_meeting_time: boolean
          leader_notification_body: string | null
          leader_notification_enabled: boolean
          leader_notification_subject: string | null
          organization_id: string
          signup_confirmation_body: string | null
          signup_confirmation_enabled: boolean
          signup_confirmation_subject: string | null
          updated_at: string
        }
        Insert: {
          attendance_reminder_day?: number | null
          attendance_reminder_enabled?: boolean
          auto_inactive_weeks?: number | null
          communication_reply_to?: string | null
          created_at?: string
          default_allow_public_signup?: boolean | null
          default_capacity?: number | null
          default_meeting_frequency?: string | null
          default_visibility?: string | null
          directory_enabled?: boolean
          directory_hero_subtitle?: string | null
          directory_hero_title?: string | null
          directory_show_capacity?: boolean
          directory_show_location?: boolean
          directory_show_meeting_time?: boolean
          leader_notification_body?: string | null
          leader_notification_enabled?: boolean
          leader_notification_subject?: string | null
          organization_id: string
          signup_confirmation_body?: string | null
          signup_confirmation_enabled?: boolean
          signup_confirmation_subject?: string | null
          updated_at?: string
        }
        Update: {
          attendance_reminder_day?: number | null
          attendance_reminder_enabled?: boolean
          auto_inactive_weeks?: number | null
          communication_reply_to?: string | null
          created_at?: string
          default_allow_public_signup?: boolean | null
          default_capacity?: number | null
          default_meeting_frequency?: string | null
          default_visibility?: string | null
          directory_enabled?: boolean
          directory_hero_subtitle?: string | null
          directory_hero_title?: string | null
          directory_show_capacity?: boolean
          directory_show_location?: boolean
          directory_show_meeting_time?: boolean
          leader_notification_body?: string | null
          leader_notification_enabled?: boolean
          leader_notification_subject?: string | null
          organization_id?: string
          signup_confirmation_body?: string | null
          signup_confirmation_enabled?: boolean
          signup_confirmation_subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organization_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      group_signup_requests: {
        Row: {
          contact_id: string | null
          created_at: string
          email: string
          group_id: string
          id: string
          name: string
          notes: string | null
          phone: string | null
          processed_at: string | null
          processed_by_user_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          email: string
          group_id: string
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          processed_at?: string | null
          processed_by_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          email?: string
          group_id?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          processed_at?: string | null
          processed_by_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_signup_requests_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_signup_requests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_signup_requests_processed_by_user_id_fkey"
            columns: ["processed_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      group_type_definitions: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          is_hidden: boolean
          is_system: boolean
          key: string
          label: string
          organization_id: string
          pco_group_type_id: string | null
          sort_order: number
          source: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          is_hidden?: boolean
          is_system?: boolean
          key: string
          label: string
          organization_id: string
          pco_group_type_id?: string | null
          sort_order?: number
          source?: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          is_hidden?: boolean
          is_system?: boolean
          key?: string
          label?: string
          organization_id?: string
          pco_group_type_id?: string | null
          sort_order?: number
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_type_definitions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_type_definitions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          allow_public_signup: boolean
          archived_at: string | null
          campus_id: string | null
          capacity: number | null
          co_leader_user_id: string | null
          created_at: string
          description: string | null
          group_type: string
          id: string
          image_url: string | null
          is_demo: boolean
          last_meeting_at: string | null
          last_synced_at: string | null
          leader_user_id: string | null
          location: string | null
          meeting_day: string | null
          meeting_frequency: string | null
          meeting_time: string | null
          member_count: number
          metadata: Json | null
          name: string
          organization_id: string
          pco_campus_id: string | null
          pco_group_id: string | null
          pco_group_type_id: string | null
          pco_group_type_name: string | null
          pco_location_id: string | null
          public_signup_token: string | null
          status: string
          tags: string[] | null
          updated_at: string
          visibility: string
        }
        Insert: {
          allow_public_signup?: boolean
          archived_at?: string | null
          campus_id?: string | null
          capacity?: number | null
          co_leader_user_id?: string | null
          created_at?: string
          description?: string | null
          group_type?: string
          id?: string
          image_url?: string | null
          is_demo?: boolean
          last_meeting_at?: string | null
          last_synced_at?: string | null
          leader_user_id?: string | null
          location?: string | null
          meeting_day?: string | null
          meeting_frequency?: string | null
          meeting_time?: string | null
          member_count?: number
          metadata?: Json | null
          name: string
          organization_id: string
          pco_campus_id?: string | null
          pco_group_id?: string | null
          pco_group_type_id?: string | null
          pco_group_type_name?: string | null
          pco_location_id?: string | null
          public_signup_token?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
          visibility?: string
        }
        Update: {
          allow_public_signup?: boolean
          archived_at?: string | null
          campus_id?: string | null
          capacity?: number | null
          co_leader_user_id?: string | null
          created_at?: string
          description?: string | null
          group_type?: string
          id?: string
          image_url?: string | null
          is_demo?: boolean
          last_meeting_at?: string | null
          last_synced_at?: string | null
          leader_user_id?: string | null
          location?: string | null
          meeting_day?: string | null
          meeting_frequency?: string | null
          meeting_time?: string | null
          member_count?: number
          metadata?: Json | null
          name?: string
          organization_id?: string
          pco_campus_id?: string | null
          pco_group_id?: string | null
          pco_group_type_id?: string | null
          pco_group_type_name?: string | null
          pco_location_id?: string | null
          public_signup_token?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_co_leader_user_id_fkey"
            columns: ["co_leader_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "groups_leader_user_id_fkey"
            columns: ["leader_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "integration_list_mappings_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations_public"
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
          {
            foreignKeyName: "integration_logs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations_public"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          auth_type: string
          auto_sync_all_people: boolean | null
          created_at: string
          credentials: Json
          id: string
          last_full_sync_completed_at: string | null
          last_sync_at: string | null
          metadata: Json | null
          oauth_access_token: string | null
          oauth_connected_by_user_id: string | null
          oauth_refresh_token: string | null
          oauth_scopes: string | null
          oauth_token_expires_at: string | null
          organization_id: string
          provider_account_id: string | null
          provider_account_name: string | null
          service_name: string
          settings: Json
          status: string
          sync_frequency: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auth_type?: string
          auto_sync_all_people?: boolean | null
          created_at?: string
          credentials?: Json
          id?: string
          last_full_sync_completed_at?: string | null
          last_sync_at?: string | null
          metadata?: Json | null
          oauth_access_token?: string | null
          oauth_connected_by_user_id?: string | null
          oauth_refresh_token?: string | null
          oauth_scopes?: string | null
          oauth_token_expires_at?: string | null
          organization_id: string
          provider_account_id?: string | null
          provider_account_name?: string | null
          service_name: string
          settings?: Json
          status?: string
          sync_frequency?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auth_type?: string
          auto_sync_all_people?: boolean | null
          created_at?: string
          credentials?: Json
          id?: string
          last_full_sync_completed_at?: string | null
          last_sync_at?: string | null
          metadata?: Json | null
          oauth_access_token?: string | null
          oauth_connected_by_user_id?: string | null
          oauth_refresh_token?: string | null
          oauth_scopes?: string | null
          oauth_token_expires_at?: string | null
          organization_id?: string
          provider_account_id?: string | null
          provider_account_name?: string | null
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
          pipeline_assignments: Json
          pipeline_ids: string[]
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
          pipeline_assignments?: Json
          pipeline_ids?: string[]
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
          pipeline_assignments?: Json
          pipeline_ids?: string[]
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
      marker_definitions: {
        Row: {
          category: string
          created_at: string
          description: string
          is_phase_two: boolean
          key: string
          label: string
          polarity: string
          requires_integration: string | null
          sort_order: number
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          is_phase_two?: boolean
          key: string
          label: string
          polarity: string
          requires_integration?: string | null
          sort_order?: number
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          is_phase_two?: boolean
          key?: string
          label?: string
          polarity?: string
          requires_integration?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          contact_id: string | null
          created_at: string | null
          email_digest_sent: boolean | null
          email_digest_sent_at: string | null
          id: string
          interaction_id: string | null
          message: string
          metadata: Json | null
          organization_id: string
          pipeline_id: string | null
          read: boolean | null
          read_at: string | null
          title: string
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          email_digest_sent?: boolean | null
          email_digest_sent_at?: string | null
          id?: string
          interaction_id?: string | null
          message: string
          metadata?: Json | null
          organization_id: string
          pipeline_id?: string | null
          read?: boolean | null
          read_at?: string | null
          title: string
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          email_digest_sent?: boolean | null
          email_digest_sent_at?: string | null
          id?: string
          interaction_id?: string | null
          message?: string
          metadata?: Json | null
          organization_id?: string
          pipeline_id?: string | null
          read?: boolean | null
          read_at?: string | null
          title?: string
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_interaction_id_fkey"
            columns: ["interaction_id"]
            isOneToOne: false
            referencedRelation: "contact_interactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      org_engagement_snapshots: {
        Row: {
          count: number
          created_at: string
          engagement_level: string
          organization_id: string
          snapshot_date: string
        }
        Insert: {
          count?: number
          created_at?: string
          engagement_level: string
          organization_id: string
          snapshot_date: string
        }
        Update: {
          count?: number
          created_at?: string
          engagement_level?: string
          organization_id?: string
          snapshot_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_engagement_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_engagement_snapshots_organization_id_fkey"
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
      organization_features: {
        Row: {
          created_at: string
          enabled: boolean
          feature_key: string
          id: string
          organization_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          feature_key: string
          id?: string
          organization_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          created_at?: string
          enabled?: boolean
          feature_key?: string
          id?: string
          organization_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_features_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_features_organization_id_fkey"
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
          demo_cleared_at: string | null
          demo_seeded_at: string | null
          fl_admin_assigned_to: string | null
          fl_admin_notes: string | null
          health_score: number | null
          id: string
          last_activity_at: string | null
          last_payment_date: string | null
          logo_url: string | null
          name: string
          next_billing_date: string | null
          notes: string | null
          onboarding_completed: boolean | null
          onboarding_progress: Json | null
          onboarding_stage_entered_at: string | null
          onboarding_step: string | null
          pco_enforce_user_permissions: boolean
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
          demo_cleared_at?: string | null
          demo_seeded_at?: string | null
          fl_admin_assigned_to?: string | null
          fl_admin_notes?: string | null
          health_score?: number | null
          id?: string
          last_activity_at?: string | null
          last_payment_date?: string | null
          logo_url?: string | null
          name: string
          next_billing_date?: string | null
          notes?: string | null
          onboarding_completed?: boolean | null
          onboarding_progress?: Json | null
          onboarding_stage_entered_at?: string | null
          onboarding_step?: string | null
          pco_enforce_user_permissions?: boolean
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
          demo_cleared_at?: string | null
          demo_seeded_at?: string | null
          fl_admin_assigned_to?: string | null
          fl_admin_notes?: string | null
          health_score?: number | null
          id?: string
          last_activity_at?: string | null
          last_payment_date?: string | null
          logo_url?: string | null
          name?: string
          next_billing_date?: string | null
          notes?: string | null
          onboarding_completed?: boolean | null
          onboarding_progress?: Json | null
          onboarding_stage_entered_at?: string | null
          onboarding_step?: string | null
          pco_enforce_user_permissions?: boolean
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
      pco_checkins: {
        Row: {
          checked_in_at: string | null
          checked_out_at: string | null
          checkin_kind: string | null
          contact_id: string | null
          created_at: string
          event_name: string | null
          event_time_name: string | null
          id: string
          location_name: string | null
          metadata: Json | null
          organization_id: string
          pc_person_id: string
          pco_checkin_id: string
        }
        Insert: {
          checked_in_at?: string | null
          checked_out_at?: string | null
          checkin_kind?: string | null
          contact_id?: string | null
          created_at?: string
          event_name?: string | null
          event_time_name?: string | null
          id?: string
          location_name?: string | null
          metadata?: Json | null
          organization_id: string
          pc_person_id: string
          pco_checkin_id: string
        }
        Update: {
          checked_in_at?: string | null
          checked_out_at?: string | null
          checkin_kind?: string | null
          contact_id?: string | null
          created_at?: string
          event_name?: string | null
          event_time_name?: string | null
          id?: string
          location_name?: string | null
          metadata?: Json | null
          organization_id?: string
          pc_person_id?: string
          pco_checkin_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pco_checkins_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pco_checkins_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pco_checkins_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pco_moment_mappings: {
        Row: {
          condition_group: number
          created_at: string
          flow_moment_type_id: string
          id: string
          integration_id: string
          is_active: boolean
          last_synced_at: string | null
          organization_id: string
          pco_source_identifier: string
          pco_source_label: string
          pco_source_type: string
          pco_tab_name: string | null
          rule_combinator: string
          trigger_condition: Json
          updated_at: string
        }
        Insert: {
          condition_group?: number
          created_at?: string
          flow_moment_type_id: string
          id?: string
          integration_id: string
          is_active?: boolean
          last_synced_at?: string | null
          organization_id: string
          pco_source_identifier: string
          pco_source_label: string
          pco_source_type?: string
          pco_tab_name?: string | null
          rule_combinator?: string
          trigger_condition?: Json
          updated_at?: string
        }
        Update: {
          condition_group?: number
          created_at?: string
          flow_moment_type_id?: string
          id?: string
          integration_id?: string
          is_active?: boolean
          last_synced_at?: string | null
          organization_id?: string
          pco_source_identifier?: string
          pco_source_label?: string
          pco_source_type?: string
          pco_tab_name?: string | null
          rule_combinator?: string
          trigger_condition?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pco_moment_mappings_flow_moment_type_id_fkey"
            columns: ["flow_moment_type_id"]
            isOneToOne: false
            referencedRelation: "flow_moment_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pco_moment_mappings_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pco_moment_mappings_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pco_moment_mappings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pco_moment_mappings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pco_oauth_states: {
        Row: {
          consumed_at: string | null
          created_at: string
          expires_at: string
          nonce: string | null
          organization_id: string
          purpose: string
          redirect_to: string | null
          state: string
          user_id: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          nonce?: string | null
          organization_id: string
          purpose: string
          redirect_to?: string | null
          state: string
          user_id: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          nonce?: string | null
          organization_id?: string
          purpose?: string
          redirect_to?: string | null
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      pco_sync_debug_logs: {
        Row: {
          checked_at: string | null
          contact_id: string | null
          created_at: string | null
          field_data_count: number | null
          field_ids_returned: string[] | null
          id: string
          pc_person_id: string
          raw_response: Json | null
        }
        Insert: {
          checked_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          field_data_count?: number | null
          field_ids_returned?: string[] | null
          id?: string
          pc_person_id: string
          raw_response?: Json | null
        }
        Update: {
          checked_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          field_data_count?: number | null
          field_ids_returned?: string[] | null
          id?: string
          pc_person_id?: string
          raw_response?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "pco_sync_debug_logs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      pco_sync_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          integration_id: string
          list_mapping_id: string | null
          metadata: Json | null
          organization_id: string
          processed_contacts: number
          started_at: string
          status: string
          total_contacts: number
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          integration_id: string
          list_mapping_id?: string | null
          metadata?: Json | null
          organization_id: string
          processed_contacts?: number
          started_at?: string
          status?: string
          total_contacts?: number
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          integration_id?: string
          list_mapping_id?: string | null
          metadata?: Json | null
          organization_id?: string
          processed_contacts?: number
          started_at?: string
          status?: string
          total_contacts?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pco_sync_jobs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pco_sync_jobs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pco_sync_jobs_list_mapping_id_fkey"
            columns: ["list_mapping_id"]
            isOneToOne: false
            referencedRelation: "integration_list_mappings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pco_sync_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pco_sync_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pco_sync_queue: {
        Row: {
          chunk_data: Json
          chunk_number: number
          created_at: string
          error_message: string | null
          id: string
          organization_id: string
          processed_at: string | null
          retry_count: number
          status: string
          sync_job_id: string
          updated_at: string
        }
        Insert: {
          chunk_data: Json
          chunk_number: number
          created_at?: string
          error_message?: string | null
          id?: string
          organization_id: string
          processed_at?: string | null
          retry_count?: number
          status?: string
          sync_job_id: string
          updated_at?: string
        }
        Update: {
          chunk_data?: Json
          chunk_number?: number
          created_at?: string
          error_message?: string | null
          id?: string
          organization_id?: string
          processed_at?: string | null
          retry_count?: number
          status?: string
          sync_job_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_sync_queue_organization"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_sync_queue_organization"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pco_sync_queue_sync_job_id_fkey"
            columns: ["sync_job_id"]
            isOneToOne: false
            referencedRelation: "pco_sync_jobs"
            referencedColumns: ["id"]
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
          stage_entered_at: string | null
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
          stage_entered_at?: string | null
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
          stage_entered_at?: string | null
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
      pipeline_resources: {
        Row: {
          content: Json
          created_at: string
          created_by_user_id: string | null
          id: string
          last_edited_by_user_id: string | null
          organization_id: string
          pipeline_id: string
          updated_at: string
        }
        Insert: {
          content?: Json
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          last_edited_by_user_id?: string | null
          organization_id: string
          pipeline_id: string
          updated_at?: string
        }
        Update: {
          content?: Json
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          last_edited_by_user_id?: string | null
          organization_id?: string
          pipeline_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_resources_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_resources_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_resources_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: true
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          color: string | null
          created_at: string
          default_assignee_user_id: string | null
          description: string | null
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
          default_assignee_user_id?: string | null
          description?: string | null
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
          default_assignee_user_id?: string | null
          description?: string | null
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
          completion_moment_type_id: string | null
          created_at: string
          cycle_days: number | null
          description: string | null
          flow_order: number | null
          flow_type: string
          icon: string | null
          id: string
          is_demo: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          completion_moment_type_id?: string | null
          created_at?: string
          cycle_days?: number | null
          description?: string | null
          flow_order?: number | null
          flow_type?: string
          icon?: string | null
          id?: string
          is_demo?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          completion_moment_type_id?: string | null
          created_at?: string
          cycle_days?: number | null
          description?: string | null
          flow_order?: number | null
          flow_type?: string
          icon?: string | null
          id?: string
          is_demo?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipelines_completion_moment_type_id_fkey"
            columns: ["completion_moment_type_id"]
            isOneToOne: false
            referencedRelation: "flow_moment_types"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          department: string | null
          email: string
          email_verified_at: string | null
          full_name: string | null
          id: string
          job_title: string | null
          location: string | null
          notification_preferences: Json | null
          onboarding_completed: boolean | null
          onboarding_dismissed: boolean | null
          onboarding_progress: Json | null
          phone: string | null
          signup_intent: string | null
          signup_referrer: string | null
          signup_utm: Json | null
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
          email_verified_at?: string | null
          full_name?: string | null
          id?: string
          job_title?: string | null
          location?: string | null
          notification_preferences?: Json | null
          onboarding_completed?: boolean | null
          onboarding_dismissed?: boolean | null
          onboarding_progress?: Json | null
          phone?: string | null
          signup_intent?: string | null
          signup_referrer?: string | null
          signup_utm?: Json | null
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
          email_verified_at?: string | null
          full_name?: string | null
          id?: string
          job_title?: string | null
          location?: string | null
          notification_preferences?: Json | null
          onboarding_completed?: boolean | null
          onboarding_dismissed?: boolean | null
          onboarding_progress?: Json | null
          phone?: string | null
          signup_intent?: string | null
          signup_referrer?: string | null
          signup_utm?: Json | null
          updated_at?: string
          use_twilio_integration?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      signal_agent_configs: {
        Row: {
          allowed_actions: Json
          created_at: string
          default_assignee_strategy: string
          enabled: boolean
          id: string
          max_suggestions_per_day: number
          organization_id: string
          quiet_hours: Json
          updated_at: string
          watch_signals: Json
        }
        Insert: {
          allowed_actions?: Json
          created_at?: string
          default_assignee_strategy?: string
          enabled?: boolean
          id?: string
          max_suggestions_per_day?: number
          organization_id: string
          quiet_hours?: Json
          updated_at?: string
          watch_signals?: Json
        }
        Update: {
          allowed_actions?: Json
          created_at?: string
          default_assignee_strategy?: string
          enabled?: boolean
          id?: string
          max_suggestions_per_day?: number
          organization_id?: string
          quiet_hours?: Json
          updated_at?: string
          watch_signals?: Json
        }
        Relationships: [
          {
            foreignKeyName: "signal_agent_configs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organization_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signal_agent_configs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      signal_agent_rules: {
        Row: {
          action_params: Json
          created_at: string
          enabled: boolean
          id: string
          organization_id: string
          signal_key: string
          suggested_action: string
          updated_at: string
        }
        Insert: {
          action_params?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          organization_id: string
          signal_key: string
          suggested_action: string
          updated_at?: string
        }
        Update: {
          action_params?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          organization_id?: string
          signal_key?: string
          suggested_action?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "signal_agent_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signal_agent_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      signal_agent_suggestions: {
        Row: {
          action_payload: Json
          action_type: string
          assignee_user_id: string | null
          confidence: number | null
          contact_id: string
          created_at: string
          executed_at: string | null
          expires_at: string
          id: string
          organization_id: string
          reasoning: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          signal_key: string
          signal_source: string
          status: string
          updated_at: string
        }
        Insert: {
          action_payload?: Json
          action_type: string
          assignee_user_id?: string | null
          confidence?: number | null
          contact_id: string
          created_at?: string
          executed_at?: string | null
          expires_at?: string
          id?: string
          organization_id: string
          reasoning?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          signal_key: string
          signal_source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          action_payload?: Json
          action_type?: string
          assignee_user_id?: string | null
          confidence?: number | null
          contact_id?: string
          created_at?: string
          executed_at?: string | null
          expires_at?: string
          id?: string
          organization_id?: string
          reasoning?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          signal_key?: string
          signal_source?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "signal_agent_suggestions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signal_agent_suggestions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_health_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signal_agent_suggestions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      user_flow_preferences: {
        Row: {
          created_at: string | null
          id: string
          is_pinned: boolean | null
          pipeline_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_pinned?: boolean | null
          pipeline_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_pinned?: boolean | null
          pipeline_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_flow_preferences_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
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
      user_pco_connections: {
        Row: {
          created_at: string
          email: string | null
          id: string
          oauth_access_token: string | null
          oauth_refresh_token: string | null
          oauth_scopes: string | null
          oauth_token_expires_at: string | null
          organization_id: string
          pc_person_id: string | null
          permissions_json: Json
          permissions_refreshed_at: string | null
          provider_account_id: string | null
          status: string
          updated_at: string
          user_id: string
          visible_people_count: number
          visible_people_synced_at: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          oauth_access_token?: string | null
          oauth_refresh_token?: string | null
          oauth_scopes?: string | null
          oauth_token_expires_at?: string | null
          organization_id: string
          pc_person_id?: string | null
          permissions_json?: Json
          permissions_refreshed_at?: string | null
          provider_account_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
          visible_people_count?: number
          visible_people_synced_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          oauth_access_token?: string | null
          oauth_refresh_token?: string | null
          oauth_scopes?: string | null
          oauth_token_expires_at?: string | null
          organization_id?: string
          pc_person_id?: string | null
          permissions_json?: Json
          permissions_refreshed_at?: string | null
          provider_account_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          visible_people_count?: number
          visible_people_synced_at?: string | null
        }
        Relationships: []
      }
      user_pco_field_preferences: {
        Row: {
          created_at: string
          hide_empty: boolean
          id: string
          open_by_default: boolean
          organization_id: string
          selected_field_ids: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hide_empty?: boolean
          id?: string
          open_by_default?: boolean
          organization_id: string
          selected_field_ids?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          hide_empty?: boolean
          id?: string
          open_by_default?: boolean
          organization_id?: string
          selected_field_ids?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_pco_visible_people: {
        Row: {
          organization_id: string
          pc_person_id: string
          synced_at: string
          user_id: string
        }
        Insert: {
          organization_id: string
          pc_person_id: string
          synced_at?: string
          user_id: string
        }
        Update: {
          organization_id?: string
          pc_person_id?: string
          synced_at?: string
          user_id?: string
        }
        Relationships: []
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
      integrations_public: {
        Row: {
          auth_type: string | null
          auto_sync_all_people: boolean | null
          created_at: string | null
          id: string | null
          last_full_sync_completed_at: string | null
          last_sync_at: string | null
          metadata: Json | null
          oauth_connected_by_user_id: string | null
          oauth_scopes: string | null
          oauth_token_expires_at: string | null
          organization_id: string | null
          provider_account_id: string | null
          provider_account_name: string | null
          service_name: string | null
          settings: Json | null
          status: string | null
          sync_frequency: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          auth_type?: string | null
          auto_sync_all_people?: boolean | null
          created_at?: string | null
          id?: string | null
          last_full_sync_completed_at?: string | null
          last_sync_at?: string | null
          metadata?: Json | null
          oauth_connected_by_user_id?: string | null
          oauth_scopes?: string | null
          oauth_token_expires_at?: string | null
          organization_id?: string | null
          provider_account_id?: string | null
          provider_account_name?: string | null
          service_name?: string | null
          settings?: Json | null
          status?: string | null
          sync_frequency?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          auth_type?: string | null
          auto_sync_all_people?: boolean | null
          created_at?: string | null
          id?: string | null
          last_full_sync_completed_at?: string | null
          last_sync_at?: string | null
          metadata?: Json | null
          oauth_connected_by_user_id?: string | null
          oauth_scopes?: string | null
          oauth_token_expires_at?: string | null
          organization_id?: string | null
          provider_account_id?: string | null
          provider_account_name?: string | null
          service_name?: string | null
          settings?: Json | null
          status?: string | null
          sync_frequency?: string | null
          updated_at?: string | null
          user_id?: string | null
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
      user_pco_connections_public: {
        Row: {
          created_at: string | null
          email: string | null
          id: string | null
          oauth_scopes: string | null
          oauth_token_expires_at: string | null
          organization_id: string | null
          pc_person_id: string | null
          permissions_json: Json | null
          permissions_refreshed_at: string | null
          provider_account_id: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string | null
          oauth_scopes?: string | null
          oauth_token_expires_at?: string | null
          organization_id?: string | null
          pc_person_id?: string | null
          permissions_json?: Json | null
          permissions_refreshed_at?: string | null
          provider_account_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string | null
          oauth_scopes?: string | null
          oauth_token_expires_at?: string | null
          organization_id?: string | null
          pc_person_id?: string | null
          permissions_json?: Json | null
          permissions_refreshed_at?: string | null
          provider_account_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_delete_organization: {
        Args: { _org_id: string }
        Returns: undefined
      }
      admin_get_org_members_activity: {
        Args: { p_org_id: string }
        Returns: {
          avatar_url: string
          contacts_assigned: number
          email: string
          full_name: string
          interactions_30d: number
          joined_at: string
          last_login: string
          logins_30d: number
          logins_7d: number
          notes_30d: number
          role: string
          user_id: string
        }[]
      }
      calculate_engagement_scores: {
        Args: { p_org_id: string }
        Returns: undefined
      }
      calculate_health_score_v2: { Args: { org_id: string }; Returns: Json }
      calculate_organization_health_score: {
        Args: { org_id: string }
        Returns: number
      }
      can_user_see_contact: {
        Args: { _contact_id: string; _user: string }
        Returns: boolean
      }
      clear_demo_data_for_org: { Args: { _org_id: string }; Returns: undefined }
      create_assignment_notification: {
        Args: {
          _contact_id: string
          _interaction_id?: string
          _message: string
          _metadata?: Json
          _organization_id: string
          _pipeline_id: string
          _title: string
          _type: string
          _user_id: string
        }
        Returns: string
      }
      create_default_pipelines: { Args: { org_id: string }; Returns: undefined }
      create_personal_flow_for_user: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: string
      }
      delete_org_tag: {
        Args: { p_org_id: string; p_tag: string }
        Returns: number
      }
      end_impersonation_session: {
        Args: { _session_id: string }
        Returns: boolean
      }
      get_contact_signal: {
        Args: { p_contact_id: string }
        Returns: {
          category: string
          description: string
          engagement_level: string
          label: string
          marker_key: string
          polarity: string
          score: number
          signal: string
          sort_order: number
          value_numeric: number
          value_text: string
        }[]
      }
      get_engagement_snapshot: {
        Args: { p_as_of: string; p_org_id: string }
        Returns: {
          count: number
          engagement_level: string
          snapshot_date: string
        }[]
      }
      get_engagement_snapshot_series: {
        Args: { p_days?: number; p_org_id: string }
        Returns: {
          count: number
          engagement_level: string
          snapshot_date: string
        }[]
      }
      get_flow_role: {
        Args: { _pipeline_id: string; _user_id: string }
        Returns: string
      }
      get_impersonation_org_id: {
        Args: { _admin_user_id: string }
        Returns: string
      }
      get_marker_catalog:
        | {
            Args: { p_org_id: string }
            Returns: {
              category: string
              contact_count: number
              description: string
              is_phase_two: boolean
              key: string
              label: string
              polarity: string
              requires_integration: string
              sort_order: number
            }[]
          }
        | {
            Args: {
              p_assigned_user_id?: string
              p_campus_id?: string
              p_org_id: string
            }
            Returns: {
              category: string
              contact_count: number
              description: string
              is_phase_two: boolean
              key: string
              label: string
              polarity: string
              requires_integration: string
              sort_order: number
            }[]
          }
      get_org_checkin_counts: {
        Args: {
          p_campus_id?: string
          p_month_start: string
          p_org_id: string
          p_week_start: string
        }
        Returns: {
          checkins_month: number
          checkins_week: number
        }[]
      }
      get_org_engagement_distribution: {
        Args: { p_campus_id?: string; p_org_id: string }
        Returns: {
          count: number
          engagement_level: string
        }[]
      }
      get_org_tag_stats: {
        Args: { p_org_id: string }
        Returns: {
          contact_count: number
          tag: string
        }[]
      }
      get_org_team_activity_stats: {
        Args: { p_org_id: string }
        Returns: {
          active_days_30d: number
          last_active_at: string
          user_id: string
        }[]
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
      get_public_content_video: {
        Args: { p_slug: string; p_video_id: string }
        Returns: Json
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
      match_content_chunks: {
        Args: {
          match_count?: number
          match_threshold?: number
          p_org_id: string
          p_video_id?: string
          query_embedding: string
        }
        Returns: {
          chunk_id: string
          chunk_index: number
          end_seconds: number
          similarity: number
          start_seconds: number
          text: string
          video_id: string
        }[]
      }
      match_content_chunks_public: {
        Args: {
          match_count?: number
          match_threshold?: number
          p_org_slug: string
          query_embedding: string
        }
        Returns: {
          chunk_id: string
          chunk_index: number
          end_seconds: number
          similarity: number
          start_seconds: number
          text: string
          video_id: string
        }[]
      }
      merge_org_tags: {
        Args: {
          p_org_id: string
          p_source_tags: string[]
          p_target_tag: string
        }
        Returns: number
      }
      recompute_contact_markers: {
        Args: { p_org_id: string }
        Returns: undefined
      }
      rename_org_tag: {
        Args: { p_new_tag: string; p_old_tag: string; p_org_id: string }
        Returns: number
      }
      replace_user_pco_visible_people: {
        Args: { _ids: string[]; _org: string; _user: string }
        Returns: number
      }
      search_visible_contacts: {
        Args: {
          _limit?: number
          _organization_id: string
          _search_term: string
        }
        Returns: {
          avatar: string
          email: string
          id: string
          name: string
          phone: string
        }[]
      }
      seed_default_moment_types: {
        Args: { org_id: string }
        Returns: undefined
      }
      snapshot_engagement_distribution_all: { Args: never; Returns: number }
      start_impersonation_session:
        | {
            Args: {
              _admin_user_id: string
              _ip_address?: string
              _reason: string
              _target_org_id: string
              _user_agent?: string
            }
            Returns: string
          }
        | {
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
      user_can_manage_group_image: { Args: { _path: string }; Returns: boolean }
      user_has_active_pco_connection: {
        Args: { _org: string; _user: string }
        Returns: boolean
      }
    }
    Enums: {
      content_consent_level: "internal_use" | "public_search"
      content_ingest_status:
        | "pending"
        | "transcribing"
        | "embedding"
        | "analyzing"
        | "ready"
        | "failed"
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
      content_consent_level: ["internal_use", "public_search"],
      content_ingest_status: [
        "pending",
        "transcribing",
        "embedding",
        "analyzing",
        "ready",
        "failed",
      ],
      system_role: ["super_admin", "support_admin", "viewer"],
    },
  },
} as const
