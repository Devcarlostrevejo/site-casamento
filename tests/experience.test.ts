import { describe, expect, it } from 'vitest';
import { getCountdownParts } from '../lib/countdown';
import { mapEmbedUrl, mapExternalUrl } from '../lib/maps';

describe('contagem regressiva', () => {
  it('divide o tempo restante em dias, horas, minutos e segundos', () => {
    const now = Date.parse('2026-01-01T00:00:00.000Z');
    const target = '2026-01-03T02:03:04.000Z';

    expect(getCountdownParts(target, now)).toEqual({
      days: 2,
      hours: 2,
      minutes: 3,
      seconds: 4,
      complete: false,
    });
  });

  it('encerra a contagem sem produzir valores negativos', () => {
    expect(
      getCountdownParts(
        '2026-01-01T00:00:00.000Z',
        Date.parse('2026-01-02T00:00:00.000Z'),
      ),
    ).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      complete: true,
    });
  });
});

describe('links de localização', () => {
  it('gera o mapa incorporado em uma origem fixa e codifica o endereço', () => {
    const url = mapEmbedUrl('Rua das Flores, 10 - São Paulo');
    expect(url).toMatch(/^https:\/\/www\.google\.com\/maps\?/);
    expect(url).toContain('Rua%20das%20Flores%2C%2010%20-%20S%C3%A3o%20Paulo');
    expect(url).toContain('output=embed');
  });

  it('aceita somente link HTTPS e usa uma busca segura como alternativa', () => {
    expect(
      mapExternalUrl('https://maps.app.goo.gl/exemplo', 'Capela das Palmeiras'),
    ).toBe('https://maps.app.goo.gl/exemplo');
    expect(
      mapExternalUrl('javascript:alert(1)', 'Capela das Palmeiras'),
    ).toMatch(/^https:\/\/www\.google\.com\/maps\/search\//);
    expect(
      mapExternalUrl('https://malicioso.example/rota', 'Capela das Palmeiras'),
    ).toMatch(/^https:\/\/www\.google\.com\/maps\/search\//);
  });
});
