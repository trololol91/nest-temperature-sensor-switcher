import path from 'path';
import { Page } from 'playwright';

/**
 * Takes a screenshot of the current page and saves it with a timestamped filename.
 * @param {Page} page - The Playwright page object.
 * @param {string} directory - The directory where the screenshot will be saved.
 * @returns {Promise<void>} A promise that resolves when the screenshot is saved.
 */
export async function takeScreenshotWithTimestamp(page: Page, directory: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = path.resolve(directory, `error-${timestamp}.png`);
    await page.screenshot({ path: screenshotPath });
    console.error(`Screenshot saved to ${screenshotPath}`);
}
