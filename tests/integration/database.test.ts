import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getDatabaseUrl } from '../../src/lib/database';

describe('PostgreSQL connectivity (synthetic data only)', () => {
  const client = new pg.Client({ connectionString: getDatabaseUrl() });

  beforeAll(async () => {
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  it('answers select 1', async () => {
    const result = await client.query('select 1 as ok');
    expect(result.rows[0].ok).toBe(1);
  });

  it('round-trips a synthetic row in a temp table', async () => {
    await client.query('create temp table w1a_probe (id serial primary key, label text not null)');
    await client.query('insert into w1a_probe (label) values ($1)', ['synthetic']);
    const result = await client.query('select label from w1a_probe');
    expect(result.rows).toEqual([{ label: 'synthetic' }]);
  });
});
