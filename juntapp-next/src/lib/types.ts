// Database types for JuntAPP

export type UserRole = 'vecino' | 'dirigente';
export type BoardPosition = 'presidente' | 'secretario' | 'tesorero' | 'dirigente';
export type CuotaStatus = 'al_dia' | 'pendiente';
export type TransactionType = 'ingreso' | 'egreso';
export type AnnouncementCategory = 'urgente' | 'asamblea' | 'beneficio' | 'general';
export type NotificationType = 'asamblea' | 'votacion' | 'cuota' | 'seguridad' | 'registro' | 'propuesta' | 'general';

export interface Junta {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  comuna: string | null;
  region: string;
  invite_code: string;
  owner_id: string | null;
  subscription_status: 'pending' | 'authorized' | 'paused' | 'cancelled' | 'past_due';
  subscription_price: number;
  subscription_plan: 'juntapp' | 'juntapp_web' | 'web';
  whatsapp_addon: boolean;
  billing_mode: 'subscription' | 'trial_then_subscription' | 'complimentary';
  trial_ends_at: string | null;
  trial_warning_sent_at: string | null;
  trial_expired_at: string | null;
  trial_expired_notice_sent_at: string | null;
  billing_notes: string | null;
  mercadopago_preference_id: string | null;
  mercadopago_payment_id: string | null;
  mercadopago_subscription_id: string | null;
  subscription_next_payment_date: string | null;
  subscription_last_payment_status: string | null;
  subscription_last_synced_at: string | null;
  monthly_due_amount: number;
  activated_at: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  junta_id: string;
  household_id: string;
  name: string;
  rut: string;
  address: string;
  phone: string | null;
  email: string;
  role: UserRole;
  board_position: BoardPosition | null;
  cuota_status: CuotaStatus;
  created_at: string;
}

export interface Household {
  id: string;
  junta_id: string;
  address: string;
  normalized_address: string;
  created_at: string;
  updated_at: string;
}

export type MembershipApplicationStatus = 'pending' | 'approved' | 'rejected' | 'activated';
export interface MembershipApplication {
  id: string;
  junta_id: string;
  name: string;
  rut: string;
  address: string;
  phone: string;
  email: string;
  status: MembershipApplicationStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  letter_delivery_status: 'pending' | 'sent' | 'in_app' | 'failed';
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: number;
  junta_id: string;
  type: TransactionType;
  description: string;
  amount: number;
  date: string;
  created_by: string | null;
  created_at: string;
  source?: 'manual' | 'mercadopago' | 'bank_import';
  accounting_kind?: 'income' | 'expense' | 'transfer' | 'adjustment';
  account_code?: string;
  destination_account_code?: string | null;
  category?: string | null;
  gross_amount?: number;
  fee_amount?: number;
  net_amount?: number;
  provider?: string | null;
  provider_transaction_id?: string | null;
  external_reference?: string | null;
  verification_status?: 'manual' | 'provider_confirmed' | 'reconciled';
  verified_at?: string | null;
  is_immutable?: boolean;
}

export interface Poll {
  id: string;
  junta_id: string;
  title: string;
  description: string;
  active: boolean;
  options: PollOption[];
  created_at: string;
}

export interface PollOption {
  id: string;
  text: string;
  votes?: number;
}

export interface Vote {
  id: number;
  user_id: string;
  poll_id: string;
  option_id: string;
  created_at: string;
}

export interface Announcement {
  id: number;
  junta_id: string;
  category: AnnouncementCategory;
  title: string;
  content: string;
  date: string;
  author: string;
  created_at: string;
}

export interface Notification {
  id: number;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  date: string;
  action: string | null;
  created_at: string;
}

export interface TreasuryDocument {
  name: string;
  path: string;
  size: number;
  created_at: string | null;
  signedUrl: string | null;
}

export type MemberDueStatus = 'pending' | 'preference_created' | 'paid' | 'rejected' | 'refunded';

export interface MemberDue {
  id: string;
  junta_id: string;
  household_id: string;
  profile_id: string | null;
  period: string;
  amount: number;
  status: MemberDueStatus;
  mercadopago_preference_id: string | null;
  mercadopago_payment_id: string | null;
  checkout_url: string | null;
  paid_at: string | null;
  transaction_id: number | null;
  refund_transaction_id: number | null;
  payment_source: 'mercadopago' | 'manual' | null;
  manual_payment_method: 'cash' | 'transfer' | 'other' | null;
  payment_batch_id?: string | null;
  checkout_expires_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type PollProposalStatus = 'pending' | 'approved' | 'rejected';
export interface PollProposal {
  id: string;
  junta_id: string;
  proposed_by: string;
  title: string;
  description: string;
  options: PollOption[];
  status: PollProposalStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  poll_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MercadoPagoConnectionSummary {
  connected: boolean;
  mercadoPagoUserId: number | null;
  connectedAt: string | null;
  oauthConfigured: boolean;
}

export interface TreasurySyncStatus {
  lastCompletedAt: string | null;
  lastImportedCount: number;
  pending: boolean;
}
