import {
  createAsaasCharge,
  createAsaasCustomer,
  findAsaasCustomerByExternalReference,
  findAsaasPaymentByExternalReference,
  getAsaasPixQrCode,
  PaymentProviderError,
  type AsaasPayment,
} from '@/lib/asaas';
import { z } from 'zod';
import { getD1 } from '@/db/queries';
import { createOrderSchema, type PaymentMethod } from '@/lib/domain';
import { isSameOriginRequest } from '@/lib/security';

export const dynamic = 'force-dynamic';

type GiftRow = {
  id: string;
  weddingId: string;
  title: string;
  priceInCents: number;
};
type ExistingOrder = {
  id: string;
  publicId: string;
  giftId: string;
  guestEmail: string;
  status: string;
  paymentMethod: PaymentMethod;
  providerPaymentId: string | null;
  providerCheckoutUrl: string | null;
  paymentExpiresAt: string | null;
  updatedAt: string;
};

function orderResponse(
  order: ExistingOrder,
  pix: Awaited<ReturnType<typeof getAsaasPixQrCode>> | null = null,
) {
  return {
    order: {
      publicId: order.publicId,
      status: order.status,
      paymentMethod: order.paymentMethod,
      checkoutUrl: order.providerCheckoutUrl,
      expiresAt: order.paymentExpiresAt,
    },
    pix,
  };
}

function providerState(payment: AsaasPayment) {
  const confirmed =
    payment.status === 'CONFIRMED' || payment.status === 'RECEIVED';
  return {
    status: confirmed ? 'CONFIRMED' : 'PENDING',
    settlementStatus: payment.status === 'RECEIVED' ? 'AVAILABLE' : 'PENDING',
  };
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request))
    return Response.json(
      { error: 'Origem da solicitação inválida.' },
      { status: 403 },
    );
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 16_000)
    return Response.json(
      { error: 'Solicitação muito grande.' },
      { status: 413 },
    );

  const parsed = createOrderSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return Response.json(
      {
        error: 'Confira os dados informados.',
        details: z.treeifyError(parsed.error),
      },
      { status: 400 },
    );

  const db = getD1();
  const input = parsed.data;
  let order = await db
    .prepare(`
    SELECT id, public_id AS publicId, gift_id AS giftId, guest_email AS guestEmail,
      status, payment_method AS paymentMethod, provider_payment_id AS providerPaymentId,
      provider_checkout_url AS providerCheckoutUrl, payment_expires_at AS paymentExpiresAt,
      updated_at AS updatedAt
    FROM orders WHERE client_request_id = ? LIMIT 1
  `)
    .bind(input.clientRequestId)
    .first<ExistingOrder>();

  if (
    order &&
    (order.giftId !== input.giftId ||
      order.paymentMethod !== input.paymentMethod ||
      order.guestEmail !== input.guestEmail.toLowerCase())
  ) {
    return Response.json(
      { error: 'Esta tentativa já foi usada com outros dados.' },
      { status: 409 },
    );
  }

  if (order?.providerPaymentId) {
    const pix =
      order.paymentMethod === 'PIX' && order.status !== 'CONFIRMED'
        ? await getAsaasPixQrCode(order.providerPaymentId).catch(() => null)
        : null;
    return Response.json(orderResponse(order, pix));
  }

  if (order) {
    const reconciled = await findAsaasPaymentByExternalReference(
      order.publicId,
    ).catch(() => null);
    if (reconciled) {
      const state = providerState(reconciled);
      const checkoutUrl =
        reconciled.invoiceUrl ?? reconciled.bankSlipUrl ?? null;
      const now = new Date().toISOString();
      await db
        .prepare(`UPDATE orders SET provider_payment_id = ?, provider_checkout_url = ?,
        payment_expires_at = ?, status = ?, settlement_status = ?,
        confirmed_at = CASE WHEN ? = 'CONFIRMED' THEN COALESCE(confirmed_at, ?) ELSE confirmed_at END,
        updated_at = ? WHERE id = ?`)
        .bind(
          reconciled.id,
          checkoutUrl,
          reconciled.dueDate ?? null,
          state.status,
          state.settlementStatus,
          state.status,
          now,
          now,
          order.id,
        )
        .run();
      order = {
        ...order,
        providerPaymentId: reconciled.id,
        providerCheckoutUrl: checkoutUrl,
        paymentExpiresAt: reconciled.dueDate ?? null,
        status: state.status,
        updatedAt: now,
      };
      const pix =
        order.paymentMethod === 'PIX' && state.status !== 'CONFIRMED'
          ? await getAsaasPixQrCode(reconciled.id).catch(() => null)
          : null;
      return Response.json(orderResponse(order, pix));
    }

    const stillCreating =
      order.status === 'CREATING' &&
      Date.now() - new Date(order.updatedAt).getTime() < 30_000;
    if (stillCreating)
      return Response.json(
        {
          error:
            'O pagamento ainda está sendo criado. Aguarde alguns segundos e tente novamente.',
        },
        { status: 409 },
      );

    const lockTime = new Date().toISOString();
    const lock = await db
      .prepare(`UPDATE orders SET status = 'CREATING', updated_at = ?
      WHERE id = ? AND provider_payment_id IS NULL AND updated_at = ?`)
      .bind(lockTime, order.id, order.updatedAt)
      .run();
    if ((lock.meta.changes ?? 0) === 0)
      return Response.json(
        { error: 'O pagamento já está sendo processado.' },
        { status: 409 },
      );
    order = { ...order, status: 'CREATING', updatedAt: lockTime };
  }

  const recent = await db
    .prepare(
      `SELECT COUNT(*) AS total FROM orders WHERE guest_email = ? AND created_at >= ?`,
    )
    .bind(
      input.guestEmail.toLowerCase(),
      new Date(Date.now() - 10 * 60_000).toISOString(),
    )
    .first<{ total: number }>();
  if (!order && Number(recent?.total ?? 0) >= 5)
    return Response.json(
      { error: 'Muitas tentativas recentes. Aguarde alguns minutos.' },
      { status: 429 },
    );

  const gift = await db
    .prepare(`
    SELECT g.id, g.wedding_id AS weddingId, g.title, g.price_in_cents AS priceInCents
    FROM gifts g JOIN weddings w ON w.id = g.wedding_id
    WHERE g.id = ? AND g.active = 1 AND g.deleted_at IS NULL AND w.published = 1 LIMIT 1
  `)
    .bind(input.giftId)
    .first<GiftRow>();
  if (!gift)
    return Response.json(
      { error: 'Este presente não está disponível.' },
      { status: 404 },
    );

  if (!order) {
    const id = crypto.randomUUID();
    const publicId = crypto.randomUUID();
    const now = new Date().toISOString();
    try {
      await db
        .prepare(`INSERT INTO orders
        (id, public_id, client_request_id, wedding_id, gift_id, guest_name, guest_email,
         guest_message, privacy_accepted_at, amount_in_cents, currency, payment_method, status, settlement_status,
         provider, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'BRL', ?, 'CREATING', 'PENDING', 'ASAAS', ?, ?)`)
        .bind(
          id,
          publicId,
          input.clientRequestId,
          gift.weddingId,
          gift.id,
          input.guestName,
          input.guestEmail.toLowerCase(),
          input.guestMessage || null,
          now,
          gift.priceInCents,
          input.paymentMethod,
          now,
          now,
        )
        .run();
    } catch {
      return Response.json(
        { error: 'Esta tentativa já está sendo processada.' },
        { status: 409 },
      );
    }
    order = {
      id,
      publicId,
      giftId: gift.id,
      guestEmail: input.guestEmail.toLowerCase(),
      status: 'CREATING',
      paymentMethod: input.paymentMethod,
      providerPaymentId: null,
      providerCheckoutUrl: null,
      paymentExpiresAt: null,
      updatedAt: now,
    };
  }

  try {
    const alreadyCreated = await findAsaasPaymentByExternalReference(
      order.publicId,
    );
    const customer =
      (await findAsaasCustomerByExternalReference(order.publicId)) ??
      (await createAsaasCustomer({
        name: input.guestName,
        email: input.guestEmail,
        cpfCnpj: input.cpfCnpj,
        externalReference: order.publicId,
      }));
    const created = alreadyCreated
      ? {
          payment: alreadyCreated,
          pix:
            input.paymentMethod === 'PIX'
              ? await getAsaasPixQrCode(alreadyCreated.id)
              : null,
        }
      : await createAsaasCharge({
          customerId: customer.id,
          method: input.paymentMethod,
          amountInCents: gift.priceInCents,
          description: gift.title,
          externalReference: order.publicId,
        });
    const { payment, pix } = created;
    const state = providerState(payment);
    const checkoutUrl = payment.invoiceUrl ?? payment.bankSlipUrl ?? null;
    const now = new Date().toISOString();
    await db
      .prepare(`UPDATE orders SET provider_customer_id = ?, provider_payment_id = ?,
      provider_checkout_url = ?, payment_expires_at = ?, status = ?, settlement_status = ?,
      confirmed_at = CASE WHEN ? = 'CONFIRMED' THEN COALESCE(confirmed_at, ?) ELSE confirmed_at END,
      updated_at = ? WHERE id = ?`)
      .bind(
        customer.id,
        payment.id,
        checkoutUrl,
        pix?.expirationDate ?? payment.dueDate ?? null,
        state.status,
        state.settlementStatus,
        state.status,
        now,
        now,
        order.id,
      )
      .run();

    return Response.json(
      {
        order: {
          publicId: order.publicId,
          status: state.status,
          paymentMethod: input.paymentMethod,
          checkoutUrl,
          expiresAt: pix?.expirationDate ?? payment.dueDate ?? null,
        },
        pix,
      },
      { status: 201 },
    );
  } catch (error) {
    const ambiguous =
      !(error instanceof PaymentProviderError) ||
      !error.status ||
      error.status >= 500 ||
      error.status === 429;
    await db
      .prepare(`UPDATE orders SET status = ?, updated_at = ? WHERE id = ?`)
      .bind(
        ambiguous ? 'UNKNOWN' : 'CANCELED',
        new Date().toISOString(),
        order.id,
      )
      .run();
    const message =
      error instanceof PaymentProviderError
        ? error.message
        : 'Não foi possível iniciar o pagamento.';
    const status =
      error instanceof PaymentProviderError && error.status === 503 ? 503 : 502;
    return Response.json({ error: message }, { status });
  }
}
