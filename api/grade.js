// api/grade.js — Vercel Edge Function
// الإجابات الصحيحة محفوظة في env variable على الخادم فقط
// المتصفح لا يرى هذا الملف أبداً

export const config = { runtime: "edge" };

// دالة مطابقة مرنة (نفس fuzzyMatch في الـ frontend)
function fuzzyMatch(userAns, correct) {
  const norm = s => s.trim().toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[''`]/g, "'")
    .replace(/[""]/, '"');
  const u = norm(userAns);
  const c = norm(correct);
  if (u === c) return true;
  if (u.replace(/\s/g, "") === c.replace(/\s/g, "")) return true;
  if (u.replace(/[()[\]{}]/g, "") === c.replace(/[()[\]]/g, "")) return true;
  return false;
}

export default async function handler(req) {
  // CORS headers
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers,
    });
  }

  try {
    const { examId, answers } = await req.json();

    // ── تحميل الإجابات من env variable (سرية على الخادم) ──
    // الصيغة في .env.local:
    // EXAM_ANSWERS={"m1_q1_b1":"CREATE TABLE","m1_q1_b2":"UNIQUE",...}
    const answersMap = JSON.parse(process.env.EXAM_ANSWERS || "{}");

    // ── التصحيح ──
    let scored = 0, total = 0;
    const details = {};

    for (const [blankId, userAns] of Object.entries(answers || {})) {
      const correctAns = answersMap[blankId];
      if (correctAns === undefined) continue; // blank غير معروف
      const marks = 0.5; // كل فراغ = 0.5 درجة (عدّل حسب الحاجة)
      total += marks;
      const correct = fuzzyMatch(String(userAns), String(correctAns));
      if (correct) scored += marks;
      details[blankId] = { correct, marks };
    }

    // ── الاستجابة: درجة فقط — بدون إجابات صحيحة ──
    return new Response(
      JSON.stringify({
        scored: Math.round(scored * 100) / 100,
        total: Math.round(total * 100) / 100,
        details, // { blankId: { correct: true/false, marks: 0.5 } }
      }),
      { status: 200, headers }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Grading failed", message: err.message }),
      { status: 500, headers }
    );
  }
}
