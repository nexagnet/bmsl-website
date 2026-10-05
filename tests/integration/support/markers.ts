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
} as const;

export const PRIVATE_MARKERS = [
  MARKERS.draftSummary,
  MARKERS.draftAbout,
  MARKERS.draftHotline,
  'PRIVATE-LEGACY-URL-MARKER',
  MARKERS.mediaSource,
];

/** Slug of the project that is CONFIRMED + published at seed time and downgraded to LEGACY-SOURCE by SQL in the test. */
export const STORED_LEGACY_SLUG = 'synthetic-smoke-stored-legacy';
