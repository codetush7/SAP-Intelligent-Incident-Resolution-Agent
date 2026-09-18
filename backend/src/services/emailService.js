const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
const smtpPort = parseInt(process.env.SMTP_PORT || '465', 10);
const smtpSecure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : true;

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpSecure,
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD
  }
});

const PRIORITY_LABELS = {
  CRITICAL: { label: 'P1 - CRITICAL', color: '#ef4444', emoji: '🔴' },
  HIGH:     { label: 'P2 - HIGH',     color: '#f97316', emoji: '🟠' },
  MEDIUM:   { label: 'P3 - MEDIUM',   color: '#f59e0b', emoji: '🟡' },
  LOW:      { label: 'P4 - LOW',      color: '#10b981', emoji: '🟢' }
};

async function sendAlertEmail(ticket, jiraKey) {
  if (!process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD || !process.env.ALERT_EMAIL_TO) {
    logger.warn('[Email] Email not configured — skipping alert');
    return null;
  }

  const allowedPriorities = (process.env.EMAIL_ALERT_PRIORITIES || 'CRITICAL,HIGH,MEDIUM,LOW')
    .split(',')
    .map(p => p.trim().toUpperCase())
    .filter(Boolean);

  const priority = ticket.priority ? String(ticket.priority).toUpperCase() : 'LOW';
  if (!allowedPriorities.includes(priority)) {
    logger.info(`[Email] Skipping email for ${priority} (not in alert priority list)`);
    return null;
  }

  const p = PRIORITY_LABELS[priority] || PRIORITY_LABELS.MEDIUM;  

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 700px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: ${p.color}; color: white; padding: 24px; }
    .header h1 { margin: 0; font-size: 20px; }
    .header p { margin: 4px 0 0; opacity: 0.9; font-size: 14px; }
    .badge { display: inline-block; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: bold; margin-top: 8px; }
    .body { padding: 24px; }
    .section { margin-bottom: 20px; }
    .section h3 { color: #374151; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
    .section p { margin: 0; color: #4b5563; font-size: 14px; line-height: 1.6; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
    .field { background: #f9fafb; padding: 12px; border-radius: 6px; border-left: 3px solid ${p.color}; }
    .field label { font-size: 11px; color: #6b7280; text-transform: uppercase; font-weight: bold; display: block; margin-bottom: 4px; }
    .field span { font-size: 14px; color: #111827; font-weight: 500; }
    .recommendation { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 6px; }
    .recommendation h3 { color: #166534; border-bottom-color: #bbf7d0; }
    .recommendation p { color: #166534; }
    .footer { background: #f9fafb; padding: 16px 24px; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
    .jira-link { display: inline-block; background: #0052cc; color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: bold; margin-top: 12px; }
    .action-box { background: #fef2f2; border: 1px solid #fecaca; padding: 16px; border-radius: 6px; margin-bottom: 20px; }
    .action-box h3 { color: #991b1b; border-bottom-color: #fecaca; }
    .action-box ul { margin: 8px 0 0; padding-left: 20px; color: #991b1b; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${p.emoji} SAP CPI Integration Alert</h1>
      <p>${ticket.title}</p>
      <div class="badge">${p.label}</div>
    </div>
    <div class="body">

      ${ticket.priority === 'CRITICAL' ? `
      <div class="action-box">
        <h3>⚡ IMMEDIATE ACTION REQUIRED</h3>
        <ul>
          <li>Notify support team immediately</li>
          <li>Stop message retry</li>
          <li>Escalate to manager if not resolved in 30 mins</li>
        </ul>
      </div>` : ''}

      <div class="grid">
        <div class="field">
          <label>Ticket</label>
          <span>${ticket.ticketNumber}</span>
        </div>
        <div class="field">
          <label>Priority</label>
          <span>${p.label}</span>
        </div>
        <div class="field">
          <label>Interface / iFlow</label>
          <span>${ticket.iflow || ticket.interface || 'N/A'}</span>
        </div>
        <div class="field">
          <label>Package</label>
          <span>${ticket.packageName || 'N/A'}</span>
        </div>
        <div class="field">
          <label>Error Code</label>
          <span>${ticket.errorCode || 'N/A'}</span>
        </div>
        <div class="field">
          <label>Assigned Team</label>
          <span>${ticket.assignedTeam || 'N/A'}</span>
        </div>
        <div class="field">
          <label>Timestamp</label>
          <span>${new Date(ticket.createdAt).toLocaleString()}</span>
        </div>
        <div class="field">
          <label>Jira Ticket</label>
          <span>${jiraKey || 'N/A'}</span>
        </div>
      </div>

      <div class="section">
        <h3>🔍 Root Cause</h3>
        <p>${ticket.rootCause || 'Under investigation'}</p>
      </div>

      <div class="section">
        <h3>📋 Evidence</h3>
        <p>${ticket.evidence || ticket.errorMessage || 'N/A'}</p>
      </div>

      <div class="section">
        <h3>💥 Business Impact</h3>
        <p>${ticket.impact || 'Integration flow disrupted'}</p>
      </div>

      <div class="recommendation">
        <h3>✅ Recommendation</h3>
        <p>${ticket.recommendation || 'Review CPI logs'}</p>
      </div>

      ${jiraKey ? `<a class="jira-link" href="${ticket.jiraUrl}">Open Jira Ticket ${jiraKey}</a>` : ''}
      ${ticket.monitorUrl ? `&nbsp;&nbsp;<a class="jira-link" style="background:#1e3a5f;" href="${ticket.monitorUrl}">Open in SAP CPI</a>` : ''}

    </div>
    <div class="footer">
      This alert was automatically generated by <strong>SAP CPI AI Ticketing Agent</strong> powered by Grok AI.<br>
      Ticket: ${ticket.ticketNumber} | Category: ${ticket.category || 'GENERAL'} | Source: ${ticket.systemSource || 'SAP_CPI'}
    </div>
  </div>
</body>
</html>`;

  const subject = `${p.emoji} [${p.label}] SAP CPI Alert: ${ticket.title}`;

  try {
    await transporter.sendMail({
      from: `"SAP CPI Agent" <${process.env.SMTP_EMAIL}>`,
      to: process.env.ALERT_EMAIL_TO,
      subject,
      html
    });
    logger.info(`[Email] Alert sent to ${process.env.ALERT_EMAIL_TO} for ${ticket.ticketNumber}`);
    return { sent: true, to: process.env.ALERT_EMAIL_TO };
  } catch (err) {
    logger.error(`[Email] Failed to send alert: ${err.message}`);
    return { sent: false, error: err.message };
  }
}

module.exports = { sendAlertEmail };