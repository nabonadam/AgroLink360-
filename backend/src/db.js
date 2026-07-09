import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => console.error('Unexpected PG pool error', err));

// Small query helper. Usage: const { rows } = await q('SELECT ...', [params])
export const q = (text, params) => pool.query(text, params);

// Build a PostGIS point expression from lon/lat (returns SQL fragment + value array)
export const pointSQL = (lon, lat) =>
  lon != null && lat != null
    ? `ST_SetSRID(ST_MakePoint(${Number(lon)}, ${Number(lat)}), 4326)::geography`
    : 'NULL';
