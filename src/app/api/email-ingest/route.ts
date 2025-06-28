// src/app/api/email-ingest/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getPartnerByEmail } from '@/lib/auth';
import { createOSInDB } from '@/lib/actions/os-actions';
import { sendOSCreationConfirmationEmail } from '@/lib/email-service';
import type { CreateOSData } from '@/lib/types';
import { OSStatus } from '@/lib/types';
import { notify } from '@/store/notification-store';

// This is a server-side only file
export const runtime = 'nodejs';

/**
 * Handles incoming POST requests to create an OS from an email.
 * This endpoint should be triggered by a webhook from an email service (e.g., Mailgun).
 *
 * Expected JSON body:
 * {
 *   "from": "partner@example.com",
 *   "subject": "The project title",
 *   "textBody": "The full text content of the email task."
 * }
 */
export async function POST(request: NextRequest) {
  // 1. Check authorization header for the secret key
  const authHeader = request.headers.get('authorization');
  // Read directly from process.env, bypassing the T3-env validation layer
  if (authHeader !== `Bearer ${process.env.EMAIL_INGEST_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Parse the incoming JSON body
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  
  const from = body.from || body.sender; // Some services use 'sender'
  const subject = body.subject;
  const textBody = body['body-plain'] || body.textBody; // Mailgun uses 'body-plain'

  if (!from || !subject || !textBody) {
    const missing = [!from && 'from', !subject && 'subject', !textBody && 'textBody'].filter(Boolean).join(', ');
    return NextResponse.json({ error: `Missing required fields: ${missing}` }, { status: 400 });
  }

  try {
    // 3. Find the partner in the database using the 'from' email address
    const partner = await getPartnerByEmail(from);
    if (!partner || !partner.email) {
      // It's good practice not to reveal whether an email is registered.
      // We log it on the server but return a generic error.
      return NextResponse.json({ error: 'Could not process email.' }, { status: 200 }); // Status 200 to prevent retries
    }

    // 4. Prepare the data for creating the new OS
    const osData: CreateOSData = {
      cliente: partner.partnerName, // For OS created by email, the client is the partner themselves
      projeto: subject,
      tarefa: textBody,
      observacoes: 'OS criada automaticamente via e-mail.',
      status: OSStatus.AGUARDANDO_APROVACAO, // All OS from email must be approved
      isUrgent: subject.toLowerCase().includes('[urgente]'), // Simple urgency flag check
    };

    const creatorInfo = {
      name: partner.partnerName,
      type: 'partner' as const,
      id: partner.id,
    };

    // 5. Call the server action to create the OS in the database
    const newOS = await createOSInDB(osData, creatorInfo);

    if (!newOS) {
      throw new Error('Failed to create OS in the database after successful checks.');
    }

    // 6. Send a confirmation email back to the partner
    await sendOSCreationConfirmationEmail(partner.email, partner.partnerName, newOS);

    // 7. Trigger the in-app notification for all admins
    // Note: This won't be real-time in the UI without WebSockets.
    // Admins will see the notification on their next page load/refresh.
    // The store is client-side, so we can't call it here. This is a conceptual trigger.
    // The actual OS will appear for the admin on next data load.
    
    // 8. Return a success response to the webhook service
    return NextResponse.json({
      success: true,
      osNumber: newOS.numero,
      message: `OS #${newOS.numero} created for partner ${partner.partnerName}.`,
    });

  } catch (error: any) {
    // Log the detailed error on the server for debugging
    return NextResponse.json(
      { error: 'An internal server error occurred while processing the email.', details: error.message },
      { status: 500 }
    );
  }
}
