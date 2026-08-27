const SERVER_START_TIME = new Date();
const cron = require('node-cron');
const logger = require('../utils/logger');
const dataStore = require('../utils/dataStore');
const { broadcastEvent } = require('./websocketService');
const { normalizeFingerprint, createIssueFingerprint, createMessageFingerprint } = require('../utils/fingerprint');
const tenantStore = require('../utils/tenantStore');
const userStore = require('../utils/userStore');
const requestContext = require('../utils/requestContext');

function firstNonEmpty(...values) {
  return values.find(v => v !== undefined && v !== null && `${v}`.toString().trim() !== '') || null;
}

let monitoringActive = false;
let monitoringJob = null;

async function isSAPConfigured(userId) {
  const creds = await tenantStore.getActiveTenantCredentials(userId);
  return !!(creds && creds.baseUrl && creds.clientId && creds.clientSecret && creds.tokenUrl);
}

// ─── REAL: Check SAP CPI Failed Message Logs ──────────────────────────────────
async function checkMessageProcessingLogs(userId) {
  if (!(await isSAPConfigured(userId))) return simulateFallback('message_logs');

  try {
    const { getFailedMessages, getMessageErrorInfo, getMessageRuns, mapSAPErrorToCode } = require('./sapCpiService');
    const failed = await getFailedMessages(10);

    if (failed.length === 0) return null;

    const recentFailed = failed.filter(msg => {
      const logEndMs = parseInt(msg.LogEnd?.match(/\d+/)?.[0] || 0);
      return logEndMs && new Date(logEndMs) > SERVER_START_TIME;
    });

    if (recentFailed.length === 0) return null;

    const existingTickets = await dataStore.getTickets(userId);
    const newFailure = recentFailed.find(msg => {
      const failureFingerprint = createIssueFingerprint({
        iflow: msg.IntegrationFlowName || msg.IntegrationFlowId || msg.ArtifactName,
        packageId: msg.IntegrationArtifact?.PackageId || msg.PackageId || msg.IntegrationFlowPackageId || msg.PackageUUID,
        packageName: msg.IntegrationFlowPackageName || msg.PackageName,
        errorCode: mapSAPErrorToCode({
          ErrorInformation: msg.ErrorInformation || msg.MessageText || '',
          AdapterName: msg.AdapterName || ''
        }),
        errorMessage: msg.ErrorInformation || msg.MessageText || ''
      });

      const duplicateMatch = existingTickets.some(t => {
        const ticketFingerprint = t.issueFingerprint
          ? normalizeFingerprint(t.issueFingerprint)
          : createIssueFingerprint({
            iflow: t.iflow || t.interface,
            packageId: t.packageId,
            packageName: t.packageName,
            errorCode: t.errorCode,
            errorId: t.errorId,
            errorMessage: t.errorMessage
          });
        return ticketFingerprint && ticketFingerprint === failureFingerprint;
      });
      if (duplicateMatch) return false;
      return true;
    });

    if (!newFailure) return null;

    const errorInfo = await getMessageErrorInfo(newFailure.MessageGuid);
    const runs = await getMessageRuns(newFailure.MessageGuid);
    const lastRun = runs[runs.length - 1] || {};

    const protocolValue = firstNonEmpty(
      lastRun.Protocol, newFailure.Protocol, lastRun.Transport, newFailure.Transport,
      lastRun.AdapterType, lastRun.AdapterName, 'N/A'
    );

    const sender = firstNonEmpty(
      newFailure.Sender, newFailure.SenderParty, newFailure.SenderService, newFailure.SenderName,
      lastRun.Sender, lastRun.SenderParty, lastRun.SenderService, lastRun.SenderName,
      newFailure.SourceSystem, newFailure.SenderAddress, lastRun.SourceSystem
    );

    const receiver = firstNonEmpty(
      newFailure.Receiver, newFailure.ReceiverParty, newFailure.ReceiverService, newFailure.ReceiverName,
      lastRun.Receiver, lastRun.ReceiverParty, lastRun.ReceiverService, lastRun.ReceiverName,
      newFailure.TargetSystem, newFailure.ReceiverAddress, lastRun.TargetSystem
    );

    const adapterDetails = firstNonEmpty(
      [lastRun.AdapterName, lastRun.AdapterType, lastRun.Channel, lastRun.Transport, lastRun.Protocol].filter(Boolean).join(' | '),
      lastRun.AdapterName, lastRun.AdapterType, lastRun.Channel, lastRun.Transport,
      newFailure.AdapterName, newFailure.AdapterType, sender, receiver
    ) || 'N/A';

    let packageName = firstNonEmpty(
      newFailure.IntegrationFlowPackageName, newFailure.PackageName, newFailure.IntegrationFlowPackageId, newFailure.PackageId,
      lastRun.IntegrationFlowPackageName, lastRun.PackageName, lastRun.IntegrationFlowPackageId, lastRun.PackageId,
      newFailure.IntegrationArtifact?.PackageId, newFailure.IntegrationArtifact?.PackageName,
      lastRun.IntegrationArtifact?.PackageId, lastRun.IntegrationArtifact?.PackageName
    );

    let packageId = firstNonEmpty(
      newFailure.IntegrationArtifact?.PackageId, newFailure.PackageId, newFailure.IntegrationFlowPackageId, newFailure.PackageUUID,
      lastRun.IntegrationArtifact?.PackageId, lastRun.PackageId, lastRun.IntegrationFlowPackageId, lastRun.PackageUUID,
      newFailure.Id, lastRun.Id
    );

    let iflowId = firstNonEmpty(
      newFailure.IntegrationFlowId, newFailure.ArtifactId, newFailure.Id,
      lastRun.IntegrationFlowId, lastRun.ArtifactId, lastRun.Id,
      newFailure.IntegrationArtifact?.Id, lastRun.IntegrationArtifact?.Id
    );

    if ((!packageName || !packageId || !iflowId) && newFailure.IntegrationFlowName) {
      try {
        const { getIntegrationFlows } = require('./sapCpiService');
        const allFlows = await getIntegrationFlows();
        const matched = allFlows.find(f => f.Id === newFailure.IntegrationFlowName || f.Name === newFailure.IntegrationFlowName);
        if (matched) {
          if (!packageName) packageName = matched.PackageName || matched.PackageId || 'N/A';
          if (!packageId) packageId = matched.PackageId || matched.PackageName || matched.Id || 'N/A';
          if (!iflowId) iflowId = matched.Id || matched.Name || 'N/A';
        }
      } catch (e) {
        logger.debug('[Monitor] Could not enrich package info from flow list: ' + e.message);
      }
    }

    const rawErrorInfo = firstNonEmpty(
      errorInfo?.ErrorMessage, errorInfo?.ErrorInformation, errorInfo?.message, errorInfo?.error,
      lastRun.ErrorInformation, lastRun.ErrorMessage, lastRun.MessageText,
      newFailure.ErrorInformation, newFailure.ErrorMessage, newFailure.MessageText
    ) || 'Message processing failed';

    const normalizedCode = mapSAPErrorToCode({
      ErrorInformation: rawErrorInfo,
      AdapterName: adapterDetails,
      Status: newFailure.Status
    });

    const cleanErrorMessage = rawErrorInfo;

    const errorTimestampMs = parseInt(newFailure.LogEnd?.match(/\d+/)?.[0] || newFailure.LogStart?.match(/\d+/)?.[0] || Date.now());

    let monitorUrl = null;
    try {
      const activeTenant = await tenantStore.getActiveTenant(userId);
      if (activeTenant?.baseUrl) {
        monitorUrl = `${activeTenant.baseUrl}/shell/monitoring/Messages('${newFailure.MessageGuid}')`;
      }
    } catch {
      monitorUrl = null;
    }

    return {
      errorCode: normalizedCode,
      errorId: newFailure.MessageGuid,
      sapMessageGuid: newFailure.MessageGuid,
      correlationId: newFailure.CorrelationId || null,
      interface: newFailure.IntegrationFlowName || newFailure.IntegrationFlowId || 'CPI Integration',
      iflow: newFailure.IntegrationFlowName || newFailure.IntegrationFlowId || 'Unknown iFlow',
      iflowId: iflowId || 'N/A',
      packageId: packageId || 'N/A',
      packageName: packageName || 'N/A',
      sender: sender || 'N/A',
      receiver: receiver || 'N/A',
      adapterDetails,
      protocol: protocolValue,
      errorMessage: cleanErrorMessage,
      errorTimestamp: new Date(errorTimestampMs).toISOString(),
      monitorUrl,
      payload: {
        messageGuid: newFailure.MessageGuid,
        correlationId: newFailure.CorrelationId,
        status: newFailure.Status,
        logStart: newFailure.LogStart,
        logEnd: newFailure.LogEnd,
        adapterDetails,
        protocol: protocolValue,
        sender,
        receiver,
        packageId,
        packageName,
        iflowId,
        errorInfo: rawErrorInfo,
        runsCount: runs.length,
        monitorUrl
      },
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    logger.error(`[Monitor] SAP CPI message log check failed: ${err.message}`);
    await dataStore.addMonitoringLog(userId, {
      type: 'ERROR',
      message: `SAP CPI API access failed: ${err.message}`,
      status: 'ERROR'
    });
    broadcastEvent('monitoring_status', {
      status: 'ERROR', mode: 'LIVE',
      message: `SAP CPI API access failed: ${err.message}`,
      timestamp: new Date().toISOString()
    }, userId);
    return null;
  }
}

// ─── REAL: Check JMS Queue Buildup ───────────────────────────────────────────
async function checkJMSQueues(userId) {
  if (!(await isSAPConfigured(userId))) return null;
  try {
    const { getJMSResources } = require('./sapCpiService');
    const brokers = await getJMSResources();
    for (const broker of brokers) {
      const queueSize = parseInt(broker.QueueNumber || 0);
      const threshold = parseInt(process.env.QUEUE_SIZE_THRESHOLD || 1000);
      if (queueSize > threshold) {
        return {
          errorCode: 'QUEUE_THRESHOLD_EXCEEDED',
          interface: 'SAP CPI JMS',
          iflow: 'JMS Broker Monitor',
          queueName: broker.Name || 'JMS Broker',
          queueSize,
          errorMessage: `JMS queue has ${queueSize} messages (threshold: ${threshold})`
        };
      }
    }
    return null;
  } catch (err) {
    logger.debug(`[Monitor] JMS not available on this tenant`);
    return null;
  }
}

// ─── REAL: Check Certificate Expiry ──────────────────────────────────────────
async function checkCertificates(userId) {
  if (!(await isSAPConfigured(userId))) return null;
  try {
    const { getCertificates } = require('./sapCpiService');
    const certs = await getCertificates();
    const warningDays = parseInt(process.env.CERT_EXPIRY_WARNING_DAYS || 30);
    const now = Date.now();
    const existingTickets = await dataStore.getTickets(userId);

    for (const cert of certs) {
      if (!cert.ValidNotAfter) continue;
      let expiry;
      const match = cert.ValidNotAfter.match(/\/Date\((\d+)\)\//);
      expiry = match ? parseInt(match[1]) : new Date(cert.ValidNotAfter).getTime();
      const daysLeft = Math.floor((expiry - now) / (1000 * 60 * 60 * 24));

      if (daysLeft <= warningDays && daysLeft >= 0) {
        const existing = existingTickets.find(t => t.certName === cert.Hexalias);
        if (existing) continue;

        return {
          errorCode: 'CERT_EXPIRY_WARNING',
          interface: 'SAP CPI Keystore',
          iflow: 'Certificate Monitor',
          certName: cert.Hexalias,
          daysUntilExpiry: daysLeft,
          errorMessage: `Certificate "${cert.Hexalias}" expiring in ${daysLeft} days (${new Date(expiry).toDateString()})`,
          payload: { alias: cert.Hexalias, type: cert.KeyType, validFrom: cert.ValidNotBefore, validUntil: cert.ValidNotAfter, daysLeft }
        };
      }
    }
    return null;
  } catch (err) {
    logger.debug(`[Monitor] Certificate API not available on this tenant`);
    return null;
  }
}

// ─── REAL: Check iFlow Runtime Status ────────────────────────────────────────
async function checkIFlowStatus(userId) {
  if (!(await isSAPConfigured(userId))) return null;
  try {
    const { getIntegrationFlows } = require('./sapCpiService');
    const iflows = await getIntegrationFlows();
    const errored = iflows.find(f => f.Status === 'ERROR' || f.Status === 'FAILED');
    if (!errored) return null;

    const existingTickets = await dataStore.getTickets(userId);
    const existing = existingTickets.find(t => t.iflow === errored.Name && t.errorCode === 'HTTP_500');
    if (existing) return null;

    return {
      errorCode: 'HTTP_500',
      interface: errored.Name || 'Unknown',
      iflow: errored.Name,
      errorMessage: `iFlow "${errored.Name}" is in ${errored.Status} state`,
      payload: { id: errored.Id, version: errored.Version, status: errored.Status, deployedBy: errored.DeployedBy, deployedOn: errored.DeployedOn }
    };
  } catch (err) {
    logger.warn(`[Monitor] iFlow status check failed: ${err.message}`);
    return null;
  }
}

// ─── FALLBACK: Simulate when a user has no tenant connected ─────────────────
function simulateFallback() {
  const rand = Math.random();
  if (rand > 0.12) return null;
  const scenarios = [
    { errorCode: 'HTTP_401', interface: 'Salesforce', iflow: 'SF_Order_Sync_v2', errorMessage: 'HTTP 401 Unauthorized - OAuth token expired' },
    { errorCode: 'MAPPING_EXCEPTION', interface: 'SAP ECC', iflow: 'ECC_Customer_Sync', errorMessage: 'NullPointerException: Field CustomerID is null', failedField: 'CustomerID' },
    { errorCode: 'HTTP_503', interface: 'Banking API', iflow: 'Banking_Payment_Gateway', errorMessage: 'Service Unavailable - upstream at capacity' }
  ];
  return scenarios[Math.floor(Math.random() * scenarios.length)];
}

// ─── Per-user cycle ────────────────────────────────────────────────────────
async function runUserMonitoringCycle(userId, creds) {
  const mode = creds ? 'LIVE' : 'SIMULATION';
  logger.info(`[Monitor] Cycle for user ${userId} (${creds ? `tenant: ${creds.name}` : 'no tenant connected — simulation'})`);

  await dataStore.addMonitoringLog(userId, {
    type: 'CHECK',
    message: `Running monitoring cycle (mode: ${mode})`,
    status: 'RUNNING'
  });

  broadcastEvent('monitoring_status', {
    status: 'CHECKING', mode,
    message: `Scanning ${creds ? 'SAP CPI' : 'simulated'} integrations...`,
    timestamp: new Date().toISOString()
  }, userId);

  try {
    const msgIssue = await checkMessageProcessingLogs(userId);
    const jmsIssue = await checkJMSQueues(userId);
    const certIssue = await checkCertificates(userId);
    const iflowIssue = await checkIFlowStatus(userId);

    const rawIssues = [msgIssue, jmsIssue, certIssue, iflowIssue].filter(Boolean);
    const issues = [];
    const seenFingerprints = new Set();
    const seenMessageIds = new Set();

    for (const issue of rawIssues) {
      const issueFp = createIssueFingerprint(issue);
      const messageFp = createMessageFingerprint({ sapMessageGuid: issue.sapMessageGuid });
      if (messageFp && seenMessageIds.has(messageFp)) continue;
      if (issueFp && seenFingerprints.has(issueFp)) continue;
      if (messageFp) seenMessageIds.add(messageFp);
      if (issueFp) seenFingerprints.add(issueFp);
      issues.push(issue);
    }

    if (issues.length > 0) {
      logger.info(`[Monitor] Found ${issues.length} issue(s) for user ${userId}`);

      for (const issue of issues) {
        let result;
        try {
          const { processIncident } = require('../agents/cpiAgent');
          result = await processIncident({ ...issue, timestamp: new Date().toISOString() }, userId);
        } catch (agentErr) {
          logger.error(`[Monitor] Agent processing failed: ${agentErr.message}`);
          continue;
        }

        if (!result || !result.ticket) continue;

        const alert = await dataStore.addAlert(userId, {
          type: issue.errorCode,
          severity: ['HTTP_503', 'QUEUE_THRESHOLD_EXCEEDED'].includes(issue.errorCode) ? 'CRITICAL' : 'HIGH',
          message: issue.errorMessage
        });

        await dataStore.addMonitoringLog(userId, {
          type: 'ALERT',
          message: `Issue detected: ${issue.errorCode} in ${issue.interface}`,
          status: 'ALERT_CREATED'
        });

        broadcastEvent('new_alert', {
          alert, issue,
          message: `🚨 ${issue.errorCode}: ${issue.errorMessage}`,
          timestamp: new Date().toISOString()
        }, userId);
      }
    } else {
      await dataStore.addMonitoringLog(userId, {
        type: 'CHECK',
        message: `Monitoring cycle complete — no issues detected (${mode})`,
        status: 'OK'
      });
      broadcastEvent('monitoring_status', {
        status: 'OK', mode,
        message: 'All systems operational',
        timestamp: new Date().toISOString()
      }, userId);
    }
  } catch (err) {
    logger.error(`[Monitor] Cycle error for user ${userId}: ${err.message}`);
    await dataStore.addMonitoringLog(userId, {
      type: 'ERROR',
      message: `Monitoring cycle error: ${err.message}`,
      status: 'ERROR'
    });
  }
}

// ─── Main entry point ──────────────────────────────────────────────────────
async function runMonitoringCycle(targetUserId) {
  if (!monitoringActive && !targetUserId) return;

  const users = targetUserId
    ? [{ id: targetUserId }]
    : await userStore.getAll();

  for (const user of users) {
    const creds = await tenantStore.getActiveTenantCredentials(user.id);
    if (creds) {
      await requestContext.run({ userId: user.id, creds }, () => runUserMonitoringCycle(user.id, creds));
    } else {
      await runUserMonitoringCycle(user.id, null);
    }
  }
}

function initializeMonitoring() {
  const intervalSeconds = parseInt(process.env.MONITORING_INTERVAL_SECONDS) || 60;
  logger.info(`[Monitor] Initializing — interval: ${intervalSeconds}s`);
  monitoringActive = true;

  setTimeout(() => runMonitoringCycle(), 5000);
  monitoringJob = cron.schedule(`*/${intervalSeconds} * * * * *`, () => runMonitoringCycle());
  logger.info('[Monitor] Monitoring service started');
}

function stopMonitoring() {
  monitoringActive = false;
  if (monitoringJob) { monitoringJob.stop(); monitoringJob = null; }
  logger.info('[Monitor] Monitoring service stopped');
}

function getMonitoringStatus(userId, isSapConfig = false) {
  return {
    active: monitoringActive,
    mode: isSapConfig ? 'LIVE' : 'SIMULATION',
    sapConfigured: Boolean(isSapConfig),
    intervalSeconds: parseInt(process.env.MONITORING_INTERVAL_SECONDS) || 60,
    lastChecked: new Date().toISOString()
  };
}

module.exports = {
  initializeMonitoring,
  stopMonitoring,
  getMonitoringStatus,
  runMonitoringCycle,
  isSAPConfigured
};