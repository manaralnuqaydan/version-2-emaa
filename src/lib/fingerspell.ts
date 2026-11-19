import * as THREE from "three";

// شكل اليد لكل حرف: 21 نقطة (MediaPipe world landmarks) من صور حقيقية، طالعة من model/training/handshapes.py
export type Handshapes = Record<string, { landmarks: number[][] }>;

const FINGERS: [string, number[]][] = [
  ["Thumb", [1, 2, 3, 4]],
  ["Index", [5, 6, 7, 8]],
  ["Middle", [9, 10, 11, 12]],
  ["Ring", [13, 14, 15, 16]],
  ["Pinky", [17, 18, 19, 20]],
];

// مكان اليد أثناء التهجئة نسبةً لطول الذراع: قدام الصدر جهة اليمين
const HAND_TARGET = { inward: 0.12, down: 0.42, forward: 0.55 };

export const LETTER_MS = 600;

const v = (p: number[]) => new THREE.Vector3(-p[0], -p[1], -p[2]);

// إطار الكف: عرض الكف (من الخنصر للسبابة)، اتجاه الأصابع، والعمودي على الكف
function frame(
  wrist: THREE.Vector3,
  index: THREE.Vector3,
  middle: THREE.Vector3,
  pinky: THREE.Vector3,
) {
  const up = middle.clone().sub(wrist).normalize();
  const across = index.clone().sub(pinky);
  across.sub(up.clone().multiplyScalar(across.dot(up))).normalize();
  const normal = new THREE.Vector3().crossVectors(across, up);
  return new THREE.Matrix4().makeBasis(across, up, normal);
}

const worldPos = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());

function setWorldQuaternion(bone: THREE.Object3D, q: THREE.Quaternion) {
  const parent = bone.parent!.getWorldQuaternion(new THREE.Quaternion());
  bone.quaternion.copy(parent.invert().multiply(q));
  bone.updateMatrixWorld(true);
}

type Side = "Right" | "Left";

// IK بسيط لعظمتين: يحرك الكتف والكوع عشان الرسغ يوصل للنقطة المطلوبة، والكوع جهة الأسفل والخارج.
// بدون target: مكان التهجئة الثابت قدام الصدر
function reachArm(avatar: THREE.Object3D, side: Side = "Right", target?: THREE.Vector3) {
  const upper = avatar.getObjectByName(`${side}Arm`)!;
  const fore = avatar.getObjectByName(`${side}ForeArm`)!;
  const hand = avatar.getObjectByName(`${side}Hand`)!;
  const S = worldPos(upper),
    E = worldPos(fore),
    W = worldPos(hand);
  const a = S.distanceTo(E),
    b = E.distanceTo(W),
    L = a + b;
  const outward = Math.sign(S.x - worldPos(avatar.getObjectByName("Spine2")!).x) || -1;
  const T =
    target ??
    S.clone().add(
      new THREE.Vector3(
        -outward * HAND_TARGET.inward * L,
        -HAND_TARGET.down * L,
        HAND_TARGET.forward * L,
      ),
    );
  const pole = S.clone().add(new THREE.Vector3(outward * 0.4 * L, -L, -0.1 * L));

  const toT = T.clone().sub(S);
  const d = Math.min(toT.length(), L * 0.999);
  const angle = Math.acos(THREE.MathUtils.clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
  const n = new THREE.Vector3().crossVectors(toT, pole.clone().sub(S)).normalize();
  const dirE = toT.clone().normalize().applyAxisAngle(n, angle);
  const elbow = S.clone().add(dirE.clone().multiplyScalar(a));

  let turn = new THREE.Quaternion().setFromUnitVectors(E.clone().sub(S).normalize(), dirE);
  setWorldQuaternion(upper, turn.multiply(upper.getWorldQuaternion(new THREE.Quaternion())));
  const now = worldPos(hand).sub(worldPos(fore)).normalize();
  const wrist = S.clone().add(toT.clone().normalize().multiplyScalar(d));
  turn = new THREE.Quaternion().setFromUnitVectors(now, wrist.sub(elbow).normalize());
  setWorldQuaternion(fore, turn.multiply(fore.getWorldQuaternion(new THREE.Quaternion())));
}

const sideBones = (side: Side) => [
  `${side}Arm`,
  `${side}ForeArm`,
  `${side}Hand`,
  ...FINGERS.flatMap(([f]) => [1, 2, 3].map((i) => `${side}Hand${f}${i}`)),
];

// يلف الرسغ والأصابع عشان يطابق شكل اليد (21 نقطة بإحداثيات العالم)
function poseHand(avatar: THREE.Object3D, side: Side, lm: THREE.Vector3[]) {
  const bone = (name: string) => avatar.getObjectByName(name)!;
  // 1) دوران الرسغ: نطابق إطار كف الأفاتار مع إطار الكف في الصورة
  const hand = bone(`${side}Hand`);
  const target = frame(lm[0], lm[5], lm[9], lm[17]);
  const current = frame(
    worldPos(hand),
    worldPos(bone(`${side}HandIndex1`)),
    worldPos(bone(`${side}HandMiddle1`)),
    worldPos(bone(`${side}HandPinky1`)),
  );
  const delta = new THREE.Quaternion().setFromRotationMatrix(target.multiply(current.invert()));
  setWorldQuaternion(hand, delta.multiply(hand.getWorldQuaternion(new THREE.Quaternion())));

  // 2) كل عظمة إصبع تلف عشان اتجاهها يطابق اتجاه نفس العقلة في الصورة
  for (const [finger, ids] of FINGERS) {
    for (let i = 1; i <= 3; i++) {
      const b = bone(`${side}Hand${finger}${i}`);
      // الملف يكرر كل عظمة كابن لنفسها (نسخة لكل mesh)، فنتجاوز النسخ ونأخذ العقلة التالية
      const child = b.children.find((c) => (c as THREE.Bone).isBone && c.name !== b.name);
      if (!child) continue;
      const now = worldPos(child).sub(worldPos(b)).normalize();
      const want = lm[ids[i]]
        .clone()
        .sub(lm[ids[i - 1]])
        .normalize();
      const turn = new THREE.Quaternion().setFromUnitVectors(now, want);
      setWorldQuaternion(b, turn.multiply(b.getWorldQuaternion(new THREE.Quaternion())));
    }
  }
}

/** يحسب وضعية الذراع واليد والأصابع لحرف واحد ويرجعها كـ quaternions محلية لكل عظمة */
export function solveLetter(
  avatar: THREE.Object3D,
  landmarks: number[][],
  bind: Map<string, THREE.Quaternion>,
) {
  const names = sideBones("Right");
  names.forEach((n) => avatar.getObjectByName(n)!.quaternion.copy(bind.get(n)!));
  avatar.updateMatrixWorld(true);
  reachArm(avatar);
  poseHand(avatar, "Right", landmarks.map(v));
  return new Map(names.map((n) => [n, avatar.getObjectByName(n)!.quaternion.clone()]));
}

// حركة كلمة ASL من فيديو حقيقي: لكل لقطة مكان الرسغ (نسبة للكتفين) وشكل اليد، لليدين
type HandTrack = { wrist: number[][]; hand: number[][][] } | null;
export type WordMotion = { right: HandTrack; left: HandTrack };
export type WordMotions = Record<string, WordMotion>;

/** يحوّل كل لقطة من حركة الكلمة إلى وضعية للأفاتار (الذراعين واليدين) */
export function solveWordMotion(
  avatar: THREE.Object3D,
  motion: WordMotion,
  bind: Map<string, THREE.Quaternion>,
) {
  const bone = (name: string) => avatar.getObjectByName(name)!;
  const sides: [Side, HandTrack][] = [
    ["Right", motion.right],
    ["Left", motion.left],
  ];
  const names = sides.flatMap(([side, track]) => (track ? sideBones(side) : []));
  names.forEach((n) => bone(n).quaternion.copy(bind.get(n)!));
  avatar.updateMatrixWorld(true);
  const rs = worldPos(bone("RightArm")),
    ls = worldPos(bone("LeftArm"));
  const center = rs.clone().add(ls).multiplyScalar(0.5);
  const width = rs.distanceTo(ls);
  // الفيديو غير معكوس: يمين الشخص على يسار الصورة، وكذا الأفاتار من جهة المشاهد
  const mx = Math.sign(ls.x - rs.x) || 1;
  const toWorld = (p: number[]) => new THREE.Vector3(mx * p[0], -p[1], -p[2]);
  const frames = (motion.right ?? motion.left)!.wrist.length;
  const poses: Pose[] = [];
  for (let f = 0; f < frames; f++) {
    names.forEach((n) => bone(n).quaternion.copy(bind.get(n)!));
    avatar.updateMatrixWorld(true);
    for (const [side, track] of sides) {
      if (!track) continue;
      const w = track.wrist[f];
      // العمق من الفيديو تقريبي، فنخلي اليد دائمًا قدام الجسم
      const forward = THREE.MathUtils.clamp(0.8 - w[2] * 0.5, 0.5, 1.3);
      const target = center
        .clone()
        .add(new THREE.Vector3(mx * w[0] * width, -w[1] * width, forward * width));
      reachArm(avatar, side, target);
      poseHand(avatar, side, track.hand[f].map(toWorld));
    }
    poses.push(new Map(names.map((n) => [n, bone(n).quaternion.clone()])));
  }
  return poses;
}

type Pose = Map<string, THREE.Quaternion>;

export type SpellToken = { ch: string; ok: boolean };

/** يقسم النص لحروف: عربي ArASL (ال و لا حرف واحد) أو إنجليزي ASL.
 * الحرف اللي ما عندنا له شكل يد يرجع ok=false (نعرضه نص بدل ما نخترع إشارة) */
export function splitLetters(text: string, shapes: Handshapes): SpellToken[] {
  const out: SpellToken[] = [];
  const chars = Array.from(
    text
      .replace(/[أإآ]/g, "ا")
      .replace(/ؤ/g, "و")
      .replace(/ئ/g, "ي")
      .replace(/[\u064B-\u0652\u0640]/g, "") // تشكيل وتطويل
      .replace(/\s+/g, " ")
      .trim(),
  );
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    const pair = c + (chars[i + 1] ?? "");
    if (shapes[pair]) {
      out.push({ ch: pair, ok: true });
      i++;
    } else if (shapes[c]) out.push({ ch: c, ok: true });
    else if (shapes[c.toUpperCase()]) out.push({ ch: c.toUpperCase(), ok: true });
    else if (c === " ") out.push({ ch: " ", ok: true });
    else if (/[\p{L}\p{N}]/u.test(c)) out.push({ ch: c, ok: false });
    // علامات الترقيم نتجاهلها
  }
  return out;
}

/** يقسم النص الإنجليزي لكلمات، ويجمع العبارات اللي لها إشارة وحدة (thank you، don't know) */
export function splitAslWords(text: string, known: Record<string, unknown>): string[] {
  const words = text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^\p{L}\p{N}'\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const pair = `${words[i]} ${words[i + 1] ?? ""}`;
    if (known[pair]) {
      out.push(pair);
      i++;
    } else out.push(words[i]);
  }
  return out;
}

export type QuestionType = "wh" | "yesno" | null;

const WH = [
  "what",
  "where",
  "when",
  "who",
  "whom",
  "why",
  "how",
  "which",
  "ماذا",
  "ما",
  "متى",
  "أين",
  "اين",
  "وين",
  "من",
  "لماذا",
  "ليش",
  "ليه",
  "كيف",
  "كم",
  "أي",
  "اي",
  "وش",
  "ايش",
  "إيش",
  "شو",
];

/** نوع السؤال من النص: سؤال بأداة استفهام (wh) أو سؤال نعم/لا. يعتمد على علامة الاستفهام */
export function questionType(text: string): QuestionType {
  const t = text.trim();
  if (!/[?؟]$/.test(t)) return null;
  const words = t
    .toLowerCase()
    .replace(/[?؟.,،!]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  // "هل" تبدأ سؤال نعم/لا حتى لو فيه "من" بمعنى (from)
  if (words[0] === "هل") return "yesno";
  return words.some((w) => WH.includes(w)) ? "wh" : "yesno";
}
