import fs from 'fs';
import path from 'path';
import { BrowserContext } from 'playwright';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Session file path in root directory
const SESSION_FILE_PATH = path.resolve(__dirname, '../../session.json');

export async function saveSession(cookies: Array<{ name: string; value: string; domain: string; path: string; expires: number; httpOnly: boolean; secure: boolean; sameSite: string; }>): Promise<void> {
    fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify(cookies, null, 2));
    console.log('Session saved to', SESSION_FILE_PATH);
}

export async function restoreSession(context: BrowserContext): Promise<void> {
    if (fs.existsSync(SESSION_FILE_PATH)) {
        const cookies = JSON.parse(fs.readFileSync(SESSION_FILE_PATH, 'utf-8'));
        await context.addCookies(cookies);
        console.log('Session restored from', SESSION_FILE_PATH);
    }
}
