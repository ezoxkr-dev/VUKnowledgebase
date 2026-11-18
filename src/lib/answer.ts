/**
 * Answer generation over retrieved chunks (RAG) using the Google
 * Generative Language API: POST /v1beta/models/{model}:generateContent
 *
 * Configured via env: GOOGLE_API_KEY (shared), ANSWER_MODEL (optional).
 */

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";
export const ANSWER_MODEL = process.env.ANSWER_MODEL || "gemini-3.8-flash";
const MAX_CONTEXT_CHARS = 24_000;

const SYSTEM_INSTRUCTION = `You are the official AI Knowledge Assistant for Varendra University (Rajshahi, Bangladesh). 

STRICT DOMAIN GUARD RULES:
1. You answer ONLY questions directly related to Varendra University (admissions, eligibility criteria, tuition fees, scholarships, waivers, academic programs, departments, faculty, permanent campus, bus transport, grading system, student clubs, and university administration).
2. If the user's question is NOT about Varendra University (e.g. general knowledge, other universities, code writing, recipes, politics, general world facts, or entertainment), you MUST politely refuse. State:
   "I am the Varendra University Knowledge AI. I can only assist with information related to Varendra University (such as admissions, tuition fees, academic programs, waivers, and campus facilities). Please ask a question about Varendra University."
   (If the user asked in Bangla, provide this refusal in natural, polite Bangla).
3. When answering university questions, answer strictly from the numbered context passages provided with each question. Cite which passage number(s) support each claim you make, like [1] or [2][3].
4. If the context does not contain the answer, say plainly: "I do not have verified records in the knowledgebase for this specific detail yet. Please consult the official VU admission office at admission.vu.edu.bd." Do not invent numbers, dates, fees, or names.
5. Be concise and professional. Use bullet points for fee breakdowns, eligibility criteria, and step-by-step procedures. Keep exact currency figures (BDT / Tk) and URLs verbatim.
6. Answer in the same language as the user's question (English or Bangla).`;

export type AnswerContext = { filename: string; content: string };

/** Generates an answer grounded in the retrieved context passages. */
export async function generateAnswer(
  question: string,
  contexts: AnswerContext[],
): Promise<string> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY is not set");
  }
  if (contexts.length === 0) {
    throw new Error("generateAnswer requires at least one context passage");
  }

  let contextBlock = "";
  contexts.forEach((context, i) => {
    contextBlock += `[${i + 1}] Source: ${context.filename}\n${context.content}\n\n`;
  });
  if (contextBlock.length > MAX_CONTEXT_CHARS) {
    contextBlock = contextBlock.slice(0, MAX_CONTEXT_CHARS);
  }

  const body = {
    system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [
      {
        role: "user",
        parts: [{ text: `${contextBlock}Question: ${question}` }],
      },
    ],
    generationConfig: {
      temperature: 0.15,
      maxOutputTokens: 2048,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  const maxRetries = 2;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const url = `${API_BASE}/models/${ANSWER_MODEL}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
        lastError = new Error(
          `Gemini answer API ${res.status}: ${errorText.slice(0, 300)}`,
        );
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
        continue;
      }
      throw new Error(`Gemini answer API ${res.status}: ${errorText.slice(0, 300)}`);
    }

    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = json.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim();

    if (!text) {
      throw new Error("Gemini answer API returned no text");
    }
    return text;
  }
  throw lastError ?? new Error("Failed to generate answer");
}
