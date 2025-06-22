
// src/lib/email-service.ts
import nodemailer from 'nodemailer';
import type { OS } from './types';
import { OSStatus } from './types';
import { env } from '@/env.mjs';

interface EmailDetails {
  to: string;
  subject: string;
  text: string;
  html: string;
}

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: Number(env.SMTP_PORT || 587),
  secure: env.SMTP_SECURE === "true", // true for 465, false for other ports
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

export async function sendEmail(details: EmailDetails): Promise<void> {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    return; // Silently fail if SMTP is not configured
  }

  try {
    await transporter.sendMail({
      from: env.EMAIL_FROM || '"FreelaOS" <no-reply@example.com>',
      to: details.to,
      subject: details.subject,
      text: details.text,
      html: details.html,
    });
  } catch (error) {
    // Do not re-throw here to prevent breaking the main application flow
    // if email sending fails. The failure is logged.
  }
}

export async function sendOSApprovalEmail(
  partnerEmail: string,
  partnerName: string,
  os: OS,
  newStatus: OSStatus,
  adminName: string
): Promise<void> {
  let subject = '';
  let messageText = '';
  let messageHtml = '';

  const osLink = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:9002'}/os/${os.id}`;

  if (newStatus === OSStatus.NA_FILA) { // Approved
    subject = `OS #${os.numero} Aprovada - FreelaOS`;
    messageText = `Olá ${partnerName},\n\nSua Ordem de Serviço #${os.numero} ("${os.projeto}") foi APROVADA por ${adminName} e agora está na fila de produção.\n\nDetalhes da OS: ${osLink}\n\nAtenciosamente,\nEquipe FreelaOS`;
    messageHtml = `<p>Olá ${partnerName},</p><p>Sua Ordem de Serviço #${os.numero} ("${os.projeto}") foi <strong>APROVADA</strong> por ${adminName} e agora está na fila de produção.</p><p><a href="${osLink}">Ver OS #${os.numero}</a></p><p>Atenciosamente,<br/>Equipe FreelaOS</p>`;
  } else if (newStatus === OSStatus.RECUSADA) { // Refused
    subject = `OS #${os.numero} Recusada - FreelaOS`;
    messageText = `Olá ${partnerName},\n\nSua Ordem de Serviço #${os.numero} ("${os.projeto}") foi RECUSADA por ${adminName}.\n\nEntre em contato com o administrador para mais detalhes ou acesse a OS para verificar observações.\n\nDetalhes da OS: ${osLink}\n\nAtenciosamente,\nEquipe FreelaOS`;
    messageHtml = `<p>Olá ${partnerName},</p><p>Sua Ordem de Serviço #${os.numero} ("${os.projeto}") foi <strong>RECUSADA</strong> por ${adminName}.</p><p>Entre em contato com o administrador para mais detalhes ou acesse a OS para verificar observações.</p><p><a href="${osLink}">Ver OS #${os.numero}</a></p><p>Atenciosamente,<br/>Equipe FreelaOS</p>`;
  } else {
    return;
  }

  if (subject && partnerEmail) {
    await sendEmail({
      to: partnerEmail,
      subject,
      text: messageText,
      html: messageHtml,
    });
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
    const osLink = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:9002'}/os/${os.id}`;
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
