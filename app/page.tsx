import {
  ArrowDown,
  CalendarDays,
  Clock3,
  MapPin,
  Sparkles,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { GiftList } from '@/components/gift-list';
import { getPublicContent } from '@/db/queries';
import { isAsaasConfigured } from '@/lib/asaas';

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

export const dynamic = 'force-dynamic';

export default async function Home() {
  const { wedding, gifts, usingDemo } = await getPublicContent();
  const paymentsEnabled = !usingDemo && isAsaasConfigured();
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
      title: `Cerimônia às ${date.time}`,
      copy: wedding.venueInstructions,
    },
    {
      icon: MapPin,
      eyebrow: 'O lugar',
      title: wedding.venueName,
      copy: wedding.venueAddress,
    },
  ];

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
                {eyebrow === 'O lugar' && wedding.mapsUrl && (
                  <a
                    className="detail-link"
                    href={wedding.mapsUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Abrir no mapa
                  </a>
                )}
              </article>
            ))}
          </div>
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
          <GiftList gifts={gifts} paymentsEnabled={paymentsEnabled} />
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
