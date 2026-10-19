import { describe, expect, it } from 'vitest';
import { REQUEST_TYPES } from '../collections/ContactLeads';
import { contextMessageFromSearch, DEFAULT_REQUEST_TYPE, REQUEST_TYPE_OPTIONS, requestTypeFromSearch } from './request-type';

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

describe('contextMessageFromSearch', () => {
  it('echoes a strictly shaped project slug inside a fixed sentence', () => {
    expect(contextMessageFromSearch('?requestType=khac&project=ecolife-tay-ho')).toBe('Tôi muốn đăng ký tham quan dự án (ecolife-tay-ho).');
    expect(contextMessageFromSearch('?project=b6-nam-trung-yen')).toContain('b6-nam-trung-yen');
  });

  it('never reflects anything else: empty, repeated, unknown shape, markup or over-long values give an empty message', () => {
    const tooLong = 'a'.repeat(101);
    for (const search of [
      '',
      '?project=',
      '?project=A-B',
      '?project=a--b',
      '?project=-a',
      '?project=a_b',
      '?project=<script>alert(1)</script>',
      '?project=%3Cb%3E',
      '?project=a%20b',
      '?project=a&project=b',
      '?context=ho-so-nang-luc',
      `?project=${tooLong}`,
    ])
      expect(contextMessageFromSearch(search), search).toBe('');
  });
});
