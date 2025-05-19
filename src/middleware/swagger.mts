import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { Express } from 'express';

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Nest Temperature Sensor Switcher API',
            version: '1.0.0',
            description: 'API documentation for the Nest Temperature Sensor Switcher',
        },
    },
    apis: ['./src/api/*.mts'], // Adjust the path to include your API files
};

const swaggerSpec = swaggerJsdoc(options);

export const setupSwagger = (app: Express): void => {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
};
