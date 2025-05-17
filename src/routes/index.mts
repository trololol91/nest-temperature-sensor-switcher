import express from 'express';
import userRouter from 'api/user.mts';
import sensorRouter from 'api/sensor.mts';
import thermostatRouter from 'api/thermostat.mts';

const router = express.Router();

// Register user routes under '/api/users'
router.use('/user', userRouter);

// Register sensor routes under '/api/sensors'
router.use('/sensor', sensorRouter);

// Register thermostat routes under '/api/thermostat'
router.use('/thermostat', thermostatRouter);

export default router;
