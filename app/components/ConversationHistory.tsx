'use client';

import { formatDate } from '@/app/lib/utils';

export interface Conversation {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
}

interface ConversationHistoryProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function ConversationHistory({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  isOpen,
  onClose,
}: ConversationHistoryProps) {
  const handleSelectConversation = (id: string) => {
    onSelectConversation(id);
    onClose(); // モバイルでは選択後に閉じる
  };

  const handleNewConversation = () => {
    onNewConversation();
    onClose(); // モバイルでは新規作成後に閉じる
  };

  return (
    <>
      {/* モバイル用オーバーレイ */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* サイドバー */}
      <div
        className={`
          fixed md:relative inset-y-0 left-0 z-50
          w-72 md:w-64 bg-gray-50 dark:bg-gray-900
          border-r border-gray-200 dark:border-gray-700
          flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* モバイル用ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 md:hidden">
          <h2 className="font-bold text-gray-900 dark:text-white">会話履歴</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={onNewConversation}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 font-medium transition-colors"
        >
          + 新規会話
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {conversations.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-4">
            会話履歴はありません
          </p>
        )}

        {conversations.map((conversation) => (
          <div
            key={conversation.id}
            className={`group relative mb-2 p-3 rounded-lg cursor-pointer transition-colors ${
              currentConversationId === conversation.id
                ? 'bg-blue-100 dark:bg-blue-900'
                : 'hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            onClick={() => onSelectConversation(conversation.id)}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {conversation.title}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {formatDate(conversation.updatedAt)}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {conversation.messageCount} メッセージ
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (
                    confirm('この会話を削除してもよろしいですか？')
                  ) {
                    onDeleteConversation(conversation.id);
                  }
                }}
                className="opacity-0 group-hover:opacity-100 ml-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-opacity"
                title="削除"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
