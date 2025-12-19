'use client';

import { useState, useEffect } from 'react';
import MessageList, { Message } from './MessageList';
import MessageInput from './MessageInput';
import ConversationHistory, { Conversation } from './ConversationHistory';

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleSendMessage = async (message: string) => {
    setIsLoading(true);
    setError(null);

    const userMessage: Message = {
      role: 'user',
      content: message,
    };

    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId: currentConversationId,
          message,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
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
        {error && (
          <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 text-center">
            {error}
          </div>
        )}

        <MessageList messages={messages} isLoading={isLoading} />
        <MessageInput onSendMessage={handleSendMessage} disabled={isLoading} />
      </div>
    </div>
  );
}
