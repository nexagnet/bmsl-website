import { assertWorkerTarget, ADMIN_URL_ENV, INVOCATION_DB_ENV } from './disposable-db';

// vitest setupFile: runs in every test worker before its suite imports anything. If the entrypoint's disposable
// database did not reach this worker, the suite fails loudly instead of resetting the schema of whatever
// DATABASE_URL happens to name (fail closed, never a silent fallback to the shared database).
assertWorkerTarget(process.env.DATABASE_URL, process.env[INVOCATION_DB_ENV]);
if (!process.env[ADMIN_URL_ENV]) throw new Error(`${ADMIN_URL_ENV} was not provided by the integration entrypoint`);
