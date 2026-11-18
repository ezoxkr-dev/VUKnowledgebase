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

function checkUniversityDomain(query: string): {
  isValid: boolean;
  isGreeting: boolean;
  refusalMessage?: string;
} {
  const qLower = query.toLowerCase().trim();
  const isBangla = /[\u0980-\u09FF]/.test(query);

  // 1. Greetings & Identity queries
  const greetings = ["hi", "hello", "hey", "who are you", "what can you do", "help", "কে তুমি", "কে আপনি", "হাই", "হ্যালো", "সালাম", "নমস্কার"];
  const isDirectGreeting = greetings.some((g) => qLower === g || qLower.startsWith(g + " ") || qLower.endsWith(" " + g));
  if (isDirectGreeting && !qLower.includes("fee") && !qLower.includes("admission") && !qLower.includes("cost")) {
    return {
      isValid: true,
      isGreeting: true,
      refusalMessage: isBangla
        ? "আসসালামু আলাইকুম / নমস্কার! আমি বরেন্দ্র বিশ্ববিদ্যালয়ের অফিসিয়াল এআই সহকারী। আমি আপনাকে ভর্তি প্রক্রিয়া, ২০টি অ্যাকাডেমিক বিভাগের টিউশন ফি, মেধা বৃত্তি/ওয়েভার নীতিমালা, স্থায়ী ক্যাম্পাস এবং বাস যাতায়াত সম্পর্কে তথ্য দিতে প্রস্তুত। আপনি কি জানতে চান?"
        : "Hello! I am the official Varendra University Knowledge AI. I can assist you with academic admissions, 20+ degree fee structures, merit waivers (up to 100%), campus facilities, and bus transportation schedules. How can I assist your university inquiry today?",
    };
  }

  // 2. Reject questions explicitly asking about other institutions
  const otherInstitutions = [
    "dhaka university", "du", "rajshahi university", "ruet", "buet", "cuet", "kuet",
    "nsu", "brac", "aiub", "aust", "diu", "harvard", "oxford", "mit", "stanford",
    "ঢাকা বিশ্ববিদ্যালয়", "বুয়েট", "রুয়েট"
  ];
  const mentionsOther = otherInstitutions.some((inst) => qLower.includes(inst));
  const mentionsVU = qLower.includes("varendra") || qLower.includes("বরেন্দ্র") || /\bvu\b/i.test(qLower);
  if (mentionsOther && !mentionsVU) {
    return {
      isValid: false,
      isGreeting: false,
      refusalMessage: isBangla
        ? "আমি শুধুমাত্র বরেন্দ্র বিশ্ববিদ্যালয় (রাজশাহী)-এর তথ্য প্রদান করতে পারি। অন্য কোনো প্রতিষ্ঠান বা বিশ্ববিদ্যালয়ের তথ্য আমার সিস্টেমে নেই।"
        : "I only provide verified information regarding Varendra University (Rajshahi). I do not have records or information for other institutions. Please ask inquiries regarding Varendra University.",
    };
  }

  // 3. Positive VU Domain signals
  if (mentionsVU) return { isValid: true, isGreeting: false };

  // Explicit VU Program / Campus / Fee tokens
  const explicitVuSignals = [
    "cse", "eee", "b.pharm", "pharmacy", "ll.b", "llb", "bba", "jcms", "nfe",
    "tuition", "tuition fee", "admission fee", "admission test", "merit waiver",
    "permanent campus", "kharbona", "bypass road", "student bus", "bus route",
    "hafizur rahaman khan", "vc", "vice chancellor", "ugc approved", "grading scale",
    "সিএসই", "ফার্মেসি", "আইন বিভাগ", "টিউশন ফি", "ভর্তি ফি", "স্থায়ী ক্যাম্পাস", "ওয়েভার", "বাস রুট"
  ];
  if (explicitVuSignals.some((sig) => qLower.includes(sig))) {
    return { isValid: true, isGreeting: false };
  }

  // Token overlap check
  const words = qLower.replace(/[?.,!;:()"]/g, " ").split(/\s+/).filter(Boolean);
  const matchedTokens = words.filter((w) => VU_DOMAIN_KEYWORDS.includes(w));
  if (
    matchedTokens.length >= 2 ||
    (matchedTokens.length === 1 &&
      ["fee", "fees", "cost", "admission", "waiver", "scholarship", "campus", "hostel", "ভর্তি", "খরচ"].includes(
        matchedTokens[0],
      ))
  ) {
    return { isValid: true, isGreeting: false };
  }

  // Otherwise: Strictly Out of Domain
  return {
    isValid: false,
    isGreeting: false,
    refusalMessage: isBangla
      ? `আমি বরেন্দ্র বিশ্ববিদ্যালয়ের অফিসিয়াল এআই সহকারী। আমি শুধুমাত্র বরেন্দ্র বিশ্ববিদ্যালয় সম্পর্কিত তথ্য (যেমনঃ বিভিন্ন বিভাগের ভর্তি যোগ্যতা, মোট টিউশন ফি, ওয়েভার ও স্কলারশিপ নীতিমালা, স্থায়ী ক্যাম্পাস, যাতায়াত ব্যবস্থা ও সুযোগ-সুবিধা) প্রদানের জন্য তৈরি।\n\nআপনার প্রশ্নটি বরেন্দ্র বিশ্ববিদ্যালয় সম্পর্কিত না হওয়ায় উত্তর প্রদান করা সম্ভব নয়। অনুগ্রহ করে বরেন্দ্র বিশ্ববিদ্যালয় সম্পর্কিত যেকোনো প্রশ্ন জিজ্ঞাসা করুন।`
      : `I am the official Varendra University Knowledge AI Assistant. I am specialized strictly to provide information regarding Varendra University (including undergraduate & graduate admissions, tuition fee structures, merit waivers, departmental programs, permanent campus location, and bus transit facilities).\n\nYour question does not appear to be related to Varendra University. Please ask an inquiry pertaining to Varendra University (e.g. "What is the tuition fee for B.Sc. in CSE?", "What are the scholarship criteria for GPA 5.00?", or "Where is the permanent campus located?").`,
  };
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

  // 1. Domain Guardrail & Greeting Classification
  const domainCheck = checkUniversityDomain(question);

  if (domainCheck.isGreeting) {
    return NextResponse.json({
      answer: domainCheck.refusalMessage,
      sources: [],
      isGreeting: true,
      mode: "university-assistant",
    });
  }

  if (!domainCheck.isValid) {
    return NextResponse.json({
      answer: domainCheck.refusalMessage,
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

  const isBangla = /[\u0980-\u09FF]/.test(question);
  return NextResponse.json({
    answer: isBangla
      ? `বরেন্দ্র বিশ্ববিদ্যালয়ের নলেজবেসে এই প্রশ্নের সরাসরি কোনো রেকর্ড খুঁজে পাওয়া যায়নি। অনুগ্রহ করে প্রশ্নটি অন্যভাবে লিখুন অথবা ভর্তির অফিসিয়াল পোর্টালে (admission.vu.edu.bd) যোগাযোগ করুন।`
      : `No direct matching record found in Varendra University documentation for this specific query. Please try rephrasing, or visit the official admissions portal at admission.vu.edu.bd.`,
    sources: [],
    noMatch: true,
  });
}
