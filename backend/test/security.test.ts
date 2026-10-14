import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decrypt, encrypt, hashPassword, signValue, verifyPassword, verifySignature } from '../src/lib/security.js';
import { detectMediaType } from '../src/lib/filetype.js';
import { loadEnv } from '../src/config/env.js';

const key = randomBytes(32).toString('base64');

describe('crypto primitives', () => {
  it('hashes passwords with per-hash salt and verifies them', async () => {
    const a = await hashPassword('correct horse battery');
    const b = await hashPassword('correct horse battery');
    expect(a).not.toBe(b);
    expect(await verifyPassword('correct horse battery', a)).toBe(true);
    expect(await verifyPassword('wrong', a)).toBe(false);
  });

  it('encrypts tokens with AES-GCM and detects tampering', () => {
    const enc = encrypt('ig-access-token', key);
    expect(enc).not.toContain('ig-access-token');
    expect(decrypt(enc, key)).toBe('ig-access-token');
    const tampered = enc.slice(0, -2) + (enc.endsWith('A') ? 'B' : 'A') + enc.slice(-1);
    expect(() => decrypt(tampered, key)).toThrow();
    expect(() => decrypt(enc, randomBytes(32).toString('base64'))).toThrow();
  });

  it('signs values and rejects forged signatures', () => {
    const sig = signValue('media.123', 'secret-secret-secret');
    expect(verifySignature('media.123', sig, 'secret-secret-secret')).toBe(true);
    expect(verifySignature('media.124', sig, 'secret-secret-secret')).toBe(false);
    expect(verifySignature('media.123', sig, 'other-secret-secret')).toBe(false);
    expect(verifySignature('media.123', 'short', 'secret-secret-secret')).toBe(false);
  });
});

describe('upload content sniffing', () => {
  it('trusts bytes, not the declared type', () => {
    expect(detectMediaType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))?.mime).toBe('image/jpeg');
    expect(detectMediaType(Buffer.from('<?php echo 1; ?>'.padEnd(32)))).toBeNull();
    expect(detectMediaType(Buffer.from('GIF89a'.padEnd(32)))).toBeNull();
    expect(detectMediaType(Buffer.alloc(0))).toBeNull();
  });
});

describe('production configuration guard', () => {
  const base = {
    DATABASE_URL: 'postgresql://x',
    JWT_SECRET: 'x'.repeat(48),
    NODE_ENV: 'production',
    TOKEN_ENCRYPTION_KEY: key,
    MEDIA_URL_SECRET: 'prod-media-secret-1234567890',
    CORS_ORIGINS: 'https://app.example.com',
  };
  it('accepts a safe production config', () => {
    expect(() => loadEnv(base)).not.toThrow();
  });
  it('rejects wildcard CORS, missing encryption key, default media secret and placeholder JWT', () => {
    expect(() => loadEnv({ ...base, CORS_ORIGINS: '*' })).toThrow(/CORS_ORIGINS/);
    expect(() => loadEnv({ ...base, TOKEN_ENCRYPTION_KEY: undefined })).toThrow(/TOKEN_ENCRYPTION_KEY/);
    expect(() => loadEnv({ ...base, MEDIA_URL_SECRET: undefined })).toThrow(/MEDIA_URL_SECRET/);
    expect(() => loadEnv({ ...base, JWT_SECRET: 'change-me-'.repeat(5) })).toThrow(/JWT_SECRET/);
  });
  it('does not block development defaults', () => {
    expect(() => loadEnv({ DATABASE_URL: 'postgresql://x', JWT_SECRET: 'x'.repeat(40) })).not.toThrow();
  });
});
