import type { FullConfig } from '@playwright/test';

import { ensureE2EData } from './support/database';

export default async function globalSetup(_config: FullConfig) {
  await ensureE2EData();
}
