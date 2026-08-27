const express = require('express');
const router = express.Router();
const dataStore = require('../utils/dataStore');
const { getMonitoringStatus } = require('../services/monitoringService');
const { getClientCount: wsClientCount } = require('../services/websocketService');
const { requireAuth } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

router.use(requireAuth);

function getCategoryBreakdown(tickets = []) {
  const categories = {};
  tickets.forEach(t => {
    const name = (t.category || 'GENERAL').toUpperCase();
    categories[name] = (categories[name] || 0) + 1;
  });
  return Object.entries(categories).map(([name, count]) => ({ name, count }));
}

function calculateTrends(tickets = []) {
  const now = new Date();
  const trends = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(day.getDate() - i);
    const dayStr = day.toISOString().split('T')[0];

    const dayTickets = tickets.filter(t => t.createdAt && t.createdAt.startsWith(dayStr));
    trends.push({
      date: dayStr,
      total: dayTickets.length,
      critical: dayTickets.filter(t => String(t.priority || '').toUpperCase() === 'CRITICAL').length,
      high: dayTickets.filter(t => String(t.priority || '').toUpperCase() === 'HIGH').length,
      resolved: dayTickets.filter(t => String(t.status || '').toUpperCase() === 'RESOLVED').length
    });
  }
  return trends;
}

// GET /api/dashboard/stats - Highly optimized single parallel query
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.id;

    // Run queries concurrently in a single parallel batch
    const [allTickets, alerts, monitoringLogs] = await Promise.all([
      dataStore.getTickets(userId),
      dataStore.getAlerts(userId),
      dataStore.getMonitoringLogs(userId)
    ]);

    const activeAlerts = alerts.filter(a => !a.acknowledged).length;
    const monitoring = getMonitoringStatus(userId);

    // Compute stats in-memory in < 1ms
    const stats = {
      total: allTickets.length,
      open: allTickets.filter(t => String(t.status || '').toUpperCase() === 'OPEN').length,
      inProgress: allTickets.filter(t => String(t.status || '').toUpperCase() === 'IN_PROGRESS').length,
      resolved: allTickets.filter(t => String(t.status || '').toUpperCase() === 'RESOLVED').length,
      critical: allTickets.filter(t => String(t.priority || '').toUpperCase() === 'CRITICAL').length,
      high: allTickets.filter(t => String(t.priority || '').toUpperCase() === 'HIGH').length,
      medium: allTickets.filter(t => String(t.priority || '').toUpperCase() === 'MEDIUM').length,
      low: allTickets.filter(t => String(t.priority || '').toUpperCase() === 'LOW').length,
      activeAlerts,
      aiAnalyzed: allTickets.filter(t => Boolean(t.aiAnalyzed)).length
    };

    const recentIssues = allTickets
      .filter(t => !!t.errorCode && t.iflow && !t.iflow.includes('MessageProcessingLogs Access'))
      .slice(0, 5)
      .map(t => {
        let parsedPayload = {};
        if (typeof t.payload === 'string') {
          try {
            parsedPayload = JSON.parse(t.payload);
          } catch {
            parsedPayload = {};
          }
        } else if (typeof t.payload === 'object' && t.payload !== null) {
          parsedPayload = t.payload;
        }

        const errorId = t.errorId || t.sapMessageGuid || parsedPayload.messageGuid || parsedPayload.MessageGuid || parsedPayload.errorId || 'N/A';
        const adapterDetails = t.adapterDetails || parsedPayload.adapterDetails || [parsedPayload.AdapterName, parsedPayload.adapterType, parsedPayload.Channel, parsedPayload.Transport, parsedPayload.TransportProtocol].filter(Boolean).join(' | ') || 'N/A';
        const protocol = t.protocol || parsedPayload.protocol || parsedPayload.TransportProtocol || parsedPayload.Transport || parsedPayload.Protocol || 'N/A';
        const packageName = t.packageName || parsedPayload.packageName || parsedPayload.IntegrationFlowPackageName || parsedPayload.PackageName || 'N/A';
        const packageId = t.packageId || parsedPayload.packageId || parsedPayload.IntegrationFlowPackageId || parsedPayload.PackageId || 'N/A';
        const iflowId = t.iflowId || parsedPayload.iflowId || parsedPayload.IntegrationFlowId || parsedPayload.ArtifactId || parsedPayload.Id || 'N/A';
        const errorMessage = t.errorMessage || t.description || t.rootCause || t.evidence || parsedPayload.errorInfo || parsedPayload.errorMessage || 'N/A';
        const status = t.status || parsedPayload.Status || 'OPEN';
        const priority = t.priority || parsedPayload.priority || 'MEDIUM';

        return {
          ticketNumber: t.ticketNumber,
          title: t.title,
          interface: t.interface || parsedPayload.interface || parsedPayload.receiver || parsedPayload.sender || 'N/A',
          iflow: t.iflow || parsedPayload.iflow || parsedPayload.IntegrationFlowName || 'N/A',
          packageName,
          packageId,
          iflowId,
          sender: t.sender || parsedPayload.sender || 'N/A',
          receiver: t.receiver || parsedPayload.receiver || 'N/A',
          errorCode: t.errorCode || 'N/A',
          errorId,
          errorMessage,
          payload: parsedPayload,
          adapterDetails,
          protocol,
          timestamp: t.errorTimestamp || t.createdAt || parsedPayload.timestamp || new Date().toISOString(),
          status,
          priority,
          correlationId: parsedPayload.correlationId || parsedPayload.CorrelationId || null
        };
      });

    res.json({
      tickets: stats,
      monitoring: {
        ...monitoring,
        wsConnections: wsClientCount ? wsClientCount() : 0,
        alerts: activeAlerts,
        activeAlerts
      },
      categories: getCategoryBreakdown(allTickets),
      recentActivity: monitoringLogs.slice(0, 5),
      recentIssues,
      trends: calculateTrends(allTickets),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    logger.error(`[Dashboard] Stats error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/trends
router.get('/trends', async (req, res) => {
  try {
    const tickets = await dataStore.getTickets(req.user.id);
    res.json(calculateTrends(tickets));
  } catch (err) {
    logger.error(`[Dashboard] Trends error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;