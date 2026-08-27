const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const userStore = require('../utils/userStore');
const { getJwtSecret } = require('../middleware/authMiddleware');

let wss = null;
const clients = new Map(); // ws -> userId

function setupWebSocket(websocketServer) {
  wss = websocketServer;

  wss.on('connection', async (ws, req) => {
    let userId = null;
    try {
      const parsedUrl = new URL(req.url, 'http://localhost');
      const token = parsedUrl.searchParams.get('token');
      if (token) {
        const payload = jwt.verify(token, getJwtSecret());
        const user = await userStore.findById(payload.sub);
        if (user) userId = user.id;
      }
    } catch (err) {
      logger.debug(`[WS] Token verification failed: ${err.message}`);
    }

    if (!userId) {
      ws.close(4001, 'Unauthorized');
      return;
    }

    clients.set(ws, userId);
    logger.info(`[WS] Client connected for user ${userId}. Total: ${clients.size}`);

    ws.send(JSON.stringify({
      type: 'connected',
      message: 'Connected to SAP CPI Ticketing Agent',
      timestamp: new Date().toISOString()
    }));

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
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
    default:
      logger.debug(`[WS] Unknown message type: ${msg.type}`);
  }
}

// Every event is now user-scoped — sends only to that user's connected sockets.
function broadcastEvent(eventType, data, userId) {
  if (!wss) return;
  if (!userId) {
    logger.warn(`[WS] broadcastEvent('${eventType}') called without a userId — dropped.`);
    return;
  }
  const payload = JSON.stringify({ type: eventType, data, timestamp: new Date().toISOString() });

  let sent = 0;
  clients.forEach((clientUserId, client) => {
    if (clientUserId === userId && client.readyState === 1) {
      try {
        client.send(payload);
        sent++;
      } catch (err) {
        logger.error(`[WS] Send error: ${err.message}`);
        clients.delete(client);
      }
    }
  });

  if (sent > 0) logger.debug(`[WS] Broadcast '${eventType}' to ${sent} client(s) for user ${userId}`);
}

function getClientCount() {
  return clients.size;
}

module.exports = { setupWebSocket, broadcastEvent, getClientCount };