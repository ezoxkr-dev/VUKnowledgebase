import { NextRequest, NextResponse } from "next/server";
import { connection } from "next/server";
import { getDb } from "@/lib/db";
import { embedQuery } from "@/lib/embed";
import { generateAnswer } from "@/lib/answer";
import fs from "fs";
import path from "path";

export const maxDuration = 120;

const MAX_QUESTION_CHARS = 1_000;
const TOP_K = 8;
const DEFAULT_MIN_SIMILARITY = 0.55;

type Source = { filename: string; similarity: number; snippet: string };

// Core domain vocabulary for Varendra University validation
const VU_DOMAIN_KEYWORDS = [
  "varendra", "vu", "university", "admission", "admissions", "apply", "tuition", "fee", "fees",
  "cost", "waiver", "waivers", "scholarship", "scholarships", "cse", "eee", "pharmacy", "bba",
  "law", "llb", "llm", "english", "economics", "sociology", "journalism", "jcms", "campus",
  "permanent", "kharbona", "bypass", "bus", "transport", "transportation", "route", "grading",
  "cgpa", "gpa", "ssc", "hsc", "semester", "credit", "credits", "faculty", "dean", "vc",
  "vice chancellor", "registrar", "trust", "hafizur", "rajshahi", "library", "lab", "laboratory",
  "club", "hostel", "accommodation", "curriculum", "syllabus", "ugc", "accreditation", "ieb",
  "pcb", "bar council", "notice", "result", "exam", "examination", "batch", "spring", "summer",
  // Bengali terms
  "বরেন্দ্র", "বিশ্ববিদ্যালয়", "ভর্তি", "ফি", "খরচ", "সিএসই", "ট্রিপল", "ফার্মেসি", "আইন", "বিবিএ",
  "ইংরেজি", "অর্থনীতি", "সমাজবিজ্ঞান", "সাংবাদিকতা", "ক্যাম্পাস", "বাইপাস", "বাস", "পরিবহন",
  "ওয়েভার", "স্কলারশিপ", "বৃত্তি", "জিপিএ", "সেমিস্টার", "ক্রেডিট", "গ্রন্থাগার", "ল্যাব", "রাজশাহী"
];

// Check if query is pertinent to Varendra University
function isVarendraUniversityQuery(query: string): boolean {
  const qLower = query.toLowerCase();
  
  // Explicit mention of Varendra / VU
  if (qLower.includes("varendra") || qLower.includes("বরেন্দ্র") || /\bvu\b/i.test(qLower)) {
    return true;
  }

  // Count domain keywords
  const words = qLower.replace(/[?.,!;:()"]/g, " ").split(/\s+/).filter(Boolean);
  let matches = 0;
  for (const w of words) {
    if (VU_DOMAIN_KEYWORDS.some((kw) => w === kw || (kw.length > 3 && w.includes(kw)))) {
      matches++;
    }
  }

  // If at least one distinct university keyword is present, consider valid
  return matches >= 1;
}

// In-memory knowledge passages for local search
let cachedPassages: { title: string; content: string; category: string }[] | null = null;

function loadPassages(): { title: string; content: string; category: string }[] {
  if (cachedPassages) return cachedPassages;
  try {
    const filePath = path.join(process.cwd(), "data", "varendra-university.txt");
    if (!fs.existsSync(filePath)) return [];
    const text = fs.readFileSync(filePath, "utf-8");
    const sections = text.split(/\n-{3,}\n/);
    const parsed: { title: string; content: string; category: string }[] = [];
    
    for (const sec of sections) {
      const trimmed = sec.trim();
      if (!trimmed || trimmed.length < 35) continue;
      const lines = trimmed.split("\n");
      const title = lines[0]?.replace(/[=#-]/g, "").trim() || "Varendra University Guide";
      
      let category = "General";
      const tLower = title.toLowerCase();
      if (tLower.includes("fee") || tLower.includes("tuition")) category = "Tuition & Fees";
      else if (tLower.includes("admission") || tLower.includes("program")) category = "Admissions";
      else if (tLower.includes("scholarship") || tLower.includes("waiver")) category = "Scholarships";
      else if (tLower.includes("facilit") || tLower.includes("campus")) category = "Campus & Transit";
      else if (tLower.includes("grading")) category = "Academic Grading";

      parsed.push({ title, content: trimmed, category });
    }
    cachedPassages = parsed;
    return parsed;
  } catch (err) {
    console.error("Failed to load local passages:", err);
    return [];
  }
}

function searchLocalPassages(query: string, limit = 5): Source[] {
  const passages = loadPassages();
  if (passages.length === 0) return [];

  const rawTokens = query.toLowerCase().replace(/[?.,!;:()"]/g, " ").split(/\s+/).filter(Boolean);
  
  const synonyms: Record<string, string[]> = {
    fee: ["tuition", "cost", "taka", "bdt", "waiver", "scholarship", "ফি", "খরচ", "টাকা"],
    tuition: ["fee", "cost", "waiver", "scholarship", "ফি", "খরচ"],
    cse: ["computer", "science", "engineering", "b.sc", "সিএসই", "কম্পিউটার"],
    eee: ["electrical", "electronic", "engineering", "ট্রিপল"],
    pharmacy: ["b.pharm", "pharma", "ফার্মেসি", "ঔষধ"],
    law: ["ll.b", "llb", "আইন", "এলএলবি"],
    bba: ["business", "administration", "বিবিএ", "ব্যবসা"],
    english: ["b.a", "literature", "ইংরেজি"],
    admission: ["requirements", "eligibility", "hsc", "ssc", "gpa", "ভর্তি", "যোগ্যতা"],
    campus: ["permanent", "kharbona", "location", "address", "ক্যাম্পাস", "ঠিকানা", "বাইপাস"],
    bus: ["transport", "route", "schedule", "বাস", "যাতায়াত", "পরিবহন"],
    waiver: ["scholarship", "merit", "discount", "বৃত্তি", "মওকুফ", "ওয়েভার"],
  };

  const expanded = new Set<string>(rawTokens);
  for (const t of rawTokens) {
    if (synonyms[t]) {
      synonyms[t].forEach((syn) => expanded.add(syn));
    }
  }

  const scored: { passage: { title: string; content: string; category: string }; score: number }[] = [];

  for (const p of passages) {
    const textLower = p.content.toLowerCase();
    const titleLower = p.title.toLowerCase();
    let hits = 0;
    for (const token of expanded) {
      if (titleLower.includes(token)) hits += 3.5;
      if (textLower.includes(token)) hits += 1;
    }
    if (hits > 0) {
      const score = Math.min(0.96, 0.55 + (hits / (expanded.size * 2.2)) * 0.4);
      scored.push({ passage: p, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => ({
    filename: `Official VU Record: ${s.passage.title.slice(0, 48)}`,
    similarity: Math.round(s.score * 100) / 100,
    snippet: s.passage.content.length > 300 ? `${s.passage.content.slice(0, 300)}…` : s.passage.content,
  }));
}

export async function POST(req: NextRequest) {
  await connection();

  let body: { question?: unknown; minSimilarity?: unknown } = {};
  try {
    const raw = await req.text();
    if (raw && raw.trim().length > 0) {
      body = JSON.parse(raw);
    }
  } catch {
    try {
      body = (await req.json()) as { question?: unknown; minSimilarity?: unknown };
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  const minSimilarity =
    typeof body.minSimilarity === "number" && body.minSimilarity > 0 && body.minSimilarity < 1
      ? body.minSimilarity
      : DEFAULT_MIN_SIMILARITY;

  if (!question) {
    return NextResponse.json({ error: "Please enter a question." }, { status: 400 });
  }
  if (question.length > MAX_QUESTION_CHARS) {
    return NextResponse.json(
      { error: `Question exceeds limit of ${MAX_QUESTION_CHARS} characters.` },
      { status: 400 },
    );
  }

  // 1. Strict Out-of-Domain Guardrail Check
  const isBangla = /[\u0980-\u09FF]/.test(question);
  if (!isVarendraUniversityQuery(question)) {
    const refusalText = isBangla
      ? `আমি বরেন্দ্র বিশ্ববিদ্যালয়ের অফিসিয়াল এআই সহকারী। আমি শুধুমাত্র বরেন্দ্র বিশ্ববিদ্যালয় সম্পর্কিত তথ্য (যেমনঃ বিভিন্ন বিভাগের ভর্তি যোগ্যতা, মোট টিউশন ফি, ওয়েভার ও স্কলারশিপ নীতিমালা, স্থায়ী ক্যাম্পাস, যাতায়াত ব্যবস্থা ও সুযোগ-সুবিধা) প্রদানের জন্য তৈরি।\n\nআপনার প্রশ্নটি বরেন্দ্র বিশ্ববিদ্যালয় সম্পর্কিত না হওয়ায় উত্তর প্রদান করা সম্ভব নয়। অনুগ্রহ করে বরেন্দ্র বিশ্ববিদ্যালয় সম্পর্কিত যেকোনো প্রশ্ন জিজ্ঞাসা করুন (যেমনঃ সিএসই বিভাগের খরচ কত?, ওয়েভার পাওয়ার যোগ্যতা কি?, স্থায়ী ক্যাম্পাসের ঠিকানা কি?)।`
      : `I am the official Varendra University Knowledge AI Assistant. I am specialized strictly to provide information regarding Varendra University (including undergraduate & graduate admissions, tuition fee structures, merit waivers, departmental programs, permanent campus location, and bus transit facilities).\n\nYour question does not appear to be related to Varendra University. Please ask an inquiry pertaining to Varendra University (e.g. "What is the tuition fee for B.Sc. in CSE?", "What are the scholarship criteria for GPA 5.00?", or "Where is the permanent campus located?").`;

    return NextResponse.json({
      answer: refusalText,
      sources: [],
      isOutOfDomain: true,
      mode: "domain-guardrail",
    });
  }

  // 2. Vector Search via pgvector + Gemini Embeddings (when configured)
  let vector: number[] | null = null;
  try {
    vector = await embedQuery(question);
  } catch (err) {
    console.warn("[ask] vector embedding skipped, using resilient knowledge matcher:", err);
  }

  if (vector) {
    try {
      const hits = await getDb().searchSimilarChunks(vector, {
        limit: TOP_K,
        minSimilarity,
      });

      if (hits.length > 0) {
        const sources: Source[] = hits.map((hit) => ({
          filename: hit.filename,
          similarity: hit.similarity,
          snippet: hit.content.length > 250 ? `${hit.content.slice(0, 250)}…` : hit.content,
        }));

        try {
          const answer = await generateAnswer(
            question,
            hits.map((hit) => ({ filename: hit.filename, content: hit.content })),
          );
          return NextResponse.json({ answer, sources, mode: "vector-rag" });
        } catch (genErr) {
          console.error("[ask] LLM answer generation failed, returning direct citation chunk:", genErr);
          const best = hits[0];
          return NextResponse.json({
            answer: `Direct Grounded Passage from [1] "${best.filename}":\n\n${best.content}`,
            sources,
            mode: "vector-direct",
          });
        }
      }
    } catch (dbErr) {
      console.warn("[ask] pgvector query failed, activating offline knowledge fallback:", dbErr);
    }
  }

  // 3. Resilient Knowledge Search Fallback (100% Grounded in data/varendra-university.txt)
  const localHits = searchLocalPassages(question, 4);
  if (localHits.length > 0) {
    const formattedAnswer = [
      `Official Varendra University Verified Information [1]:`,
      ``,
      ...localHits.slice(0, 3).map((h, i) => `[${i + 1}] ${h.snippet.replace(/\n+/g, " ")}`),
      ``,
      `📌 Verified from official Varendra University records (UGC Approved Private University, Rajshahi).`,
    ].join("\n");

    return NextResponse.json({
      answer: formattedAnswer,
      sources: localHits,
      mode: "grounded-fallback",
    });
  }

  return NextResponse.json({
    answer: isBangla
      ? `বরেন্দ্র বিশ্ববিদ্যালয়ের নলেজবেসে এই প্রশ্নের সরাসরি কোনো রেকর্ড খুঁজে পাওয়া যায়নি। অনুগ্রহ করে প্রশ্নটি অন্যভাবে লিখুন অথবা ভর্তির অফিসিয়াল পোর্টালে (admission.vu.edu.bd) যোগাযোগ করুন।`
      : `No direct matching record found in Varendra University documentation for this specific query. Please try rephrasing, or visit the official admissions portal at admission.vu.edu.bd.`,
    sources: [],
    noMatch: true,
  });
}
