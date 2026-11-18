import type { SignLang } from "@/lib/i18n";

// يخلي الأفاتار يتهجى النص بأشكال اليد المأخوذة من داتاسيت لغة الإشارة المختارة
export function spellOnAvatar(text: string, signLang: SignLang) {
  if (!text.trim()) return;
  window.dispatchEvent(new CustomEvent("spellText", { detail: { text, signLang } }));
}

// تحكم بالتهجئة الحالية (إعادة، سرعة...)
export function controlSpelling(
  detail:
    | { cmd: "replay" }
    | { cmd: "speed"; value: number }
    | { cmd: "pause" }
    | { cmd: "resume" },
) {
  window.dispatchEvent(new CustomEvent("spellControl", { detail }));
}

// كلمات تدل إن المستخدم متعثر (مطابقة كلمات بسيطة، مو ذكاء اصطناعي)
export const STRUGGLE_WORDS = [
  "لا اعرف",
  "لا أعرف",
  "ما اعرف",
  "ما أعرف",
  "مدري",
  "خطأ",
  "غلط",
  "مشكلة",
  "مشكله",
  "ما فهمت",
  "مافهمت",
  "صعب",
  "مو واضح",
  "غير واضح",
  "عيد",
  "don't know",
  "dont know",
  "problem",
  "error",
  "confused",
  "don't understand",
  "dont understand",
  "again",
  "repeat",
];

export const hasStruggleWord = (text: string) => {
  const lower = text.toLowerCase();
  return STRUGGLE_WORDS.some((w) => lower.includes(w));
};

// النص مكتوب بحروف لغة غير لغة الإشارة المختارة (عربي مع ASL أو العكس)؟
export function wrongScript(text: string, signLang: SignLang): SignLang | null {
  const ar = (text.match(/[؀-ۿ]/g) ?? []).length;
  const en = (text.match(/[A-Za-z]/g) ?? []).length;
  if (signLang === "asl" && ar > en) return "arsl";
  if (signLang === "arsl" && en > ar) return "asl";
  return null;
}
