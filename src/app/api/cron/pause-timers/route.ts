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
    // A responsabilidade de verificar o horário agora é do serviço de cron job externo.
    // Esta API irá pausar todos os timers ativos sempre que for chamada.

    // 1. Find all OS with active timers
    const connection = await db.getConnection();
    const [activeOSRows] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM os_table WHERE status = 'Em Produção' AND dataInicioProducaoAtual IS NOT NULL"
    );
    connection.release();

    if (activeOSRows.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active production timers found to pause.',
        paused_count: 0,
        checked_at: new Date().toISOString(),
      });
    }

    // 2. Pause each active timer
    const pausedOSIds: string[] = [];
    for (const row of activeOSRows) {
      const osId = String(row.id);
      // We call the existing server action to ensure all logic (time calculation, status change) is handled correctly.
      const result = await toggleOSProductionTimerInDB(osId, 'pause');
      if (result) {
        pausedOSIds.push(osId);
      }
    }

    // 3. Return a success response
    return NextResponse.json({
      success: true,
      message: `Successfully paused ${pausedOSIds.length} active production timer(s).`,
      paused_count: pausedOSIds.length,
      paused_ids: pausedOSIds,
      checked_at: new Date().toISOString(),
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: 'An internal server error occurred.', details: error.message },
      { status: 500 }
    );
  }
}
