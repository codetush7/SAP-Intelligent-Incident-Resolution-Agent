const fs = require('fs');
const path = require('path');
const hana = require('./hanaClient');
const logger = require('../utils/logger');

async function run() {
    const sqlPath = path.join(__dirname, 'migrations', '001_create_tables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(Boolean);

    for (const stmt of statements) {
        try {
            await hana.exec(stmt);
            logger.info(`[Migrate] OK: ${stmt.slice(0, 60)}...`);
        } catch (err) {
            // Ignore "already exists" so migrate.js is safe to re-run
            if (!/exists/i.test(err.message)) {
                logger.error(`[Migrate] FAILED: ${stmt.slice(0, 60)}... -> ${err.message}`);
                throw err;
            }
        }
    }
    logger.info('[Migrate] Done.');
    process.exit(0);
}

run().catch((err) => {
    logger.error(`[Migrate] Aborted: ${err.message}`);
    process.exit(1);
});