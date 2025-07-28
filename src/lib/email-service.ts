// src/lib/email-service.ts
import { Resend } from 'resend';
import type { OS } from './types';
import { OSStatus } from './types';
import { env } from '@/env.mjs';

const resend = new Resend(env.RESEND_API_KEY);


export async function sendEmail(details: { to: string; subject: string; text: string; html: string; }): Promise<void> {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    // console.warn('[Email Service] Resend API Key or Email From address not configured. Email sending is disabled.');
    return;
  }

  try {
    // console.log(`[Email Service] Attempting to send email via Resend to: ${details.to} with subject: "${details.subject}"`);
    const { data, error } = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: details.to,
      subject: details.subject,
      text: details.text,
      html: details.html,
    });

    if (error) {
      // console.error('[Email Service] Failed to send email via Resend.', error);
      // We don't re-throw here to prevent breaking the main application flow
      return;
    }

    // console.log(`[Email Service] Email sent successfully via Resend! Message ID: ${data?.id}`);
  } catch (error) {
    // console.error('[Email Service] An unexpected exception occurred while sending email.', error);
  }
}

export async function sendGeneralStatusUpdateEmail(
  partnerEmail: string,
  partnerName: string,
  os: OS,
  oldStatus: OSStatus,
  newStatus: OSStatus,
  adminName: string
): Promise<void> {
    const osLink = `${process.env.NEXT_PUBLIC_BASE_URL}/os/${os.id}`;
    const subject = `Atualização na OS #${os.numero}: ${newStatus}`;
    const messageText = `Olá ${partnerName},\n\nO status da Ordem de Serviço #${os.numero} ("${os.projeto}") foi alterado de "${oldStatus}" para "${newStatus}" por ${adminName}.\n\nDetalhes da OS: ${osLink}\n\nAtenciosamente,\nEquipe FreelaOS`;
    const messageHtml = `<p>Olá ${partnerName},</p><p>O status da Ordem de Serviço #${os.numero} ("${os.projeto}") foi alterado de "<strong>${oldStatus}</strong>" para "<strong>${newStatus}</strong>" por ${adminName}.</p><p><a href="${osLink}">Ver OS #${os.numero}</a></p><p>Atenciosamente,<br/>Equipe FreelaOS</p>`;

    await sendEmail({
        to: partnerEmail,
        subject,
        text: messageText,
        html: messageHtml,
    });
}

export async function sendOSCreationConfirmationEmail(
  partnerEmail: string,
  partnerName: string,
  os: OS
): Promise<void> {
  const osLink = `${process.env.NEXT_PUBLIC_BASE_URL}/os/${os.id}`;
  const subject = `OS #${os.numero} Recebida - FreelaOS`;
  const messageText = `Olá ${partnerName},\n\nSua solicitação de Ordem de Serviço foi recebida com sucesso e registrada com o número #${os.numero}.\n\nProjeto: ${os.projeto}\n\nEla está agora aguardando aprovação de um administrador. Você será notificado sobre qualquer atualização.\n\nDetalhes da OS: ${osLink}\n\nAtenciosamente,\nEquipe FreelaOS`;
  const messageHtml = `
    <p>Olá ${partnerName},</p>
    <p>Sua solicitação de Ordem de Serviço foi recebida com sucesso e registrada com o número <strong>#${os.numero}</strong>.</p>
    <p><strong>Projeto:</strong> ${os.projeto}</p>
    <p>Ela está agora aguardando aprovação de um administrador. Você será notificado sobre qualquer atualização.</p>
    <p><a href="${osLink}">Ver OS #${os.numero}</a></p>
    <p>Atenciosamente,<br/>Equipe FreelaOS</p>
  `;

  await sendEmail({
    to: partnerEmail,
    subject,
    text: messageText,
    html: messageHtml,
  });
}

export async function sendOSApprovalEmail(
  partnerEmail: string, 
  partnerName: string, 
  os: OS,
  newStatus: OSStatus.NA_FILA | OSStatus.RECUSADA,
  adminName: string
): Promise<void> {
  const osLink = `${process.env.NEXT_PUBLIC_BASE_URL}/os/${os.id}`;
  const approvalStatus = newStatus === OSStatus.NA_FILA ? 'APROVADA' : 'RECUSADA';
  const subject = `Sua OS #${os.numero} foi ${approvalStatus}`;
  const messageText = `Olá ${partnerName},\n\nSua Ordem de Serviço #${os.numero} ("${os.projeto}") foi ${approvalStatus} por ${adminName}.\n\nDetalhes da OS: ${osLink}\n\nAtenciosamente,\nEquipe FreelaOS`;
  const messageHtml = `<p>Olá ${partnerName},</p><p>Sua Ordem de Serviço #${os.numero} ("${os.projeto}") foi <strong>${approvalStatus}</strong> por ${adminName}.</p><p><a href="${osLink}">Ver OS #${os.numero}</a></p><p>Atenciosamente,<br/>Equipe FreelaOS</p>`;

  await sendEmail({
    to: partnerEmail,
    subject,
    text: messageText,
    html: messageHtml,
  });
}
