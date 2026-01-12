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

    const { conversationId, message, systemPrompt } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    const openai = new OpenAI({ apiKey });

    let currentConversationId = conversationId;

    // Create new conversation if no ID provided
    if (!currentConversationId) {
      const conversation = await prisma.conversation.create({
        data: {
          title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
        },
      });
      currentConversationId = conversation.id;
    }

    // Save user message
    await prisma.message.create({
      data: {
        conversationId: currentConversationId,
        role: 'user',
        content: message,
      },
    });

    // Get conversation history
    const messages = await prisma.message.findMany({
      where: { conversationId: currentConversationId },
      orderBy: { createdAt: 'asc' },
      take: 20, // Limit context to last 20 messages
    });

    // Convert to OpenAI message format
    const openaiMessages: Array<{role: 'system' | 'user' | 'assistant', content: string}> = [];

    // Add system prompt if provided
    if (systemPrompt) {
      openaiMessages.push({
        role: 'system',
        content: systemPrompt,
      });
    }

    // Add conversation history
    messages.forEach((msg) => {
      openaiMessages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      });
    });

    // Stream response from OpenAI
    const stream = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: openaiMessages,
      stream: true,
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
