import {
  ArrowDown,
  CalendarDays,
  Church,
  Clock3,
  ExternalLink,
  MapPin,
  PartyPopper,
  Sparkles,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { GiftList } from '@/components/gift-list';
import { WeddingCountdown } from '@/components/wedding-countdown';
import { getPublicContent } from '@/db/queries';
import { isAsaasConfigured } from '@/lib/asaas';
import { mapEmbedUrl, mapExternalUrl } from '@/lib/maps';

function eventParts(iso: string, timeZone: string) {
  const date = new Date(iso);
  return {
    day: new Intl.DateTimeFormat('pt-BR', { day: '2-digit', timeZone }).format(
      date,
    ),
    month: new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone }).format(
      date,
    ),
    year: new Intl.DateTimeFormat('pt-BR', {
      year: 'numeric',
      timeZone,
    }).format(date),
    fullDate: new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'long',
      timeZone,
    }).format(date),
    time: new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone,
    }).format(date),
  };
}

function LocationMap({ kind, src }: { kind: string; src: string }) {
  if (kind === 'Cerimônia') {
    return (
      <iframe
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        src={src}
        title="Mapa interativo da cerimônia"
      />
    );
  }

  return (
    <iframe
      allowFullScreen
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      src={src}
      title="Mapa interativo da recepção"
    />
  );
}

export const dynamic = 'force-dynamic';

export default async function Home() {
  const { wedding, gifts, usingDemo } = await getPublicContent();
  const paymentsEnabled = !usingDemo;
  const cardEnabled = paymentsEnabled && isAsaasConfigured();
  const date = eventParts(wedding.eventAt, wedding.timezone);
  const storyParagraphs = wedding.story.split(/\n{2,}/).filter(Boolean);
  const details = [
    {
      icon: CalendarDays,
      eyebrow: 'A data',
      title: date.fullDate,
      copy: 'Um dia inteiro reservado para celebrar o nosso sim.',
    },
    {
      icon: Clock3,
      eyebrow: 'O horário',
      title: 'Cerimônia às ' + date.time,
      copy: 'Programe-se para chegar com tranquilidade e aproveitar cada momento.',
    },
  ];
  const locations = [
    {
      kind: 'Cerimônia',
      icon: Church,
      name: wedding.ceremonyName,
      address: wedding.ceremonyAddress,
      instructions: wedding.ceremonyInstructions,
      mapsUrl: wedding.ceremonyMapsUrl,
    },
    {
      kind: 'Recepção',
      icon: PartyPopper,
      name: wedding.venueName,
      address: wedding.venueAddress,
      instructions: wedding.venueInstructions,
      mapsUrl: wedding.mapsUrl,
    },
  ].filter((location) => location.name.trim() || location.address.trim());

  return (
    <>
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      {!paymentsEnabled && (
        <div className="demo-ribbon">
          {usingDemo
            ? 'Conteúdo de demonstração · pagamentos ainda desativados'
            : 'Pagamentos em configuração'}
        </div>
      )}
      <header className="site-header">
        <a className="couple-mark" href="#inicio" aria-label="Ir para o início">
          {wedding.partnerOneName[0]}
          <span>&amp;</span>
          {wedding.partnerTwoName[0]}
        </a>
        <nav aria-label="Navegação principal">
          <a href="#historia">Nossa história</a>
          <a href="#detalhes">O grande dia</a>
          <a className="nav-locations" href="#locais">
            Locais
          </a>
          <a className="nav-gift" href="#presentes">
            Presentear
          </a>
        </nav>
      </header>

      <main id="conteudo">
        <section className="hero" id="inicio">
          <div className="hero-copy">
            <p className="eyebrow">{wedding.headline}</p>
            <h1>
              {wedding.partnerOneName} <i>&amp;</i>
              <br /> {wedding.partnerTwoName}
            </h1>
            <div className="hero-date">
              <span>{date.day}</span>
              <span className="hero-date-word">{date.month}</span>
              <span>{date.year}</span>
            </div>
            <p className="hero-intro">{wedding.welcomeText}</p>
            <a className="scroll-cue" href="#presentes">
              Ver lista de presentes <ArrowDown aria-hidden="true" />
            </a>
          </div>
          <div className="hero-art">
            <div className="hero-art-frame">
              <Image
                alt={`Detalhe da celebração de ${wedding.partnerOneName} e ${wedding.partnerTwoName}`}
                className="hero-art-image"
                fill
                priority
                sizes="(max-width: 900px) 100vw, 48vw"
                src={wedding.heroImageUrl || '/wedding-still-life.png'}
              />
            </div>
            <span className="hero-note">
              amor, presença &amp; novas memórias
            </span>
          </div>
        </section>

        <WeddingCountdown
          dateLabel={date.fullDate + ', às ' + date.time}
          eventAt={wedding.eventAt}
        />

        <section className="story-section" id="historia">
          <div className="story-number" aria-hidden="true">
            {date.day}
          </div>
          <div>
            <p className="eyebrow">Nossa história</p>
            <h2>{wedding.storyTitle}</h2>
          </div>
          <div className="story-copy">
            {storyParagraphs.map((paragraph, index) => (
              <p key={`${index}-${paragraph.slice(0, 20)}`}>{paragraph}</p>
            ))}
          </div>
        </section>

        <section className="details-section" id="detalhes">
          <div className="section-heading light-heading">
            <p className="eyebrow">Reserve a data</p>
            <h2>O grande dia</h2>
            <p>Vista-se para celebrar. O restante, deixe com a gente.</p>
          </div>
          <div className="detail-grid">
            {details.map(({ icon: Icon, eyebrow, title, copy }) => (
              <article className="detail-card" key={eyebrow}>
                <Icon aria-hidden="true" />
                <p className="detail-eyebrow">{eyebrow}</p>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
          {locations.length > 0 && (
            <div className="locations-block" id="locais">
              <div className="locations-heading">
                <div>
                  <p className="eyebrow">Como chegar</p>
                  <h2>Cerimônia e recepção</h2>
                </div>
                <p>
                  Confira cada endereço e abra a rota no aplicativo de mapas do
                  seu celular.
                </p>
              </div>
              <div
                className={
                  locations.length === 1
                    ? 'venue-grid venue-grid-single'
                    : 'venue-grid'
                }
              >
                {locations.map(
                  ({
                    kind,
                    icon: Icon,
                    name,
                    address,
                    instructions,
                    mapsUrl,
                  }) => {
                    const routeQuery = [name, address]
                      .filter(Boolean)
                      .join(', ');
                    const routeUrl = mapExternalUrl(mapsUrl, routeQuery);
                    return (
                      <article className="venue-card" key={kind}>
                        <div className="venue-copy">
                          <div className="venue-title-row">
                            <Icon aria-hidden="true" />
                            <p className="venue-eyebrow">{kind}</p>
                          </div>
                          <h3>{name || kind}</h3>
                          {address && <address>{address}</address>}
                          {instructions && <p>{instructions}</p>}
                          {(address || mapsUrl) && (
                            <a
                              aria-label={
                                'Abrir mapa da ' +
                                kind.toLowerCase() +
                                ' em nova aba'
                              }
                              className="venue-link"
                              href={routeUrl}
                              rel="noopener noreferrer"
                              target="_blank"
                            >
                              <MapPin aria-hidden="true" />
                              Abrir rota
                              <ExternalLink aria-hidden="true" />
                            </a>
                          )}
                        </div>
                        {address && (
                          <div className="venue-map">
                            <LocationMap
                              kind={kind}
                              src={mapEmbedUrl(routeQuery)}
                            />
                          </div>
                        )}
                      </article>
                    );
                  },
                )}
              </div>
            </div>
          )}
        </section>

        <section className="gifts-section" id="presentes">
          <div className="section-heading gifts-heading">
            <div>
              <p className="eyebrow">Com carinho</p>
              <h2>Lista de presentes</h2>
            </div>
            <p>
              Sua presença já é o melhor presente. Se quiser contribuir com os
              nossos próximos capítulos, escolha uma lembrança abaixo.
            </p>
          </div>
          <div className="symbolic-note">
            <Sparkles aria-hidden="true" />
            <p>
              Os itens são simbólicos e o valor é recebido pelo casal como uma
              contribuição financeira.
            </p>
          </div>
          <GiftList
            cardEnabled={cardEnabled}
            gifts={gifts}
            paymentsEnabled={paymentsEnabled}
          />
        </section>
      </main>

      <footer>
        <p className="footer-mark">
          {wedding.partnerOneName[0]} <span>&amp;</span>{' '}
          {wedding.partnerTwoName[0]}
        </p>
        <p>Feito para celebrar o que realmente importa.</p>
        <div className="footer-links">
          <Link href="/privacidade">Privacidade</Link>
          <Link href="/admin">Área do casal</Link>
        </div>
      </footer>
    </>
  );
}
