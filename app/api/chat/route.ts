import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUsername, SESSION_COOKIE } from "../../lib/auth";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function createWithRetry(params: Anthropic.MessageCreateParamsNonStreaming, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await client.messages.create(params);
    } catch (err: unknown) {
      const apiError = err as { status?: number; message?: string };
      const isOverloaded = apiError.status === 529 || apiError.message?.includes("overloaded");
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
  const username = await getSessionUsername(
    req.cookies.get(SESSION_COOKIE)?.value,
    process.env.AUTH_SECRET
  );
  if (!username) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const { system, messages } = await req.json();

    const response = await createWithRetry({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system,
      messages,
    });

    return NextResponse.json(response);
  } catch (err: unknown) {
    const apiError = err as { status?: number; message?: string };
    const isOverloaded = apiError.status === 529 || apiError.message?.includes("overloaded");

    return NextResponse.json(
      { error: { message: isOverloaded ? "Service is busy, please try again in a moment." : apiError.message ?? "Unknown error" } },
      { status: isOverloaded ? 503 : 500 }
    );
  }
}