/**
 * DIARY_SEARCH — Types
 * Local, persona-separated diary filtering.
 * No server calls, no AI analysis, no logging.
 */

export type DiarySearchPersona = 'elias' | 'kim';

export type DiaryEntryType = 'Journal' | 'Gratitude';

export type DiaryEmotionTag =
  | 'Calm'
  | 'Sad'
  | 'Anxious'
  | 'Hopeful'
  | 'Angry'
  | 'Ashamed'
  | 'Lonely'
  | 'Tired'
  | 'Overloaded'
  | 'Restless'
  | 'Grateful'
  | 'Empty'
  | 'Proud'
  | 'Confused';

export const ALL_EMOTION_TAGS: DiaryEmotionTag[] = [
  'Calm', 'Sad', 'Anxious', 'Hopeful', 'Angry', 'Ashamed',
  'Lonely', 'Tired', 'Overloaded', 'Restless', 'Grateful',
  'Empty', 'Proud', 'Confused',
];

export interface DiaryEntry {
  entryId: string;
  persona: DiarySearchPersona;
  type: DiaryEntryType;
  createdAt: string;
  updatedAt?: string;
  text: string;
  emotionTags: DiaryEmotionTag[];
  isDeleted?: boolean;
}

export interface DiarySearchQuery {
  persona: DiarySearchPersona;
  freeText?: string;
  emotionTags?: DiaryEmotionTag[];
  dateRange?: {
    fromIso?: string;
    toIso?: string;
  };
  type?: DiaryEntryType | 'ALL';
  limit?: number;
  offset?: number;
  sortOrder: 'newest_first' | 'oldest_first';
}

export interface DiarySearchResultItem {
  entryId: string;
  persona: DiarySearchPersona;
  type: DiaryEntryType;
  createdAt: string;
  previewText: string;
  emotionTags: DiaryEmotionTag[];
  matchedBy: Array<'freeText' | 'emotionTag' | 'dateRange' | 'type'>;
}

export interface DiarySearchResult {
  featureId: 'DIARY_SEARCH';
  persona: DiarySearchPersona;
  query: DiarySearchQuery;
  totalMatches: number;
  returnedCount: number;
  items: DiarySearchResultItem[];
  localOnly: true;
  aiAnalysisUsed: false;
}

export interface DiarySearchState {
  persona: DiarySearchPersona;
  queryText: string;
  selectedTags: DiaryEmotionTag[];
  selectedType: DiaryEntryType | 'ALL';
  fromDateIso?: string;
  toDateIso?: string;
  results: DiarySearchResultItem[];
  isSearching: boolean;
  error: string | null;
}
