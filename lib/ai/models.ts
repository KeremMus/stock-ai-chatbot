export const DEFAULT_CHAT_MODEL: string = 'chat-model';

export interface ChatModel {
  id: string;
  name: string;
  description: string;
}

export const chatModels: Array<ChatModel> = [
  {
    id: 'chat-model',
    name: 'Gemini 2.0 Flash',
    description: 'Google\'s latest multimodal AI model with fast responses',
  },
  {
    id: 'chat-model-reasoning',
    name: 'Gemini 2.0 Flash Thinking',
    description: 'Advanced reasoning model with visible thinking process',
  },
];
