'use client';

import { useEffect, useState } from 'react';
import { getCountdownParts, type CountdownParts } from '@/lib/countdown';

const units: Array<{
  key: keyof Omit<CountdownParts, 'complete'>;
  label: string;
}> = [
  { key: 'days', label: 'dias' },
  { key: 'hours', label: 'horas' },
  { key: 'minutes', label: 'minutos' },
  { key: 'seconds', label: 'segundos' },
];

export function WeddingCountdown({
  eventAt,
  dateLabel,
}: {
  eventAt: string;
  dateLabel: string;
}) {
  const [remaining, setRemaining] = useState<CountdownParts | null>(null);

  useEffect(() => {
    let interval: number | undefined;
    const update = () => {
      const nextUpdate = getCountdownParts(eventAt);
      setRemaining(nextUpdate);
      if (nextUpdate.complete && interval) {
        window.clearInterval(interval);
        interval = undefined;
      }
      return nextUpdate.complete;
    };
    const start = window.setTimeout(() => {
      if (!update()) interval = window.setInterval(update, 1_000);
    }, 0);

    return () => {
      window.clearTimeout(start);
      if (interval) window.clearInterval(interval);
    };
  }, [eventAt]);

  return (
    <section
      aria-labelledby="countdown-title"
      className="countdown-section"
      id="contagem"
    >
      <div className="countdown-shell">
        <div className="countdown-intro">
          <p className="eyebrow">Contagem regressiva</p>
          <h2 id="countdown-title">
            {remaining?.complete ? 'O nosso grande dia chegou' : 'Falta pouco'}
          </h2>
          <p>
            Nosso encontro está marcado para{' '}
            <time dateTime={eventAt}>{dateLabel}</time>.
          </p>
        </div>
        {!remaining?.complete && (
          <dl
            aria-label="Tempo restante para o casamento"
            className="countdown-grid"
          >
            {units.map(({ key, label }) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd>
                  {remaining ? String(remaining[key]).padStart(2, '0') : '—'}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}
