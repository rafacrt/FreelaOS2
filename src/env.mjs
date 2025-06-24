// src/env.mjs
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

// Detect if we are in an edge runtime.
// `process.env.NEXT_RUNTIME` is set to 'edge' by Next.js in edge environments.
const isEdge = process.env.NEXT_RUNTIME === 'edge';

export const env = createEnv({
  /*
   * Serverside Environment variables, not available on the client.
   * Will throw error if it is not provided.
   */
  server: {
    DB_HOST: z.string().min(1),
    DB_PORT: z.coerce.number().default(3306),
    DB_USER: z.string().min(1),
    DB_PASSWORD: z.string(),
    DB_DATABASE: z.string().min(1),
    JWT_SECRET: z.string().min(32, { message: "JWT_SECRET must be at least 32 characters long" }),
    DEV_LOGIN_ENABLED: z.string().optional().transform(val => val === "true"),
    RESEND_API_KEY: z.string().min(1),
    EMAIL_FROM: z.string().email(),
    EMAIL_INGEST_SECRET: z.string().min(1),
  },

  /*
   * Environment variables available on the client (and server).
   *
   * 💡 You'll get type errors if you try to use server variables in the client.
   */
  client: {
    NEXT_PUBLIC_DEV_MODE: z.string().optional().transform(val => val === "true"),
    NEXT_PUBLIC_BASE_URL: z.string().url(),
  },
  /*
   * Due to how Next.js bundles environment variables on edge and client,
   * we need to manually destructure them to make sure all are included in bundle.
   *
   * 💡 You'll get type errors if you try to use server variables in the client.
   */
  runtimeEnv: {
    DB_HOST: process.env.DB_HOST,
    DB_PORT: process.env.DB_PORT,
    DB_USER: process.env.DB_USER,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_DATABASE: process.env.DB_DATABASE,
    JWT_SECRET: process.env.JWT_SECRET,
    DEV_LOGIN_ENABLED: process.env.DEV_LOGIN_ENABLED,
    NEXT_PUBLIC_DEV_MODE: process.env.NEXT_PUBLIC_DEV_MODE,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    EMAIL_INGEST_SECRET: process.env.EMAIL_INGEST_SECRET,
  },
  /**
   * By default, T3 Env attempts to validate all environment variables at build time.
   * However, server-side variables (like database credentials) are not available in the
   * edge runtime (used by middleware). This causes the validation to fail when middleware
   * imports this file.
   *
   * By setting `skipValidation: isEdge`, we tell T3 Env to skip validation ONLY when
   * running in an edge environment. This allows the middleware to access the few
   * environment variables it needs (like JWT_SECRET) without crashing the build.
   * Validation will still run correctly in the server-side (Node.js) environment.
   */
  skipValidation: isEdge,
});
