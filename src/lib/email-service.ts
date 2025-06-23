// src/lib/email-service.ts
import nodemailer from 'nodemailer';
import type { OS } from './types';
import { OSStatus } from './types';
import { env } from '@/env.mjs';

// Configuration attempting to match the successful openssl connection as closely as possible.
const smtpConfig = {
  host: env.SMTP_HOST,
  port: Number(env.SMTP_PORT || 465),
  secure: env.SMTP_SECURE === "true", // `secure:true` is required for port 465
  // Explicitly set the client hostname from the server's greeting banner.
  name: 'vps-12913574.rajo.com.br',
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
  // Set explicit timeouts (in milliseconds)
  connectionTimeout: 30000,
  greetingTimeout: 30000,
  socketTimeout: 30000,
  tls: {
    // Explicitly set the servername for SNI to match the host
    servername: env.SMTP_HOST,
    rejectUnauthorized: false,
    // Force a modern TLS version, in case the server has issues with negotiation
    minVersion: 'TLSv1.2',
    // **KEY CHANGE**: Force the cipher suite reported by the successful openssl test
    ciphers: 'TLS_AES_256_GCM_SHA384',
  },
  // Add Nodemailer's own debug logging
  debug: true,
  logger: true,
  // Force IPv4 to resolve potential network stack issues
  dns: {
      family: 4
  }
};

// Log the configuration being used (masking the password) for easier debugging
const loggableConfig = {
    ...smtpConfig,
    auth: {
        user: smtpConfig.auth.user,
        pass: smtpConfig.auth.pass ? '********' : '(not set)'
    },
    tls: { ...smtpConfig.tls },
    dns: { ...smtpConfig.dns }
};
console.log('[Email Service] Initializing with SMTP config:', loggableConfig);

const transporter = nodemailer.createTransport(smtpConfig);

export async function sendEmail(details: { to: string; subject: string; text: string; html: string; }): Promise<void> {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    console.warn('[Email Service] SMTP environment variables not configured. Email sending is disabled.');
    return;
  }

  try {
    console.log(`[Email Service] Attempting to send email to: ${details.to} with subject: "${details.subject}"`);
    const info = await transporter.sendMail({
      from: env.EMAIL_FROM || '"FreelaOS" <no-reply@yourdomain.com>',
      to: details.to,
      subject: details.subject,
      text: details.text,
      html: details.html,
    });
    console.log(`[Email Service] Email sent successfully! Message ID: ${info.messageId}`);
    // Log the server response upon successful connection and authentication
    if (info.response) {
      console.log(`[Email Service] Server response: ${info.response}`);
    }
  } catch (error) {
    // Log the full error object for maximum detail
    console.error('[Email Service] Failed to send email.', error);
    // Do not re-throw here to prevent breaking the main application flow
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

export async function sendOSCreationConfirmationEmail(
  partnerEmail: string,
  partnerName: string,
  os: OS
): Promise<void> {
  const osLink = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:9002'}/os/${os.id}`;
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
  const osLink = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:9002'}/os/${os.id}`;
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
