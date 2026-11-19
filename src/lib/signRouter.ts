// يقرر هل الإشارة حروف عربية ولا كلمة إنجليزية، ويعطي نصائح استباقية من صورة الكاميرا.
// كل موديل يعرف بس اللي تدرّب عليه: ArASL = 32 حرف عربي ثابت، ASL Citizen = 100 كلمة بحركة.

// كلمات ASL فيها حركة لليد؛ الحرف العربي يد ثابتة. المقياس: مدى حركة الرسغ (بين 5% و95% من اللقطات)
// نسبة لعرض الكتفين. على 1290 فيديو اختبار من ASL Citizen: 96% من الكلمات فوق 0.25،
// ويد ثابتة مع اهتزاز الكاميرا ما تتعدى 0.14 أبدًا.
export const ASL_WORD_MIN_MOTION = 0.25;
export const ASL_WORD_MIN_CONFIDENCE = 70;
// إذا انكتب حرف عربي أثناء الإشارة، نطلب حركة وثقة أعلى قبل ما نبدله بكلمة إنجليزية
export const ASL_WORD_STRONG_MOTION = 0.35;
export const ASL_WORD_STRONG_CONFIDENCE = 90;

export function isAslWord(confidence: number, motion: number, arabicLetters: number) {
  if (arabicLetters === 0)
    return motion >= ASL_WORD_MIN_MOTION && confidence >= ASL_WORD_MIN_CONFIDENCE;
  return motion >= ASL_WORD_STRONG_MOTION && confidence >= ASL_WORD_STRONG_CONFIDENCE;
}

export type Tip = "light" | "closer" | "center" | "showHand";

type Point = { x: number; y: number };

// نصيحة وحدة بالأولوية: الإضاءة، ثم مكان اليد، ثم حجمها، ثم إذا ما فيه يد من فترة
export function visionTip({
  hand,
  dark,
  msWithoutHand,
}: {
  hand?: Point[];
  dark: boolean;
  msWithoutHand: number;
}): Tip | null {
  if (dark) return "light";
  if (!hand) return msWithoutHand > 5000 ? "showHand" : null;
  const xs = hand.map((p) => p.x);
  const ys = hand.map((p) => p.y);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  if (minX < 0.02 || maxX > 0.98 || minY < 0.02 || maxY > 0.98) return "center";
  if (Math.max(maxX - minX, maxY - minY) < 0.12) return "closer";
  return null;
}
