const express = require('express');
const router = express.Router();
const dataStore = require('../utils/dataStore');
const { getMonitoringStatus, getClientCount } = require('../services/monitoringService');
const { getClientCount: wsClientCount } = require('../services/websocketService');

// GET /api/dashboard/stats
router.get('/stats', (req, res) => {
  const stats = dataStore.getStats();
  const monitoring = getMonitoringStatus();

  const recentIssues = dataStore.getTickets()
    .filter(t => !!t.errorCode && t.iflow && !t.iflow.includes('MessageProcessingLogs Access'))
    .slice(0, 5)
    .map(t => {
      let parsedPayload = {};
      if (typeof t.payload === 'string') {
        try {
          parsedPayload = JSON.parse(t.payload);
        } catch (err) {
          parsedPayload = {};
        }
      } else if (typeof t.payload === 'object' && t.payload !== null) {
        parsedPayload = t.payload;
      }

      const errorId = t.errorId || t.sapMessageGuid || parsedPayload.messageGuid || parsedPayload.MessageGuid || parsedPayload.errorId || parsedPayload.ErrorId || null;
      const adapterDetails = t.adapterDetails || parsedPayload.adapterDetails || [parsedPayload.AdapterName, parsedPayload.adapterType, parsedPayload.Channel, parsedPayload.Transport, parsedPayload.TransportProtocol].filter(Boolean).join(' | ') || null;
      const protocol = t.protocol || parsedPayload.protocol || parsedPayload.TransportProtocol || parsedPayload.Transport || parsedPayload.Protocol || null;
      const packageName = t.packageName || parsedPayload.packageName || parsedPayload.IntegrationFlowPackageName || parsedPayload.PackageName || null;
      const packageId = t.packageId || parsedPayload.packageId || parsedPayload.IntegrationFlowPackageId || parsedPayload.PackageId || null;
      const iflowId = t.iflowId || parsedPayload.iflowId || parsedPayload.IntegrationFlowId || parsedPayload.IntegrationFlowId || null;
      const errorMessage = t.errorMessage || t.description || t.rootCause || t.evidence || parsedPayload.errorInfo || parsedPayload.errorMessage || parsedPayload.Status || (typeof t.payload === 'string' ? t.payload : JSON.stringify(t.payload || {}));
      const status = t.status || parsedPayload.Status || null;
      const priority = t.priority || parsedPayload.priority || null;

      return {
        ticketNumber: t.ticketNumber,
        title: t.title,
        interface: t.interface || parsedPayload.interface || parsedPayload.receiver || parsedPayload.sender || null,
        iflow: t.iflow || parsedPayload.iflow || parsedPayload.IntegrationFlowName || parsedPayload.IntegrationFlowName || null,
        packageName,
        packageId,
        iflowId,
        errorCode: t.errorCode,
        errorId,
        errorMessage,
        payload: parsedPayload,
        adapterDetails,
        protocol,
        timestamp: t.errorTimestamp || t.createdAt || parsedPayload.timestamp || parsedPayload.LogEnd || parsedPayload.LogStart || new Date().toISOString(),
        status,
        priority,
        sender: parsedPayload.sender || parsedPayload.Sender || null,
        receiver: parsedPayload.receiver || parsedPayload.Receiver || null,
        correlationId: parsedPayload.correlationId || parsedPayload.CorrelationId || null
      };
    });

  res.json({
    tickets: stats,
    monitoring: {
      ...monitoring,
      wsConnections: wsClientCount ? wsClientCount() : 0
    },
    categories: getCategoryBreakdown(),
    recentActivity: dataStore.getMonitoringLogs().slice(0, 5),
    recentIssues,
    timestamp: new Date().toISOString()
  });
});

// GET /api/dashboard/trends
router.get('/trends', (req, res) => {
  const tickets = dataStore.getTickets();
  const now = new Date();
  
  // Generate trend data for last 7 days
  const trends = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(day.getDate() - i);
    const dayStr = day.toISOString().split('T')[0];
    
    const dayTickets = tickets.filter(t => t.createdAt.startsWith(dayStr));
    trends.push({
      date: dayStr,
      total: dayTickets.length,
      critical: dayTickets.filter(t => t.priority === 'CRITICAL').length,
      high: dayTickets.filter(t => t.priority === 'HIGH').length,
      resolved: dayTickets.filter(t => t.status === 'RESOLVED').length
    });
  }

  res.json(trends);
});

function getCategoryBreakdown() {
  const tickets = dataStore.getTickets();
  const categories = {};
  tickets.forEach(t => {
    categories[t.category] = (categories[t.category] || 0) + 1;
  });
  return Object.entries(categories).map(([name, count]) => ({ name, count }));
}

module.exports = router;
