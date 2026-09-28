declare namespace NodeJS {
  interface ProcessEnv {
    readonly NEXT_PUBLIC_SUPABASE_URL: string;
    readonly NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
    readonly NEXT_PUBLIC_APP_URL?: string;
    readonly SUPABASE_SERVICE_ROLE_KEY?: string;
    readonly PAYMENT_WEBHOOK_SECRET?: string;
    readonly SUPERADMIN_SESSION_SECRET?: string;
    readonly SUPERADMIN_CODE_SECRET?: string;
    readonly NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY?: string;
    readonly MERCADOPAGO_ACCESS_TOKEN?: string;
    readonly MERCADOPAGO_TEST_PAYER_EMAIL?: string;
    readonly MERCADOPAGO_WEBHOOK_SECRET?: string;
    readonly MERCADOPAGO_CLIENT_ID?: string;
    readonly MERCADOPAGO_CLIENT_SECRET?: string;
    readonly MERCADOPAGO_CREDENTIALS_ENCRYPTION_KEY?: string;
    readonly MERCADOPAGO_OAUTH_TEST_MODE?: string;
  }
}
