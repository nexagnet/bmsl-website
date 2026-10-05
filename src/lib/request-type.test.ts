import { describe, expect, it } from 'vitest';
import { REQUEST_TYPES } from '../collections/ContactLeads';
import { DEFAULT_REQUEST_TYPE, REQUEST_TYPE_OPTIONS, requestTypeFromSearch } from './request-type';

describe('requestTypeFromSearch', () => {
  it('mirrors the collection request types', () => {
    expect([...REQUEST_TYPE_OPTIONS]).toEqual([...REQUEST_TYPES]);
  });

  it('prefills each valid option', () => {
    for (const type of REQUEST_TYPES) expect(requestTypeFromSearch(`?requestType=${type}`)).toBe(type);
  });

  it('uses the safe default for unknown, empty, repeated or missing values', () => {
    for (const search of ['', '?requestType=', '?requestType=admin', '?requestType=BAO-GIA', '?requestType=bao-gia&requestType=khac', '?x=bao-gia'])
      expect(requestTypeFromSearch(search)).toBe(DEFAULT_REQUEST_TYPE);
  });
});
