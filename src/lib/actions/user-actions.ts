
'use server';

import { cookies } from 'next/headers';
import { getSessionFromToken, getUserById, getPartnerById } from '../auth';
import bcrypt from 'bcrypt';
import db from '../db';
import type { AuthActionState, SessionPayload } from '../types';
import type { ResultSetHeader } from 'mysql2/promise';

export async function changePasswordAction(
  prevState: AuthActionState | null,
  formData: FormData
): Promise<AuthActionState> {
  const currentPassword = formData.get('currentPassword') as string;
  const newPassword = formData.get('newPassword') as string;
  const confirmPassword = formData.get('confirmPassword') as string;

  // Basic validation
  if (!currentPassword || !newPassword || !confirmPassword) {
    return { message: 'Todos os campos são obrigatórios.', type: 'error' };
  }
  if (newPassword.length < 6) {
    return { message: 'A nova senha deve ter pelo menos 6 caracteres.', type: 'error' };
  }
  if (newPassword !== confirmPassword) {
    return { message: 'As novas senhas não coincidem.', type: 'error' };
  }

  // Get session
  const cookieStore = cookies();
  const tokenValue = cookieStore.get('freelaos_session_token')?.value;
  const session = await getSessionFromToken(tokenValue);

  if (!session) {
    return { message: 'Sessão inválida. Por favor, faça login novamente.', type: 'error' };
  }

  try {
    let userFromDb;
    if (session.sessionType === 'admin') {
      userFromDb = await getUserById(session.id);
    } else {
      userFromDb = await getPartnerById(session.id);
    }
    
    if (!userFromDb || !userFromDb.password_hash) {
      return { message: 'Usuário não encontrado ou não possui senha configurada.', type: 'error' };
    }

    const passwordsMatch = await bcrypt.compare(currentPassword, userFromDb.password_hash);
    if (!passwordsMatch) {
      return { message: 'A senha atual está incorreta.', type: 'error' };
    }

    const newHashedPassword = await bcrypt.hash(newPassword, 10);

    let tableName: string;
    if (session.sessionType === 'admin') {
        tableName = 'users';
    } else {
        tableName = 'partners';
    }
    
    const [result] = await db.execute<ResultSetHeader>(
      `UPDATE ${tableName} SET password_hash = ?, updated_at = NOW() WHERE id = ?`,
      [newHashedPassword, session.id]
    );

    if (result.affectedRows === 0) {
      throw new Error('Falha ao atualizar a senha no banco de dados.');
    }
    
    // It might be a good idea to log the user out of all other sessions,
    // but for now, just confirming the change is sufficient.
    return { message: 'Senha alterada com sucesso!', type: 'success' };

  } catch (error: any) {
    return { message: 'Ocorreu um erro inesperado. Tente novamente.', type: 'error' };
  }
}
