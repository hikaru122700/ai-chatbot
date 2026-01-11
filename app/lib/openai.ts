import OpenAI from 'openai';

export const MODEL_NAME = 'gpt-4o';

let openaiClient: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'dummy-key-for-build',
    });
  }
  return openaiClient;
}

// For backward compatibility
export const openai = {
  get chat() {
    return getOpenAI().chat;
  },
};
