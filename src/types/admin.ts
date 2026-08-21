export type ContentMode = 'auto' | 'firebase' | 'local';

export type EditableDataKey =
  | 'faqs'
  | 'resorts'
  | 'services'
  | 'suggestedQuestions'
  | 'testimonials'
  | 'tours'
  | 'chatResponses'
  | 'knowledge'
  | 'settings';

export type ChatStatus = {
  contentMode: ContentMode;
  manualContentMode: ContentMode;
  firebaseContentEnabled: boolean;
  firebaseConfigured: boolean;
  firebaseHealth: {
    status: 'unknown' | 'healthy' | 'unhealthy' | 'skipped';
    lastCheckedAt: number | null;
    lastSuccessAt: number | null;
    lastFailureAt: number | null;
  };
  groqHealth: {
    status: 'unknown' | 'healthy' | 'unhealthy' | 'skipped';
    lastCheckedAt: number | null;
    model: string | null;
    message: string | null;
  };
  usage: {
    requestsLastMinute: number;
    errorsLastMinute: number;
    rateLimitHitsLastMinute: number;
    lastErrorMessage: string | null;
    lastErrorAt: number | null;
    provider: 'groq' | 'openai' | 'google' | 'none';
  };
  firebaseBackoffActive: boolean;
  firebaseRetryAt: number | null;
};

export type ActivityLogEntry = {
  id: string;
  time: string;
  userLabel: string;
  action: string;
  details: string;
};

export type DailyHealthSnapshot = {
  id: string;
  dateKey: string;
  label: string;
  firebaseStatus: 'unknown' | 'healthy' | 'unhealthy' | 'skipped';
  groqStatus: 'unknown' | 'healthy' | 'unhealthy' | 'skipped';
  provider: 'groq' | 'openai' | 'google' | 'none';
  apiRequests: number;
  firebaseRequests: number;
  requests: number;
  errors: number;
  rateLimitHits: number;
  backoffActive: boolean;
  updatedAt: string;
};
