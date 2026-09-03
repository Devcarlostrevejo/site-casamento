declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    FILES: R2Bucket;
    ADMIN_EMAILS?: string;
    ALLOW_TEST_ADMIN?: string;
    ASAAS_ENV?: 'sandbox' | 'production';
    ASAAS_API_URL?: string;
    ASAAS_API_KEY?: string;
    ASAAS_WEBHOOK_TOKEN?: string;
  }
}
