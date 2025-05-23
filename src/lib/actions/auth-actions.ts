
'use server';

import { cookies } from 'next/headers';
import bcrypt from 'bcrypt';
import type { ResultSetHeader, RowDataPacket, PoolConnection } from 'mysql2/promise';
import db from '../db';
import { AUTH_COOKIE_NAME, SESSION_MAX_AGE } from '../constants';
import { encryptPayload } from '../auth-edge'; // For creating JWT
import { getUserByUsername } from '../auth'; // For DB lookups (Node.js runtime)
import type { AuthActionState } from '../types';

async function createSessionCookie(userId: string, username: string, isAdmin: boolean, isApproved: boolean) {
  console.log(`[AuthAction createSessionCookie] Attempting to create session for user: ${username}, isAdmin: ${isAdmin}, isApproved: ${isApproved}`);
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
      sameSite: 'lax', // Recommended for most cases
    });
    console.log(`[AuthAction createSessionCookie] Session cookie SET for user: ${username}. Token (first 20 chars): ${token ? token.substring(0,20)+'...' : 'N/A'}`);
  } catch (error: any) {
    console.error('[AuthAction createSessionCookie] CRITICAL ERROR encrypting payload or setting cookie:', error);
    throw new Error('Falha ao criar cookie de sessão: ' + error.message);
  }
}

export async function loginAction(
  prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  console.log('[LoginAction] Initiated.');
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  const devLoginEnabledEnv = process.env.DEV_LOGIN_ENABLED;
  const devUsernameEnv = process.env.DEV_USERNAME || "dev";
  const devPasswordEnv = process.env.DEV_PASSWORD || "dev";

  console.log(`[LoginAction] Raw DEV_LOGIN_ENABLED from env: "${devLoginEnabledEnv}"`);
  console.log(`[LoginAction] Input User: ${username}, Dev User from env: ${devUsernameEnv}`);

  if (devLoginEnabledEnv === "true") {
    console.log(`[LoginAction] Dev login mode is active. Expected dev user: ${devUsernameEnv}`);
    if (username === devUsernameEnv && password === devPasswordEnv) {
      console.log(`[LoginAction] Dev credentials MATCH for user: ${devUsernameEnv}`);
      try {
        await createSessionCookie('dev-admin-001', devUsernameEnv, true, true);
        console.log(`[LoginAction] Dev session cookie created for ${devUsernameEnv}.`);
        return { message: 'Login de desenvolvimento bem-sucedido!', type: 'success', redirect: '/dashboard' };
      } catch (error: any) {
        console.error('[LoginAction] EXCEPTION during DEV login session creation:', error.message, error.stack);
        return { message: `Erro ao criar sessão de desenvolvimento: ${error.message}`, type: 'error' };
      }
    } else {
      console.warn(`[LoginAction] Dev login mode active, but credentials did NOT match. Provided user: ${username}. Expected dev user: ${devUsernameEnv}. Proceeding to DB login as fallback.`);
      // Fall through to normal DB login if dev credentials don't match but dev login is enabled.
      // OR, you might want to return an error here:
      // return { message: 'Credenciais de desenvolvimento inválidas.', type: 'error' };
    }
  }

  console.log(`[LoginAction] Attempting DB login for user: ${username}`);
  if (!username || !password) {
    return { message: 'Usuário e senha são obrigatórios.', type: 'error' };
  }

  try {
    const user = await getUserByUsername(username);

    if (!user) {
      console.log(`[LoginAction] User not found in DB: ${username}`);
      return { message: 'Credenciais inválidas ou usuário não encontrado.', type: 'error' };
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

    await createSessionCookie(String(user.id), user.username, user.isAdmin, user.isApproved);
    console.log(`[LoginAction] DB Login successful for user: ${username}. Preparing success state.`);
    return { message: 'Login bem-sucedido!', type: 'success', redirect: '/dashboard' };

  } catch (error: any) {
    console.error('[LoginAction] EXCEPTION during DB login process for user:', username);
    console.error('[LoginAction] Error Details:', error.message, error.code, error.stack);
    let errorMessage = 'Ocorreu um erro inesperado durante o login. Tente novamente.';
    if (error.code === 'ECONNREFUSED' || error.message?.includes('ECONNREFUSED')) {
      errorMessage = 'Falha na conexão com o banco de dados. Verifique se o servidor de banco de dados está acessível e as configurações de conexão estão corretas no ambiente do servidor.';
    } else if (error.message?.includes('Database error')) {
      errorMessage = 'Erro de banco de dados ao tentar fazer login.';
    } else if (error.message?.includes('JWT_SECRET') || error.message?.includes('JWT key not initialized')) {
      errorMessage = 'Erro de configuração interna do servidor (JWT). Contate o suporte.';
    } else if (error.message?.includes('Falha ao criar cookie de sessão')) {
      errorMessage = error.message; 
    }
    return { message: errorMessage, type: 'error' };
  }
}

export async function devLoginAction(prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  console.log('[DevLoginAction] Initiated.');
  const devLoginEnabledEnv = process.env.DEV_LOGIN_ENABLED;
  console.log(`[DevLoginAction] Raw DEV_LOGIN_ENABLED from env: "${devLoginEnabledEnv}"`);

  if (devLoginEnabledEnv !== "true") {
    console.warn(`[DevLoginAction] Attempted dev login, but DEV_LOGIN_ENABLED is not "true" (value: "${devLoginEnabledEnv}"). Action will not proceed.`);
    return { message: 'Login de desenvolvimento não está habilitado neste ambiente.', type: 'error' };
  }

  const devUserId = 'dev-button-admin-001';
  const devUsername = 'dev-button-admin'; // Using a distinct username for this specific dev button login
  console.log(`[DevLoginAction] DEV_LOGIN_ENABLED is "true". Creating mock session for ${devUsername}.`);

  try {
    // Ensure createSessionCookie is called correctly
    await createSessionCookie(devUserId, devUsername, true, true); // Mock admin, approved
    console.log(`[DevLoginAction] Mock session cookie created for ${devUsername}. Preparing success state.`);
    return { message: 'Login de desenvolvimento rápido bem-sucedido!', type: 'success', redirect: '/dashboard' };
  } catch (error: any) {
    console.error('[DevLoginAction] EXCEPTION during mock session creation:', error.message, error.stack);
    return { message: `Erro ao criar sessão de desenvolvimento rápida: ${error.message}`, type: 'error' };
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

  let connection: PoolConnection | undefined;
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
    const isApproved = isFirstUser; // First user is auto-approved

    const [result] = await connection.execute<ResultSetHeader>(
      'INSERT INTO users (username, password_hash, is_admin, is_approved, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
      [username, hashedPassword, isAdmin, isApproved]
    );
    console.log(`[RegisterAction] User insertion result: insertId ${result.insertId}`);

    if (!result.insertId) {
      await connection.rollback(); // Important to rollback before throwing
      console.error('[RegisterAction] Failed to insert user into database. insertId is 0. Check AUTO_INCREMENT on users.id.', result);
      return { message: 'Erro ao registrar usuário (DB Insert). Verifique se `id` é AUTO_INCREMENT. Tente novamente.', type: 'error' };
    }

    await connection.commit();
    console.log(`[RegisterAction] User ${username} registered successfully. ID: ${result.insertId}, isAdmin: ${isAdmin}, isApproved: ${isApproved}. Transaction committed.`);
    
    const devLoginEnabled = process.env.DEV_LOGIN_ENABLED === "true";

    if (isFirstUser && !devLoginEnabled) {
      console.log(`[RegisterAction] First user registered and DEV_LOGIN_ENABLED is not true. Creating session cookie for ${username}.`);
      try {
        await createSessionCookie(String(result.insertId), username, isAdmin, isApproved);
        return { message: 'Registro e login bem-sucedidos como administrador!', type: 'success', redirect: '/dashboard' };
      } catch (error: any) {
         console.error('[RegisterAction] Failed to create session for first user:', error.message);
         return { message: `Conta de administrador criada, mas houve um erro ao iniciar a sessão (${error.message}). Por favor, tente fazer login.`, type: 'error', redirect: '/login' };
      }
    } else if (isFirstUser && devLoginEnabled) {
       console.log(`[RegisterAction] First user registered in DEV_LOGIN_ENABLED mode. Redirecting to login for this new admin or dev user.`);
       return { message: 'Conta de administrador criada! Faça login com suas credenciais.', type: 'success', redirect: '/login' };
    } else {
      // Subsequent users are not auto-approved or auto-logged-in
      return { message: 'Registro bem-sucedido! Sua conta aguarda aprovação de um administrador.', type: 'success', redirect: '/login?status=pending_approval' };
    }
  } catch (error: any) {
    if (connection) {
      console.log('[RegisterAction] Error occurred, rolling back transaction.');
      await connection.rollback();
    }
    console.error('[RegisterAction] EXCEPTION during registration for user:', username);
    console.error('[RegisterAction] Error Details:', error.message, error.code, error.stack); // Log the full error
    let errorMessage = 'Ocorreu um erro inesperado durante o registro. Tente novamente.';
     if (error.code === 'ECONNREFUSED' || error.message?.includes('ECONNREFUSED')) {
        errorMessage = 'Falha na conexão com o banco de dados durante o registro.';
    } else if (error.message?.includes('Database error') || error.sqlMessage) { // Check for sqlMessage
        errorMessage = `Erro de banco de dados ao tentar registrar: ${error.sqlMessage || error.message}`;
    } else if (error.message?.includes('JWT_SECRET') || error.message?.includes('JWT key not initialized')) {
        errorMessage = 'Erro de configuração interna do servidor (JWT Reg). Contate o suporte.';
    }
    return { message: errorMessage, type: 'error' };
  } finally {
    if (connection) {
      connection.release();
      console.log('[RegisterAction] Database connection released.');
    }
  }
}

export async function logoutAction(): Promise<AuthActionState> {
  console.log('[LogoutAction] Initiated.');
  const cookieStore = cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (token) {
    cookieStore.delete(AUTH_COOKIE_NAME);
    console.log('[LogoutAction] Session cookie deleted.');
  } else {
    console.log('[LogoutAction] No session cookie found to delete.');
  }
  // For logout, a direct redirect is usually fine as client state doesn't need to react to a message.
  // However, to be consistent with AuthActionState, we return a redirect instruction.
  return { message: 'Você foi desconectado.', type: 'success', redirect: '/login?status=logged_out' };
}
