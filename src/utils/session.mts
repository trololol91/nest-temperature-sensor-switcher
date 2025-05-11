import fs from 'fs';
import path from 'path';
import { BrowserContext } from 'playwright';
import { fileURLToPath } from 'url';
import { getEncryptionKey, encrypt, decrypt } from './crypto.mjs';

// Replace __dirname with a dynamic resolution
const SESSION_FILE_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../resource/session');

const ENCRYPTION_KEY = getEncryptionKey();

export async function saveSession(cookies: Array<{ name: string; value: string; domain: string; path: string; expires: number; httpOnly: boolean; secure: boolean; sameSite: string; }>): Promise<void> {
    const encryptedData = encrypt(JSON.stringify(cookies), ENCRYPTION_KEY);
    fs.writeFileSync(SESSION_FILE_PATH, encryptedData);
    console.log('Session saved to', SESSION_FILE_PATH);
}

export async function restoreSession(context: BrowserContext): Promise<void> {
    if (fs.existsSync(SESSION_FILE_PATH)) {
        const encryptedData = fs.readFileSync(SESSION_FILE_PATH, 'utf-8');
        const cookies = JSON.parse(decrypt(encryptedData, ENCRYPTION_KEY));
        await context.addCookies(cookies);
        console.log('Session restored from', SESSION_FILE_PATH);
    }
}

export { encrypt, decrypt };
