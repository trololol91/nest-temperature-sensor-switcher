import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BrowserContext, chromium } from 'playwright';
import { HomePage } from 'page/homepage.page.js';
import { DeviceConstants, ThermostatDeviceIDs } from 'constants.mjs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SESSION_FILE_PATH = path.resolve(__dirname, '../session.json');

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

        // Perform additional actions here if needed
    } catch (error) {
        console.error('Error navigating to https://home.nest.com:', error);
    } finally {
        // Save session cookies using the browser's context
        const cookies = await context.cookies();
        await saveSession(cookies);
        
        // Close the browser
        await browser.close();
    }
}

// Parse command-line arguments
const argv = await yargs(hideBin(process.argv))
    .option('deviceName', {
        alias: 'n',
        type: 'string',
        description: 'The name of the thermostat to interact with',
        choices: Object.keys(ThermostatDeviceIDs),
        demandOption: true,
    })
    .help()
    .alias('help', 'h')
    .parseAsync();

(async function main(): Promise<void> {
    try {
        const deviceID = ThermostatDeviceIDs[argv.deviceName as keyof typeof ThermostatDeviceIDs];
        await changeNestThermostat(deviceID);
    } catch (error) {
        console.error('Error in main function:', error);
    }
})().catch(error => {
    console.error('Unhandled error in main function:', error);
});