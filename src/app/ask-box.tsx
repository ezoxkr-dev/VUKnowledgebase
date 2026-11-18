"use client";

import { useEffect, useRef, useState } from "react";

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
  mode?: string;
};

const TOPIC_PRESETS = [
  { id: "all", label: "All Topics" },
  { id: "fees", label: "💰 Tuition & Fees" },
  { id: "admission", label: "🎓 Admission & GPA" },
  { id: "cse", label: "💻 CSE Department" },
  { id: "campus", label: "🏛️ Campus & Transit" },
  { id: "waiver", label: "📜 Merit Waivers" },
];

const PROMPTS_BY_TOPIC: Record<string, string[]> = {
  all: [
    "What are the admission requirements for undergraduate programs?",
    "What is the total tuition fee and waiver for B.Sc. in CSE?",
    "Where is the Varendra University permanent campus located?",
    "সিএসই বিভাগে ভর্তির যোগ্যতা ও মোট টিউশন ফি কত?",
  ],
  fees: [
    "What is the total tuition fee for B.Sc. in CSE?",
    "What is the semester-wise payment structure?",
    "Are there installment facilities for tuition fee payments?",
  ],
  admission: [
    "What are the minimum GPA requirements for SSC and HSC?",
    "What documents must be submitted during undergraduate admission?",
    "Is there an admission test for B.Sc. in CSE?",
  ],
  cse: [
    "How many credits are required to graduate in B.Sc. in CSE?",
    "What lab facilities and research facilities are available in CSE?",
    "Does VU CSE have IEB accreditation progress?",
  ],
  campus: [
    "Where is the permanent campus located and how to reach there?",
    "Is university student bus / transportation service available?",
    "What library and cafeteria facilities exist on permanent campus?",
  ],
  waiver: [
    "What GPA is required for 100% and 50% tuition fee waiver?",
    "Is there special waiver for female students or siblings?",
    "What are the scholarship conditions for maintaining GPA in semesters?",
  ],
};

const MAX_RECORDING_MS = 60_000;

export function AskBox() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AskResponse | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [copied, setCopied] = useState(false);

  // New Interactive Feature States
  const [selectedTopic, setSelectedTopic] = useState("all");
  const [precision, setPrecision] = useState<number>(0.55); // 0.40, 0.55, 0.70
  const [inspectingSource, setInspectingSource] = useState<Source | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stop TTS if component unmounts
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  async function handleSubmit(q: string) {
    const trimmed = q.trim();
    if (!trimmed || loading) return;

    // Stop ongoing speech on new query
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
    }

    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, minSimilarity: precision }),
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
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
    }
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

  // Text-To-Speech function
  function toggleSpeech() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      alert("Text-to-speech is not supported in this browser.");
      return;
    }

    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }

    if (!result?.answer) return;

    window.speechSynthesis.cancel();
    // Clean markdown symbols for natural reading
    const cleanText = result.answer
      .replace(/\[\d+\]/g, "")
      .replace(/[#*`_]/g, "")
      .replace(/\n+/g, " ")
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Language detection: check if Bengali script is predominant
    const isBangla = /[\u0980-\u09FF]/.test(cleanText);
    if (isBangla) {
      utterance.lang = "bn-BD";
    } else {
      utterance.lang = "en-US";
    }

    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);

    window.speechSynthesis.speak(utterance);
    setIsPlayingAudio(true);
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
    <div className="mt-8 space-y-6">
      {/* Precision Filter & Search Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Topic Filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          {TOPIC_PRESETS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedTopic(t.id)}
              className={`px-3 py-1 rounded-full transition font-medium ${
                selectedTopic === t.id
                  ? "bg-purple-600 text-white shadow-sm"
                  : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Similarity Threshold Selector */}
        <div className="flex items-center gap-1.5 rounded-full border border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-900/60 p-1">
          <span className="text-[11px] font-semibold text-neutral-500 pl-2">Precision:</span>
          {[
            { val: 0.4, label: "Broad (40%)" },
            { val: 0.55, label: "Balanced (55%)" },
            { val: 0.7, label: "Strict (70%)" },
          ].map((item) => (
            <button
              key={item.val}
              type="button"
              onClick={() => setPrecision(item.val)}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition ${
                precision === item.val
                  ? "bg-purple-600 text-white shadow-xs"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Search Bar Form */}
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
          className={`text-xs ${
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

      {/* Suggested Questions Grid Based on Selected Topic */}
      {!result && !loading && (
        <div className="space-y-3">
          <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
            Suggested Prompts ({TOPIC_PRESETS.find((t) => t.id === selectedTopic)?.label}):
          </div>
          <div className="flex flex-wrap gap-2">
            {(PROMPTS_BY_TOPIC[selectedTopic] || PROMPTS_BY_TOPIC.all).map((example) => (
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
      )}

      {/* Loading state indicator */}
      {loading && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-purple-600 animate-ping"></span>
            <p className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
              Generating 3072-d embeddings &amp; querying pgvector similarity...
            </p>
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {/* Answer Container */}
      {result?.answer && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900 shadow-sm">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                  Citation-Grounded Answer
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                  {result.mode === "vector-rag" ? "Vector RAG (Gemini)" : "Verified Record"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {/* Audio Readout Button */}
                <button
                  type="button"
                  onClick={toggleSpeech}
                  title="Listen to synthesized voice readout"
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                    isPlayingAudio
                      ? "bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 animate-pulse"
                      : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200"
                  }`}
                >
                  <span>{isPlayingAudio ? "⏹ Stop" : "🔊 Listen"}</span>
                </button>

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

          {/* Supporting Sources with Interactive Modal Trigger */}
          {!result.noMatch && (result.sources?.length ?? 0) > 0 && (
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                  Supporting Sources ({result.sources!.length} retrieved passages)
                </h2>
                <span className="text-[11px] text-neutral-400">
                  Click any passage to inspect vector score &amp; full context
                </span>
              </div>
              <ol className="space-y-3">
                {result.sources!.map((source, i) => (
                  <li
                    key={i}
                    onClick={() => setInspectingSource(source)}
                    className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/60 dark:border-neutral-800 hover:border-purple-400 dark:hover:border-purple-500 cursor-pointer transition"
                  >
                    <div className="flex items-center justify-between gap-3 text-xs mb-1.5">
                      <span className="font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 font-bold">
                          [{i + 1}]
                        </span>
                        {source.filename}
                      </span>
                      <span className="rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 font-mono text-[11px] font-semibold">
                        {(source.similarity * 100).toFixed(1)}% match
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
                      {source.snippet}
                    </p>
                    <div className="mt-2 flex items-center justify-end text-[11px] text-purple-600 dark:text-purple-400 font-medium">
                      Inspect Citation &rarr;
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Interactive Citation Inspector Modal */}
      {inspectingSource && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setInspectingSource(null)}
        >
          <div
            className="w-full max-w-xl rounded-2xl bg-white dark:bg-neutral-900 p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                  Vector Citation Inspector
                </span>
                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100 mt-0.5">
                  {inspectingSource.filename}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectingSource(null)}
                className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 text-lg p-1"
              >
                ✕
              </button>
            </div>

            {/* Similarity Meter */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-neutral-500">Cosine Similarity Score:</span>
                <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                  {(inspectingSource.similarity * 100).toFixed(2)}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full"
                  style={{ width: `${Math.min(100, inspectingSource.similarity * 100)}%` }}
                ></div>
              </div>
            </div>

            {/* Passage Text */}
            <div className="space-y-1">
              <span className="text-xs font-semibold text-neutral-500">Passage Excerpt:</span>
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed font-sans max-h-60 overflow-y-auto whitespace-pre-wrap">
                {inspectingSource.snippet}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(inspectingSource.snippet);
                  alert("Citation copied to clipboard!");
                }}
                className="text-xs font-medium text-purple-600 dark:text-purple-400 hover:underline"
              >
                📋 Copy Citation Text
              </button>
              <button
                type="button"
                onClick={() => setInspectingSource(null)}
                className="px-4 py-2 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-semibold hover:opacity-90"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
