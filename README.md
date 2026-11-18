# VU Knowledgebase

> Autonomous Document Ingestion, 3072-Dimensional pgvector Semantic Search & Grounded RAG Platform.
> Developed for **Varendra University (Rajshahi, Bangladesh) — 33rd Batch Industrial Attachment**.

[![Live Demo](https://img.shields.io/badge/Live_Demo-Vercel-black?style=for-the-badge&logo=vercel)](https://vu-knowledgebase.vercel.app)
[![Developer Portfolio](https://img.shields.io/badge/Author-Mustarif_Alom-purple?style=for-the-badge)](https://ezoxkr-dev.github.io/own-portfolio/)

---

## 🚀 Live Demo & Repository
- **Live Deployment:** [https://vu-knowledgebase.vercel.app](https://vu-knowledgebase.vercel.app)
- **Developer Portfolio:** [https://ezoxkr-dev.github.io/own-portfolio/](https://ezoxkr-dev.github.io/own-portfolio/)
- **Author:** Mustarif Alom (`mustarifalom10@gmail.com`) — Computer Science & Engineering, Varendra University

---

## 🌟 Architecture & Features

1. **Document Ingestion & Text Extraction**:
   - Parses multi-format documents (PDF via `unpdf`, DOCX via `mammoth`, and plain TXT).
   - Validates file sizes with a 4MB ceiling for non-blocking serverless execution.

2. **Boundary-Aware Sliding Window Chunking**:
   - Chunks text into ~`1,200` characters with `150` characters overlap.
   - Preserves semantic integrity by breaking at natural sentence and paragraph boundaries (`\n\n`, `. `, `! `, `? `).

3. **High-Dimensional Vector Embeddings**:
   - Generates 3072-dimensional vector representations with Google Gemini (`gemini-embedding-001`).
   - Uses `RETRIEVAL_DOCUMENT` for ingested documents and `RETRIEVAL_QUERY` for queries.
   - Built with direct REST calls (no heavy SDK overhead) with jittered exponential retry backoff.

4. **Vector Database & Similarity Search**:
   - Built on **PostgreSQL** with the **`pgvector`** extension.
   - Cosine distance similarity operator (`ORDER BY embedding <=> $vec LIMIT 8`).
   - Filter thresholding ($\ge 0.55$) to eliminate irrelevant context passages.

5. **Citation-Grounded RAG Engine**:
   - Synthesizes answers strictly from retrieved context passages using Google `gemini-3.8-flash`.
   - Strict hallucination guardrails: claims cite source passage numbers (`[1]`, `[2]`).
   - Zero-thinking latency budget (`thinkingBudget: 0`) for sub-2-second response times.
   - Bilingual support: mirrors the question language in English or বাংলা (Bangla).

6. **Multimodal Speech-to-Text Search**:
   - Microphone voice querying recorded via the browser's `MediaRecorder` API.
   - Transcribed in sub-seconds via the **Groq Whisper API** (`whisper-large-v3`) at zero temperature.

7. **Queue Resilience & Asynchronous Processing**:
   - Non-blocking uploads: returns HTTP 200 immediately and completes embeddings in the background via Vercel Fluid Compute `waitUntil`.
   - Persistent queue state machine (`pending` $\rightarrow$ `processing` $\rightarrow$ `completed` / `failed`) in PostgreSQL.
   - Resumes interrupted jobs on admin dashboard login (`/api/jobs/resume`) and runs hourly Vercel Cron retry sweeps (`/api/cron/process`).

---

## 🛠️ Stack

- **Framework:** Next.js 16 (App Router, Node runtime on Fluid Compute)
- **Database:** PostgreSQL + `pgvector` (Neon / Supabase) with fallback local SQLite driver
- **AI Models:** Google `gemini-embedding-001` (3072-d vectors) & `gemini-3.8-flash` (RAG)
- **Speech AI:** Groq Whisper API (`whisper-large-v3`)
- **Styling:** Tailwind CSS

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env`:

| Variable | Required | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | Yes (Production) | Postgres connection string with `pgvector` extension enabled. |
| `GOOGLE_API_KEY` | Yes | Google AI Studio API key for `gemini-embedding-001` and `gemini-3.8-flash`. |
| `GROQ_API_KEY` | Optional | Groq API key for Whisper voice search. |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Yes | Credentials for admin dashboard. |
| `AUTH_SECRET` | Yes | Secret used for signing session JWTs. |
| `EMBEDDING_DIMS` | No | Defaults to `3072` (supports 768–3072). |

---

## 💻 Local Setup

```bash
# Clone the repository
git clone https://github.com/ezoxkr-dev/VUKnowledgebase.git
cd VUKnowledgebase

# Install dependencies
npm install

# Initialize database schema (PostgreSQL)
npm run db:init

# Start development server
npm run dev
```

---

## 👨‍💻 Author

**Mustarif Alom**
- Degree: B.Sc. in Computer Science & Engineering (Final Year, 33rd Batch)
- Institution: Varendra University, Rajshahi, Bangladesh
- Email: [mustarifalom10@gmail.com](mailto:mustarifalom10@gmail.com)
- Portfolio: [ezoxkr-dev.github.io/own-portfolio](https://ezoxkr-dev.github.io/own-portfolio/)
- GitHub: [@ezoxkr-dev](https://github.com/ezoxkr-dev)
