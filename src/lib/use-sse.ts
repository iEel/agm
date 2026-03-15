'use client';

import { useEffect, useRef, useCallback } from 'react';

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
  onEventRef.current = onEvent;

  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    // Skip SSE in SSR
    if (typeof window === 'undefined') return;

    let eventSource: EventSource;
    let fallbackInterval: ReturnType<typeof setInterval> | null = null;

    try {
      eventSource = new EventSource('/api/sse');

      eventSource.onopen = () => {
        reconnectAttempts.current = 0;
        // Clear fallback polling if SSE is connected
        if (fallbackInterval) {
          clearInterval(fallbackInterval);
          fallbackInterval = null;
        }
      };

      // Listen to specific events
      const events = ['registration', 'vote', 'agenda', 'refresh'];
      events.forEach((event) => {
        eventSource.addEventListener(event, () => {
          onEventRef.current();
        });
      });

      eventSource.onerror = () => {
        eventSource.close();
        reconnectAttempts.current++;

        if (reconnectAttempts.current <= maxReconnectAttempts) {
          // Reconnect with exponential backoff
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          setTimeout(() => connect(), delay);
        } else {
          // Fall back to polling
          console.warn('[SSE] Max reconnect attempts reached, falling back to polling');
          fallbackInterval = setInterval(() => onEventRef.current(), fallbackIntervalMs);
        }
      };
    } catch {
      // EventSource not supported or blocked — use polling
      fallbackInterval = setInterval(() => onEventRef.current(), fallbackIntervalMs);
    }

    return () => {
      if (eventSource) eventSource.close();
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }, [fallbackIntervalMs]);

  useEffect(() => {
    const cleanup = connect();
    return () => { if (cleanup) cleanup(); };
  }, [connect]);
}
