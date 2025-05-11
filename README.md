## Project Overview

The Nest Temperature Sensor Switcher is a TypeScript-based project designed to manage and automate interactions with Nest temperature sensors. It includes features such as:

- **Session Management**: Securely save and restore browser sessions using AES-256-GCM encryption.
- **Logging**: Comprehensive logging using Winston with dynamic log levels.
- **CLI Tools**: Command-line utilities for listing devices and changing thermostat settings.
- **Page Object Model**: Structured interaction with the Nest homepage using Playwright.

## Features

1. **Session Management**
   - Encrypts session data for security.
   - Automatically generates and manages encryption keys.

2. **Logging**
   - Logs application events to both console and file.
   - Supports dynamic log levels via environment variables.

3. **CLI Tools**
   - List devices stored in the database.
   - Change thermostat settings based on device name or ID.

4. **Error Handling**
   - Captures screenshots during errors for debugging.

## Setup Instructions

1. Clone this repository.
2. Install dependencies using `npm install`.
3. Configure the `.env` file with the required environment variables.
4. Run the application using the provided scripts in `package.json`.

## Usage

- **Login Script**: `npm run login`
- **Change Thermostat**: `npm run change-thermostat`

## Folder Structure

- `src/`
  - `api/`: API routes and handlers.
  - `config/`: Configuration files.
  - `middleware/`: Middleware for database and other utilities.
  - `page/`: Page object models for Playwright.
  - `scripts/`: CLI scripts for interacting with the application.
  - `utils/`: Utility modules for logging, encryption, and session management.
- `resource/`: Contains encrypted session data and database files.
- `logs/`: Stores application logs.
- `screenshots/`: Captures error screenshots for debugging.