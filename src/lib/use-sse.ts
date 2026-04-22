'use client';

import { useEffect, useRef } from 'react';

/**
 * React hook for SSE (Server-Sent Events).
 * Connects to /api/sse, listens for events, and calls onEvent callback.
 * Falls back to polling if SSE connection fails.
 * 
 * @param onEvent - function called on each SSE event to trigger refetch
 * @param fallbackIntervalMs - polling interval as fallback (default: 10000)
 */
export function useSSE(
  onEvent: () => void,
  fallbackIntervalMs: number = 10000
) {
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    // Skip SSE in SSR
    if (typeof window === 'undefined') return;

    let eventSource: EventSource | null = null;
    let fallbackInterval: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempts = 0;
    let disposed = false;
    const maxReconnectAttempts = 5;

    const startFallbackPolling = () => {
      if (!fallbackInterval) {
        fallbackInterval = setInterval(() => onEventRef.current(), fallbackIntervalMs);
      }
    };

    const connect = () => {
      if (disposed) return;

      try {
        eventSource = new EventSource('/api/sse');

        eventSource.onopen = () => {
          reconnectAttempts = 0;
          if (fallbackInterval) {
            clearInterval(fallbackInterval);
            fallbackInterval = null;
          }
        };

        const events = ['registration', 'vote', 'agenda', 'refresh'];
        events.forEach((event) => {
          eventSource?.addEventListener(event, () => {
            onEventRef.current();
          });
        });

        eventSource.onerror = () => {
          eventSource?.close();
          eventSource = null;
          reconnectAttempts++;

          if (reconnectAttempts <= maxReconnectAttempts) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
            reconnectTimer = setTimeout(connect, delay);
          } else {
            console.warn('[SSE] Max reconnect attempts reached, falling back to polling');
            startFallbackPolling();
          }
        };
      } catch {
        startFallbackPolling();
      }
    };

    connect();

    return () => {
      disposed = true;
      eventSource?.close();
      if (fallbackInterval) clearInterval(fallbackInterval);
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [fallbackIntervalMs]);
}
