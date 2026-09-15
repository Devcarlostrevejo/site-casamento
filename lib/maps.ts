function googleMapsSearch(address: string) {
  return (
    'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent(address.trim())
  );
}

export function mapEmbedUrl(address: string) {
  return (
    'https://www.google.com/maps?q=' +
    encodeURIComponent(address.trim()) +
    '&output=embed'
  );
}

export function mapExternalUrl(configuredUrl: string, address: string) {
  const fallback = googleMapsSearch(address);
  if (!configuredUrl.trim()) return fallback;

  try {
    const url = new URL(configuredUrl);
    const hostname = url.hostname.toLowerCase();
    const trustedProvider =
      hostname === 'maps.apple.com' ||
      ['google.com', 'goo.gl', 'waze.com'].some(
        (domain) => hostname === domain || hostname.endsWith('.' + domain),
      );
    return url.protocol === 'https:' && trustedProvider
      ? url.toString()
      : fallback;
  } catch {
    return fallback;
  }
}
