const express = require('express');
const router = express.Router();
const dataStore = require('../utils/dataStore');
const { getMonitoringStatus, getClientCount } = require('../services/monitoringService');
const { getClientCount: wsClientCount } = require('../services/websocketService');

// GET /api/dashboard/stats
router.get('/stats', (req, res) => {
  const stats = dataStore.getStats();
  const monitoring = getMonitoringStatus();

  res.json({
    tickets: stats,
    monitoring: {
      ...monitoring,
      wsConnections: wsClientCount ? wsClientCount() : 0
    },
    categories: getCategoryBreakdown(),
    recentActivity: dataStore.getMonitoringLogs().slice(0, 5),
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
