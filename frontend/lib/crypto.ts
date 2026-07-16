/**
 * Web Crypto API helper for Data Encryption at Rest
 */

let activeCryptoKey: CryptoKey | null = null;

export function setActiveKey(key: CryptoKey | null) {
  activeCryptoKey = key;
}

export function getActiveKey(): CryptoKey | null {
  return activeCryptoKey;
}

export async function getKey(password: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  
  // Create base key material
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  const salt = enc.encode("AFIA_HEALTH_OFFLINE_DB_SALT_2024");

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptData(plainText: string, key: CryptoKey): Promise<string> {
  const enc = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  const cipherBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    enc.encode(plainText)
  );
  
  const cipherBytes = new Uint8Array(cipherBuffer);
  const result = new Uint8Array(iv.length + cipherBytes.length);
  result.set(iv, 0);
  result.set(cipherBytes, iv.length);
  
  return btoa(String.fromCharCode(...result));
}

export async function decryptData(cipherTextBase64: string, key: CryptoKey): Promise<string> {
  const binaryStr = atob(cipherTextBase64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  
  const iv = bytes.slice(0, 12);
  const cipherBytes = bytes.slice(12);
  
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    key,
    cipherBytes
  );
  
  return new TextDecoder().decode(decryptedBuffer);
}
