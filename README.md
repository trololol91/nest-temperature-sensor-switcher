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

## Adding Sensors and Configuring Thermostat

### Setting the Thermostat ID

1. Open the `.env` file in the root directory.
2. Add or update the `THERMOSTAT_ID` variable with the ID of your thermostat. For example:
   ```env
   THERMOSTAT_ID=YOUR_THERMOSTAT_ID
   ```

### Using Docker Compose

#### Set THERMOSTAT_ID
You can configure the `THERMOSTAT_ID` environment variable directly in the `docker-compose.yml` file. Follow these steps:

1. Open the `docker-compose.yml` file in the root directory.
2. Locate the `environment` section under the `app` service.
3. Update the `THERMOSTAT_ID` variable with your thermostat ID. For example:
   ```yaml
   environment:
     - NODE_ENV=production
     - THERMOSTAT_ID=YOUR_THERMOSTAT_ID
     - LOG_LEVEL=info
   ```

4. Start the application using Docker Compose:
   ```bash
   docker-compose up --build
   ```

This will build and start the application with the specified thermostat ID.

### Adding Sensors to the Database

You can add sensors to the database using the `/sensors` POST API route. Follow these steps:

1. Start the application using `npm start`.
2. Use a tool like `curl` or Postman to send a POST request to `http://localhost:<PORT>/api/sensors`.
3. The request body should include the `name` and `deviceID` of the sensor. For example:
   ```json
   {
     "name": "Living Room Sensor",
     "deviceID": "SENSOR_123456789"
   }
   ```
4. If the request is successful, the API will return the ID of the newly added sensor.

Example `curl` command:
```bash
curl -X POST http://localhost:3000/api/sensors \
-H "Content-Type: application/json" \
-d '{"name": "Living Room Sensor", "deviceID": "SENSOR_123456789"}'
```

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