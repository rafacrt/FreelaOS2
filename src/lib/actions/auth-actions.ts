
'use server';

import { cookies } from 'next/headers';
import bcrypt from 'bcrypt';
import type { ResultSetHeader, RowDataPacket, PoolConnection } from 'mysql2/promise';
import db from '../db';
import { AUTH_COOKIE_NAME, SESSION_MAX_AGE } from '../constants';
import { encryptPayload } from '../auth-edge'; 
import { getUserByUsername, getPartnerByUsernameOrEmail } from '../auth'; 
import type { AuthActionState, User, PartnerSessionData, SessionPayload } from '../types';

// Updated to handle different session types
async function createSessionCookie(sessionData: SessionPayload) {
  console.log(`[AuthAction createSessionCookie] Attempting to create session for type: ${sessionData.sessionType}, User/Partner ID: ${sessionData.id}`);
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
    console.log('[AuthAction createSessionCookie] Cookie options:', cookieOptions);
    cookieStore.set(cookieOptions);
    console.log(`[AuthAction createSessionCookie] Session cookie SET for type: ${sessionData.sessionType}. Token (first 20 chars): ${token ? token.substring(0,20)+'...' : 'N/A'}`);
  } catch (error: any) {
    console.error('[AuthAction createSessionCookie] CRITICAL ERROR encrypting payload or setting cookie:', error);
    throw new Error('Falha ao criar cookie de sessão: ' + error.message);
  }
}

export async function loginAction(
  prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  console.log('[LoginAction Admin/Internal] Initiated.');
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  const devLoginEnabledEnv = process.env.DEV_LOGIN_ENABLED;
  const devUsernameEnv = process.env.DEV_USERNAME || "dev";
  const devPasswordEnv = process.env.DEV_PASSWORD || "dev";

  if (devLoginEnabledEnv === "true") {
    if (username === devUsernameEnv && password === devPasswordEnv) {
      console.log(`[LoginAction Admin/Internal] Dev credentials MATCH for user: ${devUsernameEnv}.`);
      try {
        const adminSession: SessionPayload = {
          sessionType: 'admin',
          id: 'dev-admin-001',
          username: devUsernameEnv,
          isAdmin: true,
          isApproved: true,
        };
        await createSessionCookie(adminSession);
        console.log(`[LoginAction Admin/Internal] Dev session cookie created for ${devUsernameEnv}.`);
        return { message: 'Login de desenvolvimento (admin) bem-sucedido!', type: 'success', redirect: '/dashboard' };
      } catch (error: any) {
        console.error('[LoginAction Admin/Internal] EXCEPTION during DEV login session creation:', error.message, error.stack);
        return { message: `Erro ao criar sessão de desenvolvimento (admin): ${error.message}`, type: 'error' };
      }
    } else {
      console.warn(`[LoginAction Admin/Internal] Dev login mode active, but DEV credentials did NOT match. Provided user: ${username}. Expected dev user: ${devUsernameEnv}.`);
      return { message: 'Credenciais de desenvolvimento (admin) inválidas.', type: 'error' };
    }
  }

  console.log(`[LoginAction Admin/Internal] Attempting DB login for user: ${username}`);
  if (!username || !password) {
    return { message: 'Usuário e senha são obrigatórios.', type: 'error' };
  }

  try {
    const user = await getUserByUsername(username);

    if (!user) {
      console.log(`[LoginAction Admin/Internal] User not found in DB: ${username}`);
      return { message: 'Credenciais inválidas ou usuário não encontrado.', type: 'error' };
    }

    if (!user.isApproved) {
      console.log(`[LoginAction Admin/Internal] User not approved: ${username}`);
      return { message: 'Sua conta ainda não foi aprovada por um administrador.', type: 'error' };
    }

    const passwordsMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordsMatch) {
      console.log(`[LoginAction Admin/Internal] Password mismatch for user: ${username}`);
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
    console.log(`[LoginAction Admin/Internal] DB Login successful for user: ${username}. Preparing success state.`);
    return { message: 'Login bem-sucedido!', type: 'success', redirect: '/dashboard' };

  } catch (error: any) {
    console.error('[LoginAction Admin/Internal] EXCEPTION during DB login process for user:', username, error);
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
  console.log('[PartnerLoginAction] Initiated.');
  const identifier = formData.get('identifier') as string; // Can be username or email
  const password = formData.get('password') as string;

  if (!identifier || !password) {
    return { message: 'Identificador (usuário/email) e senha são obrigatórios.', type: 'error' };
  }

  try {
    const partner = await getPartnerByUsernameOrEmail(identifier);

    if (!partner) {
      console.log(`[PartnerLoginAction] Partner not found in DB: ${identifier}`);
      return { message: 'Credenciais inválidas ou parceiro não encontrado.', type: 'error' };
    }

    if (!partner.isApproved) {
      console.log(`[PartnerLoginAction] Partner account not approved: ${partner.username}`);
      return { message: 'Sua conta de parceiro ainda não foi aprovada.', type: 'error' };
    }
    
    if (!partner.password_hash) {
        console.log(`[PartnerLoginAction] Partner account ${partner.username} does not have a password set.`);
        return { message: 'Conta de parceiro não configurada para login. Contate o administrador.', type: 'error' };
    }

    const passwordsMatch = await bcrypt.compare(password, partner.password_hash);
    if (!passwordsMatch) {
      console.log(`[PartnerLoginAction] Password mismatch for partner: ${partner.username}`);
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
    console.log(`[PartnerLoginAction] Partner login successful for: ${partner.username}. Redirecting to /partner/dashboard.`);
    return { message: 'Login de parceiro bem-sucedido!', type: 'success', redirect: '/partner/dashboard' };

  } catch (error: any) {
    console.error('[PartnerLoginAction] EXCEPTION during partner login process for:', identifier, error);
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
  console.log('[DevLoginAction] Initiated.');
  const devLoginEnabledEnv = process.env.DEV_LOGIN_ENABLED;
  console.log(`[DevLoginAction] Raw DEV_LOGIN_ENABLED from env: "${devLoginEnabledEnv}"`);

  if (devLoginEnabledEnv !== "true") {
    console.warn(`[DevLoginAction] Attempted dev login, but DEV_LOGIN_ENABLED is not "true".`);
    return { message: 'Login de desenvolvimento não está habilitado.', type: 'error' };
  }

  const adminSession: SessionPayload = {
    sessionType: 'admin',
    id: 'dev-button-admin-001',
    username: 'dev-button-admin',
    isAdmin: true,
    isApproved: true,
  };

  try {
    await createSessionCookie(adminSession);
    console.log(`[DevLoginAction] Mock admin session cookie created. Redirecting to /dashboard.`);
    return { message: 'Login de desenvolvimento rápido (admin) bem-sucedido!', type: 'success', redirect: '/dashboard' };
  } catch (error: any) {
    console.error('[DevLoginAction] EXCEPTION during mock admin session creation:', error.message, error.stack);
    return { message: `Erro ao criar sessão de desenvolvimento rápida (admin): ${error.message}`, type: 'error' };
  }
}


export async function registerUserAction(
  prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  console.log('[RegisterAction Admin/Internal] Initiated.');
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
         console.error('[RegisterAction Admin/Internal] Failed to create session for first user:', error.message);
         return { message: `Conta de administrador criada, mas erro ao iniciar sessão (${error.message}). Tente fazer login.`, type: 'error', redirect: '/login' };
      }
    } else if (isFirstUser && devLoginEnabled) {
       return { message: 'Conta de administrador criada! Faça login.', type: 'success', redirect: '/login' };
    } else {
      return { message: 'Registro bem-sucedido! Sua conta aguarda aprovação.', type: 'success', redirect: '/login?status=pending_approval' };
    }
  } catch (error: any) {
    if (connection) await connection.rollback();
    console.error('[RegisterAction Admin/Internal] EXCEPTION:', username, error);
    return { message: 'Erro inesperado durante o registro.', type: 'error' };
  } finally {
    if (connection) connection.release();
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
  return { message: 'Você foi desconectado.', type: 'success', redirect: '/login?status=logged_out' };
}
