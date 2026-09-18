const { v4: uuidv4 } = require('uuid');
const hana = require('../db/hanaClient');

function rowToRecord(row) {
  return { id: row.ID, userId: row.USER_ID, ...JSON.parse(row.PAYLOAD_JSON || '{}'), timestamp: row.TIMESTAMP };
}

async function getAlerts(userId) {
  const rows = await hana.query('SELECT * FROM ALERTS WHERE USER_ID = ? ORDER BY TIMESTAMP DESC', [userId]);
  return rows.map((r) => ({ ...rowToRecord(r), acknowledged: !!r.ACKNOWLEDGED }));
}

async function addAlert(userId, alert) {
  const id = uuidv4();
  await hana.exec(
    'INSERT INTO ALERTS (ID, USER_ID, ACKNOWLEDGED, PAYLOAD_JSON) VALUES (?, ?, FALSE, ?)',
    [id, userId, JSON.stringify(alert)]
  );
  const rows = await hana.query('SELECT * FROM ALERTS WHERE ID = ?', [id]);
  return { ...rowToRecord(rows[0]), acknowledged: false };
}

async function acknowledgeAlert(id, userId) {
  await hana.exec('UPDATE ALERTS SET ACKNOWLEDGED = TRUE WHERE ID = ? AND USER_ID = ?', [id, userId]);
  const rows = await hana.query('SELECT * FROM ALERTS WHERE ID = ? AND USER_ID = ?', [id, userId]);
  return rows[0] ? { ...rowToRecord(rows[0]), acknowledged: true } : null;
}

async function getMonitoringLogs(userId) {
  const rows = await hana.query(
    'SELECT * FROM MONITORING_LOGS WHERE USER_ID = ? ORDER BY TIMESTAMP DESC LIMIT 500',
    [userId]
  );
  return rows.map(rowToRecord);
}

async function addMonitoringLog(userId, log) {
  const id = uuidv4();
  await hana.exec(
    'INSERT INTO MONITORING_LOGS (ID, USER_ID, PAYLOAD_JSON) VALUES (?, ?, ?)',
    [id, userId, JSON.stringify(log)]
  );
  // trim oldest beyond 500 per user
  await hana.exec(
    `DELETE FROM MONITORING_LOGS WHERE USER_ID = ? AND ID NOT IN
     (SELECT ID FROM (SELECT ID FROM MONITORING_LOGS WHERE USER_ID = ? ORDER BY TIMESTAMP DESC LIMIT 500))`,
    [userId, userId]
  );
  const rows = await hana.query('SELECT * FROM MONITORING_LOGS WHERE ID = ?', [id]);
  return rowToRecord(rows[0]);
}

async function addAgentLog(userId, log) {
  const id = uuidv4();
  await hana.exec(
    'INSERT INTO AGENT_LOGS (ID, USER_ID, PAYLOAD_JSON) VALUES (?, ?, ?)',
    [id, userId, JSON.stringify(log)]
  );
  await hana.exec(
    `DELETE FROM AGENT_LOGS WHERE USER_ID = ? AND ID NOT IN
     (SELECT ID FROM (SELECT ID FROM AGENT_LOGS WHERE USER_ID = ? ORDER BY TIMESTAMP DESC LIMIT 200))`,
    [userId, userId]
  );
  const rows = await hana.query('SELECT * FROM AGENT_LOGS WHERE ID = ?', [id]);
  return rowToRecord(rows[0]);
}

async function getAgentLogs(userId) {
  const rows = await hana.query(
    'SELECT * FROM AGENT_LOGS WHERE USER_ID = ? ORDER BY TIMESTAMP DESC LIMIT 200',
    [userId]
  );
  return rows.map(rowToRecord);
}

module.exports = { getAlerts, addAlert, acknowledgeAlert, getMonitoringLogs, addMonitoringLog, addAgentLog, getAgentLogs };