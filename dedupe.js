import { pool, q } from './db.js';

// One-off cleanup: earlier deploys ran the seed script twice before it had a
// skip-guard, creating duplicate demo listings. This removes exact duplicates
// (same name + farmer), keeping the oldest row. Safe to run repeatedly —
// once duplicates are gone, it does nothing.

async function dedupe() {
  const { rowCount } = await q(`
    DELETE FROM produce_listings a
    USING produce_listings b
    WHERE a.id > b.id
      AND a.name = b.name
      AND a.farmer_id = b.farmer_id
  `);
  console.log(`Removed ${rowCount} duplicate listing row(s).`);
  await pool.end();
}

dedupe().catch((err) => {
  console.error('Dedupe failed:', err.message);
  process.exit(1);
});
