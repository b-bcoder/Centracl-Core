import { generateSecret, generateURI, verifySync } from 'otplib';
import { Buffer } from 'buffer';
import { argon2id } from 'hash-wasm';

// Polyfill Buffer for otplib if needed
if (typeof window !== 'undefined' && !window.Buffer) {
  window.Buffer = Buffer;
}

const SALT_LENGTH = 16;
const AES_IV_LENGTH = 12; // Standard for AES-GCM
const TWOFISH_IV_LENGTH = 16; // Standard for Twofish CTR
const SERPENT_IV_LENGTH = 16; // Standard for Serpent CTR
const CHACHA_IV_LENGTH = 12; // Standard for ChaCha20

import { deriveCascadedKeys, encryptTwofishCTR, encryptSerpentCTR, encryptChaCha20 } from './cascadedCrypto';

/**
 * Encrypts data using a cascade of ciphers: AES-256-GCM -> Twofish-256-CTR -> Serpent-256-CTR -> ChaCha20
 * Returns a combined base64-encoded string containing all nonces/salts and ciphertext.
 */
export async function encryptData(data: string, password: string, pepper: string = ''): Promise<string> {
  const encoder = new TextEncoder();
  const salt = window.crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const aesIv = window.crypto.getRandomValues(new Uint8Array(AES_IV_LENGTH));
  const twofishIv = window.crypto.getRandomValues(new Uint8Array(TWOFISH_IV_LENGTH));
  const serpentIv = window.crypto.getRandomValues(new Uint8Array(SERPENT_IV_LENGTH));
  const chachaIv = window.crypto.getRandomValues(new Uint8Array(CHACHA_IV_LENGTH));

  // Derive keys for each cipher from Argon2id seed
  const keys = await deriveCascadedKeys(password, salt, pepper);

  // Layer 1: AES-256-GCM (innermost)
  const aesCiphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: aesIv },
    keys.aesKey,
    encoder.encode(data)
  );

  // Layer 2: Twofish-256 in CTR mode
  const twofishCiphertext = encryptTwofishCTR(
    new Uint8Array(aesCiphertext),
    keys.twofishKey,
    twofishIv
  );

  // Layer 3: Serpent-256 in CTR mode
  const serpentCiphertext = encryptSerpentCTR(
    twofishCiphertext,
    keys.serpentKey,
    serpentIv
  );

  // Layer 4: ChaCha20 standard stream cipher (outermost)
  const finalCiphertext = encryptChaCha20(
    serpentCiphertext,
    keys.chachaKey,
    chachaIv
  );

  // Package all elements into a unified structural envelope
  const combinedLength =
    SALT_LENGTH +
    AES_IV_LENGTH +
    TWOFISH_IV_LENGTH +
    SERPENT_IV_LENGTH +
    CHACHA_IV_LENGTH +
    finalCiphertext.byteLength;

  const combined = new Uint8Array(combinedLength);
  let offset = 0;
  combined.set(salt, offset); offset += SALT_LENGTH;
  combined.set(aesIv, offset); offset += AES_IV_LENGTH;
  combined.set(twofishIv, offset); offset += TWOFISH_IV_LENGTH;
  combined.set(serpentIv, offset); offset += SERPENT_IV_LENGTH;
  combined.set(chachaIv, offset); offset += CHACHA_IV_LENGTH;
  combined.set(finalCiphertext, offset);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypts data using the exact reverse cascade sequence: ChaCha20 -> Serpent-256-CTR -> Twofish-256-CTR -> AES-256-GCM.
 */
export async function decryptData(base64Data: string, password: string, pepper: string = ''): Promise<string> {
  const combined = new Uint8Array(
    atob(base64Data)
      .split('')
      .map((c) => c.charCodeAt(0))
  );

  let offset = 0;
  const salt = combined.slice(offset, offset + SALT_LENGTH); offset += SALT_LENGTH;
  const aesIv = combined.slice(offset, offset + AES_IV_LENGTH); offset += AES_IV_LENGTH;
  const twofishIv = combined.slice(offset, offset + TWOFISH_IV_LENGTH); offset += TWOFISH_IV_LENGTH;
  const serpentIv = combined.slice(offset, offset + SERPENT_IV_LENGTH); offset += SERPENT_IV_LENGTH;
  const chachaIv = combined.slice(offset, offset + CHACHA_IV_LENGTH); offset += CHACHA_IV_LENGTH;
  const finalCiphertext = combined.slice(offset);

  const keys = await deriveCascadedKeys(password, salt, pepper);

  try {
    // Decrypt Layer 4 (ChaCha20)
    const serpentCiphertext = encryptChaCha20(
      finalCiphertext,
      keys.chachaKey,
      chachaIv
    );

    // Decrypt Layer 3 (Serpent-256-CTR)
    const twofishCiphertext = encryptSerpentCTR(
      serpentCiphertext,
      keys.serpentKey,
      serpentIv
    );

    // Decrypt Layer 2 (Twofish-256-CTR)
    const aesCiphertext = encryptTwofishCTR(
      twofishCiphertext,
      keys.twofishKey,
      twofishIv
    );

    // Decrypt Layer 1 (AES-256-GCM)
    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: aesIv },
      keys.aesKey,
      aesCiphertext
    );

    return new TextDecoder().decode(decrypted);
  } catch (e) {
    throw new Error('Decryption failed: Invalid password or corrupted data');
  }
}

/**
 * Hashes a password for initial verification (using Argon2id).
 * Note: For actual authentication, we rely on the ability to decrypt the data.
 */
export async function hashPassword(password: string): Promise<string> {
  // Use a static salt for verification hashing (or unique per user if we had a non-encrypted DB)
  // Since our DB is encrypted by the password itself, we use a fixed salt for the "unlock check"
  const staticSalt = new TextEncoder().encode('account-manager-static-salt');
  return argon2id({
    password: password,
    salt: staticSalt,
    parallelism: 1,
    iterations: 12,
    memorySize: 400 * 1024,
    hashLength: 32,
    outputType: 'hex',
  });
}

// TOTP Utilities
export const generateTOTPSecret = () => generateSecret();
export const generateTOTPUri = (user: string, issuer: string, secret: string) => 
  generateURI({ label: user, issuer, secret });
export const verifyTOTP = (token: string, secret: string) => 
  verifySync({ token, secret }).valid;
