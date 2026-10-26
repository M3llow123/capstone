import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function createWithRetry(params: Anthropic.MessageCreateParamsNonStreaming, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await client.messages.create(params);
    } catch (err: any) {
      const isOverloaded = err?.status === 529 || err?.message?.includes("overloaded");
      const isLastAttempt = i === maxRetries - 1;

      if (isOverloaded && !isLastAttempt) {
        const wait = 2000 * Math.pow(2, i); // 2s → 4s → 8s
        await new Promise(r => setTimeout(r, wait));
        continue;
      }

      throw err;
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const { system, messages } = await req.json();

    const response = await createWithRetry({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system,
      messages,
    });

    return NextResponse.json(response);
  } catch (err: any) {
    const isOverloaded = err?.status === 529 || err?.message?.includes("overloaded");

    return NextResponse.json(
      { error: { message: isOverloaded ? "Service is busy, please try again in a moment." : err.message ?? "Unknown error" } },
      { status: isOverloaded ? 503 : 500 }
    );
  }
}