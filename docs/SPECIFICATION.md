# AI Chatbot 詳細仕様書

## 目次

1. [システム概要](#1-システム概要)
2. [アーキテクチャ](#2-アーキテクチャ)
3. [認証・APIキー管理](#3-認証apiキー管理)
4. [チャット機能](#4-チャット機能)
5. [キャラクター設定機能（アシスタント切り替え）](#5-キャラクター設定機能アシスタント切り替え)
6. [画像アップロード・解析機能](#6-画像アップロード解析機能)
7. [音声入力機能](#7-音声入力機能)
8. [音声読み上げ機能（TTS）](#8-音声読み上げ機能tts)
9. [PDF・文書アップロード機能](#9-pdf文書アップロード機能)
10. [会話履歴管理](#10-会話履歴管理)
11. [データベース設計](#11-データベース設計)
12. [UIアニメーション](#12-uiアニメーション)
13. [エラーハンドリング](#13-エラーハンドリング)
14. [セキュリティ](#14-セキュリティ)

---

## 1. システム概要

### 1.1 目的
OpenAI GPT-4oを使用したインタラクティブなAIチャットボットアプリケーション。ユーザーがテキスト、画像、音声、ドキュメントを使ってAIと対話できる。

### 1.2 主要機能
- リアルタイムストリーミングチャット
- カスタマイズ可能なAIキャラクター
- マルチモーダル入力（テキスト、画像、音声、PDF）
- 音声読み上げ出力
- 会話履歴の永続化

### 1.3 技術スタック
| レイヤー | 技術 |
|---------|------|
| フロントエンド | Next.js 15, React 19, TypeScript |
| スタイリング | Tailwind CSS |
| バックエンド | Next.js API Routes |
| AI API | OpenAI GPT-4o, GPT-4o Vision |
| データベース | PostgreSQL (Neon) |
| ORM | Prisma 6.x |
| PDF解析 | pdfjs-dist |
| 音声認識 | Web Speech API |
| 音声合成 | Web Speech Synthesis API |

---

## 2. アーキテクチャ

### 2.1 全体構成図

```
┌─────────────────────────────────────────────────────────────────┐
│                        クライアント (Browser)                     │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ ChatInterface│  │CharacterSettings│  │    MessageInput      │  │
│  │             │  │             │  │ (画像/音声/PDF)         │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
│         │                │                      │                │
│         └────────────────┼──────────────────────┘                │
│                          │                                       │
│  ┌───────────────────────▼───────────────────────────────────┐  │
│  │              SessionStorage (APIキー)                      │  │
│  │              LocalStorage (キャラクター設定)                │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP (fetch)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Next.js API Routes                          │
├─────────────────────────────────────────────────────────────────┤
│  POST /api/chat          → OpenAI API (ストリーミング)          │
│  GET  /api/conversations → Prisma (会話一覧)                    │
│  GET  /api/conversations/[id] → Prisma (会話詳細)               │
│  DELETE /api/conversations/[id] → Prisma (会話削除)             │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│      OpenAI API         │     │   PostgreSQL (Neon)     │
│  - GPT-4o               │     │   - conversations       │
│  - GPT-4o Vision        │     │   - messages            │
└─────────────────────────┘     └─────────────────────────┘
```

### 2.2 データフロー

```
[ユーザー入力]
     │
     ▼
[MessageInput] ─── テキスト/画像/音声/PDF を収集
     │
     ▼
[ChatInterface] ─── APIリクエスト構築
     │              - message: テキスト
     │              - images: Base64画像配列
     │              - systemPrompt: キャラクター設定
     │
     ▼ POST /api/chat (X-API-Key ヘッダー付き)
     │
[API Route] ─── リクエスト検証
     │          - APIキー確認
     │          - メッセージ/画像の存在確認
     │
     ├──▶ [Prisma] 会話・メッセージ保存
     │
     ▼
[OpenAI API] ─── ストリーミングリクエスト
     │
     ▼ Server-Sent Events
     │
[ChatInterface] ─── チャンク受信・表示
     │
     ▼
[MessageList] ─── メッセージ表示・アニメーション
```

---

## 3. 認証・APIキー管理

### 3.1 設計方針
サーバー側でAPIキーを保持せず、ユーザーが自分のOpenAI APIキーを使用する設計。

### 3.2 保存場所
- **SessionStorage**: ブラウザを閉じると自動削除
- タブ間で共有されない（セキュリティ向上）

### 3.3 実装詳細

**ファイル**: `app/components/ApiKeyInput.tsx`

```typescript
// 保存
const handleSave = () => {
  if (apiKey.trim()) {
    sessionStorage.setItem('openai_api_key', apiKey.trim());
    setIsSaved(true);
    onApiKeyChange(apiKey.trim());
  }
};

// 読み込み（コンポーネントマウント時）
useEffect(() => {
  const savedKey = sessionStorage.getItem('openai_api_key');
  if (savedKey) {
    setApiKey(savedKey);
    setIsSaved(true);
    onApiKeyChange(savedKey);
  }
}, [onApiKeyChange]);

// 削除
const handleClear = () => {
  sessionStorage.removeItem('openai_api_key');
  setApiKey('');
  setIsSaved(false);
  onApiKeyChange(null);
};
```

### 3.4 APIへの送信方法

```typescript
// ChatInterface.tsx
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': apiKey,  // カスタムヘッダーでAPIキーを送信
  },
  body: JSON.stringify({ ... }),
});
```

### 3.5 サーバー側での受け取り

```typescript
// app/api/chat/route.ts
const apiKey = request.headers.get('X-API-Key');

if (!apiKey) {
  return NextResponse.json(
    { error: 'API key is required' },
    { status: 401 }
  );
}

// ユーザーのAPIキーでOpenAIクライアントを初期化
const openai = new OpenAI({ apiKey });
```

---

## 4. チャット機能

### 4.1 ストリーミングレスポンス

OpenAI APIからのレスポンスをリアルタイムで表示するため、Server-Sent Events形式でストリーミング。

**ファイル**: `app/api/chat/route.ts`

```typescript
// OpenAIストリーミングリクエスト
const stream = await openai.chat.completions.create({
  model: MODEL_NAME,  // 'gpt-4o'
  messages: openaiMessages,
  stream: true,
  max_tokens: 4096,
});

// ReadableStreamでクライアントに送信
const readableStream = new ReadableStream({
  async start(controller) {
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        assistantResponse += content;

        // JSON形式でチャンクを送信
        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              type: 'chunk',
              content: content,
              conversationId: currentConversationId,
            }) + '\n'
          )
        );
      }
    }

    // 完了シグナル
    controller.enqueue(
      encoder.encode(
        JSON.stringify({
          type: 'done',
          conversationId: currentConversationId,
        }) + '\n'
      )
    );

    controller.close();
  },
});
```

### 4.2 クライアント側の受信処理

**ファイル**: `app/components/ChatInterface.tsx`

```typescript
const reader = response.body?.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  const lines = chunk.split('\n').filter((line) => line.trim());

  for (const line of lines) {
    const data = JSON.parse(line);

    if (data.type === 'chunk') {
      // メッセージ内容を追加
      assistantMessage.content += data.content;
      setMessages((prev) => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = { ...assistantMessage };
        return newMessages;
      });
    } else if (data.type === 'done') {
      // 完了処理
      loadConversations();
    } else if (data.type === 'error') {
      setError(data.error);
    }
  }
}
```

### 4.3 メッセージフォーマット

```typescript
// OpenAIに送信するメッセージ形式
type MessageContent =
  | string
  | Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } }
    >;

const openaiMessages: Array<{
  role: 'system' | 'user' | 'assistant';
  content: MessageContent;
}> = [];
```

---

## 5. キャラクター設定機能（アシスタント切り替え）

### 5.1 概要

ユーザーがAIアシスタントの名前、アバター、性格、話し方をカスタマイズできる機能。設定はシステムプロンプトとしてOpenAI APIに送信される。

### 5.2 データ構造

**ファイル**: `app/components/CharacterSettings.tsx`

```typescript
export interface CharacterConfig {
  name: string;        // キャラクター名
  avatar: string;      // アバター絵文字
  personality: string; // 性格
  speechStyle: string; // 話し方
}

// デフォルト設定
const DEFAULT_CHARACTER: CharacterConfig = {
  name: 'アシスタント',
  avatar: '🤖',
  personality: '親切で明るい',
  speechStyle: 'フレンドリーな敬語',
};
```

### 5.3 選択可能なオプション

```typescript
// アバター選択肢
const AVATAR_OPTIONS = [
  '🤖', '🐱', '🐶', '🦊', '🐰', '🐼',
  '🦄', '👻', '🌟', '💫', '🎀', '🌸'
];

// 性格選択肢
const PERSONALITY_OPTIONS = [
  { value: '親切で明るい', label: '親切で明るい' },
  { value: '知的でクール', label: '知的でクール' },
  { value: '元気いっぱい', label: '元気いっぱい' },
  { value: '落ち着いて優しい', label: '落ち着いて優しい' },
  { value: 'ツンデレ', label: 'ツンデレ' },
];

// 話し方選択肢
const SPEECH_STYLE_OPTIONS = [
  { value: 'フレンドリーな敬語', label: 'フレンドリーな敬語（〜ですね！）' },
  { value: 'カジュアル', label: 'カジュアル（〜だよ！）' },
  { value: '丁寧語', label: '丁寧語（〜でございます）' },
  { value: '関西弁', label: '関西弁（〜やで！）' },
];
```

### 5.4 保存・読み込みロジック

```typescript
// LocalStorageに保存（永続化）
const handleSave = () => {
  localStorage.setItem('character_config', JSON.stringify(config));
  onCharacterChange(config);
  setIsOpen(false);
};

// 読み込み（コンポーネントマウント時）
useEffect(() => {
  const saved = localStorage.getItem('character_config');
  if (saved) {
    const parsed = JSON.parse(saved);
    setConfig(parsed);
    onCharacterChange(parsed);
  } else {
    onCharacterChange(DEFAULT_CHARACTER);
  }
}, [onCharacterChange]);

// リセット
const handleReset = () => {
  setConfig(DEFAULT_CHARACTER);
  localStorage.removeItem('character_config');
  onCharacterChange(DEFAULT_CHARACTER);
};
```

### 5.5 システムプロンプトへの反映

**ファイル**: `app/components/ChatInterface.tsx`

キャラクター設定は、APIリクエスト時にシステムプロンプトとして組み込まれる。

```typescript
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { ... },
  body: JSON.stringify({
    conversationId: currentConversationId,
    message: messageWithDocs,
    images: images,
    // キャラクター設定からシステムプロンプトを動的生成
    systemPrompt: character ? `あなたは「${character.name}」という名前のAIアシスタントです。
性格: ${character.personality}
話し方: ${character.speechStyle}
ユーザーの生産性向上をサポートする親しみやすいアシスタントとして振る舞ってください。
絵文字を適度に使って、楽しい雰囲気で会話してください。` : undefined,
  }),
});
```

### 5.6 サーバー側でのシステムプロンプト処理

**ファイル**: `app/api/chat/route.ts`

```typescript
const { conversationId, message, images, systemPrompt } = await request.json();

// メッセージ配列の先頭にシステムプロンプトを追加
if (systemPrompt) {
  openaiMessages.push({
    role: 'system',
    content: systemPrompt,
  });
}

// その後に会話履歴を追加
historyMessages.forEach((msg) => {
  openaiMessages.push({
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
  });
});
```

### 5.7 UI表示

キャラクターボタンはヘッダー左側に配置され、クリックするとドロップダウン設定パネルが表示される。

```typescript
<button
  onClick={() => setIsOpen(!isOpen)}
  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white"
>
  <span className="text-xl">{config.avatar}</span>
  <span className="font-medium">{config.name}</span>
</button>
```

---

## 6. 画像アップロード・解析機能

### 6.1 概要

ユーザーが画像をアップロードし、GPT-4o Visionで内容を解析する機能。

### 6.2 データ構造

```typescript
export interface ImageAttachment {
  base64: string;  // Base64エンコードされた画像データ
  type: string;    // MIMEタイプ (e.g., 'image/jpeg')
  name: string;    // ファイル名
}
```

### 6.3 画像選択・Base64変換

**ファイル**: `app/components/MessageInput.tsx`

```typescript
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
};

// FileをBase64に変換
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // data:image/jpeg;base64,xxxxx の xxxxx 部分を抽出
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};
```

### 6.4 OpenAI Vision APIフォーマット

**ファイル**: `app/api/chat/route.ts`

```typescript
if (hasImages) {
  const contentParts: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
  > = [];

  // 画像をVision API形式で追加
  images.forEach((img: { base64: string; type: string }) => {
    contentParts.push({
      type: 'image_url',
      image_url: {
        url: `data:${img.type};base64,${img.base64}`,
      },
    });
  });

  // テキストメッセージを追加
  if (hasMessage) {
    contentParts.push({
      type: 'text',
      text: message,
    });
  } else {
    // 画像のみの場合はデフォルトプロンプト
    contentParts.push({
      type: 'text',
      text: 'この画像について説明してください。',
    });
  }

  openaiMessages.push({
    role: 'user',
    content: contentParts,
  });
}
```

### 6.5 プレビュー表示

```typescript
{images.map((img, index) => (
  <div key={index} className="relative group">
    <img
      src={`data:${img.type};base64,${img.base64}`}
      alt={img.name}
      className="h-20 w-20 object-cover rounded-lg"
    />
    <button
      onClick={() => removeImage(index)}
      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6"
    >
      ×
    </button>
  </div>
))}
```

---

## 7. 音声入力機能

### 7.1 概要

Web Speech APIを使用して、ユーザーの音声をテキストに変換する機能。

### 7.2 ブラウザサポート確認

```typescript
useEffect(() => {
  if (typeof window !== 'undefined') {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    setSpeechSupported(!!SpeechRecognition);

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;       // 連続認識
      recognition.interimResults = true;   // 中間結果を取得
      recognition.lang = 'ja-JP';          // 日本語

      // ...イベントハンドラ設定

      recognitionRef.current = recognition;
    }
  }
}, []);
```

### 7.3 音声認識イベント処理

```typescript
recognition.onresult = (event: SpeechRecognitionEvent) => {
  let transcript = '';
  for (let i = event.resultIndex; i < event.results.length; i++) {
    transcript += event.results[i][0].transcript;
  }

  setInput((prev) => {
    // 最終結果の場合のみ入力に追加
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
```

### 7.4 録音開始/停止

```typescript
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
```

### 7.5 UI表示

録音中はボタンが赤くパルスアニメーション。

```typescript
<button
  onClick={toggleListening}
  disabled={disabled}
  className={`p-3 rounded-lg ${
    isListening
      ? 'text-red-500 bg-red-50 animate-pulse'
      : 'text-gray-500 hover:text-purple-600'
  }`}
  title={isListening ? '録音停止' : '音声入力'}
>
  {/* マイクアイコン */}
</button>
```

---

## 8. 音声読み上げ機能（TTS）

### 8.1 概要

Web Speech Synthesis APIを使用して、アシスタントのメッセージを音声で読み上げる機能。

### 8.2 実装

**ファイル**: `app/components/MessageList.tsx`

```typescript
function SpeakButton({ text }: { text: string }) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);

  useEffect(() => {
    setTtsSupported(
      typeof window !== 'undefined' && 'speechSynthesis' in window
    );
  }, []);

  const handleSpeak = () => {
    if (!ttsSupported) return;

    if (isSpeaking) {
      // 停止
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      // 再生
      window.speechSynthesis.cancel(); // 既存の読み上げをキャンセル

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ja-JP';
      utterance.rate = 1.0;   // 速度
      utterance.pitch = 1.0;  // ピッチ

      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    }
  };

  if (!ttsSupported) return null;

  return (
    <button onClick={handleSpeak} title={isSpeaking ? '停止' : '読み上げ'}>
      {/* スピーカーアイコン */}
    </button>
  );
}
```

### 8.3 メッセージへの組み込み

```typescript
{message.role === 'assistant' && (
  <div>
    <MarkdownRenderer content={message.content} />
    <div className="flex justify-end mt-2">
      <SpeakButton text={message.content} />
    </div>
  </div>
)}
```

---

## 9. PDF・文書アップロード機能

### 9.1 概要

PDF、テキスト、Markdownファイルをアップロードし、内容をテキストとして抽出してAIに送信する機能。

### 9.2 データ構造

```typescript
export interface DocumentAttachment {
  name: string;     // ファイル名
  content: string;  // 抽出されたテキスト内容
  type: string;     // MIMEタイプ
}
```

### 9.3 ファイル処理ロジック

**ファイル**: `app/components/MessageInput.tsx`

```typescript
const handleDocSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = e.target.files;
  if (!files) return;

  setIsProcessingFile(true);

  for (const file of Array.from(files)) {
    try {
      let content = '';

      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        // PDF解析
        const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({
          data: arrayBuffer,
          useWorkerFetch: false,
          isEvalSupported: false,
          useSystemFonts: true,
        });
        const pdf = await loadingTask.promise;
        const textParts: string[] = [];

        // 全ページからテキスト抽出
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

      } else if (
        file.type === 'text/plain' ||
        file.name.endsWith('.txt') ||
        file.name.endsWith('.md')
      ) {
        // テキストファイル
        content = await file.text();
      }

      if (content.trim()) {
        setDocuments((prev) => [...prev, {
          name: file.name,
          content: content,
          type: file.type || 'text/plain',
        }]);
      }
    } catch (error) {
      console.error('Failed to process file:', file.name, error);
      // エラー時はファイル名だけ記録
      content = `[PDFファイル: ${file.name} - テキスト抽出に失敗しました]`;
    }
  }

  setIsProcessingFile(false);
};
```

### 9.4 メッセージへの組み込み

**ファイル**: `app/components/ChatInterface.tsx`

```typescript
// ドキュメント内容をメッセージに追加
let messageWithDocs = message;
if (documents && documents.length > 0) {
  const docContents = documents
    .map(d => `--- ${d.name} ---\n${d.content}`)
    .join('\n\n');

  messageWithDocs = message
    ? `${message}\n\n以下は添付されたドキュメントの内容です:\n\n${docContents}`
    : `以下のドキュメントの内容について説明してください:\n\n${docContents}`;
}
```

---

## 10. 会話履歴管理

### 10.1 会話一覧取得

**ファイル**: `app/api/conversations/route.ts`

```typescript
export async function GET() {
  const conversations = await prisma.conversation.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: { select: { messages: true } },
    },
  });

  return NextResponse.json({
    conversations: conversations.map((conv) => ({
      id: conv.id,
      title: conv.title,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      messageCount: conv._count.messages,
    })),
  });
}
```

### 10.2 会話詳細取得

**ファイル**: `app/api/conversations/[id]/route.ts`

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!conversation) {
    return NextResponse.json(
      { error: 'Conversation not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    id: conversation.id,
    title: conversation.title,
    messages: conversation.messages,
  });
}
```

### 10.3 会話削除

```typescript
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  await prisma.conversation.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}
```

### 10.4 新規会話作成（チャット送信時）

```typescript
// app/api/chat/route.ts
if (!currentConversationId) {
  const title = hasMessage
    ? message.substring(0, 50) + (message.length > 50 ? '...' : '')
    : '画像付きメッセージ';

  const conversation = await prisma.conversation.create({
    data: { title },
  });
  currentConversationId = conversation.id;
}
```

---

## 11. データベース設計

### 11.1 スキーマ定義

**ファイル**: `prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DATABASE_URL_UNPOOLED")
}

model Conversation {
  id        String    @id @default(uuid())
  title     String
  messages  Message[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

model Message {
  id             String       @id @default(uuid())
  conversationId String
  conversation   Conversation @relation(
    fields: [conversationId],
    references: [id],
    onDelete: Cascade
  )
  role           String       // 'user' or 'assistant'
  content        String       @db.Text
  createdAt      DateTime     @default(now())

  @@index([conversationId])
}
```

### 11.2 ER図

```
┌─────────────────────────┐       ┌─────────────────────────┐
│     Conversation        │       │        Message          │
├─────────────────────────┤       ├─────────────────────────┤
│ id: String (PK, UUID)   │──┐    │ id: String (PK, UUID)   │
│ title: String           │  │    │ conversationId: String (FK)│
│ createdAt: DateTime     │  └───<│ role: String            │
│ updatedAt: DateTime     │       │ content: Text           │
└─────────────────────────┘       │ createdAt: DateTime     │
                                  └─────────────────────────┘

関係: Conversation 1:N Message (Cascade Delete)
```

### 11.3 Prismaクライアント初期化

**ファイル**: `app/lib/db.ts`

```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
};

function createPrismaClient() {
  return new PrismaClient();
}

function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

// Lazy proxy - ビルド時ではなく実行時に初期化
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrisma();
    const value = client[prop as keyof PrismaClient];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});
```

---

## 12. UIアニメーション

### 12.1 定義されているアニメーション

**ファイル**: `app/globals.css`

```css
/* フェードインアップ */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* スライドイン（右から） */
@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* スライドイン（左から） */
@keyframes slideInLeft {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* バウンスイン */
@keyframes bounceIn {
  0% {
    opacity: 0;
    transform: scale(0.3);
  }
  50% {
    opacity: 1;
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
  }
}

/* フロート（浮遊） */
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

/* ウィグル（揺れ） */
@keyframes wiggle {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-5deg); }
  75% { transform: rotate(5deg); }
}
```

### 12.2 使用箇所

| アニメーション | 使用箇所 |
|--------------|---------|
| `animate-slide-in-right` | ユーザーメッセージ |
| `animate-slide-in-left` | アシスタントメッセージ、ローディング |
| `animate-fade-in-up` | ウェルカム画面 |
| `animate-bounce-in` | 設定モーダル、機能バッジ |
| `animate-float` | ウェルカム画面の顔文字 |
| `animate-wiggle` | ウェルカム画面の括弧 |
| `animate-pulse` | 録音中のマイクボタン |

---

## 13. エラーハンドリング

### 13.1 API側エラー処理

```typescript
// app/api/chat/route.ts
try {
  // メイン処理
} catch (error: any) {
  console.error('Chat API error:', error);
  const message = error?.message || 'Unknown error';
  return NextResponse.json(
    { error: message },
    { status: 500 }
  );
}
```

### 13.2 ストリーミング中のエラー

```typescript
// ReadableStream内のエラー処理
catch (error: any) {
  console.error('Streaming error:', error);
  controller.enqueue(
    encoder.encode(
      JSON.stringify({
        type: 'error',
        error: error?.message || 'Unknown error occurred',
      }) + '\n'
    )
  );
  controller.close();
}
```

### 13.3 クライアント側エラー表示

```typescript
// ChatInterface.tsx
{error && (
  <div className="bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 px-4 py-3 text-center">
    {error}
  </div>
)}
```

---

## 14. セキュリティ

### 14.1 実装済みの対策

| 項目 | 対策 |
|------|------|
| APIキー管理 | SessionStorageに保存（ブラウザ閉鎖で削除） |
| APIキー送信 | カスタムヘッダー（X-API-Key）で送信 |
| XSS対策 | ReactのJSX自動エスケープ |
| SQLインジェクション | Prisma ORMによるパラメータ化クエリ |
| CSRF | SameSite Cookieポリシー |

### 14.2 既知の課題（Issue起票済み）

- プロンプトインジェクション対策の強化 (#3)
- Base64画像のサイズ・タイプ検証 (#4)
- エラーメッセージの情報露出防止
- Markdownレンダリング時のURL検証

---

## 更新履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|---------|
| 2025-01-13 | 1.0 | 初版作成 |
