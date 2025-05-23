
'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import bcrypt from 'bcrypt';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import db from '../db';
import { AUTH_COOKIE_NAME, SESSION_MAX_AGE } from '../constants';
import { encryptPayload } from '../auth-edge'; // Uses 'jose' for JWT
import { getUserByUsername } from '../auth'; // DB access, not Edge-safe
import type { AuthActionState } from '../types'; // Import the new type

async function createSessionCookie(userId: string, username: string, isAdmin: boolean, isApproved: boolean) {
  console.log(`[AuthAction createSessionCookie] Attempting to create session for user: ${username}`);
  const cookieStore = cookies();
  const expires = new Date(Date.now() + SESSION_MAX_AGE * 1000);
  const sessionPayload = { userId, username, isAdmin, isApproved, expires: expires.toISOString() };
  
  try {
    const token = await encryptPayload(sessionPayload);
    cookieStore.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      expires,
      path: '/',
      sameSite: 'lax',
    });
    console.log(`[AuthAction createSessionCookie] Session cookie SET for user: ${username}`);
  } catch (error) {
    console.error('[AuthAction createSessionCookie] CRITICAL ERROR encrypting payload or setting cookie:', error);
    // This error is critical and likely means JWT_SECRET is misconfigured or 'jose' has an issue.
    throw error; 
  }
}

export async function loginAction(
  prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  console.log('[LoginAction] Initiated.');
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  if (!username || !password) {
    return { message: 'Usuário e senha são obrigatórios.', type: 'error' };
  }

  // Modo de Login de Desenvolvimento
  if (process.env.DEV_LOGIN_ENABLED === "true") {
    console.log('[LoginAction] DEV_LOGIN_ENABLED is true. Attempting dev login.');
    const DEV_USERNAME = process.env.DEV_USERNAME || "dev";
    const DEV_PASSWORD = process.env.DEV_PASSWORD || "dev";

    if (username === DEV_USERNAME && password === DEV_PASSWORD) {
      console.log(`[LoginAction] Dev login successful for user: ${DEV_USERNAME}`);
      try {
        // Mock user data for dev admin
        await createSessionCookie('dev-admin-001', 'Dev Admin', true, true);
        return { message: 'Login de desenvolvimento bem-sucedido!', type: 'success', redirect: '/dashboard' };
      } catch (error: any) {
        console.error('[LoginAction] EXCEPTION during DEV login session creation:', error);
        return { message: 'Erro ao criar sessão de desenvolvimento. Verifique os logs.', type: 'error' };
      }
    } else {
      // If in dev mode but creds don't match dev creds, try DB as fallback or error
      // For simplicity here, we'll error if dev creds are expected but not matched.
      // Or, you could fall through to DB logic if you prefer.
      console.warn(`[LoginAction] Dev login FAILED. Provided: ${username}. Expected: ${DEV_USERNAME}.`);
      // To make it clearer that it's dev mode, we can show a specific error or fall through to DB.
      // Let's try falling through to DB logic for now if not exact dev match.
    }
  }

  // Lógica de Login Normal (Banco de Dados)
  console.log(`[LoginAction] Attempting DB login for user: ${username}`);
  try {
    const user = await getUserByUsername(username);

    if (!user) {
      console.log(`[LoginAction] User not found in DB: ${username}`);
      return { message: 'Credenciais inválidas.', type: 'error' };
    }

    if (!user.isApproved) {
      console.log(`[LoginAction] User not approved: ${username}`);
      return { message: 'Sua conta ainda não foi aprovada por um administrador.', type: 'error' };
    }

    const passwordsMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordsMatch) {
      console.log(`[LoginAction] Password mismatch for user: ${username}`);
      return { message: 'Credenciais inválidas.', type: 'error' };
    }

    await createSessionCookie(user.id, user.username, user.isAdmin, user.isApproved);
    console.log(`[LoginAction] DB Login successful for user: ${username}. Preparing success state.`);
    
    return { message: 'Login bem-sucedido!', type: 'success', redirect: '/dashboard' };

  } catch (error: any) {
    console.error('[LoginAction] EXCEPTION during DB login process for user:', username, 'Error:', error);
    let errorMessage = 'Ocorreu um erro inesperado durante o login. Tente novamente.';
    if (error.code === 'ECONNREFUSED' || error.message?.includes('ECONNREFUSED') || error.message?.includes('connect ETIMEDOUT')) {
      errorMessage = 'Erro de conexão com o banco de dados. O servidor de banco de dados está acessível?';
    } else if (error.message?.includes('Database error')) {
      errorMessage = 'Erro de banco de dados ao tentar fazer login.';
    } else if (error.message?.includes('JWT_SECRET')) {
      errorMessage = 'Erro de configuração interna do servidor (JWT). Contate o suporte.';
    } else if (error.message) {
      errorMessage = error.message; // Propagate specific error messages if available
    }
    return { message: errorMessage, type: 'error' };
  }
}

export async function registerUserAction(
  prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  console.log('[RegisterAction] Initiated.');
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  if (!username || !password) {
    return { message: 'Usuário e senha são obrigatórios.', type: 'error' };
  }
  if (password.length < 6) {
    return { message: 'A senha deve ter pelo menos 6 caracteres.', type: 'error' };
  }

  let connection;
  try {
    console.log(`[RegisterAction] Attempting registration for user: ${username}`);
    connection = await db.getConnection();
    console.log('[RegisterAction] Database connection acquired.');
    await connection.beginTransaction();
    console.log('[RegisterAction] Database transaction started.');

    const [existingUsers] = await connection.query<RowDataPacket[]>(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );
    if (existingUsers.length > 0) {
      await connection.rollback();
      console.log(`[RegisterAction] Username already exists: ${username}`);
      return { message: 'Este nome de usuário já está em uso.', type: 'error' };
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    console.log(`[RegisterAction] Password hashed for user: ${username}`);

    const [allUsersCountResult] = await connection.query<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM users'
    );
    const isFirstUser = allUsersCountResult[0].count === 0;
    console.log(`[RegisterAction] Is first user check: ${isFirstUser}`);

    const isAdmin = isFirstUser;
    const isApproved = isFirstUser;

    const [result] = await connection.execute<ResultSetHeader>(
      'INSERT INTO users (username, password_hash, is_admin, is_approved, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
      [username, hashedPassword, isAdmin, isApproved]
    );
    console.log(`[RegisterAction] User insertion result: insertId ${result.insertId}`);

    if (!result.insertId) {
      await connection.rollback();
      console.error('[RegisterAction] Failed to insert user into database. insertId is 0. Check AUTO_INCREMENT on users.id.');
      return { message: 'Erro ao registrar usuário (DB Insert). Tente novamente.', type: 'error' };
    }

    await connection.commit();
    console.log(`[RegisterAction] User ${username} registered successfully. ID: ${result.insertId}, isAdmin: ${isAdmin}, isApproved: ${isApproved}. Transaction committed.`);

    if (isFirstUser && process.env.DEV_LOGIN_ENABLED !== "true") { // Only auto-login first user if not in dev mode to avoid conflict with dev login
      console.log(`[RegisterAction] First user detected. Creating session cookie for ${username}.`);
      await createSessionCookie(String(result.insertId), username, isAdmin, isApproved);
      return { message: 'Registro e login bem-sucedidos como administrador!', type: 'success', redirect: '/dashboard' };
    } else if (isFirstUser && process.env.DEV_LOGIN_ENABLED === "true") {
       console.log(`[RegisterAction] First user registered in DEV_LOGIN_ENABLED mode. Redirecting to login for dev user or this new admin.`);
       return { message: 'Conta de administrador criada! Faça login com as credenciais ou use o login de desenvolvimento.', type: 'success', redirect: '/login' };
    }
    else {
      return { message: 'Registro bem-sucedido! Sua conta aguarda aprovação de um administrador.', type: 'success', redirect: '/login?status=pending_approval' };
    }
  } catch (error: any) {
    if (connection) {
      console.log('[RegisterAction] Error occurred, rolling back transaction.');
      await connection.rollback();
    }
    console.error('[RegisterAction] EXCEPTION during registration for user:', username, 'Error:', error);
    let errorMessage = 'Ocorreu um erro inesperado durante o registro. Tente novamente.';
     if (error.code === 'ECONNREFUSED' || error.message?.includes('ECONNREFUSED') || error.message?.includes('connect ETIMEDOUT')) {
        errorMessage = 'Erro de conexão com o banco de dados durante o registro.';
    } else if (error.message?.includes('Database error')) {
        errorMessage = 'Erro de banco de dados ao tentar registrar.';
    } else if (error.message?.includes('JWT_SECRET')) {
        errorMessage = 'Erro de configuração interna do servidor (JWT Reg). Contate o suporte.';
    } else if (error.message) {
        errorMessage = error.message;
    }
    return { message: errorMessage, type: 'error' };
  } finally {
    if (connection) {
      connection.release();
      console.log('[RegisterAction] Database connection released.');
    }
  }
}

export async function logoutAction() {
  console.log('[LogoutAction] Initiated.');
  const cookieStore = cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (token) {
    cookieStore.delete(AUTH_COOKIE_NAME);
    console.log('[LogoutAction] Session cookie deleted.');
  } else {
    console.log('[LogoutAction] No session cookie found to delete.');
  }
  redirect('/login?status=logged_out');
}
