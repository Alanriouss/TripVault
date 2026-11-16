/**
 * @tripvault/server - Errors and Validation Helpers
 */
import { ADDRESS, ZERO } from './constants.js';

export class RoomError extends Error {
  constructor(status, message, funding) {
    super(message);
    this.status = status;
    this.funding = funding;
  }
}

export function assert(value, status, message) {
  if (!value) throw new RoomError(status, message);
}

export function text(value, max, label, required = true) {
  assert(typeof value === 'string', 400, `Enter a valid ${label}.`);
  const clean = value.trim();
  assert(clean.length <= max && (!required || clean.length), 400, `Enter a valid ${label}.`);
  return clean;
}

export function safeAddress(input) {
  assert(typeof input === 'string' && ADDRESS.test(input) && !ZERO.test(input), 400, 'Invalid wallet address.');
  return input.toLowerCase();
}
