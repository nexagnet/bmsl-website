import { getPayload } from 'payload';
import config from '../payload.config';
import { seedServiceAreas } from './service-areas';

// Manual, non-production only: `pnpm seed:service-areas` (never wired into build/start/CI deploy).
if (process.env.NODE_ENV === 'production' && process.env.BMSL_ALLOW_SEED !== 'true') {
  throw new Error('Refusing to seed in production (set BMSL_ALLOW_SEED=true only after owner approval)');
}

const payload = await getPayload({ config });
const created = await seedServiceAreas(payload);
payload.logger.info(`service-areas seed: created ${created.length} (${created.join(', ') || 'none'})`);
await payload.destroy();
process.exit(0);
