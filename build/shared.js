import { z } from 'zod';
export const IDENTITY_ANSWER = "I'm FireTrace, your AI research assistant. I help you explore NASA combustion experiments and understand their findings.";
export function isIdentityOrGreeting(question) {
    const q = question.trim().toLowerCase();
    return (/^(?:who|what)\s+(?:are\s+you|is\s+firetrace)\b/i.test(q) ||
        /\bwho\s+are\s+you\b/i.test(q) ||
        /\bwhat\s+is\s+firetrace\b/i.test(q) ||
        /\b(?:introduce\s+yourself|tell\s+me\s+about\s+yourself)\b/i.test(q) ||
        /^(?:hello|hi|hey|greetings)[\s!.,]*$/i.test(q) ||
        /^(?:hello|hi|hey|greetings)\b/i.test(q));
}
export const Dataset = z.enum(['ALL', 'FLEX', 'BASS-II', 'SAFFIRE', 'SAME-R']);
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
