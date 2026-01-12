'use client';

import { useState, KeyboardEvent, useRef, useEffect } from 'react';

export interface ImageAttachment {
  base64: string;
  type: string;
  name: string;
}

export interface DocumentAttachment {
  name: string;
  content: string;
  type: string;
}

interface MessageInputProps {
  onSendMessage: (message: string, images?: ImageAttachment[], documents?: DocumentAttachment[]) => void;
  disabled: boolean;
}

// TypeScript declarations for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export default function MessageInput({
  onSendMessage,
  disabled,
}: MessageInputProps) {
  const [input, setInput] = useState('');
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [documents, setDocuments] = useState<DocumentAttachment[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    // Check if speech recognition is supported
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      setSpeechSupported(!!SpeechRecognition);

      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'ja-JP';

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let transcript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          setInput((prev) => {
            // If this is a final result, append to existing input
            if (event.results[event.results.length - 1].isFinal) {
              return prev + transcript;
            }
            return prev;
          });
        };

        recognition.onerror = () => {
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleSubmit = () => {
    if ((input.trim() || images.length > 0 || documents.length > 0) && !disabled) {
      onSendMessage(
        input.trim(),
        images.length > 0 ? images : undefined,
        documents.length > 0 ? documents : undefined
      );
      setInput('');
      setImages([]);
      setDocuments([]);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newImages: ImageAttachment[] = [];

    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        const base64 = await fileToBase64(file);
        newImages.push({
          base64,
          type: file.type,
          name: file.name,
        });
      }
    }

    setImages((prev) => [...prev, ...newImages]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDocSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setIsProcessingFile(true);

    for (const file of Array.from(files)) {
      try {
        let content = '';

        if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
          // PDF parsing using pdfjs-dist
          try {
            // Dynamic import with legacy build for better compatibility
            const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

            // Disable worker for simpler setup
            const arrayBuffer = await file.arrayBuffer();
            const loadingTask = pdfjsLib.getDocument({
              data: arrayBuffer,
              useWorkerFetch: false,
              isEvalSupported: false,
              useSystemFonts: true,
            });
            const pdf = await loadingTask.promise;
            const textParts: string[] = [];

            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const textContent = await page.getTextContent();
              const pageText = textContent.items
                .map((item) => {
                  if ('str' in item && typeof item.str === 'string') {
                    return item.str;
                  }
                  return '';
                })
                .join(' ');
              textParts.push(pageText);
            }

            content = textParts.join('\n\n');
          } catch (pdfError) {
            console.error('PDF parsing error:', pdfError);
            // Fallback: just note that it's a PDF that couldn't be parsed
            content = `[PDFファイル: ${file.name} - テキスト抽出に失敗しました]`;
          }
        } else if (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
          // Plain text files
          content = await file.text();
        } else {
          continue; // Skip unsupported files
        }

        if (content.trim()) {
          setDocuments((prev) => [
            ...prev,
            {
              name: file.name,
              content: content,
              type: file.type || 'text/plain',
            },
          ]);
        }
      } catch (error) {
        console.error('Failed to process file:', file.name, error);
      }
    }

    setIsProcessingFile(false);
    if (docInputRef.current) {
      docInputRef.current.value = '';
    }
  };

  const removeDocument = (index: number) => {
    setDocuments((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
      {/* Image previews */}
      {images.length > 0 && (
        <div className="max-w-4xl mx-auto mb-3 flex flex-wrap gap-2">
          {images.map((img, index) => (
            <div key={index} className="relative group">
              <img
                src={`data:${img.type};base64,${img.base64}`}
                alt={img.name}
                className="h-20 w-20 object-cover rounded-lg border border-gray-300 dark:border-gray-600"
              />
              <button
                onClick={() => removeImage(index)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Document previews */}
      {documents.length > 0 && (
        <div className="max-w-4xl mx-auto mb-3 flex flex-wrap gap-2">
          {documents.map((doc, index) => (
            <div
              key={index}
              className="relative group flex items-center gap-2 px-3 py-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700"
            >
              <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-sm text-purple-700 dark:text-purple-300 max-w-[150px] truncate">
                {doc.name}
              </span>
              <button
                onClick={() => removeDocument(index)}
                className="text-purple-500 hover:text-red-500 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Processing indicator */}
      {isProcessingFile && (
        <div className="max-w-4xl mx-auto mb-3 flex items-center gap-2 text-purple-600 dark:text-purple-400">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm">ファイルを処理中...</span>
        </div>
      )}

      <div className="max-w-4xl mx-auto flex gap-2">
        {/* File upload button */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="image/*"
          multiple
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="p-3 text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="画像を添付"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>

        {/* Voice input button */}
        {speechSupported && (
          <button
            onClick={toggleListening}
            disabled={disabled}
            className={`p-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isListening
                ? 'text-red-500 bg-red-50 dark:bg-red-900/20 animate-pulse'
                : 'text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20'
            }`}
            title={isListening ? '録音停止' : '音声入力'}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>
        )}

        {/* Document upload button */}
        <input
          type="file"
          ref={docInputRef}
          onChange={handleDocSelect}
          accept=".pdf,.txt,.md,text/plain,application/pdf"
          multiple
          className="hidden"
        />
        <button
          onClick={() => docInputRef.current?.click()}
          disabled={disabled || isProcessingFile}
          className="p-3 text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="PDF/テキストを添付"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </button>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="メッセージを入力... (Enter: 送信, Shift+Enter: 改行)"
          disabled={disabled}
          className="flex-1 resize-none rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
          rows={3}
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || (!input.trim() && images.length === 0 && documents.length === 0)}
          className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
        >
          送信
        </button>
      </div>
    </div>
  );
}
