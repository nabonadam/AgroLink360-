import bcrypt from 'bcryptjs';
import { pool, q } from './db.js';

// Seeds demo data matching the AgroLink360 prototype (Ashanti corridor).
// Default password for every demo account:  password123

const PW = await bcrypt.hash('password123', 10);

async function seed() {
  // Safe to run on every deploy: skip if demo data is already there.
  const { rows: existing } = await q('SELECT id FROM users WHERE phone = $1', ['+233241000001']);
  if (existing.length) {
    console.log('Seed data already present — skipping.');
    await pool.end();
    return;
  }

  console.log('Seeding demo data…');

  // ── Users ──
  const users = [
    ['farmer', 'Yaw Mensah', '+233241000001', 'Ejisu', -1.3667, 6.6884, '+233241000001'],
    ['farmer', 'Adwoa Boateng', '+233241000002', 'Akomadan', -1.9667, 7.2333, '+233241000002'],
    ['farmer', 'Kwabena Osei', '+233241000003', 'Offinso', -1.7667, 7.0167, '+233241000003'],
    ['buyer', 'Kumasi Fresh Foods', '+233241000010', 'Kumasi', -1.6244, 6.6885, null],
    ['transporter', 'Kofi Asante', '+233241000020', 'Ejisu', -1.3667, 6.6884, '+233241000020'],
  ];
  const ids = {};
  for (const [role, name, phone, community, lon, lat, momo] of users) {
    const { rows } = await q(
      `INSERT INTO users (role, name, phone, password_hash, community, momo_number, location)
       VALUES ($1,$2,$3,$4,$5,$6, ST_SetSRID(ST_MakePoint($7,$8),4326)::geography)
       ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [role, name, phone, PW, community, momo, lon, lat]
    );
    ids[name] = rows[0].id;
  }

  // ── Transport provider profile ──
  await q(
    `INSERT INTO transport_providers (user_id, vehicle_type, plate, capacity_kg, available, location, rating)
     VALUES ($1,'tricycle','GR 4821-22',500,true, ST_SetSRID(ST_MakePoint(-1.3667,6.6884),4326)::geography, 4.8)
     ON CONFLICT DO NOTHING`,
    [ids['Kofi Asante']]
  );

  // ── Produce listings ──
  const listings = [
    [ids['Yaw Mensah'], 'Tomatoes', 'Tomatoes', 18, 'crate', 140, 92, 'listed'],
    [ids['Adwoa Boateng'], 'Garden Eggs', 'Garden Eggs', 9, 'crate', 130, 88, 'listed'],
    [ids['Kwabena Osei'], 'Sweet Pepper', 'Sweet Pepper', 6, 'crate', 115, 95, 'listed'],
    [ids['Yaw Mensah'], 'Cabbage', 'Cabbage', 30, 'head', 15, 74, 'low_stock'],
    [ids['Yaw Mensah'], 'Okro', 'Okro', 14, 'basket', 60, 81, 'listed'],
    [ids['Adwoa Boateng'], 'Onion', 'Onion', 22, 'sack', 320, 67, 'spoilage_risk'],
  ];
  for (const [farmer, name, cat, qty, unit, price, fresh, status] of listings) {
    await q(
      `INSERT INTO produce_listings (farmer_id, name, category, quantity, unit, price_ghs, freshness_score, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [farmer, name, cat, qty, unit, price, fresh, status]
    );
  }

  // ── Price history (feeds the AI price model) ──
  const today = new Date();
  for (const [produce, base, unit] of [['Tomatoes', 140, 'crate'], ['Onion', 320, 'sack'], ['Cabbage', 15, 'head']]) {
    for (let d = 60; d >= 0; d -= 5) {
      const day = new Date(today.getTime() - d * 864e5).toISOString().slice(0, 10);
      const price = Math.round(base * (1 + Math.sin(d / 12) * 0.15));
      await q(
        `INSERT INTO price_history (produce_name, market, unit, price_ghs, recorded_on)
         VALUES ($1,'Kumasi Central',$2,$3,$4)`,
        [produce, unit, price, day]
      );
    }
  }

  console.log('✓ Seed complete. Demo logins (password: password123):');
  console.log('  Farmer       +233241000001');
  console.log('  Buyer        +233241000010');
  console.log('  Transporter  +233241000020');
  await pool.end();
}


seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
