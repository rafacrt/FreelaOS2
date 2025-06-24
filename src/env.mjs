// src/env.mjs
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /*
   * Serverside Environment variables, not available on the client.
   * Will throw error if it is not provided.
   */
  server: {
    DB_HOST: z.string().min(1),
    DB_PORT: z.coerce.number().int().positive(),
    DB_USER: z.string().min(1),
    DB_PASSWORD: z.string(),
    DB_DATABASE: z.string().min(1),
    DB_CONNECTION_LIMIT: z.coerce.number().int().optional(),
    DB_SSL_ENABLED: z.string().optional(),
    DB_SSL_REJECT_UNAUTHORIZED: z.string().optional(),
    JWT_SECRET: z.string().min(32, { message: "JWT_SECRET must be at least 32 characters long." }).optional(),
    DEV_LOGIN_ENABLED: z.string().optional(),
    EMAIL_INGEST_SECRET: z.string().min(16).optional(),

    // RESEND INTEGRATION
    RESEND_API_KEY: z.string().min(1),
    EMAIL_FROM: z.string().email(),
  },
  /*
   * Environment variables available on the client (and server).
   *
   * 💡 You'll get typeerrors if these are not prefixed with NEXT_PUBLIC_.
   */
  client: {
    NEXT_PUBLIC_DEV_MODE: z.string().optional(),
    NEXT_PUBLIC_BASE_URL: z.string().url(),
  },
  /*
   * Due to how Next.js bundles environment variables on Edge and Client,
   * we need to manually destructure them to make sure all are included in bundle.
   *
   * 💡 You'll get typeerrors if not all variables from client are included here.
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
    NEXT_PUBLIC_DEV_MODE: process.env.NEXT_PUBLIC_DEV_MODE,
    EMAIL_INGEST_SECRET: process.env.EMAIL_INGEST_SECRET,

    // RESEND INTEGRATION
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
  },
  /**
   * By default, this library will feed the environment variables directly to
   * the Zod validator.
   *
   * This means that if you have an empty string for a variable that is supposed
   * to be a number (e.g. `PORT=` in a ".env" file), Zod will rightfully complain
   * that it expected a number but received a string.
   *
   * You can tell zod to empty strings into `undefined` and then make
   * the variable optional. You can also supply a default value if applicable.
   *
   * Check out https://github.com/t3-oss/t3-env/issues/71 for more information.
   */
  emptyStringAsUndefined: true,

  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION || !!process.env.NEXT_RUNTIME,
});
