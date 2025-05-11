import fs from 'fs';
import path from 'path';
import { BrowserContext } from 'playwright';
import { getEncryptionKey, encrypt, decrypt } from 'utils/crypto.mts';
import { createNamedLogger } from 'utils/logger.mts';
import { getProjectRoot } from 'constants.mts';

// Update SESSION_FILE_PATH to use getProjectRoot
const SESSION_FILE_PATH = path.resolve(getProjectRoot(), 'resource/session');

const ENCRYPTION_KEY = getEncryptionKey();
const logger = createNamedLogger('SessionUtils');

/**
 * Saves the session cookies to a file after encrypting them.
 *
 * @param {Array} cookies - The cookies to save.
 * @returns {Promise<void>} - A promise that resolves when the session is saved.
 */
export async function saveSession(cookies: Array<{ name: string; value: string; domain: string; path: string; expires: number; httpOnly: boolean; secure: boolean; sameSite: string; }>): Promise<void> {
    const encryptedData = encrypt(JSON.stringify(cookies), ENCRYPTION_KEY);
    fs.writeFileSync(SESSION_FILE_PATH, encryptedData);
    logger.info('Session saved to', SESSION_FILE_PATH);
}


/**
 * Restores the session by reading cookies from a file and adding them to the provided context.
 *
 * @param {BrowserContext} context - The Playwright browser context to restore the session into.
 * @returns {Promise<void>} - A promise that resolves when the session is restored.
 */
export async function restoreSession(context: BrowserContext): Promise<void> {
    if (fs.existsSync(SESSION_FILE_PATH)) {
        const encryptedData = fs.readFileSync(SESSION_FILE_PATH, 'utf-8');
        const cookies = JSON.parse(decrypt(encryptedData, ENCRYPTION_KEY));
        await context.addCookies(cookies);
        logger.info('Session restored from', SESSION_FILE_PATH);
    }
}

export { encrypt, decrypt };
