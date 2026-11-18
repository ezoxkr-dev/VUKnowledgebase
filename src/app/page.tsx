import { AskBox } from "./ask-box";

/**
 * Public landing page for Varendra University Knowledge Base.
 * Engineered by Mustarif Alom (33rd Batch CSE, Varendra University).
 */
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center px-4 pb-12 pt-12 sm:pt-16 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
      <div className="w-full max-w-3xl">
        
        {/* Top Header & Attribution */}
        <div className="flex items-center justify-between pb-6 mb-8 border-b border-neutral-200 dark:border-neutral-800 text-xs sm:text-sm">
          <div className="flex items-center gap-2 font-semibold">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Varendra University &bull; AI Knowledge Base</span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://ezoxkr-dev.github.io/own-portfolio/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-purple-600 dark:text-purple-400 hover:underline"
            >
              Author Portfolio &rarr;
            </a>
            <a
              href="/login"
              className="text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
            >
              Admin
            </a>
          </div>
        </div>

        {/* Hero Branding */}
        <div className="text-center mb-8">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-md">
            <span className="text-xl font-extrabold tracking-wider">VU</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Varendra University Knowledge Base
          </h1>
          <p className="mt-3 text-sm sm:text-base text-neutral-600 dark:text-neutral-400 max-w-xl mx-auto leading-relaxed">
            AI-powered vector search &amp; citation-grounded RAG. Ask questions in English or বাংলা &mdash; answers are extracted straight from official university documents.
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
            <span className="px-2.5 py-1 rounded-full bg-neutral-200/80 dark:bg-neutral-800 font-mono">Next.js 16</span>
            <span className="px-2.5 py-1 rounded-full bg-neutral-200/80 dark:bg-neutral-800 font-mono">PostgreSQL + pgvector</span>
            <span className="px-2.5 py-1 rounded-full bg-neutral-200/80 dark:bg-neutral-800 font-mono">Gemini 3072-d</span>
            <span className="px-2.5 py-1 rounded-full bg-neutral-200/80 dark:bg-neutral-800 font-mono">Groq Whisper STT</span>
          </div>
        </div>

        {/* Search & Answer Component */}
        <AskBox />

        {/* Footer */}
        <div className="mt-14 pt-6 border-t border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 gap-3">
          <p>
            Developed by{" "}
            <a
              href="https://ezoxkr-dev.github.io/own-portfolio/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-neutral-900 dark:text-neutral-100 hover:underline"
            >
              Mustarif Alom
            </a>{" "}
            &bull; 33rd Batch CSE, Varendra University
          </p>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/ezoxkr-dev/VUKnowledgebase"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              GitHub Source
            </a>
            <a href="/login" className="hover:underline">
              Admin Portal
            </a>
          </div>
        </div>

      </div>
    </main>
  );
}
