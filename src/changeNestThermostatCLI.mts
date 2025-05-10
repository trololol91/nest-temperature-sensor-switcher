import { ThermostatDeviceIDs } from 'constants.mjs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { changeNestThermostat } from './scripts/changeNestThermostat.mjs';

// Parse command-line arguments
const argv = await yargs(hideBin(process.argv))
    .option('deviceName', {
        alias: 'n',
        type: 'string',
        description: 'The name of the thermostat to interact with',
        choices: Object.keys(ThermostatDeviceIDs),
        demandOption: true,
    })
    .option('headless', {
        alias: 'hl',
        type: 'boolean',
        description: 'Run browser in headless mode',
        default: true,
    })
    .help()
    .alias('help', 'h')
    .parseAsync();

(async function main(): Promise<void> {
    try {
        const deviceID = ThermostatDeviceIDs[argv.deviceName as keyof typeof ThermostatDeviceIDs];
        await changeNestThermostat(deviceID, argv.headless);
    } catch (error) {
        console.error('Error in main function:', error);
    }
})().catch(error => {
    console.error('Unhandled error in main function:', error);
});