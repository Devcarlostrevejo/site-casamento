'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  BedDouble,
  Check,
  CookingPot,
  Copy,
  CreditCard,
  ExternalLink,
  HeartHandshake,
  House,
  Luggage,
  Plane,
  QrCode,
  ReceiptText,
  UtensilsCrossed,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { formatBrlFromCents, type PaymentMethod } from '@/lib/domain';
import type { PublicGift } from '@/lib/demo-data';

const icons = [Plane, UtensilsCrossed, BedDouble, CookingPot, House, Luggage];
const tones = ['plum', 'coral', 'blue', 'gold', 'ink', 'rose'];

type PaymentResult = {
  order: {
    publicId: string;
    status: string;
    paymentMethod: PaymentMethod;
    checkoutUrl: string | null;
    expiresAt: string | null;
  };
  pix: {
    encodedImage: string;
    payload: string;
    expirationDate: string;
  } | null;
};

function formatDocument(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

function formatExpiration(value: string, includeTime: boolean) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(
    'pt-BR',
    includeTime
      ? { dateStyle: 'short', timeStyle: 'short' }
      : { dateStyle: 'short' },
  ).format(date);
}

export function GiftList({
  gifts,
  paymentsEnabled,
}: {
  gifts: PublicGift[];
  paymentsEnabled: boolean;
}) {
  const [selectedGift, setSelectedGift] = useState<PublicGift | null>(null);
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<
    'form' | 'processing' | 'payment' | 'confirmed'
  >('form');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PIX');
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestMessage, setGuestMessage] = useState('');
  const [documentValue, setDocumentValue] = useState('');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function startGift(gift: PublicGift) {
    setSelectedGift(gift);
    setStage('form');
    setPaymentMethod('PIX');
    setGuestName('');
    setGuestEmail('');
    setGuestMessage('');
    setDocumentValue('');
    setPrivacyAccepted(false);
    setResult(null);
    setRequestId(null);
    setError(null);
    setCopied(false);
    setOpen(true);
  }

  useEffect(() => {
    const context =
      typeof document === 'undefined' ? undefined : document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: 'start_gift_payment',
            title: 'Escolher presente de casamento',
            description:
              'Abre no site o formulário de pagamento para um presente disponível. Não conclui nem cobra o pagamento.',
            inputSchema: {
              type: 'object',
              properties: {
                giftId: {
                  type: 'string',
                  description: 'Identificador de um presente exibido na lista.',
                },
              },
              required: ['giftId'],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false, untrustedContentHint: false },
            execute(input: unknown) {
              if (!paymentsEnabled) {
                throw new Error(
                  'Os pagamentos ainda estão sendo configurados pelo casal.',
                );
              }
              const giftId =
                typeof input === 'object' && input !== null && 'giftId' in input
                  ? String((input as { giftId: unknown }).giftId)
                  : '';
              const gift = gifts.find(
                (item) => item.id === giftId && item.active,
              );
              if (!gift)
                throw new Error('Presente não encontrado ou indisponível.');
              startGift(gift);
              return {
                giftId: gift.id,
                title: gift.title,
                status: 'payment_form_opened',
              };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => undefined);
    } catch {
      return;
    }
    return () => lifecycle.abort();
  }, [gifts, paymentsEnabled]);

  useEffect(() => {
    if (!result?.order.publicId || stage !== 'payment') return;
    const publicId = result.order.publicId;
    const startedAt = Date.now();
    const interval = window.setInterval(async () => {
      if (Date.now() - startedAt > 5 * 60_000) {
        window.clearInterval(interval);
        return;
      }
      try {
        const response = await fetch(
          `/api/orders/${encodeURIComponent(publicId)}`,
          { cache: 'no-store' },
        );
        if (!response.ok) return;
        const body = (await response.json()) as { order?: { status?: string } };
        if (body.order?.status === 'CONFIRMED') setStage('confirmed');
        if (
          body.order?.status &&
          ['EXPIRED', 'CANCELED', 'REFUNDED', 'CHARGEBACK'].includes(
            body.order.status,
          )
        ) {
          setError(
            'Esta cobrança não está mais disponível. Feche a janela e gere um novo pagamento.',
          );
          window.clearInterval(interval);
        }
      } catch {
        // A tela continua utilizável; a próxima consulta tenta novamente.
      }
    }, 5_000);
    return () => window.clearInterval(interval);
  }, [result?.order.publicId, stage]);

  async function submitPayment(
    event: React.SyntheticEvent<HTMLFormElement, SubmitEvent>,
  ) {
    event.preventDefault();
    if (!selectedGift) return;
    if (!paymentsEnabled) {
      setError('Os pagamentos ainda estão sendo configurados pelo casal.');
      return;
    }
    const activeRequestId = requestId ?? crypto.randomUUID();
    setRequestId(activeRequestId);
    setStage('processing');
    setError(null);
    try {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          giftId: selectedGift.id,
          clientRequestId: activeRequestId,
          guestName,
          guestEmail,
          guestMessage,
          cpfCnpj: documentValue,
          paymentMethod,
          privacyAccepted,
        }),
      });
      const body = (await response
        .json()
        .catch(() => ({}))) as PaymentResult & { error?: string };
      if (!response.ok)
        throw new Error(body.error ?? 'Não foi possível iniciar o pagamento.');
      setResult(body);
      setStage(body.order.status === 'CONFIRMED' ? 'confirmed' : 'payment');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível iniciar o pagamento.',
      );
      setStage('form');
    }
  }

  async function copyPix() {
    if (!result?.pix?.payload) return;
    try {
      await navigator.clipboard.writeText(result.pix.payload);
      setCopied(true);
    } catch {
      setError(
        'Não foi possível copiar automaticamente. Selecione o código abaixo.',
      );
    }
  }

  if (gifts.length === 0) {
    return (
      <div className="gift-empty">
        <HeartHandshake aria-hidden="true" />
        <h3>A lista está sendo preparada</h3>
        <p>Volte em breve para escolher um presente.</p>
      </div>
    );
  }

  return (
    <>
      <div className="gift-grid">
        {gifts.map((gift, index) => {
          const Icon = icons[index % icons.length];
          const tone = tones[index % tones.length];
          return (
            <article className="gift-card" key={gift.id}>
              <div className={`gift-visual gift-visual-${tone}`}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                {gift.imageUrl ? (
                  <Image
                    alt=""
                    className="gift-image"
                    fill
                    sizes="(max-width: 640px) 100vw, 33vw"
                    src={gift.imageUrl}
                  />
                ) : (
                  <Icon aria-hidden="true" />
                )}
              </div>
              <div className="gift-card-body">
                <div>
                  <h3>{gift.title}</h3>
                  <p>{gift.description}</p>
                </div>
                <div className="gift-card-action">
                  <strong>{formatBrlFromCents(gift.priceInCents)}</strong>
                  <Button
                    className="gift-button"
                    disabled={!paymentsEnabled}
                    onClick={() => startGift(gift)}
                  >
                    {paymentsEnabled ? 'Presentear' : 'Em configuração'}
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
        <article className="gift-card gift-card-open">
          <HeartHandshake aria-hidden="true" />
          <div>
            <p className="eyebrow">Valor livre</p>
            <h3>Escolha outro valor</h3>
            <p>Um gesto do seu jeito para fazer parte dos nossos planos.</p>
          </div>
          <Button variant="outline" disabled>
            Em breve
          </Button>
        </article>
      </div>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) setError(null);
        }}
      >
        <DialogContent className="gift-dialog">
          {selectedGift && stage === 'form' && (
            <>
              <DialogHeader>
                <p className="dialog-kicker">Você escolheu</p>
                <DialogTitle>{selectedGift.title}</DialogTitle>
                <DialogDescription>
                  {formatBrlFromCents(selectedGift.priceInCents)} · Seus dados
                  são enviados de forma segura ao Asaas.
                </DialogDescription>
              </DialogHeader>
              <form className="gift-form" onSubmit={submitPayment}>
                <label htmlFor="guest-name">
                  Seu nome
                  <Input
                    autoComplete="name"
                    id="guest-name"
                    name="name"
                    onChange={(event) => setGuestName(event.target.value)}
                    placeholder="Como devemos agradecer?"
                    required
                    value={guestName}
                  />
                </label>
                <label htmlFor="guest-email">
                  Seu e-mail
                  <Input
                    autoComplete="email"
                    id="guest-email"
                    name="email"
                    onChange={(event) => setGuestEmail(event.target.value)}
                    type="email"
                    placeholder="voce@exemplo.com"
                    required
                    value={guestEmail}
                  />
                </label>
                <label htmlFor="guest-document">
                  CPF ou CNPJ
                  <Input
                    autoComplete="off"
                    id="guest-document"
                    inputMode="numeric"
                    name="cpfCnpj"
                    onChange={(event) =>
                      setDocumentValue(formatDocument(event.target.value))
                    }
                    placeholder="000.000.000-00"
                    required
                    value={documentValue}
                  />
                </label>
                <fieldset className="payment-methods">
                  <legend>Como você quer pagar?</legend>
                  <RadioGroup
                    aria-label="Forma de pagamento"
                    onValueChange={(value) =>
                      setPaymentMethod(value as PaymentMethod)
                    }
                    value={paymentMethod}
                  >
                    <label htmlFor="payment-pix">
                      <RadioGroupItem id="payment-pix" value="PIX" />
                      <QrCode aria-hidden="true" />
                      <span>
                        <strong>Pix</strong>
                        <small>QR Code dinâmico</small>
                      </span>
                    </label>
                    <label htmlFor="payment-boleto">
                      <RadioGroupItem id="payment-boleto" value="BOLETO" />
                      <ReceiptText aria-hidden="true" />
                      <span>
                        <strong>Boleto</strong>
                        <small>Página segura Asaas</small>
                      </span>
                    </label>
                    <label htmlFor="payment-card">
                      <RadioGroupItem id="payment-card" value="CARD" />
                      <CreditCard aria-hidden="true" />
                      <span>
                        <strong>Cartão</strong>
                        <small>Página segura Asaas</small>
                      </span>
                    </label>
                  </RadioGroup>
                </fieldset>
                <label htmlFor="guest-message">
                  Uma mensagem para o casal <span>(opcional)</span>
                  <Textarea
                    id="guest-message"
                    name="message"
                    maxLength={500}
                    onChange={(event) => setGuestMessage(event.target.value)}
                    placeholder="Escreva seu carinho aqui..."
                    value={guestMessage}
                  />
                </label>
                <label className="privacy-check" htmlFor="privacy-accepted">
                  <input
                    checked={privacyAccepted}
                    id="privacy-accepted"
                    name="privacy"
                    onChange={(event) =>
                      setPrivacyAccepted(event.target.checked)
                    }
                    required
                    type="checkbox"
                  />
                  <span>
                    Li e aceito a{' '}
                    <Link href="/privacidade" target="_blank">
                      política de privacidade
                    </Link>
                    .
                  </span>
                </label>
                {error && (
                  <p className="payment-error" role="alert">
                    {error}
                  </p>
                )}
                <DialogFooter className="gift-dialog-footer">
                  <DialogClose
                    render={<Button variant="ghost" type="button" />}
                  >
                    Voltar
                  </DialogClose>
                  <Button className="dialog-primary" type="submit">
                    Gerar pagamento
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}

          {stage === 'processing' && (
            <div className="payment-loading" aria-live="polite">
              <span />
              <DialogTitle>Gerando pagamento seguro…</DialogTitle>
              <DialogDescription>
                Isso costuma levar apenas alguns segundos.
              </DialogDescription>
            </div>
          )}

          {result && stage === 'payment' && (
            <div className="payment-result">
              <p className="dialog-kicker">Pagamento criado</p>
              <DialogTitle>
                {result.order.paymentMethod === 'PIX'
                  ? 'Escaneie o QR Code'
                  : 'Continue no Asaas'}
              </DialogTitle>
              <DialogDescription>
                Confirmaremos o presente automaticamente assim que o Asaas
                avisar o pagamento.
              </DialogDescription>
              {result.pix ? (
                <>
                  <div className="pix-code">
                    <Image
                      alt="QR Code Pix para pagamento do presente"
                      height={240}
                      src={`data:image/png;base64,${result.pix.encodedImage}`}
                      unoptimized
                      width={240}
                    />
                  </div>
                  <label className="pix-payload" htmlFor="pix-payload">
                    Pix copia e cola
                    <Input
                      id="pix-payload"
                      readOnly
                      value={result.pix.payload}
                    />
                  </label>
                  <Button className="dialog-primary" onClick={copyPix}>
                    <Copy aria-hidden="true" />
                    {copied ? 'Código copiado' : 'Copiar código Pix'}
                  </Button>
                </>
              ) : result.order.checkoutUrl ? (
                <a
                  className="dialog-primary payment-link"
                  href={result.order.checkoutUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <ExternalLink aria-hidden="true" />
                  Abrir checkout seguro
                </a>
              ) : (
                <p className="payment-error">
                  O pagamento foi criado, mas o link ainda não está disponível.
                </p>
              )}
              {error && (
                <p className="payment-error" role="alert">
                  {error}
                </p>
              )}
              {result.order.expiresAt && (
                <p className="payment-waiting">
                  Vencimento:{' '}
                  {formatExpiration(
                    result.order.expiresAt,
                    result.order.paymentMethod === 'PIX',
                  )}
                </p>
              )}
              <p className="payment-waiting">
                Esta janela verifica a confirmação automaticamente.
              </p>
              <DialogClose render={<Button variant="ghost" />}>
                Fechar
              </DialogClose>
            </div>
          )}

          {stage === 'confirmed' && (
            <div className="dialog-success" aria-live="polite">
              <span>
                <Check aria-hidden="true" />
              </span>
              <DialogTitle>Presente confirmado!</DialogTitle>
              <DialogDescription>
                Que alegria ter você fazendo parte deste novo capítulo. Muito
                obrigado pelo carinho.
              </DialogDescription>
              <DialogClose render={<Button className="dialog-primary" />}>
                Concluir
              </DialogClose>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
