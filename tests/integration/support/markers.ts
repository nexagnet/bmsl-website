// Synthetic marker strings shared by the HTTP fixture (seed) and the HTTP security assertions. "private" markers
// live only in drafts or internal fields and must never appear in any anonymous response; "public" markers are the
// approved positive controls and must be served.
export const MARKERS = {
  publicSummary: 'PUBLIC-PUBLISHED-SUMMARY-MARKER',
  draftSummary: 'PRIVATE-DRAFT-SUMMARY-MARKER',
  publicAbout: 'PUBLIC-ABOUT-TITLE-MARKER',
  draftAbout: 'PRIVATE-ABOUT-DRAFT-MARKER',
  draftHotline: 'PRIVATE-DRAFT-HOTLINE-MARKER',
  legacyUrl: 'https://legacy.invalid/PRIVATE-LEGACY-URL-MARKER',
  mediaSource: 'PRIVATE-MEDIA-SOURCE-MARKER',
  confirmedAddress: 'PUBLIC-CONFIRMED-ADDRESS-MARKER',
  confirmedFeedback: 'PUBLIC-CONFIRMED-FEEDBACK-MARKER',
  storedLegacySummary: 'PRIVATE-STORED-LEGACY-SUMMARY-MARKER',
  storedLegacyJobSalary: 'PRIVATE-STORED-LEGACY-JOB-SALARY-MARKER',
  unconfirmedDraftJobSalary: 'PRIVATE-UNCONFIRMED-DRAFT-JOB-SALARY-MARKER',
} as const;

export const PRIVATE_MARKERS = [
  MARKERS.draftSummary,
  MARKERS.draftAbout,
  MARKERS.draftHotline,
  'PRIVATE-LEGACY-URL-MARKER',
  MARKERS.mediaSource,
  MARKERS.unconfirmedDraftJobSalary,
];

/** Synthetic job postings (W5B3): slugs and the factual values the fixture enters. */
export const JOBS = {
  confirmed: 'synthetic-smoke-job-confirmed',
  noLocation: 'synthetic-smoke-job-no-location',
  noDate: 'synthetic-smoke-job-no-date',
  /** Draft + LEGACY-SOURCE: never public. */
  unconfirmedDraft: 'synthetic-smoke-job-unconfirmed-draft',
  /** Draft + CONFIRMED with facts: never public while draft. */
  confirmedDraft: 'synthetic-smoke-job-confirmed-draft',
  /** CONFIRMED + published at seed time; the test downgrades it to LEGACY-SOURCE by SQL (legacy-preexisting row). */
  storedLegacy: 'synthetic-smoke-job-stored-legacy',
  datePosted: '2026-03-04T00:00:00.000Z',
  locality: 'SYNTHETIC-LOCALITY-MARKER',
  country: 'ZZ',
} as const;

/** Slug of the project that is CONFIRMED + published at seed time and downgraded to LEGACY-SOURCE by SQL in the test. */
export const STORED_LEGACY_SLUG = 'synthetic-smoke-stored-legacy';
