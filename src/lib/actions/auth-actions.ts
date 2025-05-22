
'use server';

import { redirect } from 'next/navigation';
import { createSession, getUserByUsername } from '../auth';
import bcrypt from 'bcrypt';
import db from '../db';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

export async function loginAction(prevState: any, formData: FormData) {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  if (!username || !password) {
    return { message: 'Usuário e senha são obrigatórios.', type: 'error' };
  }

  try {
    console.log(`[LoginAction] Attempting login for user: ${username}`);
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

    await createSession(user.id, user.username, user.isAdmin, user.isApproved);
    console.log(`[LoginAction] Login successful for user: ${username}. Redirecting to /dashboard.`);
  } catch (error: any) {
    console.error('[LoginAction] Error during login:', error);
    if (error.message?.includes('ECONNREFUSED')) {
        return { message: 'Erro ao conectar ao banco de dados. Tente novamente mais tarde.', type: 'error'};
    }
    return { message: 'Ocorreu um erro inesperado. Tente novamente.', type: 'error' };
  }
  redirect('/dashboard');
}


export async function registerUserAction(prevState: any, formData: FormData) {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  if (!username || !password) {
    return { message: 'Usuário e senha são obrigatórios.', type: 'error' };
  }
  if (password.length < 6) {
    return { message: 'A senha deve ter pelo menos 6 caracteres.', type: 'error' };
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
      return { message: 'Este nome de usuário já está em uso.', type: 'error' };
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Check if this is the first user
    const [allUsersCountResult] = await connection.query<RowDataPacket[]>(
        'SELECT COUNT(*) as count FROM users'
    );
    const isFirstUser = allUsersCountResult[0].count === 0;

    const isAdmin = isFirstUser;
    const isApproved = isFirstUser; // First user is automatically admin and approved

    const [result] = await connection.execute<ResultSetHeader>(
      'INSERT INTO users (username, password_hash, is_admin, is_approved) VALUES (?, ?, ?, ?)',
      [username, hashedPassword, isAdmin, isApproved]
    );

    if (!result.insertId) {
      await connection.rollback();
      console.error('[RegisterAction] Failed to insert user into database.');
      return { message: 'Erro ao registrar usuário. Tente novamente.', type: 'error' };
    }
    
    await connection.commit();
    console.log(`[RegisterAction] User ${username} registered successfully. isFirstUser: ${isFirstUser}, isAdmin: ${isAdmin}, isApproved: ${isApproved}`);
    
    if (isFirstUser) {
        // Automatically log in the first user (admin)
        await createSession(String(result.insertId), username, isAdmin, isApproved);
        redirect('/dashboard');
        // return { message: 'Registro bem-sucedido! Você foi logado automaticamente como administrador.', type: 'success', redirect: '/dashboard' };
    } else {
        return { message: 'Registro bem-sucedido! Sua conta aguarda aprovação de um administrador.', type: 'success', redirect: '/login?status=pending_approval' };
    }

  } catch (error: any) {
    await connection.rollback();
    console.error('[RegisterAction] Error during registration:', error);
    return { message: 'Ocorreu um erro inesperado durante o registro. Tente novamente.', type: 'error' };
  } finally {
    connection.release();
  }
}

export async function logoutAction() {
  const cookieStore = (await import('next/headers')).cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
  redirect('/login');
}
