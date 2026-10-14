/**
 * Database types for the Supabase client.
 *
 * Hand-written to match supabase/migrations for now. Once the Supabase CLI is
 * linked, replace this file with the generated output of:
 *   npx supabase gen types typescript --linked > src/types/database.ts
 *
 * `Insert`/`Update` list only the columns clients are GRANTed; everything else
 * (roles, statuses, coin rows, audit rows) changes only via database functions.
 */
export type UserRole = "user" | "admin";
export type TaskStatus = "draft" | "active" | "archived";
export type SubmissionStatus = "pending" | "approved" | "rejected";
export type CoinTxKind = "task_reward" | "admin_adjustment";
export type AuditAction =
  | "task.created"
  | "task.updated"
  | "submission.approved"
  | "submission.rejected"
  | "coins.adjusted"
  | "profile.role_changed";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          bio: string | null;
          role: UserRole;
          is_public: boolean;
          public_slug: string;
          social_links: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: {
          username?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          is_public?: boolean;
          social_links?: Json;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          title: string;
          description: string;
          reward_coins: number;
          status: TaskStatus;
          deadline: string | null;
          requirements: string | null;
          evidence_required: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        /** Admins only (enforced by RLS). */
        Insert: {
          title: string;
          description: string;
          reward_coins: number;
          status?: TaskStatus;
          deadline?: string | null;
          requirements?: string | null;
          evidence_required?: boolean;
        };
        Update: {
          title?: string;
          description?: string;
          reward_coins?: number;
          status?: TaskStatus;
          deadline?: string | null;
          requirements?: string | null;
          evidence_required?: boolean;
        };
        Relationships: [];
      };
      task_submissions: {
        Row: {
          id: string;
          task_id: string;
          user_id: string;
          proof_text: string | null;
          proof_url: string | null;
          evidence_path: string | null;
          status: SubmissionStatus;
          review_note: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          task_id: string;
          proof_text?: string | null;
          proof_url?: string | null;
          evidence_path?: string | null;
        };
        /** Only while pending, only by the owner (enforced by RLS). */
        Update: {
          proof_text?: string | null;
          proof_url?: string | null;
        };
        Relationships: [];
      };
      coin_transactions: {
        Row: {
          id: number;
          user_id: string;
          amount: number;
          kind: CoinTxKind;
          submission_id: string | null;
          reason: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: number;
          actor_id: string | null;
          action: AuditAction;
          target_type: "task" | "submission" | "profile";
          target_id: string;
          details: Json;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: {
      coin_balances: {
        Row: {
          user_id: string;
          balance: number;
          transaction_count: number;
          lifetime_earned: number;
          rewards_count: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      valid_social_links: { Args: { links: Json }; Returns: boolean };
      admin_list_users: {
        Args: { p_search?: string | null; p_limit?: number; p_offset?: number };
        Returns: {
          id: string;
          username: string;
          display_name: string | null;
          email: string | null;
          role: UserRole;
          is_public: boolean;
          created_at: string;
          last_sign_in_at: string | null;
          coins: number;
          submissions: number;
          approved: number;
          total_count: number;
        }[];
      };
      admin_dashboard_stats: { Args: Record<string, never>; Returns: Json };
      get_my_coin_summary: {
        Args: Record<string, never>;
        Returns: {
          balance: number;
          lifetime_earned: number;
          rewards_count: number;
          leaderboard_rank: number | null;
          is_public: boolean;
        }[];
      };
      review_submission: {
        Args: { p_submission_id: string; p_decision: SubmissionStatus; p_note?: string | null };
        Returns: Database["public"]["Tables"]["task_submissions"]["Row"];
      };
      admin_adjust_coins: {
        Args: { p_user_id: string; p_amount: number; p_reason: string };
        Returns: number;
      };
      set_user_role: { Args: { p_user_id: string; p_role: UserRole }; Returns: undefined };
      regenerate_public_slug: { Args: Record<string, never>; Returns: string };
      get_public_profile: {
        Args: { p_slug: string };
        Returns: {
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          bio: string | null;
          social_links: Json;
          lifetime_coins: number;
          leaderboard_rank: number | null;
          approved_tasks: number;
          member_since: string;
        }[];
      };
      get_leaderboard: {
        Args: { p_limit?: number };
        Returns: {
          leaderboard_rank: number;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          public_slug: string;
          lifetime_coins: number;
          approved_tasks: number;
        }[];
      };
    };
    Enums: {
      user_role: UserRole;
      task_status: TaskStatus;
      submission_status: SubmissionStatus;
      coin_tx_kind: CoinTxKind;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type TaskSubmission = Database["public"]["Tables"]["task_submissions"]["Row"];
export type CoinTransaction = Database["public"]["Tables"]["coin_transactions"]["Row"];
export type AuditLog = Database["public"]["Tables"]["audit_logs"]["Row"];
