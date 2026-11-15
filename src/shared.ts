import { z } from 'zod';

export const IDENTITY_ANSWER =
  "I'm FireTrace, your AI research assistant. I help you explore NASA combustion experiments and understand their findings.";

export function isIdentityOrGreeting(question: string): boolean {
  const q = question.trim().toLowerCase();
  return (
    /^(?:who|what)\s+(?:are\s+you|is\s+firetrace)\b/i.test(q) ||
    /\bwho\s+are\s+you\b/i.test(q) ||
    /\bwhat\s+is\s+firetrace\b/i.test(q) ||
    /\b(?:introduce\s+yourself|tell\s+me\s+about\s+yourself)\b/i.test(q) ||
    /^(?:hello|hi|hey|greetings)[\s!.,]*$/i.test(q) ||
    /^(?:hello|hi|hey|greetings)\b/i.test(q)
  );
}

export const Dataset = z.enum(['ALL', 'FLEX', 'BASS-II', 'SAFFIRE', 'SAME-R']);
export type DatasetId = z.infer<typeof Dataset>;

export const Context = z.object({
  dataset: Dataset.default('ALL'),
  experimentId: z.string().max(120).optional(),
  previousExperimentId: z.string().max(120).optional(),
  filters: z.record(z.union([z.string().max(120), z.number().finite()])).default({}),
  variable: z.string().max(80).optional()
}).strict();

export const ChatRequest = z.object({
  question: z.string().trim().min(1).max(1200),
  context: Context.optional(),
  sessionId: z.string().regex(/^[a-zA-Z0-9_-]{8,80}$/)
}).strict();

export type Request = z.infer<typeof ChatRequest>;
export type ContextType = z.infer<typeof Context>;

export interface RecordData {
  id: string;
  experiment_id: string;
  dataset: Exclude<DatasetId, 'ALL'>;
  source: { file: string; sheet: string; row: number };
  source_url: string;
  values: Record<string, string | number | null>;
  flags: Record<string, string>;
}

export interface Variable {
  label: string;
  unit: string;
  kind: string;
  source_column: number;
}

export interface Channel extends Variable {
  key: string;
  n: number;
  missing: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  flags: string[];
}

export interface Series {
  id: string;
  dataset: 'SAFFIRE';
  label: string;
  source: RecordData['source'];
  source_url: string;
  count: number;
  last_row: number;
  channels: Channel[];
  limitations: string[];
}

export interface Catalog {
  version: string;
  manifest: Array<{
    dataset: Exclude<DatasetId, 'ALL'>;
    file: string;
    source_url: string;
    record_count?: number;
    limitations?: string[];
    [k: string]: unknown;
  }>;
  dictionary: Record<string, Record<string, Variable>>;
  records: RecordData[];
  series: Series[];
  documents: Array<{
    id: string;
    title: string;
    text: string;
    source_url: string;
    dataset: string;
    limitations: string[];
  }>;
  missing_datasets: string[];
}

export interface Fact {
  id: string;
  category: 'NASA recorded measurement' | 'FireTrace calculated statistic' | 'Research interpretation supported by evidence' | 'Unknown, unmeasured or insufficient evidence';
  text: string;
  sourceIds: string[];
  numbers?: number[];
}

export interface Citation {
  id: string;
  label: string;
  url: string;
  experimentId?: string;
  dataset?: DatasetId;
}

export interface Evidence {
  version: string;
  question: string;
  context: ContextType;
  facts: Fact[];
  citations: Citation[];
  limitations: string[];
  followups: string[];
  filters: Record<string, unknown>;
  unsupported: boolean;
  intent?: string;
  scientificPrinciple?: string;
  directAnswer?: string;
}

export interface Answer {
  mode: 'local' | 'gemini' | 'muse';
  answer: string;
  facts: Fact[];
  citations: Citation[];
  limitations: string[];
  followups: string[];
  context: ContextType;
  notice: string;
  cached?: boolean;
  scientificPrinciple?: string;
}
