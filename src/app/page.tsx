import { AskBox } from "./ask-box";

/**
 * Public landing page for Varendra University Knowledge Engine.
 * Engineered by Mustarif Alom (33rd Batch CSE, Varendra University)
 * In collaboration with ASTGD Industrial Attachment.
 */
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center px-4 pb-16 pt-10 sm:pt-14 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
      <div className="w-full max-w-4xl">
        
        {/* Institutional Top Banner */}
        <div className="flex flex-col sm:flex-row items-center justify-between pb-5 mb-8 border-b border-neutral-200 dark:border-neutral-800 text-xs gap-3">
          <div className="flex items-center gap-2.5 font-semibold text-neutral-800 dark:text-neutral-200">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Varendra University Knowledge AI &bull; UGC Approved</span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <a
              href="https://admission.vu.edu.bd"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
            >
              <span>Admission Portal</span>
              <span className="text-[10px]">&rarr;</span>
            </a>
            <a
              href="https://ezoxkr-dev.github.io/own-portfolio/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-purple-600 dark:text-purple-400 hover:underline"
            >
              Engineer Portfolio &rarr;
            </a>
            <a
              href="/login"
              className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
            >
              Admin Portal
            </a>
          </div>
        </div>

        {/* Hero Header */}
        <div className="text-center mb-8">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-lg">
            <span className="text-2xl font-black tracking-wider">VU</span>
          </div>
          
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-neutral-900 dark:text-neutral-50">
            Varendra University Knowledge Engine
          </h1>
          
          <p className="mt-3 text-sm sm:text-base text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto leading-relaxed">
            Autonomous domain-grounded query assistant for prospective students, enrolled undergraduates, and guardians. Answers admissions, 20+ program fee structures, merit waivers, bus transport, and campus guidelines directly from official documentation.
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-500/20">
              🛡️ Strict VU Domain Filter
            </span>
            <span className="px-2.5 py-1 rounded-full bg-neutral-200/80 dark:bg-neutral-800 font-mono">Next.js 16</span>
            <span className="px-2.5 py-1 rounded-full bg-neutral-200/80 dark:bg-neutral-800 font-mono">pgvector 3072-d</span>
            <span className="px-2.5 py-1 rounded-full bg-neutral-200/80 dark:bg-neutral-800 font-mono">Gemini 3.8-Flash RAG</span>
            <span className="px-2.5 py-1 rounded-full bg-neutral-200/80 dark:bg-neutral-800 font-mono">Groq Whisper STT</span>
          </div>
        </div>

        {/* Main Query & Features Container */}
        <AskBox />

        {/* Quick Institutional Highlights Grid */}
        <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-1">
            <div className="font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
              <span>🏛️ Permanent Campus</span>
            </div>
            <p className="text-neutral-500 leading-relaxed">
              Bypass Road, Kharbona, Rajshahi-6204. Modern 84 classrooms, 25 high-tech labs, central library, and green campus.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-1">
            <div className="font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
              <span>📜 Generous Waivers</span>
            </div>
            <p className="text-neutral-500 leading-relaxed">
              Up to 100% waiver for GPA 5.00 applicants. 25% waiver for all female students, siblings, and freedom fighter quotas.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-1">
            <div className="font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
              <span>📞 Admission Helpline</span>
            </div>
            <p className="text-neutral-500 leading-relaxed">
              Phone: 01730-406501, 01730-406502 &bull; Email: admission@vu.edu.bd &bull; Web: admission.vu.edu.bd
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 gap-3">
          <p>
            Engineered by{" "}
            <a
              href="https://ezoxkr-dev.github.io/own-portfolio/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-neutral-900 dark:text-neutral-100 hover:underline"
            >
              Mustarif Alom
            </a>{" "}
            &bull; 33rd Batch CSE &bull; Industrial Attachment with ASTGD
          </p>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/ASTGD/VUKnowledgebase"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline font-medium text-neutral-700 dark:text-neutral-300"
            >
              Official ASTGD Repository
            </a>
            <a
              href="https://github.com/ezoxkr-dev/VUKnowledgebase"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              Forked Deployment
            </a>
            <a href="/login" className="hover:underline">
              Admin
            </a>
          </div>
        </div>

      </div>
    </main>
  );
}
