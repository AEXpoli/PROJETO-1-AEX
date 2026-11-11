// Generated from project iskobkikhtwamsdhsscn; augmented for local 5.5 and 5.7 RPCs.
/* eslint-disable @typescript-eslint/no-redundant-type-constituents -- Preserve generated Supabase helper types. */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.18';
  };
  public: {
    Tables: {
      achievements: {
        Row: {
          code: string;
          created_at: string;
          description: string;
          id: string;
          title: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          description?: string;
          id?: string;
          title: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          description?: string;
          id?: string;
          title?: string;
        };
        Relationships: [];
      };
      campaign_assignments: {
        Row: {
          assigned_at: string;
          campaign_id: string;
          completed_at: string | null;
          id: string;
          organization_id: string;
          participant_id: string;
        };
        Insert: {
          assigned_at?: string;
          campaign_id: string;
          completed_at?: string | null;
          id?: string;
          organization_id: string;
          participant_id: string;
        };
        Update: {
          assigned_at?: string;
          campaign_id?: string;
          completed_at?: string | null;
          id?: string;
          organization_id?: string;
          participant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'campaign_assignments_campaign_id_organization_id_fkey';
            columns: ['campaign_id', 'organization_id'];
            isOneToOne: false;
            referencedRelation: 'campaigns';
            referencedColumns: ['id', 'organization_id'];
          },
          {
            foreignKeyName: 'campaign_assignments_organization_id_participant_id_fkey';
            columns: ['organization_id', 'participant_id'];
            isOneToOne: false;
            referencedRelation: 'organization_members';
            referencedColumns: ['organization_id', 'user_id'];
          },
        ];
      };
      campaigns: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          module_id: string;
          organization_id: string;
          status: string;
          title: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          module_id: string;
          organization_id: string;
          status?: string;
          title: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          module_id?: string;
          organization_id?: string;
          status?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'campaigns_module_id_fkey';
            columns: ['module_id'];
            isOneToOne: false;
            referencedRelation: 'learning_modules';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'campaigns_organization_id_created_by_fkey';
            columns: ['organization_id', 'created_by'];
            isOneToOne: false;
            referencedRelation: 'organization_members';
            referencedColumns: ['organization_id', 'user_id'];
          },
          {
            foreignKeyName: 'campaigns_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      exercise_attempts: {
        Row: {
          result: Json | null;
          answered_at: string;
          assignment_id: string | null;
          exercise_id: string;
          id: string;
          is_correct: boolean;
          participant_id: string;
          selected_option_id: string;
        };
        Insert: {
          answered_at?: string;
          result?: Json | null;
          assignment_id?: string | null;
          exercise_id: string;
          id?: string;
          is_correct: boolean;
          participant_id: string;
          selected_option_id: string;
        };
        Update: {
          answered_at?: string;
          result?: Json | null;
          assignment_id?: string | null;
          exercise_id?: string;
          id?: string;
          is_correct?: boolean;
          participant_id?: string;
          selected_option_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'exercise_attempts_assignment_id_participant_id_fkey';
            columns: ['assignment_id', 'participant_id'];
            isOneToOne: false;
            referencedRelation: 'campaign_assignments';
            referencedColumns: ['id', 'participant_id'];
          },
          {
            foreignKeyName: 'exercise_attempts_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'exercise_attempts_exercise_id_selected_option_id_fkey';
            columns: ['exercise_id', 'selected_option_id'];
            isOneToOne: false;
            referencedRelation: 'exercise_options';
            referencedColumns: ['exercise_id', 'id'];
          },
          {
            foreignKeyName: 'exercise_attempts_participant_id_fkey';
            columns: ['participant_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      exercise_options: {
        Row: {
          exercise_id: string;
          explanation: string;
          id: string;
          is_correct: boolean;
          option_text: string;
          sort_order: number;
        };
        Insert: {
          exercise_id: string;
          explanation?: string;
          id?: string;
          is_correct?: boolean;
          option_text: string;
          sort_order?: number;
        };
        Update: {
          exercise_id?: string;
          explanation?: string;
          id?: string;
          is_correct?: boolean;
          option_text?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'exercise_options_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
        ];
      };
      exercises: {
        Row: {
          category: string | null;
          created_at: string;
          id: string;
          module_id: string;
          question: string;
          scenario: string;
          sort_order: number;
          status: string;
          title: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          module_id: string;
          category?: string | null;
          question: string;
          scenario: string;
          sort_order?: number;
          status?: string;
          title: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          module_id?: string;
          category?: string | null;
          question?: string;
          scenario?: string;
          sort_order?: number;
          status?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'exercises_module_id_fkey';
            columns: ['module_id'];
            isOneToOne: false;
            referencedRelation: 'learning_modules';
            referencedColumns: ['id'];
          },
        ];
      };
      learning_modules: {
        Row: {
          created_at: string;
          description: string;
          id: string;
          sort_order: number;
          status: string;
          title: string;
        };
        Insert: {
          created_at?: string;
          description?: string;
          id?: string;
          sort_order?: number;
          status?: string;
          title: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          id?: string;
          sort_order?: number;
          status?: string;
          title?: string;
        };
        Relationships: [];
      };
      learning_progress: {
        Row: {
          completed_at: string | null;
          completed_exercises: number;
          module_id: string;
          participant_id: string;
          points: number;
          total_exercises: number;
          updated_at: string;
        };
        Insert: {
          completed_at?: string | null;
          completed_exercises?: number;
          module_id: string;
          participant_id: string;
          points?: number;
          total_exercises?: number;
          updated_at?: string;
        };
        Update: {
          completed_at?: string | null;
          completed_exercises?: number;
          module_id?: string;
          participant_id?: string;
          points?: number;
          total_exercises?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'learning_progress_module_id_fkey';
            columns: ['module_id'];
            isOneToOne: false;
            referencedRelation: 'learning_modules';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'learning_progress_participant_id_fkey';
            columns: ['participant_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      organization_members: {
        Row: {
          created_at: string;
          organization_id: string;
          role: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          organization_id: string;
          role?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          organization_id?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'organization_members_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'organization_members_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      organizations: {
        Row: {
          created_at: string;
          id: string;
          name: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          display_name: string;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_achievements: {
        Row: {
          achievement_id: string;
          awarded_at: string;
          participant_id: string;
        };
        Insert: {
          achievement_id: string;
          awarded_at?: string;
          participant_id: string;
        };
        Update: {
          achievement_id?: string;
          awarded_at?: string;
          participant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_achievements_achievement_id_fkey';
            columns: ['achievement_id'];
            isOneToOne: false;
            referencedRelation: 'achievements';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_achievements_participant_id_fkey';
            columns: ['participant_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      aex_create_admin_invitation: {
        Args: { p_issuer: string; p_organization: string; p_email: string; p_name: string };
        Returns: Json;
      };
      aex_admin_invitation_delivery: {
        Args: { p_issuer: string; p_invitation: string; p_target: string | null };
        Returns: undefined;
      };
      aex_accept_admin_invitation: {
        Args: { p_user: string; p_invitation: string };
        Returns: Json;
      };
      aex_record_attempt: {
        Args: {
          p_participant_id: string;
          p_attempt_id: string;
          p_exercise_id: string;
          p_selected_option_id: string;
          p_assignment_id?: string;
        };
        Returns: Json;
      };
      aex_learning_read: {
        Args: { p_participant_id: string; p_resource: string };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
