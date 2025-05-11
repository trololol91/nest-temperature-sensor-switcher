import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createNamedLogger } from './logger.mjs';
import { ENCRYPTION_KEY_FILE_NAME } from 'constants.mjs';

const logger = createNamedLogger('CryptoUtils');

const ENCRYPTION_KEY_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), `../../resource/${ENCRYPTION_KEY_FILE_NAME}`);
const IV_LENGTH = 12; // AES-GCM standard IV length

/**
 * Generates or retrieves the encryption key used for AES-256-GCM encryption.
 * If the key does not exist, it generates a new one and saves it to the file system.
 *
 * @returns {Buffer} The encryption key as a Buffer.
 */
export function getEncryptionKey(): Buffer {
    if (!fs.existsSync(ENCRYPTION_KEY_FILE)) {
        const key = crypto.randomBytes(32);
        fs.writeFileSync(ENCRYPTION_KEY_FILE, key);
        logger.info('Encryption key generated and saved to', ENCRYPTION_KEY_FILE);
    }
    return fs.readFileSync(ENCRYPTION_KEY_FILE);
}

/**
 * Encrypts a given text using AES-256-GCM encryption.
 *
 * @param {string} text - The plaintext to encrypt.
 * @param {Buffer} encryptionKey - The encryption key to use.
 * @returns {string} The encrypted text in the format: iv:authTag:encryptedData.
 */
export function encrypt(text: string, encryptionKey: Buffer): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return iv.toString('hex') + ':' + authTag + ':' + encrypted;
}

/**
 * Decrypts a given encrypted text using AES-256-GCM encryption.
 *
 * @param {string} text - The encrypted text in the format: iv:authTag:encryptedData.
 * @param {Buffer} encryptionKey - The encryption key to use.
 * @returns {string} The decrypted plaintext.
 */
export function decrypt(text: string, encryptionKey: Buffer): string {
    const [iv, authTag, encryptedText] = text.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}
