import { NextResponse } from 'next/server';
import { sseManager } from '@/lib/sse-manager';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const clientId = randomUUID();

  const stream = new ReadableStream({
    start(controller) {
      sseManager.addClient(clientId, controller);

      // Send initial connection event
      const msg = `event: connected\ndata: ${JSON.stringify({ clientId, connections: sseManager.connectionCount })}\n\n`;
      controller.enqueue(new TextEncoder().encode(msg));

      // Heartbeat every 30s to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(heartbeat);
          sseManager.removeClient(clientId);
        }
      }, 30000);

      // Cleanup on close — use a timeout to periodically check
      // The controller.close is called by the client disconnecting
    },
    cancel() {
      sseManager.removeClient(clientId);
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Nginx: disable buffering
    },
  });
}
