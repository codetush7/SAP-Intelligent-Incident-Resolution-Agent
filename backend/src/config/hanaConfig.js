require('dotenv').config();

module.exports = {
    host: process.env.HANA_HOST,
    port: parseInt(process.env.HANA_PORT || '443', 10),
    user: process.env.HANA_USER,
    password: process.env.HANA_PASSWORD,
    schema: process.env.HANA_SCHEMA || 'CPI_AGENT',
    encrypt: process.env.HANA_ENCRYPT !== 'false', // HANA Cloud requires TLS
    sslValidateCertificate: process.env.HANA_SSL_VALIDATE !== 'false',
    pool: {
        min: parseInt(process.env.HANA_POOL_MIN || '2', 10),
        max: parseInt(process.env.HANA_POOL_MAX || '10', 10)
    }
};