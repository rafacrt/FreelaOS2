
'use server';

import { cookies } from 'next/headers';
import bcrypt from 'bcrypt';
import type { ResultSetHeader, RowDataPacket, PoolConnection } from 'mysql2/promise';
import db from '../db';
import { AUTH_COOKIE_NAME, SESSION_MAX_AGE } from '../constants';
import { encryptPayload } from '../auth-edge';
import { getUserByUsername, getPartnerByUsernameOrEmail } from '../auth';
import type { AuthActionState, User, PartnerSessionData, SessionPayload } from '../types';
import { redirect as nextRedirect } from 'next/navigation'; 
import { ensureSimulatedPartnerExists } from './partner-actions'; 

async function createSessionCookie(sessionData: SessionPayload) {
  const cookieStore = cookies();
  const expires = new Date(Date.now() + SESSION_MAX_AGE * 1000);
  const sessionPayloadWithExpiry = { ...sessionData, expires: expires.toISOString() };

  try {
    const token = await encryptPayload(sessionPayloadWithExpiry as SessionPayload); 
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
  const identifier = formData.get('identifier') as string; 
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
        id: partner.id, 
        username: partner.username, 
        partnerName: partner.partnerName, 
        email: partner.email, // Include email in session
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
  const adminSession: SessionPayload = {
    sessionType: 'admin',
    id: 'dev-admin-001', 
    username: 'Dev Admin',
    isAdmin: true,
    isApproved: true,
  };

  try {
    await createSessionCookie(adminSession);
    nextRedirect('/dashboard');
  } catch (error: any) { 
    if (error.message === 'NEXT_REDIRECT') { 
        throw error;
    }
    return { message: `Erro ao criar sessão de desenvolvimento (admin): ${error.message}`, type: 'error' };
  }
}

export async function simulatePartnerLoginAction(
  prevState: AuthActionState,
  formData: FormData 
): Promise<AuthActionState> {
  try {
    // Cria uma sessão de parceiro fictícia sem consultar o banco de dados.
    const simulatedPartnerSession: SessionPayload = {
      sessionType: 'partner',
      id: 'dev-partner-001', 
      username: 'dev_partner_user', 
      partnerName: 'Parceiro de Desenvolvimento',
      email: 'dev.partner@example.com',
      isApproved: true, 
    };

    await createSessionCookie(simulatedPartnerSession);
    nextRedirect('/partner/dashboard');
  } catch (error: any) { 
    if (error.message === 'NEXT_REDIRECT') { 
        throw error;
    }
    // Melhorando o log de erro
    console.error('[simulatePartnerLoginAction] Erro:', error);
    return { message: `Erro ao simular login de parceiro: ${error.message}`, type: 'error' };
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

    if (isFirstUser) {
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
  } 
  return { message: 'Você foi desconectado.', type: 'success', redirect: '/login?status=logged_out' };
}
