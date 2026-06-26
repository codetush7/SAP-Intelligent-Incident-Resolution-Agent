const logger = require('../utils/logger');

let wss = null;
const clients = new Set();

function setupWebSocket(websocketServer) {
  wss = websocketServer;

  wss.on('connection', (ws, req) => {
    clients.add(ws);
    logger.info(`[WS] Client connected. Total: ${clients.size}`);

    ws.send(JSON.stringify({
      type: 'connected',
      message: 'Connected to SAP CPI Ticketing Agent',
      timestamp: new Date().toISOString()
    }));

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        logger.debug(`[WS] Received: ${msg.type}`);
        handleClientMessage(ws, msg);
      } catch (err) {
        logger.error(`[WS] Parse error: ${err.message}`);
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      logger.info(`[WS] Client disconnected. Total: ${clients.size}`);
    });

    ws.on('error', (err) => {
      logger.error(`[WS] Client error: ${err.message}`);
      clients.delete(ws);
    });
  });
}

function handleClientMessage(ws, msg) {
  switch (msg.type) {
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
      break;
    case 'subscribe':
      ws.send(JSON.stringify({ type: 'subscribed', channel: msg.channel }));
      break;
    default:
      logger.debug(`[WS] Unknown message type: ${msg.type}`);
  }
}

function broadcastEvent(eventType, data) {
  if (!wss) return;
  const payload = JSON.stringify({ type: eventType, data, timestamp: new Date().toISOString() });
  
  let sent = 0;
  clients.forEach(client => {
    if (client.readyState === 1) { // OPEN
      try {
        client.send(payload);
        sent++;
      } catch (err) {
        logger.error(`[WS] Send error: ${err.message}`);
        clients.delete(client);
      }
    }
  });

  if (sent > 0) {
    logger.debug(`[WS] Broadcast '${eventType}' to ${sent} clients`);
  }
}

function getClientCount() {
  return clients.size;
}

module.exports = { setupWebSocket, broadcastEvent, getClientCount };
