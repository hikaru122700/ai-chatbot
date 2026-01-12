'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import MessageList, { Message } from './MessageList';
import MessageInput, { ImageAttachment, DocumentAttachment } from './MessageInput';
import ConversationHistory, { Conversation } from './ConversationHistory';
import ApiKeyInput from './ApiKeyInput';
import CharacterSettings, { CharacterConfig } from './CharacterSettings';

// エラータイプの定義
type ErrorType = 'network' | 'timeout' | 'api' | 'auth' | 'unknown';

interface ErrorInfo {
  type: ErrorType;
  message: string;
  canRetry: boolean;
}

// 最後のメッセージ情報（リトライ用）
interface LastMessageData {
  message: string;
  images?: ImageAttachment[];
  documents?: DocumentAttachment[];
}

// エラー分類関数
function classifyError(error: unknown): ErrorInfo {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      type: 'network',
      message: 'ネットワークエラーが発生しました。インターネット接続を確認してください。',
      canRetry: true,
    };
  }

  if (error instanceof DOMException && error.name === 'AbortError') {
    return {
      type: 'timeout',
      message: 'リクエストがタイムアウトしました。もう一度お試しください。',
      canRetry: true,
    };
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();

    if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('api key')) {
      return {
        type: 'auth',
        message: 'APIキーが無効です。設定を確認してください。',
        canRetry: false,
      };
    }

    if (msg.includes('429') || msg.includes('rate limit')) {
      return {
        type: 'api',
        message: 'APIの利用制限に達しました。しばらく待ってから再試行してください。',
        canRetry: true,
      };
    }

    if (msg.includes('500') || msg.includes('502') || msg.includes('503')) {
      return {
        type: 'api',
        message: 'サーバーエラーが発生しました。しばらく待ってから再試行してください。',
        canRetry: true,
      };
    }

    if (msg.includes('network') || msg.includes('failed to fetch')) {
      return {
        type: 'network',
        message: 'ネットワークエラーが発生しました。インターネット接続を確認してください。',
        canRetry: true,
      };
    }

    return {
      type: 'unknown',
      message: error.message || 'エラーが発生しました',
      canRetry: true,
    };
  }

  return {
    type: 'unknown',
    message: 'エラーが発生しました',
    canRetry: true,
  };
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [character, setCharacter] = useState<CharacterConfig | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const lastMessageRef = useRef<LastMessageData | null>(null);

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

  // リトライ関数
  const handleRetry = useCallback(() => {
    if (lastMessageRef.current) {
      const { message, images, documents } = lastMessageRef.current;
      handleSendMessage(message, images, documents);
    }
  }, []);

  const handleSendMessage = async (message: string, images?: ImageAttachment[], documents?: DocumentAttachment[]) => {
    if (!apiKey) {
      setError('APIキーを設定してください');
      setErrorInfo({ type: 'auth', message: 'APIキーを設定してください', canRetry: false });
      setShowSettings(true);
      return;
    }

    // リトライ用に最後のメッセージを保存
    lastMessageRef.current = { message, images, documents };

    setIsLoading(true);
    setError(null);
    setErrorInfo(null);

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
      const errorDetails = classifyError(err);
      setError(errorDetails.message);
      setErrorInfo(errorDetails);
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
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-gray-800 dark:to-gray-800">
          <div className="flex items-center gap-2">
            {/* モバイル用ハンバーガーメニュー */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg md:hidden"
              aria-label="メニューを開く"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <CharacterSettings onCharacterChange={handleCharacterChange} />
          </div>
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
          <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3">
            <div className="flex items-center justify-center gap-4">
              <div className="flex items-center gap-2">
                {errorInfo?.type === 'network' && (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
                  </svg>
                )}
                {errorInfo?.type === 'timeout' && (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                {errorInfo?.type === 'auth' && (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                )}
                {(errorInfo?.type === 'api' || errorInfo?.type === 'unknown') && (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                <span>{error}</span>
              </div>
              <div className="flex gap-2">
                {errorInfo?.canRetry && lastMessageRef.current && (
                  <button
                    onClick={handleRetry}
                    disabled={isLoading}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded-md transition-colors disabled:opacity-50"
                  >
                    再試行
                  </button>
                )}
                <button
                  onClick={() => { setError(null); setErrorInfo(null); }}
                  className="px-3 py-1 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 text-sm rounded-md hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                >
                  閉じる
                </button>
              </div>
            </div>
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
