function safeString(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function normalizeFingerprint(value) {
  return safeString(value)
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/["'`]/g, '');
}

function createIssueFingerprint({ iflow, packageId, packageName, errorCode, errorId, adapterDetails }) {
  const stableErrorIdentifier = errorId || '';
  return normalizeFingerprint(
    `${iflow || ''}|${packageId || packageName || ''}|${errorCode || ''}|${adapterDetails || ''}|${stableErrorIdentifier}`
  );
}

function createMessageFingerprint({ sapMessageGuid }) {
  return normalizeFingerprint(sapMessageGuid || '');
}

module.exports = {
  safeString,
  normalizeFingerprint,
  createIssueFingerprint,
  createMessageFingerprint
};
