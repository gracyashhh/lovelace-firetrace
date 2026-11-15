// Backward compatibility wrapper routing to Gemini implementation
export { config, answerWithGemini as answerWithModel, validateGeminiReply as validateModel } from './gemini.js';
