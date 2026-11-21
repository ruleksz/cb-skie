import mysql from 'mysql2/promise';

export function createPool(dbConfig, overrides = {}) {
  return mysql.createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4',
    ...overrides,
  });
}
