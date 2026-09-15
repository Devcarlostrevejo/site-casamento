export const DEMO_WEDDING_ID = 'wedding_demo';

export type WeddingData = {
  id: string;
  slug: string;
  partnerOneName: string;
  partnerTwoName: string;
  eventAt: string;
  timezone: string;
  headline: string;
  welcomeText: string;
  storyTitle: string;
  story: string;
  ceremonyName: string;
  ceremonyAddress: string;
  ceremonyInstructions: string;
  ceremonyMapsUrl: string;
  venueName: string;
  venueAddress: string;
  venueInstructions: string;
  mapsUrl: string;
  heroImageUrl: string;
  pixKey: string;
  pixRecipientName: string;
  pixRecipientCity: string;
  published: boolean;
};

export type PublicGift = {
  id: string;
  weddingId: string;
  title: string;
  slug: string;
  description: string;
  priceInCents: number;
  imageUrl: string | null;
  categoryId: string | null;
  featured: boolean;
  active: boolean;
  sortOrder: number;
};

export const demoWedding: WeddingData = {
  id: DEMO_WEDDING_ID,
  slug: 'clara-e-rafael',
  partnerOneName: 'Clara',
  partnerTwoName: 'Rafael',
  eventAt: '2026-10-18T16:30:00-03:00',
  timezone: 'America/Sao_Paulo',
  headline: 'Nós vamos nos casar',
  welcomeText:
    'Criamos este cantinho para dividir os detalhes do nosso dia e guardar cada gesto de carinho de quem faz parte da nossa história.',
  storyTitle: 'Foi encontro. Virou casa.',
  story:
    'Entre conversas demoradas, viagens improvisadas e muitos domingos à mesa, descobrimos que o nosso lugar favorito sempre foi um ao lado do outro.\n\nAgora começa um novo capítulo — e ele fica ainda mais bonito com você por perto.',
  ceremonyName: 'Capela das Palmeiras',
  ceremonyAddress:
    'São Paulo, SP · O endereço completo será confirmado em breve.',
  ceremonyInstructions:
    'A cerimônia começa pontualmente. Sugerimos chegar com 30 minutos de antecedência.',
  ceremonyMapsUrl: '',
  venueName: 'Jardim das Palmeiras',
  venueAddress: 'São Paulo, SP · O endereço completo será confirmado em breve.',
  venueInstructions: 'Depois do sim, esperamos você para celebrar com calma.',
  mapsUrl: '',
  heroImageUrl: '/wedding-still-life.png',
  pixKey: 'casamentoHevilaCarlos@gmail.com',
  pixRecipientName: 'HEVILA E CARLOS',
  pixRecipientCity: 'SAO PAULO',
  published: true,
};

export const demoGifts: PublicGift[] = [
  {
    id: 'gift_passagens',
    weddingId: DEMO_WEDDING_ID,
    title: 'Passagens para a lua de mel',
    slug: 'passagens-lua-de-mel',
    description: 'Um empurrãozinho para começarmos a viagem dos nossos sonhos.',
    priceInCents: 45000,
    imageUrl: null,
    categoryId: null,
    featured: true,
    active: true,
    sortOrder: 1,
  },
  {
    id: 'gift_jantar',
    weddingId: DEMO_WEDDING_ID,
    title: 'Jantar especial a dois',
    slug: 'jantar-especial',
    description: 'Uma noite sem pressa, boa comida e histórias para recordar.',
    priceInCents: 28000,
    imageUrl: null,
    categoryId: null,
    featured: false,
    active: true,
    sortOrder: 2,
  },
  {
    id: 'gift_hotel',
    weddingId: DEMO_WEDDING_ID,
    title: 'Uma diária inesquecível',
    slug: 'diaria-inesquecivel',
    description: 'Para acordarmos devagar em algum lugar bonito pelo caminho.',
    priceInCents: 52000,
    imageUrl: null,
    categoryId: null,
    featured: false,
    active: true,
    sortOrder: 3,
  },
  {
    id: 'gift_cozinha',
    weddingId: DEMO_WEDDING_ID,
    title: 'Primeiras receitas da casa',
    slug: 'primeiras-receitas',
    description: 'Para os almoços de domingo que ainda vamos inventar.',
    priceInCents: 19000,
    imageUrl: null,
    categoryId: null,
    featured: false,
    active: true,
    sortOrder: 4,
  },
  {
    id: 'gift_lar',
    weddingId: DEMO_WEDDING_ID,
    title: 'Um detalhe para o novo lar',
    slug: 'detalhe-novo-lar',
    description: 'Uma contribuição para deixarmos cada canto com a nossa cara.',
    priceInCents: 35000,
    imageUrl: null,
    categoryId: null,
    featured: false,
    active: true,
    sortOrder: 5,
  },
  {
    id: 'gift_aventura',
    weddingId: DEMO_WEDDING_ID,
    title: 'Passeio surpresa na viagem',
    slug: 'passeio-surpresa',
    description: 'Uma aventura para voltarmos com histórias que rendem anos.',
    priceInCents: 24000,
    imageUrl: null,
    categoryId: null,
    featured: false,
    active: true,
    sortOrder: 6,
  },
];
