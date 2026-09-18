const { processIncident } = require('../agents/cpiAgent');
const logger = require('../utils/logger');

function mapCPIAlertToErrorCode(alertData) {
  const msg = (alertData.errorMessage || '').toLowerCase();
  if (msg.includes('401') || msg.includes('unauthorized')) return 'HTTP_401';
  if (msg.includes('403') || msg.includes('forbidden')) return 'HTTP_403';
  if (msg.includes('500')) return 'HTTP_500';
  if (msg.includes('503') || msg.includes('unavailable')) return 'HTTP_503';
  if (msg.includes('sftp') || msg.includes('ssh')) return 'SFTP_AUTH_FAILURE';
  if (msg.includes('queue') || msg.includes('jms')) return 'QUEUE_THRESHOLD_EXCEEDED';
  if (msg.includes('certificate') || msg.includes('cert')) return 'CERT_EXPIRY_WARNING';
  if (msg.includes('mapping') || msg.includes('null')) return 'MAPPING_EXCEPTION';
  if (msg.includes('pkix')) return 'PKIX_CERT_ERROR';
  if (msg.includes('oauth') || msg.includes('token')) return 'OAUTH_TOKEN_EXPIRED';
  return alertData.errorCode || 'GENERAL_ERROR';
}

async function cpiAlert(req, res) {
  try {
    const alertData = req.body;
    logger.info(`[Webhook] Received CPI alert: ${JSON.stringify(alertData)}`);

    // Map SAP CPI alert fields to our incident format
    const incident = {
      errorCode: mapCPIAlertToErrorCode(alertData),
      interface: alertData.integrationFlow?.system || alertData.system || 'Unknown',
      iflow: alertData.integrationFlow?.name || alertData.iflowName,
      errorMessage: alertData.errorMessage || alertData.message,
      payload: alertData.payload || {},
      additionalData: alertData,
      timestamp: alertData.timestamp || new Date().toISOString()
    };

    const result = await processIncident(incident);
    res.json({
      success: true,
      ticketNumber: result.ticket.ticketNumber,
      message: 'Alert processed and ticket created'
    });
  } catch (err) {
    logger.error(`[Webhook] Processing error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
}

function serviceNowUpdate(req, res) {
  logger.info(`[Webhook] ServiceNow update received: ${JSON.stringify(req.body)}`);
  res.json({ received: true });
}

module.exports = { cpiAlert, serviceNowUpdate };
