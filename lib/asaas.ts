import { env } from 'cloudflare:workers';
import type { PaymentMethod } from '@/lib/domain';

export type AsaasCustomer = { id: string };
export type AsaasPayment = {
  id: string;
  status: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  dueDate?: string;
};

type AsaasCollection<T> = { data?: T[] };

type AsaasPixQrCode = {
  encodedImage: string;
  payload: string;
  expirationDate: string;
};

export class PaymentProviderError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'PaymentProviderError';
  }
}

function config() {
  const apiKey = env.ASAAS_API_KEY;
  const apiUrl =
    env.ASAAS_API_URL ??
    (env.ASAAS_ENV === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://api-sandbox.asaas.com/v3');
  if (!apiKey)
    throw new PaymentProviderError(
      'A integração de pagamentos ainda não foi configurada.',
      503,
    );
  return { apiKey, apiUrl: apiUrl.replace(/\/$/, '') };
}

async function asaasFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { apiKey, apiUrl } = config();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const headers = new Headers(init?.headers);
    headers.set('Content-Type', 'application/json');
    headers.set('User-Agent', 'nosso-dia-presentes/0.1 (Cloudflare Workers)');
    headers.set('access_token', apiKey);
    const response = await fetch(`${apiUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers,
    });
    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      console.error('Asaas request failed', { path, status: response.status });
      throw new PaymentProviderError(
        'Não foi possível iniciar o pagamento. Tente novamente em alguns instantes.',
        response.status,
      );
    }
    return payload as T;
  } catch (error) {
    if (error instanceof PaymentProviderError) throw error;
    const isTimeout =
      error instanceof DOMException && error.name === 'AbortError';
    throw new PaymentProviderError(
      isTimeout
        ? 'O serviço de pagamento demorou para responder.'
        : 'Falha de comunicação com o serviço de pagamento.',
      502,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function createAsaasCustomer(input: {
  name: string;
  email: string;
  cpfCnpj: string;
  externalReference: string;
}) {
  return asaasFetch<AsaasCustomer>('/customers', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      email: input.email,
      cpfCnpj: input.cpfCnpj,
      externalReference: input.externalReference,
      notificationDisabled: true,
    }),
  });
}

export async function findAsaasCustomerByExternalReference(
  externalReference: string,
) {
  const result = await asaasFetch<AsaasCollection<AsaasCustomer>>(
    `/customers?externalReference=${encodeURIComponent(externalReference)}&limit=1`,
  );
  return result.data?.[0] ?? null;
}

export async function createAsaasCharge(input: {
  customerId: string;
  method: PaymentMethod;
  amountInCents: number;
  description: string;
  externalReference: string;
}) {
  const billingType = input.method === 'CARD' ? 'CREDIT_CARD' : input.method;
  const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1_000)
    .toISOString()
    .slice(0, 10);
  const payment = await asaasFetch<AsaasPayment>('/payments', {
    method: 'POST',
    body: JSON.stringify({
      customer: input.customerId,
      billingType,
      value: input.amountInCents / 100,
      dueDate,
      description: input.description,
      externalReference: input.externalReference,
    }),
  });

  const pix =
    input.method === 'PIX'
      ? await asaasFetch<AsaasPixQrCode>(
          `/payments/${encodeURIComponent(payment.id)}/pixQrCode`,
        )
      : null;

  return { payment, pix };
}

export async function getAsaasPayment(paymentId: string) {
  return asaasFetch<AsaasPayment>(`/payments/${encodeURIComponent(paymentId)}`);
}

export async function findAsaasPaymentByExternalReference(
  externalReference: string,
) {
  const result = await asaasFetch<AsaasCollection<AsaasPayment>>(
    `/payments?externalReference=${encodeURIComponent(externalReference)}&limit=1`,
  );
  return result.data?.[0] ?? null;
}

export async function getAsaasPixQrCode(paymentId: string) {
  return asaasFetch<AsaasPixQrCode>(
    `/payments/${encodeURIComponent(paymentId)}/pixQrCode`,
  );
}
