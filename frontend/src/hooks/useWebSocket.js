import { useState, useEffect, useRef, useCallback } from 'react';

const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:5000/ws';

export function useWebSocket(onMessage) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const mounted = useRef(true);

  const connect = useCallback(() => {
    if (!mounted.current) return;
    try {
      const token = sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token');
      const wsUrlWithToken = token ? `${WS_URL}?token=${encodeURIComponent(token)}` : WS_URL;
      const ws = new WebSocket(wsUrlWithToken);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mounted.current) return;
        setConnected(true);
        clearTimeout(reconnectTimer.current);
      };

      ws.onmessage = (e) => {
        if (!mounted.current) return;
        try {
          const data = JSON.parse(e.data);
          onMessage && onMessage(data);
        } catch {}
      };

      ws.onclose = () => {
        if (!mounted.current) return;
        setConnected(false);
        reconnectTimer.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (err) {
      reconnectTimer.current = setTimeout(connect, 5000);
    }
  }, [onMessage]);

  useEffect(() => {
    mounted.current = true;
    connect();
    return () => {
      mounted.current = false;
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { connected };
}
