// Backward compatibility wrapper routing to Gemini implementation
export {
  config,
  answerWithGemini as answerWithModel,
  validateGeminiReply as validateModel,
  type GeminiConfig as Config
} from './gemini.js';
