const dataStore = require('../utils/dataStore');
const { getMonitoringStatus } = require('../services/monitoringService');
const { getClientCount: wsClientCount } = require('../services/websocketService');

function getCategoryBreakdown(userId) {
  const tickets = dataStore.getTickets(userId);
  const categories = {};
  tickets.forEach(t => {
    const name = (t.category || 'GENERAL').toUpperCase();
    categories[name] = (categories[name] || 0) + 1;
  });
  return Object.entries(categories).map(([name, count]) => ({ name, count }));
}

function getStats(req, res) {
  const userId = req.user.id;

  const stats = dataStore.getStats(userId);
  const monitoring = getMonitoringStatus(userId);
  const activeAlerts = dataStore.getAlerts(userId).filter(a => !a.acknowledged).length;

  const recentIssues = dataStore.getTickets(userId)
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

      const errorId = t.errorId || t.sapMessageGuid || parsedPayload.messageGuid || parsedPayload.MessageGuid || parsedPayload.errorId || parsedPayload.ErrorId || 'N/A';
      const adapterDetails = t.adapterDetails || parsedPayload.adapterDetails || [parsedPayload.AdapterName, parsedPayload.adapterType, parsedPayload.Channel, parsedPayload.Transport, parsedPayload.TransportProtocol].filter(Boolean).join(' | ') || 'N/A';
      const protocol = t.protocol || parsedPayload.protocol || parsedPayload.TransportProtocol || parsedPayload.Transport || parsedPayload.Protocol || 'N/A';
      const packageName = t.packageName || parsedPayload.packageName || parsedPayload.IntegrationFlowPackageName || parsedPayload.PackageName || 'N/A';
      const packageId = t.packageId || parsedPayload.packageId || parsedPayload.IntegrationFlowPackageId || parsedPayload.PackageId || parsedPayload.PackageUUID || parsedPayload.Id || 'N/A';
      const iflowId = t.iflowId || parsedPayload.iflowId || parsedPayload.IntegrationFlowId || parsedPayload.ArtifactId || parsedPayload.Id || 'N/A';
      const errorMessage = t.errorMessage || t.description || t.rootCause || t.evidence || parsedPayload.errorInfo || parsedPayload.errorMessage || parsedPayload.Status || (typeof t.payload === 'string' ? t.payload : JSON.stringify(t.payload || {})) || 'N/A';
      const status = t.status || parsedPayload.Status || 'N/A';
      const priority = t.priority || parsedPayload.priority || 'N/A';

      return {
        ticketNumber: t.ticketNumber,
        title: t.title,
        interface: t.interface || parsedPayload.interface || parsedPayload.receiver || parsedPayload.sender || 'N/A',
        iflow: t.iflow || parsedPayload.iflow || parsedPayload.IntegrationFlowName || 'N/A',
        packageName,
        packageId,
        iflowId,
        sender: t.sender || parsedPayload.sender || parsedPayload.Sender || 'N/A',
        receiver: t.receiver || parsedPayload.receiver || parsedPayload.Receiver || 'N/A',
        errorCode: t.errorCode || 'N/A',
        errorId,
        errorMessage,
        payload: parsedPayload,
        adapterDetails,
        protocol,
        timestamp: t.errorTimestamp || t.createdAt || parsedPayload.timestamp || parsedPayload.LogEnd || parsedPayload.LogStart || new Date().toISOString(),
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
    categories: getCategoryBreakdown(userId),
    recentActivity: dataStore.getMonitoringLogs(userId).slice(0, 5),
    recentIssues,
    timestamp: new Date().toISOString()
  });
}

function getTrends(req, res) {
  const tickets = dataStore.getTickets(req.user.id);
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
}

module.exports = { getStats, getTrends };
