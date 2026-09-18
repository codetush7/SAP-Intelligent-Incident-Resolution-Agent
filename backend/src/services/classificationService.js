const logger = require('../utils/logger');

// ─── P1 Critical Error Patterns ───────────────────────────────────────────────
const CRITICAL_PATTERNS = [
  'HttpResponseException','HTTP_401', 'HTTP_403', 'OAUTH_TOKEN_EXPIRED',
  'PKIX_CERT_ERROR', 'CERT_EXPIRED', 'KEYSTORE_MISSING',
  'SFTP_HOST_UNREACHABLE', 'SFTP_AUTH_FAILURE',
  'CONNECTION_REFUSED', 'UNKNOWN_HOST', 'TENANT_UNREACHABLE',
  'QUEUE_CONNECTION_FAILURE', 'JMS_DOWN',
  'JDBC_CONNECTION_FAILED', 'DATABASE_CONNECTION_FAILURE',
  'OUT_OF_MEMORY', 'WORKER_NODE_FAILURE', 'RUNTIME_CRASH',
  'MAPPING_ABORTED', 'GROOVY_EXCEPTION'
];

const CRITICAL_KEYWORDS = [
  '401', '403', 'unauthorized', 'forbidden',
  'connection refused', 'host unreachable', 'unknown host',
  'pkix', 'ssl handshake', 'certificate expired', 'keystore',
  'out of memory', 'heap space', 'worker node',
  'mapping aborted', 'nullpointerexception', 'runtime crash',
  'jms connection', 'jdbc connection', 'tenant unreachable',
  'oauth', 'token expired', 'access token'
];

// ─── P2 High Error Patterns ───────────────────────────────────────────────────
const HIGH_PATTERNS = [
  'HTTP_500', 'HTTP_502', 'HTTP_503',
  'SOAP_FAULT', 'RFC_FAILURE', 'IDOC_FAILURE',
  'MAPPING_EXCEPTION', 'XML_VALIDATION_FAILED',
  'JSON_VALIDATION_FAILED', 'MISSING_MANDATORY_FIELD',
  'INVALID_PAYLOAD', 'DUPLICATE_MESSAGE',
  'ADAPTER_TIMEOUT', 'BACKEND_TIMEOUT',
  'DATA_STORE_FAILURE', 'QUEUE_THRESHOLD_EXCEEDED',
  'CONTENT_MODIFIER_ERROR', 'XPATH_ERROR'
];

const HIGH_KEYWORDS = [
  '500', '502', '503', 'internal server error',
  'bad gateway', 'service unavailable',
  'soap fault', 'rfc', 'idoc',
  'validation failed', 'missing mandatory', 'invalid payload',
  'duplicate message', 'timeout', 'datastore',
  'queue full', 'xpath', 'content modifier',
  'json at line', 'malformed json', 'xml parsing'
];

// ─── P3 Medium Error Patterns ─────────────────────────────────────────────────
const MEDIUM_PATTERNS = [
  'HTTP_404', 'HTTP_408', 'HTTP_429',
  'NETWORK_TIMEOUT', 'RATE_LIMIT',
  'DATA_FORMAT_WARNING', 'NAMESPACE_MISMATCH',
  'OPTIONAL_FIELD_MISSING', 'VALUE_MAPPING_MISSING',
  'PARTNER_PROFILE_MISSING', 'CSV_PARSING_WARNING',
  'MINOR_MAPPING_ISSUE', 'DUPLICATE_FILENAME',
  'TEMP_DB_LOCK', 'MAIL_DELIVERY_DELAY'
];

const MEDIUM_KEYWORDS = [
  '404', '408', '429', 'not found', 'request timeout',
  'rate limit', 'too many requests',
  'namespace', 'optional field', 'value mapping',
  'partner profile', 'csv', 'duplicate file',
  'temporary lock', 'mail delay', 'minor mapping'
];

// ─── P4 Low Error Patterns ────────────────────────────────────────────────────
const LOW_KEYWORDS = [
  'deprecated', 'certificate expiring', 'high memory',
  'processing time', 'warning', 'retry successful',
  'duplicate warning', 'optional mapping', 'header not found',
  'empty optional', 'already archived', 'informational',
  'audit warning'
];

// ─── Main Classification Function ────────────────────────────────────────────
function classifyError(incidentData) {
  const errorCode = (incidentData.errorCode || '').toUpperCase();
  const errorMsg = (incidentData.errorMessage || '').toLowerCase();
  const rootCause = (incidentData.rootCause || '').toLowerCase();
  const combined = `${errorMsg} ${rootCause}`;

  // Check P1 Critical
  if (CRITICAL_PATTERNS.includes(errorCode) ||
      CRITICAL_KEYWORDS.some(k => combined.includes(k))) {
    return {
      priority: 'CRITICAL',
      priorityCode: 'P1',
      createJira: true,
      sendEmail: true,
      retryable: false,
      action: 'ESCALATE_IMMEDIATELY'
    };
  }

  // Check P2 High
  if (HIGH_PATTERNS.includes(errorCode) ||
      HIGH_KEYWORDS.some(k => combined.includes(k))) {
    return {
      priority: 'HIGH',
      priorityCode: 'P2',
      createJira: true,
      sendEmail: true,
      retryable: true,
      maxRetries: 3,
      action: 'CREATE_TICKET_AFTER_RETRY'
    };
  }

  // Check P3 Medium
  if (MEDIUM_PATTERNS.includes(errorCode) ||
      MEDIUM_KEYWORDS.some(k => combined.includes(k))) {
    return {
      priority: 'MEDIUM',
      priorityCode: 'P3',
      createJira: true,
      sendEmail: true,
      retryable: true,
      maxRetries: 3,
      action: 'RETRY_THEN_TICKET'
    };
  }

  // Default P4 Low
  return {
    priority: 'LOW',
    priorityCode: 'P4',
    createJira: false,
    sendEmail: true,
    retryable: true,
    action: 'LOG_ONLY'
  };
}

module.exports = { classifyError };