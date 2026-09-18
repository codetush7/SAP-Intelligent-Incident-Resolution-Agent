const { v4: uuidv4 } = require('uuid');
const hana = require('../db/hanaClient');
const { normalizeFingerprint, createIssueFingerprint } = require('../utils/fingerprint');

function normalizeTicketData(data = {}) {
    const normalized = { ...data };
    if (data.status !== undefined) normalized.status = String(data.status).toUpperCase();
    if (data.priority !== undefined) normalized.priority = String(data.priority).toUpperCase();
    if (data.category !== undefined) normalized.category = String(data.category).toUpperCase();
    return normalized;
}

function rowToTicket(row) {
    return {
        id: row.ID,
        userId: row.USER_ID,
        ticketNumber: row.TICKET_NUMBER,
        issueFingerprint: row.ISSUE_FINGERPRINT,
        status: row.STATUS,
        priority: row.PRIORITY,
        category: row.CATEGORY,
        title: row.TITLE,
        description: row.DESCRIPTION,
        aiAnalyzed: !!row.AI_ANALYZED,
        ...JSON.parse(row.PAYLOAD_JSON || '{}'),
        createdAt: row.CREATED_AT,
        updatedAt: row.UPDATED_AT
    };
}

async function getTickets(userId) {
    const rows = await hana.query('SELECT * FROM TICKETS WHERE USER_ID = ? ORDER BY CREATED_AT DESC', [userId]);
    return rows.map(rowToTicket);
}

async function getTicketById(id, userId) {
    const rows = await hana.query('SELECT * FROM TICKETS WHERE ID = ? AND USER_ID = ?', [id, userId]);
    return rows[0] ? rowToTicket(rows[0]) : null;
}

async function findDuplicateTicket(userId, ticketData) {
    const fp = normalizeFingerprint(ticketData.issueFingerprint || createIssueFingerprint(ticketData));
    if (!fp) return null;
    const rows = await hana.query(
        'SELECT * FROM TICKETS WHERE USER_ID = ? AND ISSUE_FINGERPRINT = ?',
        [userId, fp]
    );
    return rows[0] ? rowToTicket(rows[0]) : null;
}

async function createTicket(userId, data) {
    const duplicate = await findDuplicateTicket(userId, data);
    if (duplicate) return duplicate;

    const normalized = normalizeTicketData(data);
    const fp = normalizeFingerprint(data.issueFingerprint || createIssueFingerprint(data));

    const countRows = await hana.query('SELECT COUNT(*) AS CNT FROM TICKETS WHERE USER_ID = ?', [userId]);
    const userTicketCount = countRows[0].CNT;

    const id = uuidv4();
    const ticketNumber = `CPI-${1000 + userTicketCount + 1}`;
    const { status, priority, category, title, description, ...rest } = normalized;

    await hana.exec(
        `INSERT INTO TICKETS
     (ID, USER_ID, TICKET_NUMBER, ISSUE_FINGERPRINT, STATUS, PRIORITY, CATEGORY, TITLE, DESCRIPTION, AI_ANALYZED, PAYLOAD_JSON)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, userId, ticketNumber, fp, status || 'OPEN', priority, category, title, description, false, JSON.stringify(rest)]
    );

    return getTicketById(id, userId);
}

async function updateTicket(id, userId, data) {
    const existing = await getTicketById(id, userId);
    if (!existing) return null;

    const normalized = normalizeTicketData(data);
    const merged = { ...existing, ...normalized };
    const { status, priority, category, title, description, id: _i, userId: _u, ticketNumber, issueFingerprint, aiAnalyzed, createdAt, updatedAt, ...rest } = merged;

    await hana.exec(
        `UPDATE TICKETS SET STATUS=?, PRIORITY=?, CATEGORY=?, TITLE=?, DESCRIPTION=?, AI_ANALYZED=?, PAYLOAD_JSON=?, UPDATED_AT=CURRENT_TIMESTAMP
     WHERE ID=? AND USER_ID=?`,
        [status, priority, category, title, description, !!aiAnalyzed, JSON.stringify(rest), id, userId]
    );

    return getTicketById(id, userId);
}

async function deleteTicket(id, userId) {
    await hana.exec('DELETE FROM TICKETS WHERE ID = ? AND USER_ID = ?', [id, userId]);
    return true;
}

async function getStats(userId) {
    const rows = await hana.query(
        `SELECT
       COUNT(*) AS TOTAL,
       SUM(CASE WHEN STATUS='OPEN' THEN 1 ELSE 0 END) AS OPEN_CNT,
       SUM(CASE WHEN STATUS='IN_PROGRESS' THEN 1 ELSE 0 END) AS IN_PROGRESS_CNT,
       SUM(CASE WHEN STATUS='RESOLVED' THEN 1 ELSE 0 END) AS RESOLVED_CNT,
       SUM(CASE WHEN PRIORITY='CRITICAL' THEN 1 ELSE 0 END) AS CRITICAL_CNT,
       SUM(CASE WHEN PRIORITY='HIGH' THEN 1 ELSE 0 END) AS HIGH_CNT,
       SUM(CASE WHEN PRIORITY='MEDIUM' THEN 1 ELSE 0 END) AS MEDIUM_CNT,
       SUM(CASE WHEN PRIORITY='LOW' THEN 1 ELSE 0 END) AS LOW_CNT,
       SUM(CASE WHEN AI_ANALYZED=TRUE THEN 1 ELSE 0 END) AS AI_ANALYZED_CNT
     FROM TICKETS WHERE USER_ID = ?`,
        [userId]
    );
    const alertRows = await hana.query(
        'SELECT COUNT(*) AS CNT FROM ALERTS WHERE USER_ID = ? AND ACKNOWLEDGED = FALSE',
        [userId]
    );
    const r = rows[0];
    return {
        total: r.TOTAL,
        open: r.OPEN_CNT,
        inProgress: r.IN_PROGRESS_CNT,
        resolved: r.RESOLVED_CNT,
        critical: r.CRITICAL_CNT,
        high: r.HIGH_CNT,
        medium: r.MEDIUM_CNT,
        low: r.LOW_CNT,
        activeAlerts: alertRows[0].CNT,
        aiAnalyzed: r.AI_ANALYZED_CNT
    };
}

module.exports = {
    getTickets, getTicketById, createTicket, updateTicket, deleteTicket,
    findDuplicateTicket, getStats
};