/**
 * Login Script.
 *
 * This script automates the login process for the Nest application using Playwright.
 * It restores a saved browser session if available, or prompts the user to log in manually.
 * The session is then saved for future use.
 *
 * Functions:
 * - `promptUntilDone()`: Prompts the user until they type 'Done'.
 * - `restoreSession(context: BrowserContext)`: Restores a saved session to the browser context.
 * - `saveSession(cookies: Array<Cookie>): void`: Saves the current session cookies.
 *
 * Logging:
 * - Logs events and errors using the Winston logger.
 */

import { chromium } from 'playwright';
import { restoreSession, saveSession } from 'utils/session.mts';
import { HomePage } from 'page/homepage.page.mts';
import {createInterface} from 'node:readline/promises';
import {createNamedLogger} from 'utils/logger.mts';

const logger = createNamedLogger('LoginScript', 'login');

async function promptUntilDone(): Promise<void> {
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout
    });

    while (true) {
        const answer = await rl.question('Type in Done to finish: ');
        if (answer.trim().toLowerCase() === 'done') {
            break;
        }
    }
}

async function login(headless: boolean): Promise<void> {
    const browser = await chromium.launch({
        headless: headless, // Use the headless argument from yargs
        args: [
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--disable-setuid-sandbox',
            '--no-first-run',
            '--no-sandbox',
            '--no-zygote',
            '--ignore-certificate-errors',
            '--disable-extensions',
            '--disable-infobars',
            '--disable-notifications',
            '--disable-popup-blocking',
            '--remote-debugging-port=9222',
            '--disable-blink-features=AutomationControlled'
        ]
    });

    const context = await browser.newContext();

    // Restore session if available
    await restoreSession(context);

    // Perform login actions here if needed
    const page = await context.newPage();

    // Use the HomePage page object to navigate to the Nest home page
    const homePage = new HomePage(page);
    await homePage.navigate();

    // Allow use to do action prompt user if completed
    logger.info('Please complete the login process in the browser window.');

    // Wait for user to type 'Done'
    await promptUntilDone();

    // Save session after login
    const cookies = await context.cookies();
    await saveSession(cookies);

    // Close the browser
    await browser.close();
    logger.info('Login process completed and session saved.');
}

void (async (): Promise<void> => {
    const headless = false;
    await login(headless);
    process.exit(0);
})().catch(error => {
    logger.error('Error during login:', error);
    process.exit(1);
});

