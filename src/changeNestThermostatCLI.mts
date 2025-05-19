// filepath: c:\Users\richm\Projects\nest-temperature-sensor-switcher\src\changeNestThermostatCLI.mts
/**
 * Main CLI script for changing Nest thermostat settings.
 *
 * This script allows users to list devices or change the thermostat settings
 * based on the provided device name or ID. It interacts with the SQLite database
 * to fetch device information and uses Playwright for browser automation.
 */
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { changeNestThermostat } from 'scripts/changeNestThermostat.mts';
import { createNamedLogger } from 'utils/logger.mts';
import Database from 'better-sqlite3';
import path from 'path';
import { getProjectRoot } from 'constants.mts';

const logger = createNamedLogger('ChangeNestThermostatCLI');

// Initialize SQLite database with proper path
const dbPath = path.resolve(getProjectRoot(), 'resource', 'encrypted-sensors.db');
const db = new Database(dbPath);

// Parse command-line arguments
const argv = await yargs(hideBin(process.argv))
    .option('deviceName', {
        alias: 'n',
        type: 'string',
        description: 'The name of the thermostat to interact with',
        demandOption: false, // Initially set to false
    })
    .option('headless', {
        alias: 'hl',
        type: 'boolean',
        description: 'Run browser in headless mode',
        default: true,
    })
// Add 'list' argument to list devices in the SQLite database
    .option('list', {
        alias: 'l',
        type: 'boolean',
        description: 'List all devices in the database',
        default: false,
    })
    .help()
    .alias('help', 'h')
    .parseAsync();

// Dynamically enforce 'deviceName' requirement if 'list' is not used
if (!argv.list && !argv.deviceName) {
    logger.error('Error: The \'deviceName\' argument is required unless \'--list\' is specified.');
    process.exit(1);
}

interface DeviceRow {
  name: string;
  deviceID: string;
}

(async function main(): Promise<void> {
    try {
    // Ensure 'deviceName' is not required when 'list' is used
        if (argv.list) {
            try {
                const rows = db.prepare('SELECT name, deviceID FROM sensors').all() as DeviceRow[];
                logger.info('Devices in the database:');
                rows.forEach((row) => {
                    logger.info(`- ${row.name}: ${row.deviceID}`);
                });
                db.close();
                process.exit(0);
            }
            catch (err) {
                logger.error('Error fetching devices from database:', err instanceof Error ? err.message : err);
                db.close();
                process.exit(1);
            }
        }
        else {
            // Fetch deviceID from the database based on deviceName
            try {
                const row = db.prepare('SELECT deviceID FROM sensors WHERE name = ?').get(argv.deviceName) as DeviceRow | undefined;

                if (!row) {
                    logger.error('Device name not found in the database.');
                    db.close();
                    process.exit(1);
                }

                try {
                    await changeNestThermostat(row.deviceID, 'DEVICE_CCA7C100002935B9', argv.headless); // Added thermostatId parameter
                }
                catch (error) {
                    logger.error('Error in main function:', error);
                }
                finally {
                    db.close();
                }
            }
            catch (err) {
                logger.error('Error fetching device from database:', err instanceof Error ? err.message : err);
                db.close();
                process.exit(1);
            }
        }
    }
    catch (error: unknown) {
        logger.error('Unhandled error in main function:', error);
        db.close();
    }
})().catch((error: unknown) => {
    logger.error('Unhandled error in main execution:', error);
    process.exit(1);
});
