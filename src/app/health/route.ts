import db from '@/lib/db'; // Changed to default import

export async function GET() {
  try {
    // Attempt to get a connection and perform a simple query
    const connection = await db.getConnection();
    await connection.query('SELECT 1');
    connection.release();
    return Response.json({ status: 'ok', db: 'connected' });
  } catch (err: any) {
    console.error('[Health Check] DB connection error:', err.message);
    return Response.json({ status: 'error', db: 'disconnected', error: err.message }, { status: 500 });
  }
}
