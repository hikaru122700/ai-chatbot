'use client';

import { useState, useEffect, useCallback } from 'react';
import MessageList, { Message } from './MessageList';
import MessageInput, { ImageAttachment, DocumentAttachment } from './MessageInput';
import ConversationHistory, { Conversation } from './ConversationHistory';
import ApiKeyInput from './ApiKeyInput';
import CharacterSettings, { CharacterConfig } from './CharacterSettings';

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [character, setCharacter] = useState<CharacterConfig | null>(null);

  const handleApiKeyChange = useCallback((key: string | null) => {
    setApiKey(key);
  }, []);

  const handleCharacterChange = useCallback((config: CharacterConfig) => {
    setCharacter(config);
  }, []);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const response = await fetch('/api/conversations');
      const data = await response.json();
      setConversations(
        data.conversations.map((conv: any) => ({
          ...conv,
          createdAt: new Date(conv.createdAt),
          updatedAt: new Date(conv.updatedAt),
        }))
      );
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

  const loadConversation = async (id: string) => {
    try {
      const response = await fetch(`/api/conversations/${id}`);
      const data = await response.json();
      setMessages(
        data.messages.map((msg: any) => ({
          ...msg,
          createdAt: new Date(msg.createdAt),
        }))
      );
      setCurrentConversationId(id);
    } catch (err) {
      console.error('Failed to load conversation:', err);
      setError('会話の読み込みに失敗しました');
    }
  };

  const handleSendMessage = async (message: string, images?: ImageAttachment[], documents?: DocumentAttachment[]) => {
    if (!apiKey) {
      setError('APIキーを設定してください');
      setShowSettings(true);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Build display message with document info
    let displayMessage = message;
    if (documents && documents.length > 0) {
      const docNames = documents.map(d => d.name).join(', ');
      displayMessage = message
        ? `${message}\n\n[添付ファイル: ${docNames}]`
        : `[添付ファイル: ${docNames}]`;
    }

    const userMessage: Message = {
      role: 'user',
      content: displayMessage,
      images: images,
    };

    setMessages((prev) => [...prev, userMessage]);

    // Build the actual message to send with document content
    let messageWithDocs = message;
    if (documents && documents.length > 0) {
      const docContents = documents.map(d => `--- ${d.name} ---\n${d.content}`).join('\n\n');
      messageWithDocs = message
        ? `${message}\n\n以下は添付されたドキュメントの内容です:\n\n${docContents}`
        : `以下のドキュメントの内容について説明してください:\n\n${docContents}`;
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({
          conversationId: currentConversationId,
          message: messageWithDocs,
          images: images,
          systemPrompt: character ? `あなたは「${character.name}」という名前のAIアシスタントです。
性格: ${character.personality}
話し方: ${character.speechStyle}
ユーザーの生産性向上をサポートする親しみやすいアシスタントとして振る舞ってください。
絵文字を適度に使って、楽しい雰囲気で会話してください。` : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to send message`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      let assistantMessage: Message = {
        role: 'assistant',
        content: '',
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (reader) {
        let newConversationId = currentConversationId;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter((line) => line.trim());

          for (const line of lines) {
            try {
              const data = JSON.parse(line);

              if (data.type === 'chunk') {
                assistantMessage.content += data.content;
                setMessages((prev) => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1] = {
                    ...assistantMessage,
                  };
                  return newMessages;
                });

                if (data.conversationId && !newConversationId) {
                  newConversationId = data.conversationId;
                  setCurrentConversationId(newConversationId);
                }
              } else if (data.type === 'done') {
                if (data.conversationId && !newConversationId) {
                  newConversationId = data.conversationId;
                  setCurrentConversationId(newConversationId);
                }
                loadConversations();
              } else if (data.type === 'error') {
                setError(data.error || 'エラーが発生しました');
                setMessages((prev) => prev.slice(0, -1));
              }
            } catch (err) {
              console.error('Failed to parse chunk:', err);
            }
          }
        }
      }
    } catch (err) {
      console.error('Send message error:', err);
      setError('メッセージの送信に失敗しました');
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewConversation = () => {
    setMessages([]);
    setCurrentConversationId(null);
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      const response = await fetch(`/api/conversations/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete conversation');
      }

      if (currentConversationId === id) {
        handleNewConversation();
      }

      loadConversations();
    } catch (err) {
      console.error('Delete conversation error:', err);
      setError('会話の削除に失敗しました');
    }
  };

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900">
      <ConversationHistory
        conversations={conversations}
        currentConversationId={currentConversationId}
        onSelectConversation={loadConversation}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
      />

      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-gray-800 dark:to-gray-800">
          <CharacterSettings onCharacterChange={handleCharacterChange} />
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg transition-colors ${
              apiKey
                ? 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
                : 'text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
            }`}
            title={apiKey ? 'APIキー設定済み' : 'APIキーを設定'}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>

        {/* Settings Modal */}
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowSettings(false)}
            />
            {/* Modal */}
            <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 m-4 max-w-md w-full animate-bounce-in">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  設定
                </h2>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <ApiKeyInput onApiKeyChange={handleApiKeyChange} />
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 text-center">
            {error}
          </div>
        )}

        {!apiKey && !showSettings && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-700 px-4 py-3 text-center">
            <span className="text-yellow-700 dark:text-yellow-300 text-sm">
              チャットを開始するには、
              <button
                onClick={() => setShowSettings(true)}
                className="underline hover:no-underline font-medium"
              >
                APIキーを設定
              </button>
              してください。
            </span>
          </div>
        )}

        <MessageList messages={messages} isLoading={isLoading} />
        <MessageInput onSendMessage={handleSendMessage} disabled={isLoading || !apiKey} />
      </div>
    </div>
  );
}
