"use client";

import { useRef, useState } from "react";

type Source = {
  filename: string;
  similarity: number;
  snippet: string;
};

type AskResponse = {
  answer?: string;
  sources?: Source[];
  noMatch?: boolean;
  error?: string;
};

const PROMPT_CATEGORIES = [
  {
    category: "🎓 Admissions & Programs",
    items: [
      "What are the admission requirements for undergraduate programs?",
      "What is the tuition fee and waiver for B.Sc. in CSE?",
      "What scholarships or merit waivers are available?",
    ],
  },
  {
    category: "🇧🇩 বাংলায় দ্রুত প্রশ্ন (Bangla)",
    items: [
      "সিএসই বিভাগে ভর্তির যোগ্যতা ও মোট টিউশন ফি কত?",
      "ভর্তির সময় কি কি কাগজপত্র জমা দিতে হয়?",
      "স্থায়ী ক্যাম্পাসের ঠিকানা ও যাতায়াত ব্যবস্থা কি?",
    ],
  },
];

const MAX_RECORDING_MS = 60_000;

export function AskBox() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AskResponse | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [copied, setCopied] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleSubmit(q: string) {
    const trimmed = q.trim();
    if (!trimmed || loading) return;

    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const data = (await res.json()) as AskResponse;
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setResult(data);
    } catch {
      setError("Network error — please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setQuestion("");
    setResult(null);
    setError(null);
  }

  function handleCopy() {
    if (!result?.answer) return;
    navigator.clipboard.writeText(result.answer).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  function cleanupRecording() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    setRecording(false);
  }

  async function transcribe(blob: Blob) {
    setTranscribing(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("audio", blob, "recording.webm");
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok || !data.text) {
        setError(data.error ?? "Voice transcription failed. Please type instead.");
        return;
      }
      setQuestion(data.text.trim());
      handleSubmit(data.text.trim());
    } catch {
      setError("Network error during transcription — please type instead.");
    } finally {
      setTranscribing(false);
    }
  }

  async function toggleRecording() {
    if (recording) {
      mediaRecorderRef.current?.stop();
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Microphone access was denied. Please type your question.");
      return;
    }

    streamRef.current = stream;
    audioChunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : undefined;
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) audioChunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      cleanupRecording();
      const blob = new Blob(audioChunksRef.current, {
        type: recorder.mimeType || "audio/webm",
      });
      if (blob.size > 0) void transcribe(blob);
    };

    mediaRecorderRef.current = recorder;
    recorder.start();
    setRecording(true);

    stopTimerRef.current = setTimeout(() => {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    }, MAX_RECORDING_MS);
  }

  const micLabel = transcribing ? "Transcribing…" : recording ? "Stop" : "Voice";

  return (
    <div className="mt-8">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit(question);
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question (e.g. What are the tuition fees for CSE? or বাংলায় লিখুন)..."
          maxLength={1000}
          disabled={loading}
          required
          className="flex-1 rounded-xl border border-neutral-300 bg-white px-4 py-3.5 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-purple-600 focus:ring-2 focus:ring-purple-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-purple-400"
        />
        <button
          type="button"
          onClick={toggleRecording}
          disabled={loading || transcribing}
          title={
            recording
              ? "Stop recording and search"
              : "Ask with microphone (English or Bangla)"
          }
          aria-label={micLabel}
          className={`flex w-12 items-center justify-center rounded-xl border transition disabled:cursor-not-allowed disabled:opacity-50 ${
            recording
              ? "border-red-500 bg-red-500/10 text-red-600 dark:text-red-400"
              : "border-neutral-300 bg-white text-neutral-600 hover:border-neutral-500 hover:text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-neutral-500 dark:hover:text-neutral-100"
          }`}
        >
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {recording ? (
              <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" />
            ) : (
              <>
                <rect x="9" y="2" width="6" height="12" rx="3" />
                <path d="M5 10v1a7 7 0 0 0 14 0v-1" />
                <path d="M12 19v3" />
              </>
            )}
          </svg>
        </button>
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white px-5 py-3.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 shadow-sm"
        >
          {loading ? "Searching…" : "Ask"}
        </button>
      </form>

      {(recording || transcribing) && (
        <p
          className={`mt-2 text-xs ${
            recording
              ? "animate-pulse text-red-600 dark:text-red-400 font-medium"
              : "text-purple-600 dark:text-purple-400 font-medium"
          }`}
        >
          {recording
            ? "🎙️ Listening… click mic again to transcribe with Groq Whisper."
            : "⚡ Transcribing speech to text..."}
        </p>
      )}

      {/* Suggested Questions Grid */}
      {!result && !loading && (
        <div className="mt-6 space-y-4">
          {PROMPT_CATEGORIES.map((cat, idx) => (
            <div key={idx} className="space-y-2">
              <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                {cat.category}
              </div>
              <div className="flex flex-wrap gap-2">
                {cat.items.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => {
                      setQuestion(example);
                      handleSubmit(example);
                    }}
                    className="rounded-full border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/70 px-3.5 py-1.5 text-xs text-neutral-700 dark:text-neutral-300 transition hover:border-purple-400 hover:text-purple-600 dark:hover:border-purple-500 dark:hover:text-purple-300"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-purple-600 animate-ping"></span>
            <p className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
              Generating 3072-d embeddings &amp; querying pgvector similarity...
            </p>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {result?.answer && (
        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900 shadow-sm">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                  Citation-Grounded Answer
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                  Grounded
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="text-xs font-medium text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 transition"
                >
                  {copied ? "✓ Copied!" : "Copy"}
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-xs font-medium text-neutral-400 hover:text-red-500 transition"
                >
                  Clear
                </button>
              </div>
            </div>

            <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-800 dark:text-neutral-200">
              {result.answer}
            </p>
          </div>

          {!result.noMatch && (result.sources?.length ?? 0) > 0 && (
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900 shadow-sm">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-neutral-500">
                Supporting Sources ({result.sources!.length} retrieved passages)
              </h2>
              <ol className="space-y-3">
                {result.sources!.map((source, i) => (
                  <li key={i} className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/60 dark:border-neutral-800">
                    <div className="flex items-center justify-between gap-3 text-xs mb-1">
                      <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                        [{i + 1}] {source.filename}
                      </span>
                      <span className="rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 font-mono text-[11px] font-semibold">
                        {(source.similarity * 100).toFixed(1)}% similarity
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
                      {source.snippet}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
