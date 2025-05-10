import path from 'path';
import { BrowserContext, chromium, Page } from 'playwright';
import { HomePage } from 'page/homepage.page.js';
import { saveSession, restoreSession } from '../utils/sessionUtils.mjs';
import { takeScreenshotWithTimestamp } from '../utils/screenshotUtils.mjs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { DeviceConstants } from 'constants.mjs';

// Resolve __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Update changeNestThermostat to accept only database entries
export async function changeNestThermostat(deviceID: string, headless: boolean): Promise<void> {
    console.log('Starting Playwright...');
    const browser = await chromium.launch({
        headless: headless,
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

    const context: BrowserContext = await browser.newContext();

    // Restore session if available
    await restoreSession(context);

    let page: Page | undefined;
    try {
        page = await context.newPage();

        // Use the HomePage page object to navigate to the Nest home page
        const homePage = new HomePage(page);
        await homePage.navigate();

        // Wait for the home icon label to be visible
        await homePage.waitForHomeIconLabelVisible({ timeout: 10000 });

        // Click on thermostat puck item
        const thermostatItem = await homePage.selectPuckItemByHref(DeviceConstants.LivingRoomThermostat);
        await thermostatItem.click();

        // Wait for the thermostat setting button to be visible
        await homePage.waitForSettingsButtonVisible({ timeout: 10000 });

        console.log(`Clicked on thermostat with deviceID: ${deviceID}`);
    } catch (error) {
        // Take a screenshot with a timestamp
        if (page) {
            await takeScreenshotWithTimestamp(page, path.resolve(__dirname, '../../screenshots'));
        } else {
            console.error('Page object is not available for taking a screenshot.');
        }
        console.error('Error interacting with Nest thermostat. Details:', error);
        throw error;
    } finally {
        // Save session cookies using the browser's context
        const cookies = await context.cookies();
        await saveSession(cookies);
        
        // Close the browser
        await browser.close();
    }
}
