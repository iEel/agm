/**
 * SSE (Server-Sent Events) Manager
 * Manages connected clients and broadcasts events to all subscribers.
 * 
 * Event types:
 * - registration  → checkin/checkout/cancel
 * - vote          → new vote recorded
 * - agenda        → status change (open/close/announce)
 * - refresh       → generic refresh signal
 */

type SSEClient = {
  id: string;
  controller: ReadableStreamDefaultController;
};

class SSEManager {
  private clients: Map<string, SSEClient> = new Map();

  addClient(id: string, controller: ReadableStreamDefaultController): void {
    this.clients.set(id, { id, controller });
  }

  removeClient(id: string): void {
    this.clients.delete(id);
  }

  broadcast(event: string, data?: Record<string, unknown>): void {
    const message = `event: ${event}\ndata: ${JSON.stringify(data || {})}\n\n`;
    const deadClients: string[] = [];

    this.clients.forEach((client) => {
      try {
        client.controller.enqueue(new TextEncoder().encode(message));
      } catch {
        deadClients.push(client.id);
      }
    });

    // Clean up dead connections
    deadClients.forEach((id) => this.clients.delete(id));
  }

  get connectionCount(): number {
    return this.clients.size;
  }
}

// Singleton instance
const globalForSSE = globalThis as unknown as { sseManager: SSEManager };
export const sseManager = globalForSSE.sseManager || new SSEManager();
if (process.env.NODE_ENV !== 'production') {
  globalForSSE.sseManager = sseManager;
}
