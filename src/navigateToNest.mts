import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BrowserContext, chromium } from 'playwright';
import { HomePage } from 'page/homepage.page.js';
import { DeviceConstants, ThermostatDeviceIDs } from 'constants.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SESSION_FILE_PATH = path.resolve(__dirname, '../session.json');

// Wait for 5 minutes before closing the browser
const WAIT_TIME_MS = 15 * 60 * 1000;

async function saveSession(cookies: Array<{ name: string; value: string; domain: string; path: string; expires: number; httpOnly: boolean; secure: boolean; sameSite: string; }>): Promise<void> {
    fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify(cookies, null, 2));
    console.log('Session saved to', SESSION_FILE_PATH);
}

async function restoreSession(context: BrowserContext): Promise<void> {
    if (fs.existsSync(SESSION_FILE_PATH)) {
        const cookies = JSON.parse(fs.readFileSync(SESSION_FILE_PATH, 'utf-8'));
        await context.addCookies(cookies);
        console.log('Session restored from', SESSION_FILE_PATH);
    }
}

async function changeNestThermostat(deviceID: ThermostatDeviceIDs): Promise<void> {
    console.log('Starting Playwright...');
    const browser = await chromium.launch({
        headless: false, // Set to false if you want to see the browser UI
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

    try {
        const page = await context.newPage();

        // Use the HomePage page object to navigate to the Nest home page
        const homePage = new HomePage(page);
        await homePage.navigate();

        // Wait for the page to load completely
        await new Promise(resolve => setTimeout(resolve, 10000));

        // Click on thermostat puck item
        const thermostatItem = await homePage.selectPuckItemByHref(DeviceConstants.LivingRoomThermostat);
        await thermostatItem.click();

        // Click on the specified thermostat
        const thermostat = await homePage.selectTemperatureSensorByDeviceID(deviceID);
        await thermostat.click();
        console.log(`Clicked on thermostat with deviceID: ${deviceID}`);

        // Wait for thermostat to be selected
        await homePage.waitForTemperatureSensorSelected(deviceID);

        // Perform additional actions here if needed
    } catch (error) {
        console.error('Error navigating to https://home.nest.com:', error);
    } finally {
        // Wait for 15 minutes before closing the browser
        await new Promise(resolve => setTimeout(resolve, WAIT_TIME_MS));

        // Save session cookies using the browser's context
        const cookies = await context.cookies();
        await saveSession(cookies);
        
        // Close the browser
        await browser.close();
    }
}

// Run the function
changeNestThermostat(ThermostatDeviceIDs.LivingRoomThermostat).catch(error => {
    console.error('Unhandled error in changeNestThermostat:', error);
});