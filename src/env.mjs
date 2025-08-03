import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    DB_HOST: z.string().default("127.0.0.1"),
    DB_PORT: z.coerce.number().default(3306),
    DB_USER: z.string().default("user"),
    DB_PASSWORD: z.string(),
    DB_DATABASE: z.string().default("freelaos-db"),
    DB_CONNECTION_LIMIT: z.coerce.number().optional(),
    DB_SSL_ENABLED: z.string().transform(val => val === "true").optional(),
    DB_SSL_REJECT_UNAUTHORIZED: z.string().transform(val => val === "true").optional(),
    
    JWT_SECRET: z.string().min(32, { message: "JWT_SECRET must be at least 32 characters long" }),
    DEV_LOGIN_ENABLED: z.string().transform(val => val === "true").optional(),

    CRON_SECRET: z.string().optional(),
    EMAIL_INGEST_SECRET: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().email().optional(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    NEXT_PUBLIC_BASE_URL: z.string().url().default("http://localhost:9002"),
    NEXT_PUBLIC_DEV_MODE: z.string().transform(val => val === "true").optional(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    DB_HOST: process.env.DB_HOST,
    DB_PORT: process.env.DB_PORT,
    DB_USER: process.env.DB_USER,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_DATABASE: process.env.DB_DATABASE,
    DB_CONNECTION_LIMIT: process.env.DB_CONNECTION_LIMIT,
    DB_SSL_ENABLED: process.env.DB_SSL_ENABLED,
    DB_SSL_REJECT_UNAUTHORIZED: process.env.DB_SSL_REJECT_UNAUTHORIZED,
    
    JWT_SECRET: process.env.JWT_SECRET,
    DEV_LOGIN_ENABLED: process.env.DEV_LOGIN_ENABLED,

    CRON_SECRET: process.env.CRON_SECRET,
    EMAIL_INGEST_SECRET: process.env.EMAIL_INGEST_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,

    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    NEXT_PUBLIC_DEV_MODE: process.env.NEXT_PUBLIC_DEV_MODE,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION || !!process.env.NEXT_RUNTIME,
});