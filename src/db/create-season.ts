/**
 * Creates a season and sets it ACTIVE.
 *
 *   npm run season:create -- "2026 Football" 2026-09-01 2027-01-31
 *
 * Production's counterpart to the season half of `seed.ts`, without the fixture odds slate
 * that makes `seed.ts` unsafe to point at a real database. Refuses to run if a season is
 * already ACTIVE, since two active seasons is not a state the app models.
 */
import { config } from 'dotenv';

config({ path: process.env.ENV_FILE ?? '.env.local' });

async function run() {
  const [name, startsAt, endsAt] = process.argv.slice(2);
  if (!name || !startsAt || !endsAt) {
    console.error('usage: npm run season:create -- "<name>" <starts-at> <ends-at>');
    process.exit(1);
  }

  const starts = new Date(startsAt);
  const ends = new Date(endsAt);
  if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) {
    console.error('starts-at and ends-at must be parseable dates, e.g. 2026-09-01');
    process.exit(1);
  }
  if (ends <= starts) {
    console.error('ends-at must be after starts-at');
    process.exit(1);
  }

  // Imported after dotenv so the db client sees DATABASE_URL.
  const { db, pgClient } = await import('./client');
  const { seasons } = await import('./schema');
  const { eq } = await import('drizzle-orm');
  const { createSeason } = await import('@/server/seasons/service');

  const [active] = await db.select().from(seasons).where(eq(seasons.status, 'ACTIVE'));
  if (active) {
    console.error(`season "${active.name}" is already ACTIVE; end it before creating another`);
    await pgClient.end();
    process.exit(1);
  }

  const season = await createSeason({ name, startsAt: starts, endsAt: ends });
  await db.update(seasons).set({ status: 'ACTIVE' }).where(eq(seasons.id, season.id));
  await pgClient.end();

  console.log(`created "${season.name}" and set it ACTIVE`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
