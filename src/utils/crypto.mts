import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ENCRYPTION_KEY_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../resource/encryption-key');
const IV_LENGTH = 12; // AES-GCM standard IV length

export function getEncryptionKey(): Buffer {
    if (!fs.existsSync(ENCRYPTION_KEY_FILE)) {
        const key = crypto.randomBytes(32);
        fs.writeFileSync(ENCRYPTION_KEY_FILE, key);
        console.log('Encryption key generated and saved to', ENCRYPTION_KEY_FILE);
    }
    return fs.readFileSync(ENCRYPTION_KEY_FILE);
}

export function encrypt(text: string, encryptionKey: Buffer): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return iv.toString('hex') + ':' + authTag + ':' + encrypted;
}

export function decrypt(text: string, encryptionKey: Buffer): string {
    const [iv, authTag, encryptedText] = text.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}
