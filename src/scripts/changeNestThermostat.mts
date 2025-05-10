import path from 'path';
import { BrowserContext, chromium, Page } from 'playwright';
import { HomePage } from 'page/homepage.page.js';
import { DeviceConstants, ThermostatDeviceIDs } from 'constants.mjs';
import { saveSession, restoreSession } from '../utils/sessionUtils.mjs';
import { takeScreenshotWithTimestamp } from '../utils/screenshotUtils.mjs';

export async function changeNestThermostat(deviceID: ThermostatDeviceIDs, headless: boolean): Promise<void> {
    console.log('Starting Playwright...');
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
        const thermostatItem = await homePage.selectPuckItemByHref(DeviceConstants.LivingRoomThermostat);
        await thermostatItem.click();

        // Wait for the thermostat setting button to be visible
        await homePage.waitForSettingsButtonVisible({ timeout: 10000 });

        // Check if the thermostat is already selected
        const isSelected = await homePage.isTemperatureSensorSelected(deviceID);
        if (isSelected) {
            console.log(`Thermostat with deviceID: ${deviceID} is already selected.`);
            return;
        }

        // Click on the specified thermostat
        const thermostat = await homePage.selectTemperatureSensorByDeviceID(deviceID);
        await thermostat.scrollIntoViewIfNeeded();
        await thermostat.evaluate((el) => el.click());
        console.log(`Clicked on thermostat with deviceID: ${deviceID}`);

        // Wait for thermostat to be selected
        await homePage.waitForTemperatureSensorSelected(deviceID);
    } catch (error) {
        // Take a screenshot with a timestamp
        if (page) {
            await takeScreenshotWithTimestamp(page, path.resolve(__dirname, '../../screenshots'));
        } else {
            console.error('Page object is not available for taking a screenshot.');
        }
        console.error('Error interacting with Nest thermostat. Details:', error);
        throw error; // Re-throw the error after logging and taking a screenshot
    } finally {
        // Save session cookies using the browser's context
        const cookies = await context.cookies();
        await saveSession(cookies);
        
        // Close the browser
        await browser.close();
    }
}
