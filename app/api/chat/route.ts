import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { MODEL_NAME } from '@/app/lib/openai';
import { prisma } from '@/app/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
      ? `${hasMessage ? message : ''}${hasMessage ? '\n' : ''}[画像 ${images.length}枚添付]`
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

      // Add images first
      images.forEach((img: {base64: string, type: string}) => {
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
