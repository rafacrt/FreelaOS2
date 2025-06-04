
// src/env.mjs
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    JWT_SECRET: z.string().min(32, { message: "JWT_SECRET must be at least 32 characters long" }).optional(),
    DEV_LOGIN_ENABLED: z.string().optional(), // expecting "true" or "false"
    DB_HOST: z.string().min(1),
    DB_PORT: z.coerce.number().int().default(3306),
    DB_USER: z.string().min(1),
    DB_PASSWORD: z.string().optional(),
    DB_DATABASE: z.string().min(1),
    DB_CONNECTION_LIMIT: z.coerce.number().int().default(10),
    DB_SSL_ENABLED: z.string().optional(), // "true" or "false"
    DB_SSL_REJECT_UNAUTHORIZED: z.string().optional(), // "true" or "false"
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    NEXT_PUBLIC_DEV_MODE: z.string().optional(), // expecting "true" or "false"
    // NEXT_PUBLIC_CLIENTVAR: z.string(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    JWT_SECRET: process.env.JWT_SECRET,
    DEV_LOGIN_ENABLED: process.env.DEV_LOGIN_ENABLED,
    NEXT_PUBLIC_DEV_MODE: process.env.NEXT_PUBLIC_DEV_MODE,
    DB_HOST: process.env.DB_HOST,
    DB_PORT: process.env.DB_PORT,
    DB_USER: process.env.DB_USER,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_DATABASE: process.env.DB_DATABASE,
    DB_CONNECTION_LIMIT: process.env.DB_CONNECTION_LIMIT,
    DB_SSL_ENABLED: process.env.DB_SSL_ENABLED,
    DB_SSL_REJECT_UNAUTHORIZED: process.env.DB_SSL_REJECT_UNAUTHORIZED,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION=true` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
