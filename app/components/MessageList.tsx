'use client';

import { useEffect, useRef } from 'react';
import MarkdownRenderer from './MarkdownRenderer';
import { ImageAttachment } from './MessageInput';

export interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  images?: ImageAttachment[];
  createdAt?: Date;
}

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
}

export default function MessageList({ messages, isLoading }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="max-w-4xl mx-auto space-y-4">
        {messages.length === 0 && !isLoading && (
          <div className="text-center text-gray-500 dark:text-gray-400 mt-20">
            <h2 className="text-2xl font-bold mb-2">AI Chatbot</h2>
            <p>メッセージを入力して会話を開始してください。</p>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={message.id || index}
            className={`flex ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              }`}
            >
              {message.role === 'user' ? (
                <div>
                  {message.images && message.images.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {message.images.map((img, imgIndex) => (
                        <img
                          key={imgIndex}
                          src={`data:${img.type};base64,${img.base64}`}
                          alt={img.name}
                          className="max-w-[200px] max-h-[200px] rounded-lg object-cover"
                        />
                      ))}
                    </div>
                  )}
                  {message.content && (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  )}
                </div>
              ) : (
                <MarkdownRenderer content={message.content} />
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg px-4 py-3 bg-gray-100 dark:bg-gray-800">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce-delay-100"></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce-delay-200"></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
