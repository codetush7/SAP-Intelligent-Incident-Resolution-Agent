const express = require('express');
const router = express.Router();
const { analyzeIncidentWithAI } = require('../agents/cpiAgent');
const logger = require('../utils/logger');

// POST /api/analysis/analyze
router.post('/analyze', async (req, res) => {
  try {
    const { errorCode, interface: iface, iflow, errorMessage, payload, additionalData } = req.body;
    if (!errorCode) return res.status(400).json({ error: 'errorCode is required' });

    const analysis = await analyzeIncidentWithAI({
      errorCode, interface: iface, iflow, errorMessage, payload, additionalData,
      timestamp: new Date().toISOString()
    });

    res.json({ analysis, timestamp: new Date().toISOString() });
  } catch (err) {
    logger.error('Analysis error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analysis/scenarios - Return common error scenarios
router.get('/scenarios', (req, res) => {
  res.json([
    {
      id: 'api_401',
      name: 'API Authentication Failure',
      errorCode: 'HTTP_401',
      description: 'OAuth token expired or invalid credentials',
      category: 'API_CONNECTIVITY',
      commonCauses: ['Expired OAuth token', 'Rotated client secret', 'Wrong credentials'],
      quickFixes: ['Refresh OAuth token', 'Update credentials in CPI Security Material', 'Check OAuth endpoint URL']
    },
    {
      id: 'jms_queue',
      name: 'JMS Queue Buildup',
      errorCode: 'QUEUE_THRESHOLD_EXCEEDED',
      description: 'Message queue exceeding capacity threshold',
      category: 'JMS_QUEUE',
      commonCauses: ['Slow downstream system', 'Too few consumers', 'Processing errors in loop'],
      quickFixes: ['Increase JMS consumers', 'Check downstream availability', 'Review error handling logic']
    },
    {
      id: 'cert_expiry',
      name: 'Certificate Expiry',
      errorCode: 'CERT_EXPIRY_WARNING',
      description: 'SSL/TLS certificate approaching expiry date',
      category: 'CERTIFICATE_EXPIRY',
      commonCauses: ['Annual renewal missed', 'Auto-renewal failed', 'New domain not covered'],
      quickFixes: ['Renew certificate', 'Update keystore in SAP CPI', 'Test connectivity post-renewal']
    },
    {
      id: 'sftp_auth',
      name: 'SFTP Authentication Failure',
      errorCode: 'SFTP_AUTH_FAILURE',
      description: 'Cannot authenticate to SFTP server',
      category: 'SFTP_CONNECTION',
      commonCauses: ['SSH key changed', 'Password expired', 'Host key mismatch'],
      quickFixes: ['Re-exchange SSH keys', 'Update credentials', 'Clear known_hosts and reconnect']
    },
    {
      id: 'mapping_error',
      name: 'Message Mapping Error',
      errorCode: 'MAPPING_EXCEPTION',
      description: 'Data transformation failure in iFlow mapping',
      category: 'MESSAGE_MAPPING',
      commonCauses: ['Missing mandatory field', 'Data type mismatch', 'Null value in required field'],
      quickFixes: ['Add null checks in mapping', 'Validate source payload schema', 'Add default value handling']
    },
    {
      id: 'pkix_error',
      name: 'PKIX Certificate Error',
      errorCode: 'PKIX_CERT_ERROR',
      description: 'PKIX path building failed - SSL handshake error',
      category: 'CERTIFICATE_EXPIRY',
      commonCauses: ['Expired server certificate', 'Untrusted CA', 'Certificate chain incomplete'],
      quickFixes: ['Update certificate in CPI Keystore', 'Import CA certificate', 'Verify certificate chain']
    }
  ]);
});

module.exports = router;
