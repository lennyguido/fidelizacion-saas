
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "core": {
          Tables: {
            "audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"business_id": string,"changed_at": string,"id": number,"new_data": Json | null,"old_data": Json | null,"record_id": string | null,"table_name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"business_id": string,"changed_at"?: string,"id"?: never,"new_data"?: Json | null,"old_data"?: Json | null,"record_id"?: string | null,"table_name": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"business_id"?: string,"changed_at"?: string,"id"?: never,"new_data"?: Json | null,"old_data"?: Json | null,"record_id"?: string | null,"table_name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"business_modules": {
                  Row: {
                    "business_id": string,"created_at": string,"enabled": boolean,"ends_at": string | null,"limits": NonNullable<Json>,"module_id": string,"starts_at": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"enabled"?: boolean,"ends_at"?: string | null,"limits"?: NonNullable<Json>,"module_id": string,"starts_at"?: string,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"enabled"?: boolean,"ends_at"?: string | null,"limits"?: NonNullable<Json>,"module_id"?: string,"starts_at"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "business_modules_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "business_modules_module_id_fkey"
      columns: ["module_id"]
isOneToOne: false
      referencedRelation: "modules"
      referencedColumns: ["id"]
    }
                  ]
                },"businesses": {
                  Row: {
                    "address": string | null,"created_at": string,"currency": string,"email": string | null,"id": string,"logo_path": string | null,"name": string,"phone": string | null,"primary_color": string | null,"secondary_color": string | null,"settings": NonNullable<Json>,"slug": string,"status": string,"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"created_at"?: string,"currency"?: string,"email"?: string | null,"id"?: string,"logo_path"?: string | null,"name": string,"phone"?: string | null,"primary_color"?: string | null,"secondary_color"?: string | null,"settings"?: NonNullable<Json>,"slug": string,"status"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "address"?: string | null,"created_at"?: string,"currency"?: string,"email"?: string | null,"id"?: string,"logo_path"?: string | null,"name"?: string,"phone"?: string | null,"primary_color"?: string | null,"secondary_color"?: string | null,"settings"?: NonNullable<Json>,"slug"?: string,"status"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"customer_accounts": {
                  Row: {
                    "business_id": string,"created_at": string,"customer_id": string,"id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"customer_id": string,"id"?: string,"user_id": string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"customer_id"?: string,"id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "customer_accounts_business_id_customer_id_fkey"
      columns: ["business_id","customer_id"]
isOneToOne: true
      referencedRelation: "customers"
      referencedColumns: ["business_id","id"]
    },{
      foreignKeyName: "customer_accounts_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"customer_consents": {
                  Row: {
                    "business_id": string,"channel": string,"customer_id": string,"granted": boolean,"id": string,"purpose": string,"recorded_at": string,"recorded_by": string | null,"source": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"channel": string,"customer_id": string,"granted": boolean,"id"?: string,"purpose": string,"recorded_at"?: string,"recorded_by"?: string | null,"source": string
                  }
                  Update: {
                    "business_id"?: string,"channel"?: string,"customer_id"?: string,"granted"?: boolean,"id"?: string,"purpose"?: string,"recorded_at"?: string,"recorded_by"?: string | null,"source"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "customer_consents_business_id_customer_id_fkey"
      columns: ["business_id","customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["business_id","id"]
    },{
      foreignKeyName: "customer_consents_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"customer_stats": {
                  Row: {
                    "avg_ticket_minor": number | null,"business_id": string,"customer_id": string,"expected_next_visit_at": string | null,"first_visit_at": string | null,"last_visit_at": string | null,"median_interval_days": number | null,"risk_score": number,"spend_visit_count": number,"status": string,"status_changed_at": string,"total_spend_minor": number,"updated_at": string,"visit_count": number
                  }
                  ComputedFields: never
                  Insert: {
                    "avg_ticket_minor"?: number | null,"business_id": string,"customer_id": string,"expected_next_visit_at"?: string | null,"first_visit_at"?: string | null,"last_visit_at"?: string | null,"median_interval_days"?: number | null,"risk_score"?: number,"spend_visit_count"?: number,"status"?: string,"status_changed_at"?: string,"total_spend_minor"?: number,"updated_at"?: string,"visit_count"?: number
                  }
                  Update: {
                    "avg_ticket_minor"?: number | null,"business_id"?: string,"customer_id"?: string,"expected_next_visit_at"?: string | null,"first_visit_at"?: string | null,"last_visit_at"?: string | null,"median_interval_days"?: number | null,"risk_score"?: number,"spend_visit_count"?: number,"status"?: string,"status_changed_at"?: string,"total_spend_minor"?: number,"updated_at"?: string,"visit_count"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "customer_stats_business_id_customer_id_fkey"
      columns: ["business_id","customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["business_id","id"]
    },{
      foreignKeyName: "customer_stats_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"customer_status_history": {
                  Row: {
                    "business_id": string,"changed_at": string,"customer_id": string,"from_status": string | null,"id": number,"reason": string,"to_status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"changed_at"?: string,"customer_id": string,"from_status"?: string | null,"id"?: never,"reason": string,"to_status": string
                  }
                  Update: {
                    "business_id"?: string,"changed_at"?: string,"customer_id"?: string,"from_status"?: string | null,"id"?: never,"reason"?: string,"to_status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "customer_status_history_business_id_customer_id_fkey"
      columns: ["business_id","customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["business_id","id"]
    },{
      foreignKeyName: "customer_status_history_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"customers": {
                  Row: {
                    "anonymized_at": string | null,"birthdate": string | null,"business_id": string,"created_at": string,"created_by": string | null,"email": string | null,"id": string,"name": string,"notes": string | null,"phone": string | null,"source": string,"status": string,"tags": (string)[],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "anonymized_at"?: string | null,"birthdate"?: string | null,"business_id": string,"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"id"?: string,"name": string,"notes"?: string | null,"phone"?: string | null,"source"?: string,"status"?: string,"tags"?: (string)[],"updated_at"?: string
                  }
                  Update: {
                    "anonymized_at"?: string | null,"birthdate"?: string | null,"business_id"?: string,"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"id"?: string,"name"?: string,"notes"?: string | null,"phone"?: string | null,"source"?: string,"status"?: string,"tags"?: (string)[],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "customers_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"events": {
                  Row: {
                    "business_id": string,"id": number,"occurred_at": string,"payload": NonNullable<Json>,"processed_at": string | null,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"id"?: never,"occurred_at"?: string,"payload"?: NonNullable<Json>,"processed_at"?: string | null,"type": string
                  }
                  Update: {
                    "business_id"?: string,"id"?: never,"occurred_at"?: string,"payload"?: NonNullable<Json>,"processed_at"?: string | null,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"locations": {
                  Row: {
                    "active": boolean,"address": string | null,"business_id": string,"created_at": string,"id": string,"name": string,"timezone": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"address"?: string | null,"business_id": string,"created_at"?: string,"id"?: string,"name": string,"timezone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"address"?: string | null,"business_id"?: string,"created_at"?: string,"id"?: string,"name"?: string,"timezone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "locations_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"memberships": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"role": string,"status": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"role": string,"status"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"role"?: string,"status"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "memberships_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"modules": {
                  Row: {
                    "available": boolean,"created_at": string,"description": string | null,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "available"?: boolean,"created_at"?: string,"description"?: string | null,"id": string,"name": string
                  }
                  Update: {
                    "available"?: boolean,"created_at"?: string,"description"?: string | null,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"plan_modules": {
                  Row: {
                    "limits": NonNullable<Json>,"module_id": string,"plan_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "limits"?: NonNullable<Json>,"module_id": string,"plan_id": string
                  }
                  Update: {
                    "limits"?: NonNullable<Json>,"module_id"?: string,"plan_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "plan_modules_module_id_fkey"
      columns: ["module_id"]
isOneToOne: false
      referencedRelation: "modules"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "plan_modules_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["id"]
    }
                  ]
                },"plans": {
                  Row: {
                    "active": boolean,"created_at": string,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"id": string,"name": string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"platform_admins": {
                  Row: {
                    "created_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"subscriptions": {
                  Row: {
                    "business_id": string,"created_at": string,"current_period_end": string | null,"id": string,"plan_id": string,"provider": string | null,"provider_ref": string | null,"status": string,"trial_ends_at": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"current_period_end"?: string | null,"id"?: string,"plan_id": string,"provider"?: string | null,"provider_ref"?: string | null,"status": string,"trial_ends_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"current_period_end"?: string | null,"id"?: string,"plan_id"?: string,"provider"?: string | null,"provider_ref"?: string | null,"status"?: string,"trial_ends_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscriptions_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscriptions_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["id"]
    }
                  ]
                },"visits": {
                  Row: {
                    "amount_minor": number | null,"business_id": string,"created_at": string,"created_by": string | null,"currency": string,"customer_id": string | null,"id": string,"location_id": string,"notes": string | null,"occurred_at": string,"source": string,"source_ref": string | null,"void_reason": string | null,"voided_at": string | null,"voided_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_minor"?: number | null,"business_id": string,"created_at"?: string,"created_by"?: string | null,"currency": string,"customer_id"?: string | null,"id"?: string,"location_id": string,"notes"?: string | null,"occurred_at"?: string,"source": string,"source_ref"?: string | null,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Update: {
                    "amount_minor"?: number | null,"business_id"?: string,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"customer_id"?: string | null,"id"?: string,"location_id"?: string,"notes"?: string | null,"occurred_at"?: string,"source"?: string,"source_ref"?: string | null,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "visits_business_id_customer_id_fkey"
      columns: ["business_id","customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["business_id","id"]
    },{
      foreignKeyName: "visits_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "visits_business_id_location_id_fkey"
      columns: ["business_id","location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["business_id","id"]
    }
                  ]
                }
          }
          Views: {
            "customer_consent_status": {
                  Row: {
                    "business_id": string | null,"channel": string | null,"customer_id": string | null,"granted": boolean | null,"purpose": string | null,"recorded_at": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "customer_consents_business_id_customer_id_fkey"
      columns: ["business_id","customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["business_id","id"]
    },{
      foreignKeyName: "customer_consents_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "compute_customer_status":
{ Args: { "p_first_visit_at": string,"p_is_new_visit": boolean,"p_last_visit_at": string,"p_median_interval": number,"p_now": string,"p_prev_changed_at": string,"p_prev_status": string,"p_settings": Json,"p_visit_count": number }; Returns: Record<string, unknown>
                           },
"create_business":
{ Args: { "p_name": string,"p_slug": string,"p_timezone"?: string }; Returns: {
              "address": string | null,
"created_at": string,
"currency": string,
"email": string | null,
"id": string,
"logo_path": string | null,
"name": string,
"phone": string | null,
"primary_color": string | null,
"secondary_color": string | null,
"settings": NonNullable<Json>,
"slug": string,
"status": string,
"timezone": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "businesses"
        isOneToOne: true
        isSetofReturn: false
      } },
"emit_event":
{ Args: { "p_business_id": string,"p_payload"?: Json,"p_type": string }; Returns: number
                           },
"has_module":
{ Args: { "p_business_id": string,"p_module": string }; Returns: boolean
                           },
"has_role":
{ Args: { "p_business_id": string,"p_roles": (string)[] }; Returns: boolean
                           },
"import_customers":
{ Args: { "p_business_id": string,"p_rows": Json }; Returns: Json
                           },
"is_member":
{ Args: { "p_business_id": string }; Returns: boolean
                           },
"is_platform_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_reserved_slug":
{ Args: { "p_slug": string }; Returns: boolean
                           },
"is_slug_available":
{ Args: { "p_slug": string }; Returns: boolean
                           },
"is_valid_timezone":
{ Args: { "p_tz": string }; Returns: boolean
                           },
"my_business_ids":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           },
"my_business_ids_with_module":
{ Args: { "p_module": string }; Returns: string[]
                           },
"my_business_ids_with_role":
{ Args: { "p_roles": (string)[] }; Returns: string[]
                           },
"my_customer_ids":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           },
"raise_forbidden":
{ Args: { "p_message"?: string }; Returns: undefined
                           },
"record_visit":
{ Args: { "p_amount_minor"?: number,"p_business_id": string,"p_customer_id"?: string,"p_location_id"?: string,"p_notes"?: string,"p_occurred_at"?: string,"p_source"?: string,"p_source_ref"?: string }; Returns: {
              "amount_minor": number | null,
"business_id": string,
"created_at": string,
"created_by": string | null,
"currency": string,
"customer_id": string | null,
"id": string,
"location_id": string,
"notes": string | null,
"occurred_at": string,
"source": string,
"source_ref": string | null,
"void_reason": string | null,
"voided_at": string | null,
"voided_by": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "visits"
        isOneToOne: true
        isSetofReturn: false
      } },
"record_visit_internal":
{ Args: { "p_amount_minor": number,"p_business_id": string,"p_created_by": string,"p_customer_id": string,"p_location_id": string,"p_notes": string,"p_occurred_at": string,"p_source": string,"p_source_ref": string }; Returns: {
              "amount_minor": number | null,
"business_id": string,
"created_at": string,
"created_by": string | null,
"currency": string,
"customer_id": string | null,
"id": string,
"location_id": string,
"notes": string | null,
"occurred_at": string,
"source": string,
"source_ref": string | null,
"void_reason": string | null,
"voided_at": string | null,
"voided_by": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "visits"
        isOneToOne: true
        isSetofReturn: false
      } },
"refresh_customer_stats":
{ Args: { "p_customer_id": string,"p_is_new_visit"?: boolean,"p_prev_status"?: string,"p_reason": string }; Returns: {
              "avg_ticket_minor": number | null,
"business_id": string,
"customer_id": string,
"expected_next_visit_at": string | null,
"first_visit_at": string | null,
"last_visit_at": string | null,
"median_interval_days": number | null,
"risk_score": number,
"spend_visit_count": number,
"status": string,
"status_changed_at": string,
"total_spend_minor": number,
"updated_at": string,
"visit_count": number
            }
                          SetofOptions: {
        from: "*"
        to: "customer_stats"
        isOneToOne: true
        isSetofReturn: false
      } },
"refresh_statuses":
{ Args: { "p_business_id"?: string }; Returns: number
                           },
"require_member":
{ Args: { "p_business_id": string,"p_roles"?: (string)[] }; Returns: undefined
                           },
"search_customers":
{ Args: { "p_business_id": string,"p_limit"?: number,"p_offset"?: number,"p_query"?: string,"p_status"?: string }; Returns: {
              "email": string,"id": string,"last_visit_at": string,"name": string,"phone": string,"risk_score": number,"status": string,"total_spend_minor": number,"visit_count": number
            }[]
                           },
"status_settings":
{ Args: { "p_settings": Json }; Returns: Json
                           },
"void_visit":
{ Args: { "p_reason": string,"p_visit_id": string }; Returns: {
              "amount_minor": number | null,
"business_id": string,
"created_at": string,
"created_by": string | null,
"currency": string,
"customer_id": string | null,
"id": string,
"location_id": string,
"notes": string | null,
"occurred_at": string,
"source": string,
"source_ref": string | null,
"void_reason": string | null,
"voided_at": string | null,
"voided_by": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "visits"
        isOneToOne: true
        isSetofReturn: false
      } }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "core": {
          Enums: {
            
          }
        }
} as const
