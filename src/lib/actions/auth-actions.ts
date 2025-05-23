
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
    // It's hard to return this to the form, as the cookie setting itself failed.
    // The form might show a generic "Error reaching server".
    throw error; // Re-throw for now, server will crash action.
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

  console.log(`[LoginAction] Attempting login for user: ${username}`);
  try {
    const user = await getUserByUsername(username);

    if (!user) {
      console.log(`[LoginAction] User not found: ${username}`);
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
    console.log(`[LoginAction] Login successful for user: ${username}. Preparing success state.`);
    
    // Instead of redirecting here, return state for client to handle redirect
    return { message: 'Login bem-sucedido!', type: 'success', redirect: '/dashboard' };

  } catch (error: any) {
    console.error('[LoginAction] EXCEPTION during login process for user:', username, 'Error:', error);
    let errorMessage = 'Ocorreu um erro inesperado durante o login. Tente novamente.';
    if (error.code === 'ECONNREFUSED' || error.message?.includes('ECONNREFUSED') || error.message?.includes('connect ETIMEDOUT')) {
      errorMessage = 'Erro de conexão com o banco de dados. O servidor de banco de dados está acessível?';
    } else if (error.message?.includes('Database error')) {
      errorMessage = 'Erro de banco de dados ao tentar fazer login.';
    } else if (error.message?.includes('JWT_SECRET')) {
      errorMessage = 'Erro de configuração interna do servidor (JWT). Contate o suporte.';
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

    if (isFirstUser) {
      console.log(`[RegisterAction] First user detected. Creating session cookie for ${username}.`);
      await createSessionCookie(String(result.insertId), username, isAdmin, isApproved);
      return { message: 'Registro e login bem-sucedidos como administrador!', type: 'success', redirect: '/dashboard' };
    } else {
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
  // Redirection will be handled by middleware or client-side logic after page reload
  redirect('/login?status=logged_out');
}
