// Acceso a datos de la plataforma. Es el único lugar que habla con Supabase.
export { readPublicEnv, type PublicEnv } from './env.ts'
export { getSupabase, initSupabase, type PlatformClient } from './client.ts'
export {
  AppError,
  errorMessage,
  fromAuthError,
  fromPostgrestError,
  type AppErrorCode,
} from './errors.ts'
export type { Business, MemberRole, MyBusiness } from './types.ts'
export * as auth from './auth.ts'
export * as businesses from './businesses.ts'
export * as customers from './customers.ts'
export {
  CUSTOMER_STATUSES,
  type Customer,
  type CustomerInput,
  type CustomerListItem,
  type CustomerStats,
  type CustomerStatus,
} from './customers.ts'
export * as visits from './visits.ts'
export * as campaigns from './campaigns.ts'
export type {
  Campaign,
  CampaignInput,
  CampaignResults,
  CampaignStatus,
  Recipient as CampaignRecipient,
  Segment,
  SegmentPreview,
} from './campaigns.ts'
export * as dashboard from './dashboard.ts'
export type { DashboardSummary } from './dashboard.ts'
export * as loyalty from './loyalty.ts'
export * as card from './card.ts'
export type { Card, CardMovement, CardReward } from './card.ts'
export type {
  Member as LoyaltyMember,
  Movement as LoyaltyMovement,
  MovementReason as LoyaltyMovementReason,
  Program as LoyaltyProgram,
  ProgramInput as LoyaltyProgramInput,
  ProgramKind as LoyaltyProgramKind,
  Redemption as LoyaltyRedemption,
  Reward as LoyaltyReward,
} from './loyalty.ts'
export type { Visit, VisitCounts } from './visits.ts'
export { startOfDayInTimeZone } from './dates.ts'
export { formatMoney, parseAmountToMinor } from './money.ts'
export { detectDelimiter, parseCsv, toCsv } from './csv.ts'
export {
  IMPORT_TEMPLATE,
  buildImportRows,
  detectColumns,
  importRejectionLabels,
  type ColumnMapping,
  type ImportField,
  type ImportRejection,
  type ImportRow,
  type InvalidRow,
} from './customerImport.ts'
export { formatPhone, normalizePhone } from './phone.ts'
export { isValidSlug, slugify } from './slug.ts'
export {
  COMMON_TIMEZONES,
  LOGO_ACCEPT,
  LOGO_MAX_BYTES,
  isValidHexColor,
  logoFileError,
  normalizeHexColor,
  textColorOn,
} from './branding.ts'
export type { BrandingInput } from './businesses.ts'
export type { Session } from '@supabase/supabase-js'
