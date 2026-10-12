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
  type Birthday,
  type CustomerInput,
  type CustomerListItem,
  type CustomerStats,
  type CustomerStatus,
} from './customers.ts'
export { formatBirthday, isValidBirthday, MONTH_NAMES } from './birthday.ts'
export * as visits from './visits.ts'
export * as campaigns from './campaigns.ts'
export type {
  Campaign,
  CampaignInput,
  CampaignResults,
  CampaignStatus,
  Coupon,
  CouponRedemption,
  CouponStatus,
  CouponVisitInput,
  Recipient as CampaignRecipient,
  RecipientBlockedReason,
  Segment,
  SegmentPreview,
} from './campaigns.ts'
export * as automations from './automations.ts'
export {
  AUTOMATION_DAYS,
  AUTOMATION_KINDS,
  type Automation,
  type AutomationInput,
  type AutomationKind,
  type OutboxBlockedReason,
  type OutboxMessage,
} from './automations.ts'
export * as selfSignup from './selfSignup.ts'
export type {
  SelfSignupInput,
  SelfSignupNotice,
  SelfSignupResult,
  SelfSignupSettings,
  SelfSignupStatus,
} from './selfSignup.ts'
export * as integrations from './integrations.ts'
export type { IntegrationKey, SimulatedSale } from './integrations.ts'
export * as dashboard from './dashboard.ts'
export * as weeklyDigest from './weeklyDigest.ts'
export * as smartCounter from './smartCounter.ts'
export type { CustomerSnapshot, TeamMemberWeek, TopCustomer } from './smartCounter.ts'
export type { WeeklyDigest } from './weeklyDigest.ts'
export type { DashboardSummary } from './dashboard.ts'
export * as loyalty from './loyalty.ts'
export * as card from './card.ts'
export type { Card, CardMovement, CardReferral, CardReward, StampSlots } from './card.ts'
export * as referrals from './referrals.ts'
export * as mobileRedemption from './mobileRedemption.ts'
export type { FoundRequest, RedemptionRequest, RequestState } from './mobileRedemption.ts'
export type {
  MemberReferral,
  RankingRow as ReferralRankingRow,
  ReferralSettings,
} from './referrals.ts'
export * as feedback from './feedback.ts'
export type { Feedback } from './feedback.ts'
export * as wallet from './wallet.ts'
export type { WalletErrorCode, WalletProvider, WalletStatus } from './wallet.ts'
export type {
  Member as LoyaltyMember,
  Movement as LoyaltyMovement,
  MovementReason as LoyaltyMovementReason,
  Program as LoyaltyProgram,
  ProgramTemplate as LoyaltyProgramTemplate,
  ProgramInput as LoyaltyProgramInput,
  ProgramKind as LoyaltyProgramKind,
  ProgramRule as LoyaltyProgramRule,
  Redemption as LoyaltyRedemption,
  Reward as LoyaltyReward,
} from './loyalty.ts'
export type { Visit, VisitCounts } from './visits.ts'
export { localDateInTimeZone, startOfDayInTimeZone } from './dates.ts'
export { formatMoney, parseAmountToMinor } from './money.ts'
export { detectDelimiter, neutralizeFormula, parseCsv, toCsv } from './csv.ts'
export * as dataExport from './dataExport.ts'
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
