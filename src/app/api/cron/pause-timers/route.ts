
// src/app/api/cron/pause-timers/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import db from '@/lib/db';
import type { RowDataPacket } from 'mysql2/promise';
import { toggleOSProductionTimerInDB } from '@/lib/actions/os-actions';

// This is a server-side only file, meant to be called by a cron job service.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // Ensure it runs dynamically every time

export async function GET(request: NextRequest) {
  // 1. Check if the CRON_SECRET is configured on the server by reading directly from the process environment
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: 'Internal Server Configuration Error', message: 'The CRON_SECRET is not set on the server.' },
      { status: 500 }
    );
  }
  
  // 2. Check authorization header for the secret key
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 3. Get current time in São Paulo timezone
    const now = new Date();
    // Use toLocaleString to get the hour in the correct timezone, regardless of server location
    const saoPauloHour = parseInt(
      now.toLocaleString('en-US', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        hour12: false,
      }),
      10
    );

    // 4. Check if it's outside working hours (before 8 AM or 11 PM or later)
    const isOutsideWorkingHours = saoPauloHour < 8 || saoPauloHour >= 23;

    if (!isOutsideWorkingHours) {
      return NextResponse.json({
        message: 'Within working hours. No timers paused.',
        checked_at: now.toISOString(),
        sao_paulo_hour: saoPauloHour,
      });
    }

    // 5. If outside working hours, find all OS with active timers
    const connection = await db.getConnection();
    const [activeOSRows] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM os_table WHERE status = 'Em Produção' AND dataInicioProducaoAtual IS NOT NULL"
    );
    connection.release();

    if (activeOSRows.length === 0) {
      return NextResponse.json({
        message: 'Outside working hours, but no active timers found.',
        checked_at: now.toISOString(),
        sao_paulo_hour: saoPauloHour,
      });
    }

    // 6. Pause each active timer
    const pausedOSIds: string[] = [];
    for (const row of activeOSRows) {
      const osId = String(row.id);
      // We call the existing server action to ensure all logic (time calculation, status change) is handled correctly.
      const result = await toggleOSProductionTimerInDB(osId, 'pause');
      if (result) {
        pausedOSIds.push(osId);
      }
    }

    // 7. Return a success response
    return NextResponse.json({
      success: true,
      message: `Outside working hours. Paused ${pausedOSIds.length} timers.`,
      paused_count: pausedOSIds.length,
      paused_ids: pausedOSIds,
      checked_at: now.toISOString(),
      sao_paulo_hour: saoPauloHour,
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: 'An internal server error occurred.', details: error.message },
      { status: 500 }
    );
  }
}
