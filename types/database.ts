import type {
  ApprovalStatus,
  ClaimType,
  EvidenceType,
  ExportFormat,
  ExportStatus,
  ExportTargetType,
  LinkType,
  PeriodType,
  ProofStrength,
  SourceSystem,
  TagType,
  VerificationStatus,
  Visibility,
  VisibilityDefault,
} from "./domain";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          github_connected: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          github_connected?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          display_name?: string;
          github_connected?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      evidence_items: {
        Row: {
          id: string;
          user_id: string;
          type: EvidenceType;
          title: string;
          raw_input: string;
          factual_summary: string | null;
          time_start: string | null;
          time_end: string | null;
          source_system: SourceSystem;
          source_external_id: string | null;
          source_url: string | null;
          project_name: string | null;
          visibility_default: VisibilityDefault;
          proof_strength: ProofStrength | null;
          verification_status: VerificationStatus;
          approval_status: ApprovalStatus;
          ai_structured_payload: Json;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: EvidenceType;
          title: string;
          raw_input: string;
          factual_summary?: string | null;
          time_start?: string | null;
          time_end?: string | null;
          source_system: SourceSystem;
          source_external_id?: string | null;
          source_url?: string | null;
          project_name?: string | null;
          visibility_default?: VisibilityDefault;
          proof_strength?: ProofStrength | null;
          verification_status?: VerificationStatus;
          approval_status?: ApprovalStatus;
          ai_structured_payload?: Json;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          raw_input?: string;
          factual_summary?: string | null;
          time_start?: string | null;
          time_end?: string | null;
          source_external_id?: string | null;
          source_url?: string | null;
          project_name?: string | null;
          visibility_default?: VisibilityDefault;
          proof_strength?: ProofStrength | null;
          verification_status?: VerificationStatus;
          approval_status?: ApprovalStatus;
          ai_structured_payload?: Json;
          metadata?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      evidence_links: {
        Row: {
          id: string;
          evidence_item_id: string;
          label: string;
          url: string;
          link_type: LinkType;
          created_at: string;
        };
        Insert: {
          id?: string;
          evidence_item_id: string;
          label: string;
          url: string;
          link_type: LinkType;
          created_at?: string;
        };
        Update: {
          label?: string;
          url?: string;
          link_type?: LinkType;
        };
        Relationships: [];
      };
      tags: {
        Row: {
          id: string;
          user_id: string;
          tag_type: TagType;
          name: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          tag_type: TagType;
          name: string;
        };
        Update: {
          tag_type?: TagType;
          name?: string;
        };
        Relationships: [];
      };
      evidence_item_tags: {
        Row: {
          evidence_item_id: string;
          tag_id: string;
        };
        Insert: {
          evidence_item_id: string;
          tag_id: string;
        };
        Update: {
          evidence_item_id?: string;
          tag_id?: string;
        };
        Relationships: [];
      };
      role_variants: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          target_title: string | null;
          job_description_raw: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          target_title?: string | null;
          job_description_raw?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          target_title?: string | null;
          job_description_raw?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      role_variant_tags: {
        Row: {
          role_variant_id: string;
          tag_id: string;
        };
        Insert: {
          role_variant_id: string;
          tag_id: string;
        };
        Update: {
          role_variant_id?: string;
          tag_id?: string;
        };
        Relationships: [];
      };
      resume_bullets: {
        Row: {
          id: string;
          user_id: string;
          role_variant_id: string;
          draft_text: string;
          claim_type: ClaimType;
          proof_strength: ProofStrength;
          approval_status: ApprovalStatus;
          is_user_edited: boolean;
          generation_metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role_variant_id: string;
          draft_text: string;
          claim_type: ClaimType;
          proof_strength: ProofStrength;
          approval_status?: ApprovalStatus;
          is_user_edited?: boolean;
          generation_metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          draft_text?: string;
          claim_type?: ClaimType;
          proof_strength?: ProofStrength;
          approval_status?: ApprovalStatus;
          is_user_edited?: boolean;
          generation_metadata?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      resume_bullet_evidence: {
        Row: {
          resume_bullet_id: string;
          evidence_item_id: string;
        };
        Insert: {
          resume_bullet_id: string;
          evidence_item_id: string;
        };
        Update: {
          resume_bullet_id?: string;
          evidence_item_id?: string;
        };
        Relationships: [];
      };
      changelog_entries: {
        Row: {
          id: string;
          user_id: string;
          period_type: PeriodType;
          period_start: string;
          period_end: string;
          title: string;
          body: string;
          visibility: Visibility;
          approval_status: ApprovalStatus;
          is_user_edited: boolean;
          generation_metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          period_type: PeriodType;
          period_start: string;
          period_end: string;
          title: string;
          body: string;
          visibility?: Visibility;
          approval_status?: ApprovalStatus;
          is_user_edited?: boolean;
          generation_metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          period_type?: PeriodType;
          period_start?: string;
          period_end?: string;
          title?: string;
          body?: string;
          visibility?: Visibility;
          approval_status?: ApprovalStatus;
          is_user_edited?: boolean;
          generation_metadata?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      changelog_entry_evidence: {
        Row: {
          changelog_entry_id: string;
          evidence_item_id: string;
        };
        Insert: {
          changelog_entry_id: string;
          evidence_item_id: string;
        };
        Update: {
          changelog_entry_id?: string;
          evidence_item_id?: string;
        };
        Relationships: [];
      };
      exports: {
        Row: {
          id: string;
          user_id: string;
          target_type: ExportTargetType;
          target_id: string | null;
          format: ExportFormat;
          content: string;
          status: ExportStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          target_type: ExportTargetType;
          target_id?: string | null;
          format: ExportFormat;
          content: string;
          status?: ExportStatus;
          created_at?: string;
        };
        Update: {
          target_type?: ExportTargetType;
          target_id?: string | null;
          format?: ExportFormat;
          content?: string;
          status?: ExportStatus;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      save_manual_evidence: {
        Args: {
          evidence_id?: string | null;
          input_links?: Json | null;
          input_project_name?: string | null;
          input_raw_input: string;
          input_time_end?: string | null;
          input_time_start?: string | null;
          input_title: string;
          input_type: EvidenceType;
        };
        Returns: string;
      };
      upsert_generated_changelog_entry: {
        Args: {
          input_body: string;
          input_evidence_ids: string[];
          input_generation_metadata: Json;
          input_period_end: string;
          input_period_start: string;
          input_period_type: PeriodType;
          input_replace_edited?: boolean;
          input_title: string;
        };
        Returns: string;
      };
    };
    Enums: {
      evidence_type: EvidenceType;
      source_system: SourceSystem;
      visibility_default: VisibilityDefault;
      proof_strength: ProofStrength;
      verification_status: VerificationStatus;
      approval_status: ApprovalStatus;
      link_type: LinkType;
      tag_type: TagType;
      claim_type: ClaimType;
      period_type: PeriodType;
      visibility: Visibility;
      export_target_type: ExportTargetType;
      export_format: ExportFormat;
      export_status: ExportStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
