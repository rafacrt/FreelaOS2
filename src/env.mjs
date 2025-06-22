// src/env.mjs
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    // Database (Required)
    DB_HOST: z.string(),
    DB_PORT: z.string().optional().default('3306'),
    DB_USER: z.string(),
    DB_PASSWORD: z.string().optional(),
    DB_DATABASE: z.string(),
    DB_CONNECTION_LIMIT: z.string().optional().default('10'),
    DB_SSL_ENABLED: z.string().optional().default('false'),

    // Auth (Required)
    JWT_SECRET: z.string().min(32, { message: "JWT_SECRET must be at least 32 characters long for security." }),
    DEV_LOGIN_ENABLED: z.string().optional().default('false'),

    // Email Service (SMTP) - All optional
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.string().optional(),
    SMTP_SECURE: z.string().optional().default('false'),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    EMAIL_FROM: z.string().optional(),

    // Email Ingest Webhook (Optional)
    EMAIL_INGEST_SECRET: z.string().optional(),
  },

  /**
   * Specify your client-side environment variables schema here. To expose a variable to the client,
   * prefix it with `NEXT_PUBLIC_`.
   */
  client: {
    NEXT_PUBLIC_DEV_MODE: z.string().optional().default('false'),
    NEXT_PUBLIC_BASE_URL: z.string().url().optional(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    // Database
    DB_HOST: process.env.DB_HOST,
    DB_PORT: process.env.DB_PORT,
    DB_USER: process.env.DB_USER,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_DATABASE: process.env.DB_DATABASE,
    DB_CONNECTION_LIMIT: process.env.DB_CONNECTION_LIMIT,
    DB_SSL_ENABLED: process.env.DB_SSL_ENABLED,
    
    // Auth
    JWT_SECRET: process.env.JWT_SECRET,
    DEV_LOGIN_ENABLED: process.env.DEV_LOGIN_ENABLED,
    
    // Client
    NEXT_PUBLIC_DEV_MODE: process.env.NEXT_PUBLIC_DEV_MODE,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,

    // Email
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_SECURE: process.env.SMTP_SECURE,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    EMAIL_FROM: process.env.EMAIL_FROM,
    EMAIL_INGEST_SECRET: process.env.EMAIL_INGEST_SECRET,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined.
   * `SOME_VAR: z.string()` and `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
