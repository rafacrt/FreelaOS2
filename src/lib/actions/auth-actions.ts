
'use server';

import { cookies } from 'next/headers';
import bcrypt from 'bcrypt';
import type { ResultSetHeader, RowDataPacket, PoolConnection } from 'mysql2/promise';
import db from '../db';
import { AUTH_COOKIE_NAME, SESSION_MAX_AGE } from '../constants';
import { encryptPayload } from '../auth-edge';
import { getUserByUsername, getPartnerByUsernameOrEmail } from '../auth';
import type { AuthActionState, User, PartnerSessionData, SessionPayload } from '../types';
import { redirect as nextRedirect } from 'next/navigation'; // Renomeado para evitar conflito de nome

// Updated to handle different session types
async function createSessionCookie(sessionData: SessionPayload) {
  const cookieStore = cookies();
  const expires = new Date(Date.now() + SESSION_MAX_AGE * 1000);

  // The sessionData itself is now the full payload including sessionType
  const sessionPayloadWithExpiry = { ...sessionData, expires: expires.toISOString() };

  try {
    const token = await encryptPayload(sessionPayloadWithExpiry as SessionPayload); // Cast because TS might not infer expires correctly here
    const cookieOptions = {
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      expires,
      path: '/',
      sameSite: 'lax' as 'lax' | 'strict' | 'none' | undefined,
    };
    cookieStore.set(cookieOptions);
  } catch (error: any) {
    throw new Error('Falha ao criar cookie de sessão: ' + error.message);
  }
}

export async function loginAction(
  prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  const devLoginEnabledEnv = process.env.DEV_LOGIN_ENABLED;
  const devUsernameEnv = process.env.DEV_USERNAME || "dev";
  const devPasswordEnv = process.env.DEV_PASSWORD || "dev";

  if (devLoginEnabledEnv === "true") {
    if (username === devUsernameEnv && password === devPasswordEnv) {
      try {
        const adminSession: SessionPayload = {
          sessionType: 'admin',
          id: 'dev-admin-001',
          username: devUsernameEnv,
          isAdmin: true,
          isApproved: true,
        };
        await createSessionCookie(adminSession);
        return { message: 'Login de desenvolvimento (admin) bem-sucedido!', type: 'success', redirect: '/dashboard' };
      } catch (error: any) {
        return { message: `Erro ao criar sessão de desenvolvimento (admin): ${error.message}`, type: 'error' };
      }
    } else {
    }
  }

  if (!username || !password) {
    return { message: 'Usuário e senha são obrigatórios.', type: 'error' };
  }

  try {
    const user = await getUserByUsername(username);

    if (!user) {
      return { message: 'Credenciais inválidas ou usuário não encontrado.', type: 'error' };
    }

    if (!user.isApproved) {
      return { message: 'Sua conta ainda não foi aprovada por um administrador.', type: 'error' };
    }

    const passwordsMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordsMatch) {
      return { message: 'Credenciais inválidas.', type: 'error' };
    }

    const adminSessionData: SessionPayload = {
        sessionType: 'admin',
        id: user.id,
        username: user.username,
        isAdmin: user.isAdmin,
        isApproved: user.isApproved,
    };
    await createSessionCookie(adminSessionData);
    return { message: 'Login bem-sucedido!', type: 'success', redirect: '/dashboard' };

  } catch (error: any) {
    let errorMessage = 'Ocorreu um erro inesperado durante o login. Tente novamente.';
    if (error.code === 'ECONNREFUSED' || error.message?.includes('ECONNREFUSED')) {
      errorMessage = 'Falha na conexão com o banco de dados.';
    } else if (error.message?.includes('Falha ao criar cookie de sessão')) {
      errorMessage = error.message;
    }
    return { message: errorMessage, type: 'error' };
  }
}

export async function partnerLoginAction(
  prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const identifier = formData.get('identifier') as string; // Can be username or email
  const password = formData.get('password') as string;

  if (!identifier || !password) {
    return { message: 'Identificador (usuário/email) e senha são obrigatórios.', type: 'error' };
  }

  try {
    const partner = await getPartnerByUsernameOrEmail(identifier);

    if (!partner) {
      return { message: 'Credenciais inválidas ou parceiro não encontrado.', type: 'error' };
    }

    if (!partner.isApproved) {
      return { message: 'Sua conta de parceiro ainda não foi aprovada.', type: 'error' };
    }

    if (!partner.password_hash) {
        return { message: 'Conta de parceiro não configurada para login. Contate o administrador.', type: 'error' };
    }

    const passwordsMatch = await bcrypt.compare(password, partner.password_hash);
    if (!passwordsMatch) {
      return { message: 'Credenciais inválidas.', type: 'error' };
    }

    const partnerSessionData: SessionPayload = {
        sessionType: 'partner',
        id: partner.id, // Partner's own ID from 'partners' table
        username: partner.username, // Partner's login username
        partnerName: partner.partnerName, // Actual name of the partner
        email: partner.email,
        isApproved: partner.isApproved,
    };
    await createSessionCookie(partnerSessionData);
    return { message: 'Login de parceiro bem-sucedido!', type: 'success', redirect: '/partner/dashboard' };

  } catch (error: any) {
    let errorMessage = 'Ocorreu um erro inesperado durante o login do parceiro. Tente novamente.';
     if (error.code === 'ECONNREFUSED' || error.message?.includes('ECONNREFUSED')) {
      errorMessage = 'Falha na conexão com o banco de dados.';
    } else if (error.message?.includes('Falha ao criar cookie de sessão')) {
      errorMessage = error.message;
    }
    return { message: errorMessage, type: 'error' };
  }
}


export async function devLoginAction(prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const devLoginEnabledEnv = process.env.DEV_LOGIN_ENABLED;

  if (devLoginEnabledEnv !== "true" && process.env.NODE_ENV !== 'development') { // Allow in dev even if not explicitly "true" for easier local dev
    // return { message: 'Login de desenvolvimento não está habilitado neste ambiente.', type: 'error' };
  }

  const adminSession: SessionPayload = {
    sessionType: 'admin',
    id: 'dev-admin-001', // Using a fixed ID for dev admin
    username: 'Dev Admin (Botão)',
    isAdmin: true,
    isApproved: true,
  };

  try {
    await createSessionCookie(adminSession);
    // Using Next.js redirect function. It works by throwing an error that Next.js catches.
    // Ensure this action is called from a Server Component or a form action handler.
    nextRedirect('/dashboard');
  } catch (error: any) {
    if (error.message === 'NEXT_REDIRECT') { // This is expected if redirect() is called
        throw error;
    }
    return { message: `Erro ao criar sessão de desenvolvimento (admin): ${error.message}`, type: 'error' };
  }
}

export async function simulatePartnerLoginAction(
  prevState: AuthActionState,
  formData: FormData // formData won't be used but is part of the action signature
): Promise<AuthActionState> {

  const partnerSession: SessionPayload = {
    sessionType: 'partner',
    id: '99901', // Mock partner's ID - Changed to a numeric string
    username: 'sim_partner_user', // Mock partner's login username
    partnerName: 'Parceiro Simulado Inc.', // Mock partner name
    email: 'sim.partner@example.com',
    isApproved: true, // Partner is approved
  };

  try {
    await createSessionCookie(partnerSession);
    nextRedirect('/partner/dashboard');
  } catch (error: any) { 
    if (error.message === 'NEXT_REDIRECT') { 
        throw error;
    }
    return { message: `Erro ao criar sessão de parceiro simulada: ${error.message}`, type: 'error' };
  }
}


export async function registerUserAction(
  prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
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
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [existingUsers] = await connection.query<RowDataPacket[]>(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );
    if (existingUsers.length > 0) {
      await connection.rollback();
      return { message: 'Este nome de usuário já está em uso.', type: 'error' };
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [allUsersCountResult] = await connection.query<RowDataPacket[]>('SELECT COUNT(*) as count FROM users');
    const isFirstUser = allUsersCountResult[0].count === 0;
    const isAdmin = isFirstUser;
    const isApproved = isFirstUser;

    const [result] = await connection.execute<ResultSetHeader>(
      'INSERT INTO users (username, password_hash, is_admin, is_approved, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
      [username, hashedPassword, isAdmin, isApproved]
    );

    if (!result.insertId) {
      await connection.rollback();
      return { message: 'Erro ao registrar usuário (DB Insert).', type: 'error' };
    }
    await connection.commit();

    const devLoginEnabled = process.env.DEV_LOGIN_ENABLED === "true";

    if (isFirstUser && !devLoginEnabled) {
      try {
        const adminSession: SessionPayload = {
          sessionType: 'admin',
          id: String(result.insertId),
          username: username,
          isAdmin: isAdmin,
          isApproved: isApproved,
        };
        await createSessionCookie(adminSession);
        return { message: 'Registro e login bem-sucedidos como administrador!', type: 'success', redirect: '/dashboard' };
      } catch (error: any) {
         return { message: `Conta de administrador criada, mas erro ao iniciar sessão (${error.message}). Tente fazer login.`, type: 'error', redirect: '/login' };
      }
    } else if (isFirstUser && devLoginEnabled) {
       return { message: 'Conta de administrador criada! Faça login.', type: 'success', redirect: '/login' };
    } else {
      return { message: 'Registro bem-sucedido! Sua conta aguarda aprovação.', type: 'success', redirect: '/login?status=pending_approval' };
    }
  } catch (error: any) {
    if (connection) await connection.rollback();
    return { message: 'Erro inesperado durante o registro.', type: 'error' };
  } finally {
    if (connection) connection.release();
  }
}

export async function logoutAction(): Promise<AuthActionState> {
  const cookieStore = cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (token) {
    cookieStore.delete(AUTH_COOKIE_NAME);
  } else {
  }
  // Determine redirect based on previous path or a default
  // For simplicity, always redirect to login after admin logout.
  // Partner logout might redirect to /partner-login?status=logged_out if we differentiate.
  // For now, a generic /login?status=logged_out is fine.
  return { message: 'Você foi desconectado.', type: 'success', redirect: '/login?status=logged_out' };
}
    
