/**
 * Logger utility module.
 *
 * This module configures and exports a Winston logger instance for use across the application.
 * It supports dynamic log levels based on the `LOG_LEVEL` environment variable and logs messages
 * to a file located at `logs/application.log`.
 *
 * Functions:
 * - `createNamedLogger(name: string): Logger`: Creates a logger instance with a specific name.
 *
 * Environment Variables:
 * - `LOG_LEVEL`: Sets the logging level (e.g., 'info', 'debug', 'error'). Defaults to 'info'.
 */

import path from 'path';
import { createLogger, format, transports } from 'winston';
import { DEFAULT_LOG_FILE_NAME, LOG_DIR } from 'constants.mts';
import dotenv from 'dotenv';

dotenv.config();

const LOG_FILE_PATH = path.join(LOG_DIR, DEFAULT_LOG_FILE_NAME);

const logLevel = process.env.LOG_LEVEL || 'info';

/**
 * Creates a Winston logger instance with the specified configuration.
 *
 * The logger supports logging to both a file and the console. The log level is determined
 * by the `LOG_LEVEL` environment variable, defaulting to 'info' if not set.
 *
 * @constant {Logger} logger - The configured Winston logger instance.
 */
export const logger = createLogger({
    level: logLevel,
    format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.printf(({ timestamp, level, message }) => `${timestamp} [${level.toUpperCase()}]: ${message}`)
    ),
    transports: [
        new transports.File({ filename: LOG_FILE_PATH }),
        new transports.Console()
    ]
});

/**
 * Creates a named logger instance with a specific configuration.
 *
 * The logger supports logging to both a file and the console. The log level is determined
 * by the `LOG_LEVEL` environment variable, defaulting to 'info' if not set.
 *
 * @param {string} name - The name of the logger instance.
 * @param {string} [fileName='application'] - The filename for the log file (default: 'application').
 * @returns {Logger} - The configured Winston logger instance.
 */
export const createNamedLogger = (name: string, fileName = 'application'): ReturnType<typeof createLogger> => createLogger({
    level: logLevel,
    format: format.combine(
        format.label({ label: name }),
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.printf(({ timestamp, level, message, label }) => `${timestamp} [${label}] [${level.toUpperCase()}]: ${message}`)
    ),
    transports: [
        new transports.File({ filename: path.join(LOG_DIR, `${fileName}.log`) }),
        new transports.Console()
    ]
});
