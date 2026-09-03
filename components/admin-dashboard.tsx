'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  ExternalLink,
  Gift,
  Heart,
  ImagePlus,
  LayoutDashboard,
  LogOut,
  Pencil,
  Plus,
  ReceiptText,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

type Wedding = {
  id: string;
  partnerOneName: string;
  partnerTwoName: string;
  eventAt: string;
  headline: string;
  welcomeText: string;
  storyTitle: string;
  story: string;
  venueName: string;
  venueAddress: string;
  venueInstructions: string;
  mapsUrl: string;
  heroImageUrl: string;
  published: boolean;
};

type AdminGift = {
  id: string;
  title: string;
  description: string;
  priceInCents: number;
  imageUrl: string | null;
  categoryId: string | null;
  featured: boolean;
  active: boolean;
  sortOrder: number;
};

type AdminOrder = {
  publicId: string;
  guestName: string;
  guestEmail: string;
  guestMessage: string | null;
  amountInCents: number;
  paymentMethod: string;
  status: string;
  settlementStatus: string;
  createdAt: string;
  giftTitle: string;
};

type AdminContent = {
  wedding: Wedding | null;
  gifts: AdminGift[];
  orders: AdminOrder[];
};

const emptyGift: Omit<AdminGift, 'id'> = {
  title: '',
  description: '',
  priceInCents: 10000,
  imageUrl: null,
  categoryId: null,
  featured: false,
  active: true,
  sortOrder: 0,
};

function money(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value / 100);
}

function localDateTime(iso: string) {
  const date = new Date(iso);
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

async function api(path: string, init: RequestInit) {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  const response = await fetch(path, { ...init, headers });
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    url?: string;
  };
  if (!response.ok)
    throw new Error(body.error ?? 'Não foi possível concluir a operação.');
  return body;
}

export function AdminDashboard({
  content,
  databaseReady,
  user,
  signOutPath,
}: {
  content: AdminContent | null;
  databaseReady: boolean;
  user: { name: string; email: string };
  signOutPath: string;
}) {
  const [wedding, setWedding] = useState(content?.wedding ?? null);
  const [gifts, setGifts] = useState(content?.gifts ?? []);
  const [editingGift, setEditingGift] = useState<AdminGift | null>(null);
  const [giftDraft, setGiftDraft] = useState<Omit<AdminGift, 'id'>>(emptyGift);
  const [giftDialogOpen, setGiftDialogOpen] = useState(false);
  const [giftToDelete, setGiftToDelete] = useState<AdminGift | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const orders = useMemo(() => content?.orders ?? [], [content?.orders]);
  const totalReceived = useMemo(
    () =>
      orders
        .filter((order) => order.status === 'CONFIRMED')
        .reduce((sum, order) => sum + order.amountInCents, 0),
    [orders],
  );

  function beginGift(gift?: AdminGift) {
    setEditingGift(gift ?? null);
    setGiftDraft(
      gift ? { ...gift } : { ...emptyGift, sortOrder: gifts.length + 1 },
    );
    setGiftDialogOpen(true);
    setError(null);
  }

  async function seed() {
    setBusy(true);
    setError(null);
    try {
      await api('/api/admin/seed', { method: 'POST' });
      window.location.reload();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Falha ao preparar o site.',
      );
      setBusy(false);
    }
  }

  async function saveWedding(
    event: React.SyntheticEvent<HTMLFormElement, SubmitEvent>,
  ) {
    event.preventDefault();
    if (!wedding) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api('/api/admin/wedding', {
        method: 'PATCH',
        body: JSON.stringify(wedding),
      });
      setNotice('Informações do casamento salvas.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao salvar.');
    } finally {
      setBusy(false);
    }
  }

  async function saveGift(
    event: React.SyntheticEvent<HTMLFormElement, SubmitEvent>,
  ) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const path = editingGift
        ? `/api/admin/gifts/${editingGift.id}`
        : '/api/admin/gifts';
      const result = await api(path, {
        method: editingGift ? 'PATCH' : 'POST',
        body: JSON.stringify(giftDraft),
      });
      const next = editingGift
        ? gifts.map((gift) =>
            gift.id === editingGift.id ? { ...gift, ...giftDraft } : gift,
          )
        : [
            ...gifts,
            { id: String((result as { id?: string }).id), ...giftDraft },
          ];
      setGifts(next);
      setGiftDialogOpen(false);
      setNotice(editingGift ? 'Presente atualizado.' : 'Presente criado.');
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Falha ao salvar presente.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeGift(gift: AdminGift) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/admin/gifts/${gift.id}`, { method: 'DELETE' });
      setGifts((current) => current.filter((item) => item.id !== gift.id));
      setNotice('Presente removido da lista pública.');
      setGiftToDelete(null);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Falha ao remover presente.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function uploadHero(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !wedding) return;
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set('file', file);
    form.set(
      'altText',
      `Foto de ${wedding.partnerOneName} e ${wedding.partnerTwoName}`,
    );
    try {
      const response = await fetch('/api/admin/media', {
        method: 'POST',
        body: form,
      });
      const result = (await response.json()) as {
        error?: string;
        url?: string;
      };
      if (!response.ok || !result.url)
        throw new Error(result.error ?? 'Falha no envio.');
      setWedding({ ...wedding, heroImageUrl: result.url });
      setNotice('Foto enviada. Salve as informações para publicá-la.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha no envio.');
    } finally {
      setBusy(false);
    }
  }

  if (!databaseReady) {
    return (
      <main className="access-page">
        <div className="access-card">
          <h1>Banco ainda não preparado</h1>
          <p>
            A migração será aplicada durante a publicação. Depois disso, volte a
            esta área.
          </p>
        </div>
      </main>
    );
  }

  if (!wedding) {
    return (
      <main className="access-page">
        <div className="access-card">
          <Heart aria-hidden="true" />
          <h1>Vamos preparar o primeiro conteúdo?</h1>
          <p>
            Isso cria informações e presentes de demonstração, todos editáveis.
          </p>
          {error && <p className="admin-error">{error}</p>}
          <Button disabled={busy} onClick={seed}>
            {busy ? 'Preparando…' : 'Carregar conteúdo inicial'}
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="couple-mark admin-brand" href="/">
          C<span>&amp;</span>R
        </Link>
        <div className="admin-user">
          <span>{user.name.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{user.name}</strong>
            <small>{user.email}</small>
          </div>
        </div>
        <nav>
          <Link href="/">
            <ExternalLink />
            Ver site público
          </Link>
          <Link href={signOutPath}>
            <LogOut />
            Sair
          </Link>
        </nav>
      </aside>

      <div className="admin-main">
        <header className="admin-header">
          <div>
            <p className="eyebrow">Área do casal</p>
            <h1>Nosso painel</h1>
          </div>
          <Badge variant={wedding.published ? 'default' : 'secondary'}>
            {wedding.published ? 'Site publicado' : 'Rascunho'}
          </Badge>
        </header>
        {(notice || error) && (
          <div
            aria-live="polite"
            className={error ? 'admin-notice admin-error' : 'admin-notice'}
          >
            {error ?? notice}
          </div>
        )}
        <div className="admin-stats">
          <article>
            <Gift />
            <span>Presentes ativos</span>
            <strong>{gifts.filter((gift) => gift.active).length}</strong>
          </article>
          <article>
            <ReceiptText />
            <span>Contribuições</span>
            <strong>{orders.length}</strong>
          </article>
          <article>
            <Heart />
            <span>Total confirmado</span>
            <strong>{money(totalReceived)}</strong>
          </article>
        </div>

        <Tabs defaultValue="conteudo" className="admin-tabs">
          <TabsList className="admin-tabs-list">
            <TabsTrigger value="conteudo">
              <LayoutDashboard />
              Conteúdo
            </TabsTrigger>
            <TabsTrigger value="presentes">
              <Gift />
              Presentes
            </TabsTrigger>
            <TabsTrigger value="recebidos">
              <ReceiptText />
              Recebidos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="conteudo">
            <form className="admin-panel admin-form" onSubmit={saveWedding}>
              <div className="admin-panel-heading">
                <div>
                  <h2>Informações do casamento</h2>
                  <p>Atualize os textos exibidos no site público.</p>
                </div>
                <label className="switch-label" htmlFor="wedding-published">
                  <Switch
                    checked={wedding.published}
                    id="wedding-published"
                    onCheckedChange={(published) =>
                      setWedding({ ...wedding, published })
                    }
                  />
                  Publicado
                </label>
              </div>
              <div className="form-grid two">
                <label htmlFor="partner-one">
                  Primeiro nome
                  <Input
                    id="partner-one"
                    value={wedding.partnerOneName}
                    onChange={(e) =>
                      setWedding({ ...wedding, partnerOneName: e.target.value })
                    }
                    required
                  />
                </label>
                <label htmlFor="partner-two">
                  Segundo nome
                  <Input
                    id="partner-two"
                    value={wedding.partnerTwoName}
                    onChange={(e) =>
                      setWedding({ ...wedding, partnerTwoName: e.target.value })
                    }
                    required
                  />
                </label>
              </div>
              <div className="form-grid two">
                <label htmlFor="event-at">
                  Data e horário
                  <Input
                    id="event-at"
                    type="datetime-local"
                    value={localDateTime(wedding.eventAt)}
                    onChange={(e) =>
                      setWedding({
                        ...wedding,
                        eventAt: new Date(e.target.value).toISOString(),
                      })
                    }
                    required
                  />
                </label>
                <label htmlFor="headline">
                  Chamada
                  <Input
                    id="headline"
                    value={wedding.headline}
                    onChange={(e) =>
                      setWedding({ ...wedding, headline: e.target.value })
                    }
                    required
                  />
                </label>
              </div>
              <label htmlFor="welcome-text">
                Texto de boas-vindas
                <Textarea
                  id="welcome-text"
                  value={wedding.welcomeText}
                  onChange={(e) =>
                    setWedding({ ...wedding, welcomeText: e.target.value })
                  }
                  required
                />
              </label>
              <div className="form-grid two">
                <label htmlFor="story-title">
                  Título da história
                  <Input
                    id="story-title"
                    value={wedding.storyTitle}
                    onChange={(e) =>
                      setWedding({ ...wedding, storyTitle: e.target.value })
                    }
                    required
                  />
                </label>
                <label htmlFor="venue-name">
                  Nome do local
                  <Input
                    id="venue-name"
                    value={wedding.venueName}
                    onChange={(e) =>
                      setWedding({ ...wedding, venueName: e.target.value })
                    }
                    required
                  />
                </label>
              </div>
              <label htmlFor="story">
                Nossa história
                <Textarea
                  className="tall-textarea"
                  id="story"
                  value={wedding.story}
                  onChange={(e) =>
                    setWedding({ ...wedding, story: e.target.value })
                  }
                  required
                />
              </label>
              <label htmlFor="venue-address">
                Endereço
                <Input
                  id="venue-address"
                  value={wedding.venueAddress}
                  onChange={(e) =>
                    setWedding({ ...wedding, venueAddress: e.target.value })
                  }
                  required
                />
              </label>
              <label htmlFor="venue-instructions">
                Orientações
                <Textarea
                  id="venue-instructions"
                  value={wedding.venueInstructions}
                  onChange={(e) =>
                    setWedding({
                      ...wedding,
                      venueInstructions: e.target.value,
                    })
                  }
                />
              </label>
              <label htmlFor="maps-url">
                Link do mapa
                <Input
                  id="maps-url"
                  type="url"
                  value={wedding.mapsUrl}
                  onChange={(e) =>
                    setWedding({ ...wedding, mapsUrl: e.target.value })
                  }
                  placeholder="https://maps.google.com/..."
                />
              </label>
              <label className="upload-field" htmlFor="hero-upload">
                <span>Foto principal</span>
                <div>
                  <ImagePlus />
                  <span>
                    {busy ? 'Enviando…' : 'Escolher JPEG, PNG ou WebP'}
                  </span>
                  <Input
                    accept="image/jpeg,image/png,image/webp"
                    disabled={busy}
                    id="hero-upload"
                    onChange={uploadHero}
                    type="file"
                  />
                </div>
              </label>
              <div className="admin-form-actions">
                <Button className="admin-primary" disabled={busy} type="submit">
                  {busy ? 'Salvando…' : 'Salvar alterações'}
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="presentes">
            <section className="admin-panel">
              <div className="admin-panel-heading">
                <div>
                  <h2>Lista de presentes</h2>
                  <p>{gifts.length} itens cadastrados</p>
                </div>
                <Button className="admin-primary" onClick={() => beginGift()}>
                  <Plus />
                  Novo presente
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Presente</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gifts.map((gift) => (
                    <TableRow key={gift.id}>
                      <TableCell>
                        <strong>{gift.title}</strong>
                        <small className="table-description">
                          {gift.description}
                        </small>
                      </TableCell>
                      <TableCell>{money(gift.priceInCents)}</TableCell>
                      <TableCell>
                        <Badge variant={gift.active ? 'secondary' : 'outline'}>
                          {gift.active ? 'Ativo' : 'Oculto'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          aria-label={`Editar ${gift.title}`}
                          onClick={() => beginGift(gift)}
                          size="icon"
                          variant="ghost"
                        >
                          <Pencil />
                        </Button>
                        <Button
                          aria-label={`Excluir ${gift.title}`}
                          onClick={() => setGiftToDelete(gift)}
                          size="icon"
                          variant="destructive"
                        >
                          <Trash2 />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
          </TabsContent>

          <TabsContent value="recebidos">
            <section className="admin-panel">
              <div className="admin-panel-heading">
                <div>
                  <h2>Presentes recebidos</h2>
                  <p>A confirmação vem diretamente do Asaas.</p>
                </div>
              </div>
              {orders.length === 0 ? (
                <div className="admin-empty">
                  <ReceiptText />
                  <h3>Nenhuma contribuição ainda</h3>
                  <p>Quando um pagamento for criado, ele aparecerá aqui.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Convidado</TableHead>
                      <TableHead>Presente</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Pagamento</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.publicId}>
                        <TableCell>
                          <strong>{order.guestName}</strong>
                          <small className="table-description">
                            {order.guestEmail}
                          </small>
                        </TableCell>
                        <TableCell>{order.giftTitle}</TableCell>
                        <TableCell>{money(order.amountInCents)}</TableCell>
                        <TableCell>{order.paymentMethod}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              order.status === 'CONFIRMED'
                                ? 'default'
                                : 'secondary'
                            }
                          >
                            {order.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </section>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={giftDialogOpen} onOpenChange={setGiftDialogOpen}>
        <DialogContent className="gift-dialog admin-gift-dialog">
          <DialogHeader>
            <p className="dialog-kicker">Lista de presentes</p>
            <DialogTitle>
              {editingGift ? 'Editar presente' : 'Novo presente'}
            </DialogTitle>
            <DialogDescription>
              O item é ilustrativo e o valor será recebido como contribuição.
            </DialogDescription>
          </DialogHeader>
          <form className="gift-form" onSubmit={saveGift}>
            <label htmlFor="gift-title">
              Título
              <Input
                id="gift-title"
                value={giftDraft.title}
                onChange={(e) =>
                  setGiftDraft({ ...giftDraft, title: e.target.value })
                }
                required
              />
            </label>
            <label htmlFor="gift-description">
              Descrição
              <Textarea
                id="gift-description"
                value={giftDraft.description}
                onChange={(e) =>
                  setGiftDraft({ ...giftDraft, description: e.target.value })
                }
                required
              />
            </label>
            <div className="form-grid two">
              <label htmlFor="gift-price">
                Valor em reais
                <Input
                  id="gift-price"
                  min="1"
                  step="0.01"
                  type="number"
                  value={(giftDraft.priceInCents / 100).toFixed(2)}
                  onChange={(e) =>
                    setGiftDraft({
                      ...giftDraft,
                      priceInCents: Math.round(Number(e.target.value) * 100),
                    })
                  }
                  required
                />
              </label>
              <label htmlFor="gift-order">
                Ordem
                <Input
                  id="gift-order"
                  min="0"
                  type="number"
                  value={giftDraft.sortOrder}
                  onChange={(e) =>
                    setGiftDraft({
                      ...giftDraft,
                      sortOrder: Number(e.target.value),
                    })
                  }
                  required
                />
              </label>
            </div>
            <div className="switch-row">
              <label htmlFor="gift-active">
                <Switch
                  checked={giftDraft.active}
                  id="gift-active"
                  onCheckedChange={(active) =>
                    setGiftDraft({ ...giftDraft, active })
                  }
                />
                Visível na lista
              </label>
              <label htmlFor="gift-featured">
                <Switch
                  checked={giftDraft.featured}
                  id="gift-featured"
                  onCheckedChange={(featured) =>
                    setGiftDraft({ ...giftDraft, featured })
                  }
                />
                Destacar
              </label>
            </div>
            <div className="admin-form-actions">
              <Button
                onClick={() => setGiftDialogOpen(false)}
                type="button"
                variant="ghost"
              >
                Cancelar
              </Button>
              <Button className="admin-primary" disabled={busy} type="submit">
                {busy ? 'Salvando…' : 'Salvar presente'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(giftToDelete)}
        onOpenChange={(nextOpen) => !nextOpen && !busy && setGiftToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover este presente?</AlertDialogTitle>
            <AlertDialogDescription>
              “{giftToDelete?.title}” deixará de aparecer na lista pública.
              Pedidos já registrados serão preservados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={() => giftToDelete && removeGift(giftToDelete)}
              variant="destructive"
            >
              {busy ? 'Removendo…' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
