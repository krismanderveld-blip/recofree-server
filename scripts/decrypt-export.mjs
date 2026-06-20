/**
 * Decrypt a .recofree export file and output the payload structure.
 * Usage: node scripts/decrypt-export.mjs <file_path> <password>
 */
import { readFileSync, writeFileSync } from 'fs';
import { createDecipheriv } from 'crypto';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';

const filePath = process.argv[2];
const password = process.argv[3];

if (!filePath || !password) {
  console.error('Usage: node scripts/decrypt-export.mjs <file_path> <password>');
  process.exit(1);
}

const raw = readFileSync(filePath, 'utf-8');
const envelope = JSON.parse(raw);

console.log('=== ENVELOPE METADATA ===');
console.log('fileMagic:', envelope.fileMagic);
console.log('envelopeVersion:', envelope.envelopeVersion);
console.log('appExportedVersion:', envelope.appExportedVersion);
console.log('createdAt:', envelope.createdAt);
console.log('KDF:', JSON.stringify(envelope.kdf));
console.log('Encryption:', JSON.stringify(envelope.encryption));

// Derive key using PBKDF2
const salt = Buffer.from(envelope.kdf.saltBase64, 'base64');
const iterations = envelope.kdf.iterations;
const keyLength = envelope.kdf.keyLengthBits / 8;

console.log('\n=== DERIVING KEY ===');
console.log(`PBKDF2 with ${iterations} iterations, salt ${salt.length} bytes, key ${keyLength} bytes`);

const encoder = new TextEncoder();
const passwordBytes = encoder.encode(password);
const key = pbkdf2(sha256, passwordBytes, salt, { c: iterations, dkLen: keyLength });
console.log('Key derived successfully');

// Decrypt
const iv = Buffer.from(envelope.encryption.ivBase64, 'base64');
const ciphertext = Buffer.from(envelope.payload.ciphertextBase64, 'base64');
const authTag = Buffer.from(envelope.payload.authTagBase64, 'base64');

// Build AAD (same as the app)
const aadString = `${envelope.fileMagic}|${envelope.envelopeVersion}|${envelope.createdAt}|${envelope.appExportedVersion}`;
const aad = encoder.encode(aadString);
console.log(`AAD: ${aadString}`);

console.log(`\n=== DECRYPTING ===`);
console.log(`IV: ${iv.length} bytes, Ciphertext: ${ciphertext.length} bytes, AuthTag: ${authTag.length} bytes`);

const decipher = createDecipheriv('aes-256-gcm', Buffer.from(key), iv);
decipher.setAuthTag(authTag);
decipher.setAAD(Buffer.from(aad));

let decrypted = decipher.update(ciphertext, null, 'utf-8');
decrypted += decipher.final('utf-8');

console.log(`Decrypted payload: ${decrypted.length} chars`);

// Parse the payload
const payload = JSON.parse(decrypted);

console.log('\n=== PAYLOAD STRUCTURE ===');
console.log('Top-level keys:', Object.keys(payload));
console.log('payloadVersion:', payload.payloadVersion);
console.log('exportedAt:', payload.exportedAt);

if (payload.personas) {
  console.log('\n--- personas ---');
  console.log('Persona keys:', Object.keys(payload.personas));
  
  for (const [personaName, personaData] of Object.entries(payload.personas)) {
    if (personaData) {
      console.log(`\n  [${personaName}]:`);
      console.log(`    Keys: ${Object.keys(personaData)}`);
      for (const [key, value] of Object.entries(personaData)) {
        if (value === null) {
          console.log(`    ${key}: null`);
        } else if (typeof value === 'string') {
          console.log(`    ${key}: string (${value.length} chars)`);
        } else if (typeof value === 'object') {
          console.log(`    ${key}: object with keys [${Object.keys(value)}]`);
        } else {
          console.log(`    ${key}: ${typeof value}`);
        }
      }
    } else {
      console.log(`  [${personaName}]: null`);
    }
  }
}

if (payload.shared) {
  console.log('\n--- shared ---');
  console.log('Shared keys:', Object.keys(payload.shared));
  for (const [key, value] of Object.entries(payload.shared)) {
    if (value === null) {
      console.log(`  ${key}: null`);
    } else if (typeof value === 'string') {
      console.log(`  ${key}: string (${value.length} chars)`);
    } else if (typeof value === 'object') {
      console.log(`  ${key}: object with keys [${Object.keys(value).slice(0, 10)}]${Object.keys(value).length > 10 ? '...' : ''}`);
    } else {
      console.log(`  ${key}: ${typeof value}`);
    }
  }
}

// Write full decrypted payload to file for inspection
writeFileSync('/home/ubuntu/recofree-app/scripts/decrypted-payload.json', JSON.stringify(payload, null, 2));
console.log('\n=== Full payload written to scripts/decrypted-payload.json ===');
