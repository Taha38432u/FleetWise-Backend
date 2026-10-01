import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  PORT: Joi.number().default(5000),
  DATABASE_URL: Joi.string().required(),
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('8h'),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  EMAIL_USER: Joi.string().email().required(),
  EMAIL_PASS: Joi.string().required(),
  EMAIL_HOST: Joi.string().required(),
  EMAIL_PORT: Joi.number().default(587),
  EMAIL_FROM: Joi.string().email().required(),
  APP_NAME: Joi.string().default('FleetWise'),
  APP_URL: Joi.string().uri().required(),
  RESEND_API_KEY: Joi.string().required(),
  FRONTEND_URL: Joi.string().uri().required(),
  PYTHON_AI_URL: Joi.string().uri().default('http://localhost:8001'),
});
