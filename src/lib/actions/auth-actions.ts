
'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { AUTH_COOKIE_NAME, SESSION_MAX_AGE } from '../constants';
import { encryptPayload } from '../auth-edge'; // Use from auth-edge for JWT creation
import { getUserByUsername } from '../auth'; // DB access remains in the main auth.ts
import bcrypt from 'bcrypt';
import db from '../db';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

async function createSessionCookie(userId: string, username: string, isAdmin: boolean, isApproved: boolean) {
  const cookieStore = cookies();
  const expires = new Date(Date.now() + SESSION_MAX_AGE * 1000);
  const sessionPayload = { userId, username, isAdmin, isApproved, expires: expires.toISOString() }; 
  const token = await encryptPayload(sessionPayload);

  cookieStore.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    expires,
    path: '/',
    sameSite: 'lax',
  });
  console.log(`[AuthAction createSessionCookie] Session cookie set for user: ${username}`);
}

export async function loginAction(prevState: any, formData: FormData) {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  if (!username || !password) {
    return { message: 'Usuário e senha são obrigatórios.', type: 'error' as const };
  }

  console.log(`[LoginAction] Attempting login for user: ${username}`);
  try {
    const user = await getUserByUsername(username);

    if (!user) {
      console.log(`[LoginAction] User not found: ${username}`);
      return { message: 'Credenciais inválidas.', type: 'error' as const };
    }

    if (!user.isApproved) {
      console.log(`[LoginAction] User not approved: ${username}`);
      return { message: 'Sua conta ainda não foi aprovada por um administrador.', type: 'error' as const };
    }

    const passwordsMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordsMatch) {
      console.log(`[LoginAction] Password mismatch for user: ${username}`);
      return { message: 'Credenciais inválidas.', type: 'error' as const };
    }

    await createSessionCookie(user.id, user.username, user.isAdmin, user.isApproved);
    console.log(`[LoginAction] Login successful for user: ${username}.`);
    // Do not redirect here directly; return a state that indicates success for the client to handle.
    // The form's useEffect will handle redirection.
    return { message: 'Login bem-sucedido!', type: 'success' as const, redirect: '/dashboard' };

  } catch (error: any) {
    console.error('[LoginAction] Critical error during login process for user:', username, error);
    let errorMessage = 'Ocorreu um erro inesperado durante o login. Tente novamente.';
    if (error.message?.includes('ECONNREFUSED') || error.message?.includes('connect ETIMEDOUT')) {
        errorMessage = 'Erro de conexão com o banco de dados. O servidor de banco de dados está acessível?';
    } else if (error.message?.includes('Database error')) {
        errorMessage = 'Erro de banco de dados ao tentar fazer login.';
    }
    return { message: errorMessage, type: 'error' as const };
  }
  // This line should not be reached if returning state above, but as a fallback:
  // redirect('/dashboard'); 
}

export async function registerUserAction(prevState: any, formData: FormData) {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  if (!username || !password) {
    return { message: 'Usuário e senha são obrigatórios.', type: 'error' as const };
  }
  if (password.length < 6) {
    return { message: 'A senha deve ter pelo menos 6 caracteres.', type: 'error' as const };
  }

  let connection;
  try {
    console.log(`[RegisterAction] Attempting registration for user: ${username}`);
    connection = await db.getConnection();
    await connection.beginTransaction();
    

    const [existingUsers] = await connection.query<RowDataPacket[]>(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );
    if (existingUsers.length > 0) {
      await connection.rollback();
      console.log(`[RegisterAction] Username already exists: ${username}`);
      return { message: 'Este nome de usuário já está em uso.', type: 'error' as const };
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const [allUsersCountResult] = await connection.query<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM users'
    );
    const isFirstUser = allUsersCountResult[0].count === 0;

    const isAdmin = isFirstUser;
    const isApproved = isFirstUser;

    const [result] = await connection.execute<ResultSetHeader>(
      'INSERT INTO users (username, password_hash, is_admin, is_approved, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
      [username, hashedPassword, isAdmin, isApproved]
    );

    if (!result.insertId) {
      await connection.rollback();
      console.error('[RegisterAction] Failed to insert user into database. insertId is 0. Check AUTO_INCREMENT on users.id.');
      return { message: 'Erro ao registrar usuário. Tente novamente.', type: 'error' as const };
    }

    await connection.commit();
    console.log(`[RegisterAction] User ${username} registered successfully. ID: ${result.insertId}, isFirstUser: ${isFirstUser}, isAdmin: ${isAdmin}, isApproved: ${isApproved}`);

    if (isFirstUser) {
      // Automatically log in the first user
      await createSessionCookie(String(result.insertId), username, isAdmin, isApproved);
      return { message: 'Registro e login bem-sucedidos como administrador!', type: 'success' as const, redirect: '/dashboard' };
    } else {
      return { message: 'Registro bem-sucedido! Sua conta aguarda aprovação de um administrador.', type: 'success' as const, redirect: '/login?status=pending_approval' };
    }
  } catch (error: any) {
    if (connection) await connection.rollback();
    console.error('[RegisterAction] Critical error during registration for user:', username, error);
    let errorMessage = 'Ocorreu um erro inesperado durante o registro. Tente novamente.';
     if (error.message?.includes('ECONNREFUSED') || error.message?.includes('connect ETIMEDOUT')) {
        errorMessage = 'Erro de conexão com o banco de dados durante o registro.';
    } else if (error.message?.includes('Database error')) {
        errorMessage = 'Erro de banco de dados ao tentar registrar.';
    }
    return { message: errorMessage, type: 'error' as const };
  } finally {
    if (connection) connection.release();
  }
}

export async function logoutAction() {
  const cookieStore = cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (token) {
    cookieStore.delete(AUTH_COOKIE_NAME);
    console.log('[AuthAction logoutAction] Session cookie deleted.');
  } else {
    console.log('[AuthAction logoutAction] No session cookie found to delete.');
  }
  redirect('/login?status=logged_out');
}
