import { describe, expect, it } from 'vitest';
import {
  createOrderSchema,
  formatBrlFromCents,
  isValidCpfCnpj,
  mapAsaasEvent,
  resolveOrderStatus,
  resolveSettlementStatus,
  slugify,
} from '../lib/domain';
import {
  constantTimeEqual,
  isSameOriginRequest,
  sha256Hex,
} from '../lib/security';

describe('validação do pagador', () => {
  it('aceita e normaliza CPF e CNPJ válidos', () => {
    expect(isValidCpfCnpj('529.982.247-25')).toBe(true);
    expect(isValidCpfCnpj('04.252.011/0001-10')).toBe(true);
    const parsed = createOrderSchema.parse({
      giftId: 'gift_1',
      clientRequestId: '641f399c-ff88-4de4-990f-e4b1c812fd1c',
      guestName: 'Maria Silva',
      guestEmail: 'MARIA@example.com',
      cpfCnpj: '529.982.247-25',
      paymentMethod: 'PIX',
      privacyAccepted: true,
    });
    expect(parsed.cpfCnpj).toBe('52998224725');
  });

  it('rejeita documentos inválidos e aceite ausente', () => {
    expect(isValidCpfCnpj('111.111.111-11')).toBe(false);
    expect(
      createOrderSchema.safeParse({
        giftId: 'gift_1',
        clientRequestId: crypto.randomUUID(),
        guestName: 'Maria Silva',
        guestEmail: 'maria@example.com',
        cpfCnpj: '111.111.111-11',
        paymentMethod: 'PIX',
        privacyAccepted: false,
      }).success,
    ).toBe(false);
  });
});

describe('eventos e transições de pagamento', () => {
  it('mapeia confirmação, liquidação e reembolso parcial', () => {
    expect(mapAsaasEvent('PAYMENT_CONFIRMED')).toEqual({
      status: 'CONFIRMED',
      settlementStatus: 'PENDING',
    });
    expect(mapAsaasEvent('PAYMENT_RECEIVED')).toEqual({
      status: 'CONFIRMED',
      settlementStatus: 'AVAILABLE',
    });
    expect(mapAsaasEvent('PAYMENT_PARTIALLY_REFUNDED')).toEqual({
      status: 'PARTIALLY_REFUNDED',
      settlementStatus: 'PARTIAL_REVERSED',
    });
  });

  it('não regride confirmação por evento atrasado', () => {
    expect(resolveOrderStatus('CONFIRMED', 'EXPIRED')).toBe('CONFIRMED');
    expect(resolveOrderStatus('EXPIRED', 'CONFIRMED')).toBe('CONFIRMED');
    expect(resolveOrderStatus('REFUNDED', 'CONFIRMED')).toBe('REFUNDED');
    expect(resolveSettlementStatus('AVAILABLE', 'PENDING')).toBe('AVAILABLE');
  });
});

describe('utilitários', () => {
  it('gera slug e moeda brasileira previsíveis', () => {
    expect(slugify('Jantar Especial à Dois!')).toBe('jantar-especial-a-dois');
    expect(formatBrlFromCents(12345)).toContain('123,45');
  });

  it('compara segredos e gera hash estável', async () => {
    expect(constantTimeEqual('segredo', 'segredo')).toBe(true);
    expect(constantTimeEqual('segredo', 'outro')).toBe(false);
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('rejeita mutações administrativas de outra origem', () => {
    const sameOrigin = new Request(
      'https://casamento.example/api/admin/gifts',
      {
        headers: {
          host: 'casamento.example',
          origin: 'https://casamento.example',
        },
      },
    );
    const crossOrigin = new Request(
      'https://casamento.example/api/admin/gifts',
      {
        headers: {
          host: 'casamento.example',
          origin: 'https://malicioso.example',
        },
      },
    );
    expect(isSameOriginRequest(sameOrigin)).toBe(true);
    expect(isSameOriginRequest(crossOrigin)).toBe(false);
  });
});
