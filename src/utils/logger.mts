import path from 'path';
import { createLogger, format, transports } from 'winston';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

// Replace __dirname with a dynamic resolution
const LOG_FILE_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../logs/application.log');

const logLevel = process.env.LOG_LEVEL || 'info';

// Configure Winston logger
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

export const createNamedLogger = (name: string, fileName: string = 'application'): ReturnType<typeof createLogger> => createLogger({
    level: logLevel,
    format: format.combine(
        format.label({ label: name }),
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.printf(({ timestamp, level, message, label }) => `${timestamp} [${label}] [${level.toUpperCase()}]: ${message}`)
    ),
    transports: [
        new transports.File({ filename: path.resolve(path.dirname(fileURLToPath(import.meta.url)), `../../logs/${fileName}.log`) }),
        new transports.Console()
    ]
});
