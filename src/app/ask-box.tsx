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
  isOutOfDomain?: boolean;
  error?: string;
  mode?: string;
};

const PROGRAMS_DATA: Record<
  string,
  { name: string; credits: number; fee: number; semesters: number; minGpa: number }
> = {
  cse: { name: "B.Sc. in Computer Science & Engineering (CSE)", credits: 144, fee: 514000, semesters: 8, minGpa: 2.5 },
  eee: { name: "B.Sc. in Electrical & Electronic Engineering (EEE)", credits: 143, fee: 468000, semesters: 8, minGpa: 2.5 },
  pharmacy: { name: "Bachelor of Pharmacy (B.Pharm)", credits: 164, fee: 666000, semesters: 8, minGpa: 3.0 },
  bba: { name: "Bachelor of Business Administration (BBA)", credits: 126, fee: 414000, semesters: 8, minGpa: 2.5 },
  llb: { name: "LL.B. (Honours) - Law", credits: 134, fee: 369000, semesters: 8, minGpa: 2.5 },
  english: { name: "B.A. (Honours) in English", credits: 123, fee: 324000, semesters: 8, minGpa: 2.5 },
  economics: { name: "BSS (Honours) in Economics", credits: 123, fee: 252000, semesters: 8, minGpa: 2.5 },
  sociology: { name: "BSS (Honours) in Sociology", credits: 123, fee: 252000, semesters: 8, minGpa: 2.5 },
  jcms: { name: "BSS in Journalism & Creative Media (JCMS)", credits: 123, fee: 288000, semesters: 8, minGpa: 2.5 },
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
    "What is the total cost for Bachelor of Pharmacy (B.Pharm)?",
    "What is the semester fee payment schedule?",
  ],
  admission: [
    "What are the minimum GPA requirements for SSC and HSC?",
    "What documents must be submitted during undergraduate admission?",
    "How to apply online through admission.vu.edu.bd?",
  ],
  cse: [
    "How many credits are required to graduate in B.Sc. in CSE?",
    "What lab facilities and research facilities are available in CSE?",
    "Does VU CSE have IEB accreditation progress?",
  ],
  campus: [
    "Where is the permanent campus located and how to reach there?",
    "Is student bus transportation service available and what are the routes?",
    "What library and cafeteria facilities exist on permanent campus?",
  ],
  waiver: [
    "What GPA is required for 100% and 50% tuition fee waiver?",
    "Is there a 25% waiver for female students or siblings?",
    "What are the conditions for maintaining merit waiver in semesters?",
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

  // Advanced features state
  const [selectedTopic, setSelectedTopic] = useState("all");
  const [precision, setPrecision] = useState<number>(0.55);
  const [inspectingSource, setInspectingSource] = useState<Source | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  
  // Interactive Modals
  const [showCalculator, setShowCalculator] = useState(false);
  const [showBusGuide, setShowBusGuide] = useState(false);

  // Calculator State
  const [calcProgram, setCalcProgram] = useState("cse");
  const [calcSscGpa, setCalcSscGpa] = useState<number>(5.0);
  const [calcHscGpa, setCalcHscGpa] = useState<number>(5.0);
  const [calcQuota, setCalcQuota] = useState("none"); // none, female, sibling, ff

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setError("Network connection issue — please try again.");
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
    const cleanText = result.answer
      .replace(/\[\d+\]/g, "")
      .replace(/[#*`_]/g, "")
      .replace(/\n+/g, " ")
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

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
        setError(data.error ?? "Voice transcription unavailable. Please type your question.");
        return;
      }
      setQuestion(data.text.trim());
      handleSubmit(data.text.trim());
    } catch {
      setError("Transcription network error — please type instead.");
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
      setError("Microphone permission denied. Please type your question.");
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

  // Calculate waiver and fee estimation
  const prog = PROGRAMS_DATA[calcProgram] || PROGRAMS_DATA.cse;
  let waiverPercent = 0;
  if (calcQuota === "ff") {
    waiverPercent = 100;
  } else if (calcSscGpa >= 5.0 && calcHscGpa >= 5.0) {
    waiverPercent = 50; // Merit waiver standard 50%-100%
  } else if (calcQuota === "female" || calcQuota === "sibling") {
    waiverPercent = 25;
  }
  const discountAmount = (prog.fee * waiverPercent) / 100;
  const netPayable = prog.fee - discountAmount;
  const perSemester = Math.round(netPayable / prog.semesters);

  return (
    <div className="mt-8 space-y-6">
      
      {/* Top Professional Tools Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-white/80 dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">
            University Tools:
          </span>
          <button
            type="button"
            onClick={() => setShowCalculator(true)}
            className="px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 transition flex items-center gap-1.5"
          >
            <span>💰 Fee &amp; Waiver Calculator</span>
          </button>
          <button
            type="button"
            onClick={() => setShowBusGuide(true)}
            className="px-3 py-1 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800 hover:bg-blue-100 transition flex items-center gap-1.5"
          >
            <span>🚌 Bus Routes &amp; Schedule</span>
          </button>
        </div>

        {/* Domain Scope Chip */}
        <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Verified Varendra University Scope</span>
        </div>
      </div>

      {/* Topic Filter Chips */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          {TOPIC_PRESETS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedTopic(t.id)}
              className={`px-3 py-1 rounded-full transition font-medium ${
                selectedTopic === t.id
                  ? "bg-purple-600 text-white shadow-xs"
                  : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Precision Threshold */}
        <div className="flex items-center gap-1.5 rounded-full border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/70 p-1">
          <span className="text-[11px] font-semibold text-neutral-500 pl-2">Filter:</span>
          {[
            { val: 0.4, label: "Broad" },
            { val: 0.55, label: "Balanced" },
            { val: 0.7, label: "Strict Grounding" },
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

      {/* Main Search Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit(question);
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask anything about Varendra University (e.g. CSE fees, admission criteria, permanent campus)..."
            maxLength={1000}
            disabled={loading}
            required
            className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3.5 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-purple-600 focus:ring-2 focus:ring-purple-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-purple-400"
          />
        </div>

        {/* Voice recording button */}
        <button
          type="button"
          onClick={toggleRecording}
          disabled={loading || transcribing}
          title={recording ? "Stop and query" : "Ask by speaking (Groq Whisper STT)"}
          className={`flex w-12 items-center justify-center rounded-xl border transition disabled:cursor-not-allowed ${
            recording
              ? "border-red-500 bg-red-500/10 text-red-600 animate-pulse"
              : "border-neutral-300 bg-white text-neutral-600 hover:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
          }`}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
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

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white px-5 py-3.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 shadow-sm"
        >
          {loading ? "Querying..." : "Ask AI"}
        </button>
      </form>

      {/* Voice status indicator */}
      {(recording || transcribing) && (
        <p className={`text-xs ${recording ? "text-red-600 font-medium animate-pulse" : "text-purple-600 font-medium"}`}>
          {recording ? "🎙️ Listening to your voice... Click microphone again to transcribe." : "⚡ Transcribing via Groq Whisper API..."}
        </p>
      )}

      {/* Suggested Prompts Grid */}
      {!result && !loading && (
        <div className="space-y-3">
          <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
            Suggested University Prompts:
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
                className="rounded-full border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/70 px-3.5 py-1.5 text-xs text-neutral-700 dark:text-neutral-300 transition hover:border-purple-400 hover:text-purple-600"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading Ping */}
      {loading && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-purple-600 animate-ping"></span>
            <p className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
              Verifying university domain &amp; retrieving grounded knowledge passages...
            </p>
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {/* Out-of-Domain Guardrail Warning */}
      {result?.isOutOfDomain && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-6 dark:border-amber-900 text-amber-900 dark:text-amber-200 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🛡️</span>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
              Domain Scope Guardrail: Varendra University Only
            </span>
          </div>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {result.answer}
          </p>
          <div className="pt-2 border-t border-amber-200 dark:border-amber-900/60 flex flex-wrap gap-2 text-xs">
            <span className="text-amber-800 dark:text-amber-300 font-semibold">Try asking instead:</span>
            <button
              onClick={() => {
                setQuestion("What is the total tuition fee for B.Sc. in CSE?");
                handleSubmit("What is the total tuition fee for B.Sc. in CSE?");
              }}
              className="underline hover:text-amber-600"
            >
              CSE Tuition Fees
            </button>
            <span>&bull;</span>
            <button
              onClick={() => {
                setQuestion("Where is the permanent campus located and how to reach?");
                handleSubmit("Where is the permanent campus located and how to reach?");
              }}
              className="underline hover:text-amber-600"
            >
              Permanent Campus Location
            </button>
            <span>&bull;</span>
            <button
              onClick={() => {
                setQuestion("What GPA is required for 100% and 50% waiver?");
                handleSubmit("What GPA is required for 100% and 50% waiver?");
              }}
              className="underline hover:text-amber-600"
            >
              Merit Waiver Policy
            </button>
          </div>
        </div>
      )}

      {/* Grounded University Answer Box */}
      {result?.answer && !result.isOutOfDomain && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900 shadow-sm">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                  Verified VU Knowledge Response
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
                  Official Record Grounded
                </span>
              </div>
              
              <div className="flex items-center gap-3">
                {/* Text-To-Speech Button */}
                <button
                  type="button"
                  onClick={toggleSpeech}
                  title="Listen to synthesized voice readout"
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition ${
                    isPlayingAudio
                      ? "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 animate-pulse"
                      : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200"
                  }`}
                >
                  <span>{isPlayingAudio ? "⏹ Stop Audio" : "🔊 Listen Voice"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopy}
                  className="text-xs font-medium text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 transition"
                >
                  {copied ? "✓ Copied" : "Copy"}
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

          {/* Retrieved Citations */}
          {!result.noMatch && (result.sources?.length ?? 0) > 0 && (
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                  Supporting University Documents ({result.sources!.length} verified passages)
                </h2>
                <span className="text-[11px] text-neutral-400">
                  Click to inspect vector similarity &amp; citation excerpt
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
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Tuition Fee & Waiver Calculator Modal */}
      {showCalculator && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setShowCalculator(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white dark:bg-neutral-900 p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
                  Interactive University Planning
                </span>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mt-0.5">
                  Tuition Fee &amp; Merit Waiver Estimator
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCalculator(false)}
                className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 text-lg p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Select Intended Degree Program:
                </label>
                <select
                  value={calcProgram}
                  onChange={(e) => setCalcProgram(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-2.5 text-neutral-900 dark:text-neutral-100"
                >
                  {Object.entries(PROGRAMS_DATA).map(([key, item]) => (
                    <option key={key} value={key}>
                      {item.name} ({item.credits} Credits &bull; ৳{item.fee.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    SSC GPA (out of 5.00):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="2.5"
                    max="5.0"
                    value={calcSscGpa}
                    onChange={(e) => setCalcSscGpa(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-2 text-neutral-900 dark:text-neutral-100"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    HSC GPA (out of 5.00):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="2.5"
                    max="5.0"
                    value={calcHscGpa}
                    onChange={(e) => setCalcHscGpa(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-2 text-neutral-900 dark:text-neutral-100"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Special Waiver Eligibility / Quota:
                </label>
                <select
                  value={calcQuota}
                  onChange={(e) => setCalcQuota(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-2.5 text-neutral-900 dark:text-neutral-100"
                >
                  <option value="none">General Merit (Standard)</option>
                  <option value="female">Female Student Special Waiver (25%)</option>
                  <option value="sibling">Sibling / Spouse of Enrolled Student (25%)</option>
                  <option value="ff">Freedom Fighter Quota (100% Full Waiver)</option>
                </select>
              </div>

              {/* Calculator Results Card */}
              <div className="p-4 rounded-xl bg-neutral-100 dark:bg-neutral-800 space-y-2 border border-neutral-200 dark:border-neutral-700 mt-2">
                <div className="flex justify-between">
                  <span className="text-neutral-600 dark:text-neutral-400">Standard Total Fee:</span>
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                    ৳{prog.fee.toLocaleString()} BDT
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600 dark:text-neutral-400">Eligible Waiver:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {waiverPercent}% (Savings: ৳{discountAmount.toLocaleString()})
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-neutral-200 dark:border-neutral-700 text-sm font-bold">
                  <span>Net Payable Tuition:</span>
                  <span className="text-purple-600 dark:text-purple-400">৳{netPayable.toLocaleString()} BDT</span>
                </div>
                <div className="flex justify-between text-[11px] text-neutral-500">
                  <span>Per Semester Approx. Cost ({prog.semesters} Semesters):</span>
                  <span>৳{perSemester.toLocaleString()} / semester</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  const q = `Give me a full breakdown of the tuition fees, credit requirements, and waiver policy for ${prog.name}.`;
                  setShowCalculator(false);
                  setQuestion(q);
                  handleSubmit(q);
                }}
                className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline"
              >
                Ask AI Full Breakdown &rarr;
              </button>
              <button
                type="button"
                onClick={() => setShowCalculator(false)}
                className="px-4 py-2 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bus Routes & Transit Guide Modal */}
      {showBusGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setShowBusGuide(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white dark:bg-neutral-900 p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                  Campus Connectivity
                </span>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mt-0.5">
                  Varendra University Student Bus Routes
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowBusGuide(false)}
                className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 text-lg p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed text-neutral-700 dark:text-neutral-300">
              <p>
                Varendra University operates dedicated fleet transport services between Rajshahi City hubs and the <strong>Permanent Campus at Bypass Road, Kharbona</strong>:
              </p>

              <div className="space-y-2">
                <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                  <div className="font-bold text-blue-600 dark:text-blue-400 mb-0.5">
                    Route 1: Talaimari &bull; Kazla &bull; RU Main Gate &bull; VU Campus
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    Morning Pickups: 7:45 AM, 8:45 AM, 10:00 AM &bull; Return Departures: 1:30 PM, 3:30 PM, 5:00 PM.
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                  <div className="font-bold text-blue-600 dark:text-blue-400 mb-0.5">
                    Route 2: Railway Station &bull; Vodra &bull; Shiroil &bull; VU Campus
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    Morning Pickups: 8:00 AM, 9:00 AM &bull; Return Departures: 2:00 PM, 4:15 PM.
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                  <div className="font-bold text-blue-600 dark:text-blue-400 mb-0.5">
                    Route 3: Court &bull; C&amp;B &bull; Bornali &bull; Railgate &bull; VU Campus
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    Morning Pickups: 7:50 AM, 8:50 AM &bull; Return Departures: 3:30 PM, 5:00 PM.
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-[11px]">
                <strong>Fare:</strong> Transportation is complimentary or nominal for all enrolled students carrying valid university ID cards.
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowBusGuide(false)}
                className="px-4 py-2 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-semibold"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Citation Inspector Modal */}
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
                  Official Record Citation Inspector
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

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-neutral-500">Relevance Match:</span>
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

            <div className="space-y-1">
              <span className="text-xs font-semibold text-neutral-500">Official Excerpt:</span>
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
                📋 Copy Excerpt Text
              </button>
              <button
                type="button"
                onClick={() => setInspectingSource(null)}
                className="px-4 py-2 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-semibold"
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
