import { BrowserContext, chromium, Page } from 'playwright';
import { HomePage } from 'page/homepage.page.mts';
import { saveSession, restoreSession } from 'utils/session.mts';
import { takeScreenshotWithTimestamp } from 'utils/screenshot.mts';
import { createNamedLogger } from 'utils/logger.mts';

const logger = createNamedLogger('ChangeNestThermostatScript');

/**
 * Changes the selected Nest thermostat to the specified device ID.
 * @param {string} deviceID - The sensor device ID to select.
 * @param {string} thermostatDeviceId - The Nest thermostat ID to use for navigation.
 * @param {boolean} headless - Whether to run the browser in headless mode.
 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
 */
export async function changeNestThermostat(deviceID: string, thermostatDeviceId: string, headless: boolean): Promise<void> {
    logger.info('Starting Playwright...');
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
        const thermostatItem = await homePage.selectPuckItemByHref(thermostatDeviceId);
        await thermostatItem?.click();

        // Wait for the thermostat setting button to be visible
        await homePage.waitForSettingsButtonVisible({ timeout: 10000 });

        // Check if the thermostat is already selected
        const isSelected = await homePage.isTemperatureSensorSelected(deviceID);
        if (isSelected) {
            logger.info(`Thermostat with deviceID: ${deviceID} is already selected.`);
            return;
        }

        // Click on the specified thermostat
        const thermostat = await homePage.selectTemperatureSensorByDeviceID(deviceID);
        await thermostat?.scrollIntoViewIfNeeded();
        await thermostat?.evaluate<unknown, HTMLButtonElement>((el) => { el.click(); });
        logger.info(`Clicked on thermostat with deviceID: ${deviceID}`);

        // Wait for thermostat to be selected
        await homePage.waitForTemperatureSensorSelected(deviceID);
    } catch (error) {
        // Take a screenshot with a timestamp
        if (page) {
            await takeScreenshotWithTimestamp(page);
        } else {
            logger.error('Page object is not available for taking a screenshot.');
        }
        logger.error(`Error interacting with Nest thermostat. Details: ${error instanceof Error ? error.message : String(error)}`);
        throw error; // Re-throw the error after logging and taking a screenshot
    } finally {
        // Save session cookies using the browser's context
        const cookies = await context.cookies();
        saveSession(cookies);
        logger.info('Session cookies saved.');

        // Close the browser
        await browser.close();
        logger.info('Browser closed.');
    }
}
