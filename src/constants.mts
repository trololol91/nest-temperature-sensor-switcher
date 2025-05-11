import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

export const ENCRYPTION_KEY_FILE_NAME = 'encryption-key';
export const DEFAULT_LOG_FILE_NAME = 'application.log';

/**
 * Utility function to obtain the root path of the project.
 * This function can be called from any file in the project.
 *
 * @returns {string} - The absolute path to the root of the project.
 */
export const getProjectRoot = (): string => {
    return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
};

// Define LOG_DIR constant
export const LOG_DIR = path.isAbsolute(process.env.LOG_DIR || '')
    ? process.env.LOG_DIR
    : path.resolve(getProjectRoot(), process.env.LOG_DIR || 'logs');
