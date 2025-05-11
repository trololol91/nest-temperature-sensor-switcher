import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { changeNestThermostat } from './scripts/changeNestThermostat.mjs';
import sqlite3 from 'sqlite3';

// Initialize SQLite database
const db = new sqlite3.Database('resource/encrypted-sensors.db');

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
    console.error("Error: The 'deviceName' argument is required unless '--list' is specified.");
    process.exit(1);
}

(async function main(): Promise<void> {
    try {
        // Ensure 'deviceName' is not required when 'list' is used
        if (argv.list) {
            db.all('SELECT name, deviceID FROM sensors', [], (err, rows: { name: string; deviceID: string }[]) => {
                if (err) {
                    console.error('Error fetching devices from database:', err.message);
                    process.exit(1);
                }
                console.log('Devices in the database:');
                rows.forEach((row) => {
                    console.log(`- ${row.name}: ${row.deviceID}`);
                });
                db.close();
                process.exit(0);
            });
        } else {
            // Fetch deviceID from the database based on deviceName
            db.get('SELECT deviceID FROM sensors WHERE name = ?', [argv.deviceName], async (err, row: { deviceID: string } | undefined) => {
                if (err) {
                    console.error('Error fetching device from database:', err.message);
                    process.exit(1);
                }
                if (!row) {
                    console.error('Device name not found in the database.');
                    process.exit(1);
                }

                try {
                    await changeNestThermostat(row.deviceID, argv.headless);
                } catch (error) {
                    console.error('Error in main function:', error);
                } finally {
                    db.close();
                }
            });
        }
    } catch (error) {
        console.error('Unhandled error in main function:', error);
        db.close();
    }
})().catch(error => {
    console.error('Unhandled error in main execution:', error);
    process.exit(1);
});