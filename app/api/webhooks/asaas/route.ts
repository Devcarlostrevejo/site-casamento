import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { getD1 } from '@/db/queries';
import {
  mapAsaasEvent,
  resolveOrderStatus,
  resolveSettlementStatus,
} from '@/lib/domain';
import { constantTimeEqual, sha256Hex } from '@/lib/security';

export const dynamic = 'force-dynamic';

const webhookSchema = z
  .object({
    id: z.string().min(1).max(200),
    event: z.string().min(1).max(100),
    payment: z
      .object({
        id: z.string().min(1).max(200),
        externalReference: z.string().max(200).nullish(),
      })
      .nullish(),
    checkout: z
      .object({
        id: z.string().min(1).max(200),
        externalReference: z.string().max(200).nullish(),
      })
      .nullish(),
  })
  .loose();

export async function POST(request: Request) {
  const expectedToken = env.ASAAS_WEBHOOK_TOKEN;
  if (!expectedToken)
    return Response.json(
      { error: 'Webhook não configurado.' },
      { status: 503 },
    );
  const suppliedToken = request.headers.get('asaas-access-token') ?? '';
  if (
    !constantTimeEqual(
      await sha256Hex(suppliedToken),
      await sha256Hex(expectedToken),
    )
  )
    return Response.json({ error: 'Não autorizado.' }, { status: 401 });

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 256_000)
    return Response.json({ error: 'Payload muito grande.' }, { status: 413 });
  const rawBody = await request.text();
  if (rawBody.length > 256_000)
    return Response.json({ error: 'Payload muito grande.' }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(rawBody || 'null');
  } catch {
    return Response.json({ error: 'JSON inválido.' }, { status: 400 });
  }
  const parsed = webhookSchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: 'Evento inválido.' }, { status: 400 });

  const payload = parsed.data;
  const providerPaymentId = payload.payment?.id ?? payload.checkout?.id ?? null;
  const externalReference =
    payload.payment?.externalReference ??
    payload.checkout?.externalReference ??
    null;
  const now = new Date().toISOString();
  const db = getD1();
  const insert = await db
    .prepare(`INSERT OR IGNORE INTO webhook_events
    (id, provider_event_id, event_type, provider_payment_id, payload_hash, processing_status, received_at)
    VALUES (?, ?, ?, ?, ?, 'RECEIVED', ?)`)
    .bind(
      crypto.randomUUID(),
      payload.id,
      payload.event,
      providerPaymentId,
      await sha256Hex(rawBody),
      now,
    )
    .run();
  if ((insert.meta.changes ?? 0) === 0) {
    const existing = await db
      .prepare(
        `SELECT processing_status AS processingStatus FROM webhook_events WHERE provider_event_id = ? LIMIT 1`,
      )
      .bind(payload.id)
      .first<{ processingStatus: string }>();
    if (existing?.processingStatus === 'PROCESSED')
      return Response.json({ received: true, duplicate: true });
    await db
      .prepare(
        `UPDATE webhook_events SET processing_status = 'RECEIVED', last_error = NULL WHERE provider_event_id = ?`,
      )
      .bind(payload.id)
      .run();
  }

  try {
    let order = providerPaymentId
      ? await db
          .prepare(
            `SELECT id, status, settlement_status AS settlementStatus FROM orders WHERE provider_payment_id = ? LIMIT 1`,
          )
          .bind(providerPaymentId)
          .first<{ id: string; status: string; settlementStatus: string }>()
      : null;
    if (!order && externalReference) {
      order = await db
        .prepare(
          `SELECT id, status, settlement_status AS settlementStatus FROM orders WHERE public_id = ? LIMIT 1`,
        )
        .bind(externalReference)
        .first<{ id: string; status: string; settlementStatus: string }>();
    }
    const mapped = mapAsaasEvent(payload.event);
    if (order && (mapped.status || mapped.settlementStatus)) {
      const nextStatus = resolveOrderStatus(order.status, mapped.status);
      const nextSettlement = resolveSettlementStatus(
        order.settlementStatus,
        mapped.settlementStatus,
      );
      await db.batch([
        db
          .prepare(`UPDATE orders SET status = ?, settlement_status = ?,
          confirmed_at = CASE WHEN ? = 'CONFIRMED' THEN COALESCE(confirmed_at, ?) ELSE confirmed_at END,
          updated_at = ? WHERE id = ?`)
          .bind(nextStatus, nextSettlement, nextStatus, now, now, order.id),
        db
          .prepare(
            `UPDATE webhook_events SET processing_status = 'PROCESSED', processed_at = ? WHERE provider_event_id = ?`,
          )
          .bind(new Date().toISOString(), payload.id),
      ]);
      return Response.json({ received: true });
    }
    const isOurReference = Boolean(
      externalReference && /^[0-9a-f-]{36}$/i.test(externalReference),
    );
    if (!order && isOurReference)
      throw new Error('Pedido ainda não localizado para o evento.');
    await db
      .prepare(
        `UPDATE webhook_events SET processing_status = 'PROCESSED', processed_at = ?, last_error = ? WHERE provider_event_id = ?`,
      )
      .bind(
        new Date().toISOString(),
        order ? null : 'IGNORED_ORDER_NOT_FOUND',
        payload.id,
      )
      .run();
    return Response.json({ received: true });
  } catch (error) {
    await db
      .prepare(
        `UPDATE webhook_events SET processing_status = 'FAILED', last_error = ? WHERE provider_event_id = ?`,
      )
      .bind(
        error instanceof Error ? error.message.slice(0, 300) : 'unknown',
        payload.id,
      )
      .run();
    return Response.json({ error: 'Falha temporária.' }, { status: 500 });
  }
}
