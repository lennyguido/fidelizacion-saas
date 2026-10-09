
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
                },"campaign_recipients": {
                  Row: {
                    "business_id": string,"campaign_id": string,"contacted_at": string | null,"coupon_code": string | null,"coupon_redeemed_at": string | null,"coupon_redeemed_by": string | null,"coupon_visit_id": string | null,"customer_id": string,"id": string,"is_control": boolean,"message": string | null,"risk_score_at_send": number,"status_at_send": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"campaign_id": string,"contacted_at"?: string | null,"coupon_code"?: string | null,"coupon_redeemed_at"?: string | null,"coupon_redeemed_by"?: string | null,"coupon_visit_id"?: string | null,"customer_id": string,"id"?: string,"is_control": boolean,"message"?: string | null,"risk_score_at_send"?: number,"status_at_send": string
                  }
                  Update: {
                    "business_id"?: string,"campaign_id"?: string,"contacted_at"?: string | null,"coupon_code"?: string | null,"coupon_redeemed_at"?: string | null,"coupon_redeemed_by"?: string | null,"coupon_visit_id"?: string | null,"customer_id"?: string,"id"?: string,"is_control"?: boolean,"message"?: string | null,"risk_score_at_send"?: number,"status_at_send"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "campaign_recipients_business_id_campaign_id_fkey"
      columns: ["business_id","campaign_id"]
isOneToOne: false
      referencedRelation: "campaigns"
      referencedColumns: ["business_id","id"]
    },{
      foreignKeyName: "campaign_recipients_business_id_coupon_visit_id_fkey"
      columns: ["business_id","coupon_visit_id"]
isOneToOne: false
      referencedRelation: "visits"
      referencedColumns: ["business_id","id"]
    },{
      foreignKeyName: "campaign_recipients_business_id_customer_id_fkey"
      columns: ["business_id","customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["business_id","id"]
    },{
      foreignKeyName: "campaign_recipients_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"campaigns": {
                  Row: {
                    "attribution_days": number,"benefit": string | null,"business_id": string,"cancelled_at": string | null,"channel": string,"control_pct": number,"created_at": string,"created_by": string | null,"id": string,"message": string,"module_id": string,"name": string,"recipients_count": number,"segment": NonNullable<Json>,"sent_at": string | null,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attribution_days"?: number,"benefit"?: string | null,"business_id": string,"cancelled_at"?: string | null,"channel"?: string,"control_pct"?: number,"created_at"?: string,"created_by"?: string | null,"id"?: string,"message": string,"module_id": string,"name": string,"recipients_count"?: number,"segment": NonNullable<Json>,"sent_at"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "attribution_days"?: number,"benefit"?: string | null,"business_id"?: string,"cancelled_at"?: string | null,"channel"?: string,"control_pct"?: number,"created_at"?: string,"created_by"?: string | null,"id"?: string,"message"?: string,"module_id"?: string,"name"?: string,"recipients_count"?: number,"segment"?: NonNullable<Json>,"sent_at"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "campaigns_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "campaigns_module_id_fkey"
      columns: ["module_id"]
isOneToOne: false
      referencedRelation: "modules"
      referencedColumns: ["id"]
    }
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
                    "business_id": string,"channel": string,"customer_id": string,"granted": boolean,"id": string,"purpose": string,"recorded_at": string,"recorded_by": string | null,"seq": number,"source": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"channel": string,"customer_id": string,"granted": boolean,"id"?: string,"purpose": string,"recorded_at"?: string,"recorded_by"?: string | null,"seq"?: never,"source": string
                  }
                  Update: {
                    "business_id"?: string,"channel"?: string,"customer_id"?: string,"granted"?: boolean,"id"?: string,"purpose"?: string,"recorded_at"?: string,"recorded_by"?: string | null,"seq"?: never,"source"?: string
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
                },"invitations": {
                  Row: {
                    "accepted_at": string | null,"accepted_by": string | null,"business_id": string,"created_at": string,"created_by": string | null,"email": string,"expires_at": string,"id": string,"revoked_at": string | null,"role": string,"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"business_id": string,"created_at"?: string,"created_by"?: string | null,"email": string,"expires_at"?: string,"id"?: string,"revoked_at"?: string | null,"role": string,"token_hash": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"business_id"?: string,"created_at"?: string,"created_by"?: string | null,"email"?: string,"expires_at"?: string,"id"?: string,"revoked_at"?: string | null,"role"?: string,"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invitations_business_id_fkey"
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
            "accept_invitation":
{ Args: { "p_token": string }; Returns: {
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
"anonymize_customer":
{ Args: { "p_customer_id": string }; Returns: {
              "anonymized_at": string | null,
"birthdate": string | null,
"business_id": string,
"created_at": string,
"created_by": string | null,
"email": string | null,
"id": string,
"name": string,
"notes": string | null,
"phone": string | null,
"source": string,
"status": string,
"tags": (string)[],
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "customers"
        isOneToOne: true
        isSetofReturn: false
      } },
"campaign_results":
{ Args: { "p_campaign_id": string }; Returns: {
              "contacted_count": number,"control_count": number,"control_rate": number,"control_returned": number,"control_revenue_minor": number,"coupons_redeemed": number,"incremental_customers": number,"incremental_revenue_minor": number,"treatment_count": number,"treatment_rate": number,"treatment_returned": number,"treatment_revenue_minor": number,"window_ends_at": string,"window_open": boolean
            }[]
                           },
"cancel_campaign":
{ Args: { "p_campaign_id": string }; Returns: {
              "attribution_days": number,
"benefit": string | null,
"business_id": string,
"cancelled_at": string | null,
"channel": string,
"control_pct": number,
"created_at": string,
"created_by": string | null,
"id": string,
"message": string,
"module_id": string,
"name": string,
"recipients_count": number,
"segment": NonNullable<Json>,
"sent_at": string | null,
"status": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "campaigns"
        isOneToOne: true
        isSetofReturn: false
      } },
"cleanup_old_records":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"compute_customer_status":
{ Args: { "p_first_visit_at": string,"p_is_new_visit": boolean,"p_last_visit_at": string,"p_median_interval": number,"p_now": string,"p_prev_changed_at": string,"p_prev_status": string,"p_settings": Json,"p_visit_count": number }; Returns: Record<string, unknown>
                           },
"coupon_info":
{ Args: { "p_recipient_id": string }; Returns: Json
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
"create_campaign":
{ Args: { "p_attribution_days"?: number,"p_benefit"?: string,"p_business_id": string,"p_control_pct"?: number,"p_message": string,"p_module_id": string,"p_name": string,"p_segment": Json }; Returns: {
              "attribution_days": number,
"benefit": string | null,
"business_id": string,
"cancelled_at": string | null,
"channel": string,
"control_pct": number,
"created_at": string,
"created_by": string | null,
"id": string,
"message": string,
"module_id": string,
"name": string,
"recipients_count": number,
"segment": NonNullable<Json>,
"sent_at": string | null,
"status": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "campaigns"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_invitation":
{ Args: { "p_business_id": string,"p_email": string,"p_role": string }; Returns: {
              "expires_at": string,"invitation_id": string,"token": string
            }[]
                           },
"dashboard_summary":
{ Args: { "p_business_id": string }; Returns: Json
                           },
"emit_event":
{ Args: { "p_business_id": string,"p_payload"?: Json,"p_type": string }; Returns: number
                           },
"find_campaign_coupon":
{ Args: { "p_business_id": string,"p_code": string }; Returns: Json
                           },
"get_invitation":
{ Args: { "p_token": string }; Returns: {
              "business_name": string,"email": string,"role": string,"status": string
            }[]
                           },
"has_module":
{ Args: { "p_business_id": string,"p_module": string }; Returns: boolean
                           },
"has_role":
{ Args: { "p_business_id": string,"p_roles": (string)[] }; Returns: boolean
                           },
"hash_token":
{ Args: { "p_token": string }; Returns: string
                           },
"import_customers":
{ Args: { "p_business_id": string,"p_rows": Json }; Returns: Json
                           },
"in_open_campaign":
{ Args: { "p_business_id": string,"p_customer_id": string }; Returns: boolean
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
"launch_campaign":
{ Args: { "p_campaign_id": string }; Returns: {
              "attribution_days": number,
"benefit": string | null,
"business_id": string,
"cancelled_at": string | null,
"channel": string,
"control_pct": number,
"created_at": string,
"created_by": string | null,
"id": string,
"message": string,
"module_id": string,
"name": string,
"recipients_count": number,
"segment": NonNullable<Json>,
"sent_at": string | null,
"status": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "campaigns"
        isOneToOne: true
        isSetofReturn: false
      } },
"list_campaign_recipients":
{ Args: { "p_campaign_id": string }; Returns: {
              "blocked_reason": string,"contacted_at": string,"coupon_code": string,"coupon_redeemed_at": string,"customer_id": string,"is_control": boolean,"message": string,"name": string,"phone": string,"recipient_id": string,"returned_amount_minor": number,"returned_at": string,"status_at_send": string
            }[]
                           },
"list_members":
{ Args: { "p_business_id": string }; Returns: {
              "created_at": string,"email": string,"membership_id": string,"role": string,"status": string,"user_id": string
            }[]
                           },
"mark_recipient_contacted":
{ Args: { "p_recipient_id": string }; Returns: {
              "business_id": string,
"campaign_id": string,
"contacted_at": string | null,
"coupon_code": string | null,
"coupon_redeemed_at": string | null,
"coupon_redeemed_by": string | null,
"coupon_visit_id": string | null,
"customer_id": string,
"id": string,
"is_control": boolean,
"message": string | null,
"risk_score_at_send": number,
"status_at_send": string
            }
                          SetofOptions: {
        from: "*"
        to: "campaign_recipients"
        isOneToOne: true
        isSetofReturn: false
      } },
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
"new_coupon_code":
{ Args: { "p_business_id": string }; Returns: string
                           },
"normalize_coupon_code":
{ Args: { "p_code": string }; Returns: string
                           },
"preview_segment":
{ Args: { "p_business_id": string,"p_segment": Json }; Returns: {
              "busy": number,"matching": number,"reachable": number
            }[]
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
"redeem_campaign_coupon":
{ Args: { "p_business_id": string,"p_code": string,"p_visit_id"?: string }; Returns: Json
                           },
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
"revoke_invitation":
{ Args: { "p_invitation_id": string }; Returns: undefined
                           },
"search_customers":
{ Args: { "p_business_id": string,"p_limit"?: number,"p_offset"?: number,"p_query"?: string,"p_status"?: string }; Returns: {
              "email": string,"id": string,"last_visit_at": string,"name": string,"phone": string,"risk_score": number,"status": string,"total_spend_minor": number,"visit_count": number
            }[]
                           },
"segment_members":
{ Args: { "p_business_id": string,"p_segment": Json }; Returns: {
              "busy": boolean,"customer_id": string,"first_name": string,"reachable": boolean,"risk_score": number,"status": string
            }[]
                           },
"set_customer_status":
{ Args: { "p_customer_id": string,"p_status": string }; Returns: {
              "anonymized_at": string | null,
"birthdate": string | null,
"business_id": string,
"created_at": string,
"created_by": string | null,
"email": string | null,
"id": string,
"name": string,
"notes": string | null,
"phone": string | null,
"source": string,
"status": string,
"tags": (string)[],
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "customers"
        isOneToOne: true
        isSetofReturn: false
      } },
"status_settings":
{ Args: { "p_settings": Json }; Returns: Json
                           },
"update_member":
{ Args: { "p_membership_id": string,"p_role": string,"p_status": string }; Returns: undefined
                           },
"validate_segment":
{ Args: { "p_segment": Json }; Returns: undefined
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
      } },
"whatsapp_marketing_granted":
{ Args: { "p_business_id": string,"p_customer_id": string }; Returns: boolean
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"loyalty": {
          Tables: {
            "cards": {
                  Row: {
                    "business_id": string,"issued_at": string,"member_id": string,"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"issued_at"?: string,"member_id": string,"token_hash": string
                  }
                  Update: {
                    "business_id"?: string,"issued_at"?: string,"member_id"?: string,"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cards_business_id_member_id_fkey"
      columns: ["business_id","member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["business_id","id"]
    }
                  ]
                },"event_failures": {
                  Row: {
                    "business_id": string,"created_at": string,"error": string | null,"event_id": number | null,"id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"error"?: string | null,"event_id"?: number | null,"id"?: never
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"error"?: string | null,"event_id"?: number | null,"id"?: never
                  }
                  Relationships: [
                    
                  ]
                },"ledger": {
                  Row: {
                    "business_id": string,"created_at": string,"created_by": string | null,"delta": number,"id": number,"member_id": string,"note": string | null,"reason": string,"redemption_id": string | null,"visit_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"created_at"?: string,"created_by"?: string | null,"delta": number,"id"?: never,"member_id": string,"note"?: string | null,"reason": string,"redemption_id"?: string | null,"visit_id"?: string | null
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"created_by"?: string | null,"delta"?: number,"id"?: never,"member_id"?: string,"note"?: string | null,"reason"?: string,"redemption_id"?: string | null,"visit_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "ledger_business_id_member_id_fkey"
      columns: ["business_id","member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["business_id","id"]
    },{
      foreignKeyName: "ledger_business_id_redemption_id_fkey"
      columns: ["business_id","redemption_id"]
isOneToOne: false
      referencedRelation: "redemptions"
      referencedColumns: ["business_id","id"]
    }
                  ]
                },"members": {
                  Row: {
                    "business_id": string,"card_issued_at": string | null,"created_by": string | null,"customer_id": string,"id": string,"joined_at": string,"left_at": string | null,"lifetime_points": number,"member_code": string,"points_balance": number,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"card_issued_at"?: string | null,"created_by"?: string | null,"customer_id": string,"id"?: string,"joined_at"?: string,"left_at"?: string | null,"lifetime_points"?: number,"member_code": string,"points_balance"?: number,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"card_issued_at"?: string | null,"created_by"?: string | null,"customer_id"?: string,"id"?: string,"joined_at"?: string,"left_at"?: string | null,"lifetime_points"?: number,"member_code"?: string,"points_balance"?: number,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"programs": {
                  Row: {
                    "amount_step_minor": number | null,"business_id": string,"created_at": string,"enabled": boolean,"kind": string,"max_points_per_visit": number,"max_visits_per_day": number,"min_amount_minor": number,"points_per_amount": number,"points_per_visit": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_step_minor"?: number | null,"business_id": string,"created_at"?: string,"enabled"?: boolean,"kind"?: string,"max_points_per_visit"?: number,"max_visits_per_day"?: number,"min_amount_minor"?: number,"points_per_amount"?: number,"points_per_visit"?: number,"updated_at"?: string
                  }
                  Update: {
                    "amount_step_minor"?: number | null,"business_id"?: string,"created_at"?: string,"enabled"?: boolean,"kind"?: string,"max_points_per_visit"?: number,"max_visits_per_day"?: number,"min_amount_minor"?: number,"points_per_amount"?: number,"points_per_visit"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"redemptions": {
                  Row: {
                    "business_id": string,"cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"code": string,"created_at": string,"created_by": string | null,"id": string,"member_id": string,"points": number,"request_id": string | null,"reward_id": string,"reward_name": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_id": string,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"code": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"member_id": string,"points": number,"request_id"?: string | null,"reward_id": string,"reward_name": string,"status"?: string
                  }
                  Update: {
                    "business_id"?: string,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"code"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"member_id"?: string,"points"?: number,"request_id"?: string | null,"reward_id"?: string,"reward_name"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "redemptions_business_id_member_id_fkey"
      columns: ["business_id","member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["business_id","id"]
    },{
      foreignKeyName: "redemptions_business_id_reward_id_fkey"
      columns: ["business_id","reward_id"]
isOneToOne: false
      referencedRelation: "rewards"
      referencedColumns: ["business_id","id"]
    }
                  ]
                },"rewards": {
                  Row: {
                    "active": boolean,"available_until": string | null,"business_id": string,"cost_points": number,"created_at": string,"description": string | null,"id": string,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"available_until"?: string | null,"business_id": string,"cost_points": number,"created_at"?: string,"description"?: string | null,"id"?: string,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"available_until"?: string | null,"business_id"?: string,"cost_points"?: number,"created_at"?: string,"description"?: string | null,"id"?: string,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "adjust_points":
{ Args: { "p_delta": number,"p_member_id": string,"p_note": string }; Returns: {
              "business_id": string,
"card_issued_at": string | null,
"created_by": string | null,
"customer_id": string,
"id": string,
"joined_at": string,
"left_at": string | null,
"lifetime_points": number,
"member_code": string,
"points_balance": number,
"status": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "members"
        isOneToOne: true
        isSetofReturn: false
      } },
"cancel_redemption":
{ Args: { "p_reason": string,"p_redemption_id": string }; Returns: {
              "business_id": string,
"cancel_reason": string | null,
"cancelled_at": string | null,
"cancelled_by": string | null,
"code": string,
"created_at": string,
"created_by": string | null,
"id": string,
"member_id": string,
"points": number,
"request_id": string | null,
"reward_id": string,
"reward_name": string,
"status": string
            }
                          SetofOptions: {
        from: "*"
        to: "redemptions"
        isOneToOne: true
        isSetofReturn: false
      } },
"enroll_customer":
{ Args: { "p_customer_id": string }; Returns: {
              "business_id": string,
"card_issued_at": string | null,
"created_by": string | null,
"customer_id": string,
"id": string,
"joined_at": string,
"left_at": string | null,
"lifetime_points": number,
"member_code": string,
"points_balance": number,
"status": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "members"
        isOneToOne: true
        isSetofReturn: false
      } },
"find_member_by_code":
{ Args: { "p_business_id": string,"p_code": string }; Returns: string
                           },
"get_card":
{ Args: { "p_token": string }; Returns: Json
                           },
"issue_card":
{ Args: { "p_member_id": string }; Returns: string
                           },
"leave_program":
{ Args: { "p_member_id": string }; Returns: {
              "business_id": string,
"card_issued_at": string | null,
"created_by": string | null,
"customer_id": string,
"id": string,
"joined_at": string,
"left_at": string | null,
"lifetime_points": number,
"member_code": string,
"points_balance": number,
"status": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "members"
        isOneToOne: true
        isSetofReturn: false
      } },
"new_member_code":
{ Args: { "p_business_id": string }; Returns: string
                           },
"new_redemption_code":
{ Args: { "p_business_id": string }; Returns: string
                           },
"points_for_visit":
{ Args: { "p_amount_minor": number,"p_program": Omit<Database["loyalty"]['Tables']["programs"]['Row'], Database["loyalty"]['Tables']["programs"]['ComputedFields']> }; Returns: number
                           },
"post_movement":
{ Args: { "p_delta": number,"p_member": Omit<Database["loyalty"]['Tables']["members"]['Row'], Database["loyalty"]['Tables']["members"]['ComputedFields']>,"p_note"?: string,"p_reason": string,"p_redemption_id"?: string,"p_visit_id"?: string }; Returns: boolean
                           },
"redeem_reward":
{ Args: { "p_member_id": string,"p_request_id"?: string,"p_reward_id": string }; Returns: {
              "business_id": string,
"cancel_reason": string | null,
"cancelled_at": string | null,
"cancelled_by": string | null,
"code": string,
"created_at": string,
"created_by": string | null,
"id": string,
"member_id": string,
"points": number,
"request_id": string | null,
"reward_id": string,
"reward_name": string,
"status": string
            }
                          SetofOptions: {
        from: "*"
        to: "redemptions"
        isOneToOne: true
        isSetofReturn: false
      } },
"require_module":
{ Args: { "p_business_id": string }; Returns: undefined
                           }
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
        },"loyalty": {
          Enums: {
            
          }
        }
} as const
