import winston from 'winston';
import config from '../config';

const { combine, timestamp, json, errors } = winston.format;

export const logger = winston.createLogger({
  level: config.logLevel,
  defaultMeta: {
    service: 'store-platform-api',
  },
  format: combine(
    timestamp(),
    errors({ stack: true }),
    json()
  ),
  transports: [
    new winston.transports.Console({
      format: config.nodeEnv === 'development' 
        ? winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        : undefined,
    }),
  ],
});

export default logger;
