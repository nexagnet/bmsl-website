import { describe, expect, it } from 'vitest';
import { REQUEST_TYPES } from '../collections/ContactLeads';
import { contextMessageFromSearch, DEFAULT_REQUEST_TYPE, REQUEST_TYPE_OPTIONS, requestTypeFromSearch } from './request-type';

describe('contextMessageFromSearch', () => {
  it('prefills only for a known context key or a strictly shaped project slug', () => {
    expect(contextMessageFromSearch('?context=ho-so-nang-luc')).toContain('hồ sơ năng lực');
    expect(contextMessageFromSearch('?requestType=khac&project=du-an-mau-1')).toContain('(du-an-mau-1)');
  });

  it('never reflects unknown, repeated, malformed or over-long values', () => {
    for (const search of [
      '',
      '?context=unknown',
      '?context=__proto__',
      '?context=ho-so-nang-luc&context=ho-so-nang-luc',
      '?project=Du_An',
      '?project=<script>',
      '?project=a&project=b',
      `?project=${'a'.repeat(101)}`,
    ])
      expect(contextMessageFromSearch(search), search).toBe('');
  });
});

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
