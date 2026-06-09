/**
 * DIARY_SEARCH — Logic
 * Pure local search. No server calls, no AI, no logging.
 * All filters are AND-combined.
 */

import type {
  DiaryEntry,
  DiarySearchQuery,
  DiarySearchResult,
  DiarySearchResultItem,
} from './diary-search-types';

export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function getFirstTwoSentences(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return '';

  const sentenceMatches = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
  if (!sentenceMatches) return clean.slice(0, 220);

  const firstTwo = sentenceMatches.slice(0, 2).join(' ').trim();
  return firstTwo.length > 240 ? firstTwo.slice(0, 237) + '...' : firstTwo;
}

export function searchDiaryEntries(
  entries: DiaryEntry[],
  query: DiarySearchQuery
): DiarySearchResult {
  const limit = query.limit ?? 50;
  const offset = query.offset ?? 0;

  const normalizedFreeText = normalizeSearchText(query.freeText || '');
  const hasFreeText = normalizedFreeText.length > 0;
  const selectedTags = query.emotionTags || [];
  const hasTags = selectedTags.length > 0;
  const selectedType = query.type || 'ALL';

  const filtered = entries
    .filter(entry => !entry.isDeleted)
    .filter(entry => entry.persona === query.persona)
    .map(entry => {
      const matchedBy: DiarySearchResultItem['matchedBy'] = [];

      if (hasFreeText) {
        const normalizedEntryText = normalizeSearchText(entry.text);
        if (!normalizedEntryText.includes(normalizedFreeText)) return null;
        matchedBy.push('freeText');
      }

      if (hasTags) {
        const hasAllSelectedTags = selectedTags.every(tag =>
          entry.emotionTags.includes(tag)
        );
        if (!hasAllSelectedTags) return null;
        matchedBy.push('emotionTag');
      }

      if (query.dateRange?.fromIso) {
        if (new Date(entry.createdAt).getTime() < new Date(query.dateRange.fromIso).getTime()) {
          return null;
        }
        matchedBy.push('dateRange');
      }

      if (query.dateRange?.toIso) {
        if (new Date(entry.createdAt).getTime() > new Date(query.dateRange.toIso).getTime()) {
          return null;
        }
        if (!matchedBy.includes('dateRange')) matchedBy.push('dateRange');
      }

      if (selectedType !== 'ALL') {
        if (entry.type !== selectedType) return null;
        matchedBy.push('type');
      }

      return {
        entryId: entry.entryId,
        persona: entry.persona,
        type: entry.type,
        createdAt: entry.createdAt,
        previewText: getFirstTwoSentences(entry.text),
        emotionTags: entry.emotionTags,
        matchedBy,
      };
    })
    .filter((item): item is DiarySearchResultItem => item !== null)
    .sort((a, b) => {
      const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return query.sortOrder === 'oldest_first' ? diff : -diff;
    });

  const paginated = filtered.slice(offset, offset + limit);

  return {
    featureId: 'DIARY_SEARCH',
    persona: query.persona,
    query,
    totalMatches: filtered.length,
    returnedCount: paginated.length,
    items: paginated,
    localOnly: true,
    aiAnalysisUsed: false,
  };
}
