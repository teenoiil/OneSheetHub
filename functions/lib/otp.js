// functions/lib/otp.js
import crypto from 'crypto';

export function genCode(len = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
export function sha256(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}
