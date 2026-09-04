const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const {
  getStatus,
  getLogs,
  getAlerts,
  acknowledgeAlert,
  triggerScan,
  startMonitoring,
  stopMonitoringHandler,
  getIflows,
  getCertificates
} = require('../controllers/monitoringController');

router.use(requireAuth);

// GET /api/monitoring/status
router.get('/status', getStatus);

// GET /api/monitoring/logs
router.get('/logs', getLogs);

// GET /api/monitoring/alerts
router.get('/alerts', getAlerts);

// POST /api/monitoring/alerts/:id/acknowledge
router.post('/alerts/:id/acknowledge', acknowledgeAlert);

// POST /api/monitoring/trigger-scan
router.post('/trigger-scan', triggerScan);

// POST /api/monitoring/start
router.post('/start', startMonitoring);

// POST /api/monitoring/stop
router.post('/stop', stopMonitoringHandler);

// GET /api/monitoring/iflows
router.get('/iflows', getIflows);

// GET /api/monitoring/certificates
router.get('/certificates', getCertificates);

module.exports = router;