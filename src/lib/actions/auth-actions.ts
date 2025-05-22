
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
  // Ensure payload is serializable, Date object for expires in cookieStore.set is fine
  const sessionPayload = { userId, username, isAdmin, isApproved, expires: expires.toISOString() }; 
  const token = await encryptPayload(sessionPayload);

  cookieStore.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    expires, // Pass Date object here
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

  try {
    console.log(`[LoginAction] Attempting login for user: ${username}`);
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
    console.log(`[LoginAction] Login successful for user: ${username}. Redirecting to /dashboard.`);
  } catch (error: any) {
    console.error('[LoginAction] Error during login:', error);
    if (error.message?.includes('ECONNREFUSED')) {
        return { message: 'Erro ao conectar ao banco de dados. Tente novamente mais tarde.', type: 'error' as const};
    }
    if (error.message?.includes('Database error')) {
        return { message: 'Erro de banco de dados ao tentar fazer login.', type: 'error' as const };
    }
    return { message: 'Ocorreu um erro inesperado. Tente novamente.', type: 'error' as const };
  }
  redirect('/dashboard');
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

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    console.log(`[RegisterAction] Attempting registration for user: ${username}`);

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
    const isApproved = isFirstUser; // First user is admin and approved

    const [result] = await connection.execute<ResultSetHeader>(
      'INSERT INTO users (username, password_hash, is_admin, is_approved) VALUES (?, ?, ?, ?)',
      [username, hashedPassword, isAdmin, isApproved]
    );

    if (!result.insertId) {
      await connection.rollback();
      console.error('[RegisterAction] Failed to insert user into database.');
      return { message: 'Erro ao registrar usuário. Tente novamente.', type: 'error' as const };
    }

    await connection.commit();
    console.log(`[RegisterAction] User ${username} registered successfully. isFirstUser: ${isFirstUser}, isAdmin: ${isAdmin}, isApproved: ${isApproved}`);

    if (isFirstUser) {
      await createSessionCookie(String(result.insertId), username, isAdmin, isApproved);
      redirect('/dashboard'); 
    } else {
      redirect('/login?status=pending_approval');
    }
  } catch (error: any) {
    await connection.rollback();
    console.error('[RegisterAction] Error during registration:', error);
    if (error.message?.includes('ECONNREFUSED')) {
        return { message: 'Erro ao conectar ao banco de dados durante o registro.', type: 'error' as const};
    }
    if (error.message?.includes('Database error')) {
        return { message: 'Erro de banco de dados ao tentar registrar.', type: 'error' as const };
    }
    return { message: 'Ocorreu um erro inesperado durante o registro. Tente novamente.', type: 'error' as const };
  } finally {
    connection.release();
  }
}

export async function logoutAction() {
  const cookieStore = cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (token) {
    // Optional: blacklist the token on the server if you have such a mechanism
    cookieStore.delete(AUTH_COOKIE_NAME);
    console.log('[AuthAction logoutAction] Session cookie deleted.');
  } else {
    console.log('[AuthAction logoutAction] No session cookie found to delete.');
  }
  redirect('/login?status=logged_out');
}
