// src/env.mjs
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /*
   * Serverside Environment variables, not available on the client.
   * Will throw error if it is not provided.
   */
  server: {
    // Database
    DB_HOST: z.string().min(1),
    DB_PORT: z.coerce.number().default(3306),
    DB_USER: z.string().min(1),
    DB_PASSWORD: z.string().optional(),
    DB_DATABASE: z.string().min(1),

    // Security
    JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters long."),
    EMAIL_INGEST_SECRET: z.string().min(1, "EMAIL_INGEST_SECRET is required."),

    // Email Service (Resend)
    RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY is required."),
    EMAIL_FROM: z.string().email("EMAIL_FROM must be a valid email address."),

    // Development Flags
    DEV_LOGIN_ENABLED: z.string().transform((s) => s === "true").optional(),
  },

  /*
   * Environment variables available on the client (and server).
   * Must be prefixed with NEXT_PUBLIC_.
   * Will throw error if it is not provided.
   */
  client: {
    NEXT_PUBLIC_BASE_URL: z.string().url("NEXT_PUBLIC_BASE_URL must be a valid URL."),
    NEXT_PUBLIC_DEV_MODE: z.string().transform((s) => s === "true").optional(),
  },

  /*
   * Due to how Next.js bundles environment variables on Edge and Client,
   * we need to manually destructure them to make sure all are included in process.env.
   */
  runtimeEnv: {
    // Server-side
    DB_HOST: process.env.DB_HOST,
    DB_PORT: process.env.DB_PORT,
    DB_USER: process.env.DB_USER,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_DATABASE: process.env.DB_DATABASE,
    JWT_SECRET: process.env.JWT_SECRET,
    EMAIL_INGEST_SECRET: process.env.EMAIL_INGEST_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    DEV_LOGIN_ENABLED: process.env.DEV_LOGIN_ENABLED,

    // Client-side
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    NEXT_PUBLIC_DEV_MODE: process.env.NEXT_PUBLIC_DEV_MODE,
  },

  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation.
   * This is especially useful for Docker builds and CI pipelines.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
