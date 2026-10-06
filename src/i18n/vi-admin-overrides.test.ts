import { describe, expect, it } from 'vitest';
import { en } from '@payloadcms/translations/languages/en';
import { vi } from '@payloadcms/translations/languages/vi';
import { viAdminOverrides, viAdminTranslations } from './vi-admin-overrides';

type Catalog = Record<string, Record<string, string>>;
const upstream = vi.translations as unknown as Catalog;
const english = en.translations as unknown as Catalog;
const merged = viAdminTranslations as unknown as Catalog;
const overrides = viAdminOverrides as unknown as Catalog;

const placeholders = (s: string) => [...s.matchAll(/\{\{\s*\w+\s*\}\}/g)].map((m) => m[0]).sort();

describe('vi admin overrides', () => {
  it('only overrides keys that exist upstream and keeps interpolation variables', () => {
    for (const [ns, keys] of Object.entries(overrides)) {
      for (const [key, value] of Object.entries(keys)) {
        expect(english[ns]?.[key], `${ns}:${key}`).toBeDefined();
        expect(placeholders(value), `${ns}:${key}`).toEqual(placeholders(upstream[ns]![key]!));
      }
    }
  });

  it('applies the confirmed glossary to the exact Payload 3.90.2 keys', () => {
    expect(english.general!.goBack).toBe('Go back');
    expect(merged.general!.goBack).toBe('Trở lại');
    expect(english.version!.publishChanges).toBe('Publish changes');
    expect(merged.version!.publishChanges).toBe('Xuất bản các thay đổi');
    expect(english.version!.unpublish).toBe('Unpublish');
    expect(merged.version!.unpublish).toBe('Gỡ xuất bản');
    expect(merged.version!.versions).toBe('Lịch sử phiên bản');
    expect(merged.version!.saveDraft).toBe('Lưu bản nháp');
    expect(merged.version!.publish).toBe('Xuất bản');
    expect(merged.version!.draft).toBe('Bản nháp');
    expect(merged.version!.published).toBe('Đã xuất bản');
    expect(merged.general!.dashboard).toBe('Bảng điều khiển');
    expect(merged.general!.createNew).toBe('Tạo mới');
    expect(merged.general!.save).toBe('Lưu');
    expect(merged.general!.cancel).toBe('Hủy');
    expect(merged.general!.confirm).toBe('Xác nhận');
  });

  it('no longer calls the generic publish/unpublish actions "tài liệu"', () => {
    expect(merged.version!.publishChanges).not.toMatch(/tài liệu/i);
    expect(merged.version!.unpublish).not.toMatch(/tài liệu/i);
    expect(merged.version!.unpublishing).not.toMatch(/tài liệu/i);
  });

  it('leaves every key outside the overrides identical to upstream', () => {
    for (const [ns, keys] of Object.entries(upstream)) {
      for (const [key, value] of Object.entries(keys)) {
        if (overrides[ns]?.[key] !== undefined) continue;
        expect(merged[ns]![key], `${ns}:${key}`).toBe(value);
      }
    }
  });
});
