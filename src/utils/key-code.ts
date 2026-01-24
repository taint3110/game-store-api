import {randomBytes} from 'crypto';

export function generateKeyCode(): string {
  const chars = randomBytes(16).toString('hex').toUpperCase().split('');
  return `${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars
    .slice(8, 12)
    .join('')}-${chars.slice(12, 16).join('')}`;
}

