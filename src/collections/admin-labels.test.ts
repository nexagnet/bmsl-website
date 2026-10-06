import { describe, expect, it } from 'vitest';
import type { CollectionConfig, GlobalConfig, SelectField } from 'payload';
import { ArticleCategories, Articles, Documents, JobPostings, Projects, ServiceAreas } from './content';
import { ContactLeads } from './ContactLeads';
import { MediaAssets } from './MediaAssets';
import { Redirects } from './Redirects';
import { Users } from './Users';
import { AboutPage, ContactPage, HomePage, ProcessPage, SiteSettings } from '../globals';

// Admin UI i18n contract: Vietnamese display labels only; slugs and stored option values must not change.

const plural = (c: CollectionConfig) => (c.labels?.plural as string | undefined) ?? '';

const select = (c: CollectionConfig, name: string) =>
  c.fields.find((f) => 'name' in f && f.name === name) as SelectField;

const values = (field: SelectField) =>
  field.options.map((o) => (typeof o === 'string' ? o : o.value));

describe('admin collection and global labels', () => {
  it('names the 10 collections in Vietnamese and keeps their slugs', () => {
    const expected: Array<[CollectionConfig, string, string]> = [
      [Users, 'users', 'Tài khoản'],
      [MediaAssets, 'media-assets', 'Thư viện ảnh và tệp'],
      [ServiceAreas, 'service-areas', 'Lĩnh vực dịch vụ'],
      [ArticleCategories, 'article-categories', 'Chuyên mục bài viết'],
      [Projects, 'projects', 'Dự án'],
      [Articles, 'articles', 'Bài viết'],
      [JobPostings, 'job-postings', 'Tin tuyển dụng'],
      [Documents, 'documents', 'Tài liệu'],
      [Redirects, 'redirects', 'Chuyển hướng URL'],
      [ContactLeads, 'contact-leads', 'Yêu cầu liên hệ'],
    ];
    for (const [config, slug, label] of expected) {
      expect(config.slug).toBe(slug);
      expect(plural(config)).toBe(label);
    }
  });

  it('names the 5 globals in Vietnamese and keeps their slugs', () => {
    const expected: Array<[GlobalConfig, string, string]> = [
      [HomePage, 'home-page', 'Trang chủ'],
      [AboutPage, 'about-page', 'Giới thiệu'],
      [ProcessPage, 'process-page', 'Quy trình và minh bạch'],
      [ContactPage, 'contact-page', 'Trang liên hệ'],
      [SiteSettings, 'site-settings', 'Cài đặt website'],
    ];
    for (const [config, slug, label] of expected) {
      expect(config.slug).toBe(slug);
      expect(config.label).toBe(label);
    }
  });
});

describe('select option machine values are unchanged', () => {
  it('keeps role, source, rights, lead and redirect values', () => {
    expect(values(select(Users, 'role'))).toEqual(['ADMIN', 'EDITOR']);
    expect(values(select(Projects, 'sourceStatus'))).toEqual(['LEGACY-SOURCE', 'CONFIRMED']);
    expect(values(select(JobPostings, 'sourceStatus'))).toEqual(['LEGACY-SOURCE', 'CONFIRMED']);
    expect(values(select(MediaAssets, 'rightsStatus'))).toEqual(['UNCONFIRMED', 'APPROVED']);
    expect(values(select(ContactLeads, 'status'))).toEqual(['new', 'handled']);
    expect(values(select(ContactLeads, 'requestType'))).toEqual(['khao-sat', 'bao-gia', 'khac']);
    expect(values(select(Redirects, 'type'))).toEqual(['301']);
  });

  it('labels LEGACY-SOURCE as unconfirmed legacy source', () => {
    const legacy = select(Projects, 'sourceStatus').options.find(
      (o) => typeof o !== 'string' && o.value === 'LEGACY-SOURCE',
    );
    expect(legacy).toMatchObject({ label: 'Nguồn cũ – chưa xác nhận' });
  });

  it('keeps the unchanged defaults', () => {
    expect(select(Projects, 'sourceStatus').defaultValue).toBe('LEGACY-SOURCE');
    expect(select(MediaAssets, 'rightsStatus').defaultValue).toBe('UNCONFIRMED');
    expect(select(ContactLeads, 'status').defaultValue).toBe('new');
    expect(select(Users, 'role').defaultValue).toBe('EDITOR');
  });
});

describe('no data localization', () => {
  it('does not mark any top-level field localized', () => {
    const all = [Users, MediaAssets, ServiceAreas, ArticleCategories, Projects, Articles, JobPostings, Documents, Redirects, ContactLeads];
    for (const c of all) {
      for (const f of c.fields) expect('localized' in f && f.localized).toBeFalsy();
    }
  });
});
