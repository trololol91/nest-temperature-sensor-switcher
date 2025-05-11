/**
 * Page object model for the Nest homepage.
 *
 * This class provides methods to interact with the homepage elements,
 * such as navigating to the page, selecting devices, and interacting with
 * temperature sensors.
 */
import { Page, ElementHandle } from 'playwright';
import { createNamedLogger } from 'utils/logger.mts';

const logger = createNamedLogger('HomePage');

/**
 * @fileoverview Provides the HomePage class which encapsulates the operations required 
 * for interacting with the Nest home page. This includes navigation, selecting puck items, 
 * temperature sensors, and waiting for the selection of a temperature sensor based on its device ID.
 *
 * The HomePage class offers the following functionality:
 * - URL retrieval and navigation to the home page.
 * - Selecting an element based on its href attribute.
 * - Selecting a temperature sensor element using its device ID.
 * - Waiting for a temperature sensor to become selected as indicated by specific CSS styling.
 *
 * @remarks
 * All methods in the HomePage class are asynchronous where applicable, providing enhanced control 
 * over navigation timing, element retrieval, and user feedback via console logging. This ensures 
 * that interactions with the web page are handled efficiently and debugging information is logged during operations.
 *
 * @packageDocumentation
 */
export class HomePage {
    private url: string;
    private page: Page;

    constructor(page: Page) {
        this.page = page;
        this.url = 'https://home.nest.com';
    }

    /**
     * Retrieves the URL of the home page.
     * @returns {string} The URL of the home page.
     */
    public getUrl(): string {
        return this.url;
    }
    
    /**
     * Navigates to the home page URL.
     * @returns {Promise<void>} A promise that resolves when navigation is complete.
     */
    public async navigate(): Promise<void> {
        await this.page.goto(this.url);
        logger.info(`Navigated to ${this.url}`);
    }

    /**
     * Selects a puck item element by its href attribute.
     * @param {string} href - The href value of the puck item to select.
     * @returns {Promise<ElementHandle | null>} A promise that resolves to the selected element or null if not found.
     */
    public async selectPuckItemByHref(thermostatId: string): Promise<ElementHandle | null> {
        const selector = `.puck-item a[href='/thermostat/${thermostatId}']`;
        const element = await this.page.$(selector);
        if (!element) {
            logger.error(`Element with href '${thermostatId}' not found.`);
        }
        return element;
    }

    /**
     * Selects a temperature sensor element by its device ID.
     * @param {string} deviceID - The device ID of the temperature sensor to select.
     * @returns {Promise<ElementHandle | null>} A promise that resolves to the selected element or null if not found.
     */
    public async selectTemperatureSensorByDeviceID(deviceID: string): Promise<ElementHandle | null> {
        const selector = `.card span[data-test='thermozilla-aag-sensors-temperature-sensor-${deviceID}-listcell-value']`;
        const element = await this.page.$(selector);
        if (!element) {
            logger.error(`Temperature sensor with deviceID '${deviceID}' not found.`);
        }
        return element;
    }

    /**
     * Waits for the temperature sensor with the specified device ID to be selected.
     * @param {string} deviceID - The device ID of the temperature sensor.
     * @param {{ timeout?: number }} [options] - Optional parameters.
     * @param {number} [options.timeout] - Maximum time to wait in milliseconds.
     * @returns {Promise<void>} A promise that resolves when the sensor is selected.
     */
    public async waitForTemperatureSensorSelected(
        deviceID: string,
        options?: { timeout?: number }
    ): Promise<void> {
        const selector = `.card div[data-test='thermozilla-aag-sensors-temperature-sensor-${deviceID}-listcell']`;
        await this.page.waitForSelector(`${selector}.style--selected_3GC`, {
            state: 'attached',
            timeout: options?.timeout,
        });
        logger.info(`Temperature sensor with deviceID '${deviceID}' is now selected.`);
    }

    /**
     * Checks if the temperature sensor with the specified device ID is already selected.
     * @param {string} deviceID - The device ID of the temperature sensor.
     * @returns {Promise<boolean>} A promise that resolves to true if the sensor is selected, false otherwise.
     */
    public async isTemperatureSensorSelected(deviceID: string): Promise<boolean> {
        const selector = `.card div[data-test='thermozilla-aag-sensors-temperature-sensor-${deviceID}-listcell'].style--selected_3GC`;
        const element = await this.page.$(selector);
        return element !== null;
    }

    /**
     * Waits for the settings button to be visible on the page.
     * @param {{ timeout?: number }} [options] - Optional parameters.
     * @param {number} [options.timeout] - Maximum time to wait in milliseconds.
     * @returns {Promise<void>} A promise that resolves when the settings button is visible.
     */
    public async waitForSettingsButtonVisible(options?: { timeout?: number }): Promise<void> {
        const selector = "button[data-test='thermozilla-header-settings-button']";
        await this.page.waitForSelector(selector, {
            state: 'visible',
            timeout: options?.timeout,
        });
        logger.info('Settings button is now visible.');
    }

    /**
     * Waits for the home icon label to be visible on the page.
     * @param {{ timeout?: number }} [options] - Optional parameters.
     * @param {number} [options.timeout] - Maximum time to wait in milliseconds.
     * @returns {Promise<void>} A promise that resolves when the home icon label is visible.
     */
    public async waitForHomeIconLabelVisible(options?: { timeout?: number }): Promise<void> {
        const selector = "label[for='icon-mode-home']";
        await this.page.waitForSelector(selector, {
            state: 'visible',
            timeout: options?.timeout,
        });
        logger.info('Home icon label is now visible.');
    }
}
