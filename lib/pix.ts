function field(id: string, value: string) {
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

function pixText(value: string, maxLength: number) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 .-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function crc16Ccitt(value: string) {
  let crc = 0xffff;
  for (let index = 0; index < value.length; index += 1) {
    crc ^= value.charCodeAt(index) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function createPixPayload(input: {
  key: string;
  recipientName: string;
  recipientCity: string;
  amountInCents: number;
  transactionId: string;
}) {
  const merchantAccount =
    field('00', 'BR.GOV.BCB.PIX') + field('01', input.key);
  const amount = (input.amountInCents / 100).toFixed(2);
  const transactionId = pixText(input.transactionId, 25) || '***';
  const withoutCrc =
    field('00', '01') +
    field('26', merchantAccount) +
    field('52', '0000') +
    field('53', '986') +
    field('54', amount) +
    field('58', 'BR') +
    field('59', pixText(input.recipientName, 25)) +
    field('60', pixText(input.recipientCity, 15)) +
    field('62', field('05', transactionId)) +
    '6304';
  return withoutCrc + crc16Ccitt(withoutCrc);
}
