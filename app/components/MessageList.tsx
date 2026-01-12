'use client';

import { useEffect, useRef, useState } from 'react';
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

// TTS component for assistant messages
function SpeakButton({ text }: { text: string }) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);

  useEffect(() => {
    setTtsSupported(typeof window !== 'undefined' && 'speechSynthesis' in window);
  }, []);

  const handleSpeak = () => {
    if (!ttsSupported) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ja-JP';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    }
  };

  if (!ttsSupported) return null;

  return (
    <button
      onClick={handleSpeak}
      className={`ml-2 p-1 rounded transition-colors ${
        isSpeaking
          ? 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30'
          : 'text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
      title={isSpeaking ? '停止' : '読み上げ'}
    >
      {isSpeaking ? (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
        </svg>
      )}
    </button>
  );
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
