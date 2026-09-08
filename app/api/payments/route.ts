import { z } from 'zod';
import {
  createAsaasCardCharge,
  createAsaasCustomer,
  findAsaasCustomerByExternalReference,
  findAsaasPaymentByExternalReference,
  PaymentProviderError,
  type AsaasPayment,
} from '@/lib/asaas';
import { getD1 } from '@/db/queries';
import { createOrderSchema, type PaymentMethod } from '@/lib/domain';
import { createPixPayload } from '@/lib/pix';
import { isSameOriginRequest } from '@/lib/security';

export const dynamic = 'force-dynamic';

type GiftRow = {
  id: string;
  weddingId: string;
  title: string;
  priceInCents: number;
  pixKey: string;
  pixRecipientName: string;
  pixRecipientCity: string;
};

type ExistingOrder = {
  id: string;
  publicId: string;
  giftId: string;
  guestEmail: string;
  amountInCents: number;
  status: string;
  paymentMethod: PaymentMethod;
  providerPaymentId: string | null;
  providerCheckoutUrl: string | null;
  paymentExpiresAt: string | null;
  updatedAt: string;
};

function providerState(payment: AsaasPayment) {
  const confirmed =
    payment.status === 'CONFIRMED' || payment.status === 'RECEIVED';
  return {
    status: confirmed ? 'CONFIRMED' : 'PENDING',
    settlementStatus: payment.status === 'RECEIVED' ? 'AVAILABLE' : 'PENDING',
  };
}

function pixResponse(order: ExistingOrder, gift: GiftRow) {
  return {
    order: {
      publicId: order.publicId,
      status: order.status,
      paymentMethod: 'PIX' as const,
      checkoutUrl: null,
      expiresAt: null,
    },
    pix: {
      payload: createPixPayload({
        key: gift.pixKey,
        recipientName: gift.pixRecipientName,
        recipientCity: gift.pixRecipientCity,
        amountInCents: order.amountInCents,
        transactionId: order.publicId.replace(/-/g, '').slice(0, 25),
      }),
      key: gift.pixKey,
      recipientName: gift.pixRecipientName,
    },
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
  const gift = await db
    .prepare(`
    SELECT g.id, g.wedding_id AS weddingId, g.title, g.price_in_cents AS priceInCents,
      w.pix_key AS pixKey, w.pix_recipient_name AS pixRecipientName,
      w.pix_recipient_city AS pixRecipientCity
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

  let order = await db
    .prepare(`
    SELECT id, public_id AS publicId, gift_id AS giftId, guest_email AS guestEmail,
      amount_in_cents AS amountInCents, status, payment_method AS paymentMethod,
      provider_payment_id AS providerPaymentId, provider_checkout_url AS providerCheckoutUrl,
      payment_expires_at AS paymentExpiresAt, updated_at AS updatedAt
    FROM orders WHERE client_request_id = ? LIMIT 1
  `)
    .bind(input.clientRequestId)
    .first<ExistingOrder>();
  const orderWasExisting = Boolean(order);

  if (
    order &&
    (order.giftId !== input.giftId ||
      order.paymentMethod !== input.paymentMethod ||
      order.guestEmail !== input.guestEmail.toLowerCase())
  )
    return Response.json(
      { error: 'Esta tentativa já foi usada com outros dados.' },
      { status: 409 },
    );

  if (order && input.paymentMethod === 'PIX')
    return Response.json(pixResponse(order, gift));

  if (order?.providerPaymentId)
    return Response.json({
      order: {
        publicId: order.publicId,
        status: order.status,
        paymentMethod: order.paymentMethod,
        checkoutUrl: order.providerCheckoutUrl,
        expiresAt: order.paymentExpiresAt,
      },
      pix: null,
    });

  if (orderWasExisting && order) {
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

  if (!order) {
    const now = new Date().toISOString();
    order = {
      id: crypto.randomUUID(),
      publicId: crypto.randomUUID(),
      giftId: gift.id,
      guestEmail: input.guestEmail.toLowerCase(),
      amountInCents: gift.priceInCents,
      status: input.paymentMethod === 'PIX' ? 'PENDING' : 'CREATING',
      paymentMethod: input.paymentMethod,
      providerPaymentId: null,
      providerCheckoutUrl: null,
      paymentExpiresAt: null,
      updatedAt: now,
    };
    try {
      await db
        .prepare(`INSERT INTO orders
        (id, public_id, client_request_id, wedding_id, gift_id, guest_name, guest_email,
         guest_message, privacy_accepted_at, amount_in_cents, currency, payment_method, status,
         settlement_status, provider, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'BRL', ?, ?, 'PENDING', ?, ?, ?)`)
        .bind(
          order.id,
          order.publicId,
          input.clientRequestId,
          gift.weddingId,
          gift.id,
          input.guestName,
          input.guestEmail.toLowerCase(),
          input.guestMessage || null,
          now,
          gift.priceInCents,
          input.paymentMethod,
          order.status,
          input.paymentMethod === 'PIX' ? 'DIRECT_PIX' : 'ASAAS',
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
  }

  if (input.paymentMethod === 'PIX')
    return Response.json(pixResponse(order, gift), { status: 201 });

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
      ? { payment: alreadyCreated }
      : await createAsaasCardCharge({
          customerId: customer.id,
          amountInCents: gift.priceInCents,
          description: gift.title,
          externalReference: order.publicId,
        });
    const state = providerState(created.payment);
    const checkoutUrl = created.payment.invoiceUrl ?? null;
    const now = new Date().toISOString();
    const statements = [
      db
        .prepare(`UPDATE orders SET provider_customer_id = ?, provider_payment_id = ?,
      provider_checkout_url = ?, payment_expires_at = ?, status = ?, settlement_status = ?,
      confirmed_at = CASE WHEN ? = 'CONFIRMED' THEN COALESCE(confirmed_at, ?) ELSE confirmed_at END,
      updated_at = ? WHERE id = ?`)
        .bind(
          customer.id,
          created.payment.id,
          checkoutUrl,
          created.payment.dueDate ?? null,
          state.status,
          state.settlementStatus,
          state.status,
          now,
          now,
          order.id,
        ),
    ];
    if (state.status === 'CONFIRMED') {
      const formattedAmount = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(gift.priceInCents / 100);
      statements.push(
        db
          .prepare(`INSERT OR IGNORE INTO admin_notifications
          (id, wedding_id, order_id, dedupe_key, type, title, message, created_at)
          VALUES (?, ?, ?, ?, 'CARD_CONFIRMED', 'Cartão confirmado', ?, ?)`)
          .bind(
            crypto.randomUUID(),
            gift.weddingId,
            order.id,
            `card-confirmed:${order.id}`,
            `${input.guestName} enviou ${formattedAmount} por cartão. O pagamento foi confirmado pelo Asaas.`,
            now,
          ),
      );
    }
    await db.batch(statements);
    return Response.json(
      {
        order: {
          publicId: order.publicId,
          status: state.status,
          paymentMethod: 'CARD',
          checkoutUrl,
          expiresAt: created.payment.dueDate ?? null,
        },
        pix: null,
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
    return Response.json(
      { error: message },
      {
        status:
          error instanceof PaymentProviderError && error.status === 503
            ? 503
            : 502,
      },
    );
  }
}
