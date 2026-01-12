import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { MODEL_NAME } from '@/app/lib/openai';
import { prisma } from '@/app/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// セキュリティ: 画像検証の定数
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_BASE64_LENGTH = Math.ceil(MAX_IMAGE_SIZE_BYTES * 1.37); // Base64は約37%大きくなる
const MAX_IMAGES_COUNT = 5;

// メッセージ長の制限
const MAX_MESSAGE_LENGTH = 8000;

// 画像検証関数
interface ImageData {
  base64: string;
  type: string;
  name?: string;
}

function validateImages(images: unknown): { valid: boolean; error?: string; images?: ImageData[] } {
  if (!Array.isArray(images)) {
    return { valid: false, error: '画像データが不正です' };
  }

  if (images.length > MAX_IMAGES_COUNT) {
    return { valid: false, error: `画像は最大${MAX_IMAGES_COUNT}枚までです` };
  }

  const validatedImages: ImageData[] = [];

  for (let i = 0; i < images.length; i++) {
    const img = images[i];

    // 構造チェック
    if (!img || typeof img !== 'object') {
      return { valid: false, error: `画像${i + 1}のデータが不正です` };
    }

    const { base64, type } = img as { base64?: unknown; type?: unknown };

    // MIMEタイプチェック
    if (typeof type !== 'string' || !ALLOWED_IMAGE_TYPES.includes(type)) {
      return {
        valid: false,
        error: `画像${i + 1}の形式が非対応です（対応: JPEG, PNG, GIF, WebP）`,
      };
    }

    // Base64文字列チェック
    if (typeof base64 !== 'string' || base64.length === 0) {
      return { valid: false, error: `画像${i + 1}のデータが空です` };
    }

    // サイズチェック
    if (base64.length > MAX_BASE64_LENGTH) {
      return {
        valid: false,
        error: `画像${i + 1}のサイズが大きすぎます（最大5MB）`,
      };
    }

    // Base64形式の簡易検証
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
      return { valid: false, error: `画像${i + 1}のBase64データが不正です` };
    }

    validatedImages.push({
      base64,
      type,
      name: typeof img.name === 'string' ? img.name : undefined,
    });
  }

  return { valid: true, images: validatedImages };
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('X-API-Key');

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 401 }
      );
    }

    const { conversationId, message, images, systemPrompt } = await request.json();

    const hasMessage = message && typeof message === 'string' && message.trim().length > 0;
    const hasImages = images && Array.isArray(images) && images.length > 0;

    if (!hasMessage && !hasImages) {
      return NextResponse.json(
        { error: 'Message or images are required' },
        { status: 400 }
      );
    }

    // 画像の検証
    let validatedImages: ImageData[] = [];
    if (hasImages) {
      const imageValidation = validateImages(images);
      if (!imageValidation.valid) {
        return NextResponse.json(
          { error: imageValidation.error },
          { status: 400 }
        );
      }
      validatedImages = imageValidation.images!;
    }

    const openai = new OpenAI({ apiKey });

    let currentConversationId = conversationId;

    // Create new conversation if no ID provided
    if (!currentConversationId) {
      const title = hasMessage
        ? message.substring(0, 50) + (message.length > 50 ? '...' : '')
        : '画像付きメッセージ';
      const conversation = await prisma.conversation.create({
        data: { title },
      });
      currentConversationId = conversation.id;
    }

    // Save user message (with image info as text for history)
    const savedContent = hasImages
      ? `${hasMessage ? message : ''}${hasMessage ? '\n' : ''}[画像 ${validatedImages.length}枚添付]`
      : message;

    await prisma.message.create({
      data: {
        conversationId: currentConversationId,
        role: 'user',
        content: savedContent,
      },
    });

    // Get conversation history
    const messages = await prisma.message.findMany({
      where: { conversationId: currentConversationId },
      orderBy: { createdAt: 'asc' },
      take: 20, // Limit context to last 20 messages
    });

    // Convert to OpenAI message format
    type MessageContent = string | Array<{type: 'text', text: string} | {type: 'image_url', image_url: {url: string}}>;
    const openaiMessages: Array<{role: 'system' | 'user' | 'assistant', content: MessageContent}> = [];

    // Add system prompt if provided
    if (systemPrompt) {
      openaiMessages.push({
        role: 'system',
        content: systemPrompt,
      });
    }

    // Add conversation history (except the last message which we'll handle with images)
    const historyMessages = messages.slice(0, -1);
    historyMessages.forEach((msg) => {
      openaiMessages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      });
    });

    // Add the current message with images if provided
    if (hasImages) {
      const contentParts: Array<{type: 'text', text: string} | {type: 'image_url', image_url: {url: string}}> = [];

      // Add validated images first
      validatedImages.forEach((img) => {
        contentParts.push({
          type: 'image_url',
          image_url: {
            url: `data:${img.type};base64,${img.base64}`,
          },
        });
      });

      // Add text message if provided
      if (hasMessage) {
        contentParts.push({
          type: 'text',
          text: message,
        });
      } else {
        contentParts.push({
          type: 'text',
          text: 'この画像について説明してください。',
        });
      }

      openaiMessages.push({
        role: 'user',
        content: contentParts,
      });
    } else {
      openaiMessages.push({
        role: 'user',
        content: message,
      });
    }

    // Stream response from OpenAI
    const stream = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: openaiMessages as OpenAI.Chat.ChatCompletionMessageParam[],
      stream: true,
      max_tokens: 4096,
    });

    let assistantResponse = '';

    // Create a readable stream for the response
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              assistantResponse += content;

              // Send chunk to client
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

          // Save assistant response to database
          await prisma.message.create({
            data: {
              conversationId: currentConversationId,
              role: 'assistant',
              content: assistantResponse,
            },
          });

          // Send completion signal
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: 'done',
                conversationId: currentConversationId,
              }) + '\n'
            )
          );

          controller.close();
        } catch (error: any) {
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
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Chat API error:', error);
    const message = error?.message || 'Unknown error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
