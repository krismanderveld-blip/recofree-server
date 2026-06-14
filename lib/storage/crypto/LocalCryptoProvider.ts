/**
 * LocalCryptoProvider — High-level interface for logs.dat encryption.
 */
export { getOrCreateLocalEncryptionKey } from "./secureKeyStore";
export { encryptJsonAes256Gcm, decryptJsonAes256Gcm } from "./aes256gcm";
