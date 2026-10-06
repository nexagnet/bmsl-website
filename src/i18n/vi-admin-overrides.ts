import { vi } from '@payloadcms/translations/languages/vi';
import type { DefaultTranslationsObject } from '@payloadcms/translations';

// Selective overrides of Payload 3.90.2's official `vi` catalog (admin UI language only; no data localization).
// Only keys whose upstream wording misstates the action are listed; every other key keeps the upstream translation.
// In Payload, "document" means any CMS record (article, project, global...), not the "Tài liệu" collection, so
// generic publish/unpublish wording refers to "nội dung". Keep every {{placeholder}} identical to upstream.
export const viAdminOverrides = {
  error: {
    unPublishingDocument: 'Lỗi - Đã xảy ra vấn đề khi gỡ xuất bản nội dung này.',
  },
  general: {
    // Back navigation (upstream: 'Quay lại').
    goBack: 'Trở lại',
  },
  version: {
    aboutToUnpublishIn: 'Bạn đang chuẩn bị gỡ xuất bản nội dung này trong {{locale}}. Bạn có chắc chắn không?',
    currentDocumentStatus: 'Trạng thái nội dung hiện tại: {{docStatus}}',
    currentDraft: 'Bản nháp hiện tại',
    publishChanges: 'Xuất bản các thay đổi',
    unpublish: 'Gỡ xuất bản',
    unpublishing: 'Đang gỡ xuất bản...',
    versions: 'Lịch sử phiên bản',
  },
} satisfies {
  [N in keyof DefaultTranslationsObject]?: Partial<DefaultTranslationsObject[N]>;
};

type Catalog = Record<string, Record<string, string>>;

export function mergeViAdmin(): DefaultTranslationsObject {
  const base = vi.translations as unknown as Catalog;
  const merged: Catalog = { ...base };
  for (const [ns, keys] of Object.entries(viAdminOverrides)) {
    merged[ns] = { ...base[ns], ...keys };
  }
  return merged as unknown as DefaultTranslationsObject;
}

export const viAdminTranslations = mergeViAdmin();
