import express from 'express';
import userRouter from 'api/user.mts';
import sensorRouter from 'api/sensor.mts';

const router = express.Router();

// Register user routes under '/api/users'
router.use('/user', userRouter);

// Register sensor routes under '/api/sensors'
router.use('/sensor', sensorRouter);

export default router;
