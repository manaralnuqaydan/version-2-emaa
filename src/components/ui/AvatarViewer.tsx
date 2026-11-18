import type { SignLang } from "@/lib/i18n";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useFBX } from "@react-three/drei";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  LETTER_MS,
  questionType,
  solveLetter,
  splitLetters,
  type Handshapes,
  type QuestionType,
  type SpellToken,
} from "@/lib/fingerspell";

type Pose = Map<string, THREE.Quaternion>;

// أول 40% من وقت كل حرف انتقال ناعم من الوضعية السابقة، والباقي ثبات عشان الحرف يتقرأ
const TRANSITION = 0.4;
const smooth = (x: number) => {
  const u = THREE.MathUtils.clamp(x, 0, 1);
  return u * u * (3 - 2 * u);
};

// يمزج وضعيتين (نفس العظام) بنسبة t
function mixPose(a: Pose, b: Pose, t: number): Pose {
  const out: Pose = new Map();
  b.forEach((q, n) => out.set(n, (a.get(n) ?? q).clone().slerp(q, t)));
  return out;
}

// تعابير الوجه للسؤال (non-manual markers): سؤال بأداة استفهام = حواجب منخفضة،
// سؤال نعم/لا = حواجب مرفوعة. هذا موثّق في ASL، وفي لغة الإشارة السعودية يحتاج مراجعة من أصم
const BROWS: Record<Exclude<QuestionType, null>, Record<string, number>> = {
  wh: { browDownLeft: 0.6, browDownRight: 0.6 },
  yesno: { browInnerUp: 0.7, browOuterUpLeft: 0.55, browOuterUpRight: 0.55 },
};
const BROW_KEYS = [
  "browDownLeft",
  "browDownRight",
  "browInnerUp",
  "browOuterUpLeft",
  "browOuterUpRight",
];

export const SPEEDS = [0.5, 0.75, 1] as const;
export type SpellState = {
  status: "playing" | "paused" | "idle";
  speed: number;
  tokens: SpellToken[];
  index: number;
  question: QuestionType;
};
export type SpellControl =
  | { cmd: "pause" }
  | { cmd: "resume" }
  | { cmd: "replay" }
  | { cmd: "speed"; value: number };

const blockedLegTracks = [
  "leftupleg",
  "rightupleg",
  "leftleg",
  "rightleg",
  "leftfoot",
  "rightfoot",
  "lefttoebase",
  "righttoebase",
  "lefttoe",
  "righttoe",
];

function isLegTrack(trackName: string) {
  const name = trackName.toLowerCase();
  return blockedLegTracks.some((word) => name.includes(word));
}

// وضعية وقوف طبيعية (الذراعان للأسفل) بدل وضعية T
function applyRestPose(avatar: THREE.Object3D) {
  const pose: [string, number, number, number][] = [
    ["LeftArm", 1.45, 0, 0.15],
    ["RightArm", 1.45, 0, -0.15],
    ["LeftForeArm", 0.25, 0, 0],
    ["RightForeArm", 0.25, 0, 0],
  ];
  pose.forEach(([name, x, y, z]) => {
    const bone = avatar.getObjectByName(name);
    if (bone) {
      bone.rotation.x += x;
      bone.rotation.y += y;
      bone.rotation.z += z;
    }
  });
  // أصابع مرتخية بشكل طبيعي وقت الوقوف بدل ما تكون مفرودة ومتباعدة
  const CURL = [0.15, 0.25, 0.2];
  for (const side of ["Left", "Right"]) {
    for (const finger of ["Index", "Middle", "Ring", "Pinky"]) {
      CURL.forEach((c, j) => {
        const bone = avatar.getObjectByName(`${side}Hand${finger}${j + 1}`);
        if (bone) bone.rotation.x -= c + (finger === "Pinky" ? 0.05 : 0);
      });
    }
  }
}

// خامات أوضح: الملف يجي بخامات Phong قديمة، فنحولها لخامات PBR بنفس الصور
// (الثوب والشماغ مطفيين، البشرة ناعمة، العيون لامعة) مع فلترة أعلى للصور
const ROUGHNESS: [RegExp, number][] = [
  [/look/i, 0.86],
  [/shoes/i, 0.5],
  [/^Eyes/i, 0.12],
  [/Teeth/i, 0.35],
  [/Eyelash|EyeAO/i, 0.9],
  [/Body|Head/i, 0.62],
];
function upgradeMaterial(
  m: THREE.MeshPhongMaterial,
  anisotropy: number,
): THREE.MeshStandardMaterial {
  const roughness = ROUGHNESS.find(([re]) => re.test(m.name))?.[1] ?? 0.7;
  if (m.map) {
    m.map.colorSpace = THREE.SRGBColorSpace;
    m.map.anisotropy = anisotropy;
  }
  if (m.normalMap) m.normalMap.anisotropy = anisotropy;
  const std = new THREE.MeshStandardMaterial({
    name: m.name,
    map: m.map,
    normalMap: m.normalMap,
    alphaMap: m.alphaMap,
    transparent: m.transparent,
    opacity: m.opacity,
    side: m.side,
    roughness,
    metalness: 0,
  });
  // الثوب الأبيض يحترق تحت الإضاءة القوية، فنخفف لونه شوي عشان تبان الطيات
  if (/look/i.test(m.name)) std.color.setScalar(0.86);
  if (/Eyelash/i.test(m.name)) std.alphaTest = 0.25;
  if (/EyeAO/i.test(m.name)) std.depthWrite = false;
  return std;
}

function AvatarModel({ action: currentAction }: { action?: string }) {
  const avatar = useFBX("/avatar.fbx");
  const gl = useThree((st) => st.gl);
  const mixer = useRef<THREE.AnimationMixer | null>(null);
  const action = useRef<THREE.AnimationAction | null>(null);
  const pendingPlay = useRef(false);
  const restPose = useRef<Map<string, THREE.Quaternion>>(new Map());
  const faces = useRef<THREE.Mesh[]>([]);
  // كل لغة إشارة لها أشكال يد منفصلة، وما نخلطهم أبدًا
  const shapes = useRef<Record<SignLang, Handshapes>>({ arsl: {}, asl: {} });
  // تهجئة: وضعية لكل حرف + ساعة خاصة (تتوقف مع الإيقاف وتتأثر بالسرعة)
  const spelling = useRef<{
    from: Pose[];
    to: Pose[];
    dip: boolean[]; // حرف مكرر: اليد ترتخي شوي بينهم عشان يبان أنه حرفين
    tokens: SpellToken[];
    clock: number;
    shown: number;
    question: QuestionType;
  } | null>(null);
  const lastRequest = useRef<SpellRequest | null>(null);
  const paused = useRef(false);
  const speed = useRef(1);
  const brows = useRef<Record<string, number>>({});

  const emitState = () => {
    const sp = spelling.current;
    window.dispatchEvent(
      new CustomEvent<SpellState>("spellState", {
        detail: {
          status: sp ? (paused.current ? "paused" : "playing") : "idle",
          speed: speed.current,
          tokens: sp?.tokens ?? [],
          index: sp?.shown ?? -1,
          question: sp?.question ?? null,
        },
      }),
    );
  };

  const play = () => {
    if (action.current) {
      action.current.reset();
      action.current.play();
    } else {
      pendingPlay.current = true;
    }
  };

  useEffect(() => {
    if (!avatar) return;
    avatar.traverse((object: THREE.Object3D) => {
      object.frustumCulled = false;
      if ((object as THREE.Mesh).isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
        // خريطة الشفافية في الملف تجعل الوجه شفافًا فيظهر الشماغ من خلفه، فنلغيها
        const material = (object as THREE.Mesh).material as THREE.MeshPhongMaterial;
        if (object.name === "Head_Mesh" && material.alphaMap) {
          material.alphaMap = null;
          material.transparent = false;
          material.depthWrite = true;
          material.needsUpdate = true;
        }
      }
    });
    if (!avatar.userData.materialsUpgraded) {
      const aniso = gl.capabilities.getMaxAnisotropy();
      avatar.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh && (mesh.material as THREE.Material).type === "MeshPhongMaterial")
          mesh.material = upgradeMaterial(mesh.material as THREE.MeshPhongMaterial, aniso);
      });
      avatar.userData.materialsUpgraded = true;
    }
    if (!avatar.userData.restPoseApplied) {
      applyRestPose(avatar);
      avatar.userData.restPoseApplied = true;
    }
    faces.current = [];
    avatar.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.morphTargetDictionary && mesh.morphTargetInfluences) faces.current.push(mesh);
    });
    avatar.traverse((o) => {
      // الملف فيه نسخ مكررة بنفس الاسم، ونعتمد أول نسخة (نفس اللي يرجعها getObjectByName)
      if ((o as THREE.Bone).isBone && o.name.startsWith("Right") && !restPose.current.has(o.name))
        restPose.current.set(o.name, o.quaternion.clone());
    });

    if (avatar.animations && avatar.animations.length > 0) {
      mixer.current = new THREE.AnimationMixer(avatar);
      const clip = avatar.animations[0].clone();
      clip.tracks = clip.tracks.filter((track) => !isLegTrack(track.name));
      action.current = mixer.current.clipAction(clip);
      action.current.setLoop(THREE.LoopOnce, 1);
      // بعد انتهاء الإشارة يرجع الأفاتار لوضعية الوقوف
      mixer.current.addEventListener("finished", () => action.current?.stop());

      if (pendingPlay.current) {
        pendingPlay.current = false;
        play();
      }
    }

    return () => {
      if (mixer.current) {
        mixer.current.stopAllAction();
        mixer.current = null;
      }
      action.current = null;
    };
  }, [avatar]);

  useEffect(() => {
    window.addEventListener("playAvatar", play);
    return () => window.removeEventListener("playAvatar", play);
  }, []);

  useEffect(() => {
    // أشكال اليد العربية (ArASL) والإنجليزية (ASL) إذا موجودة
    const files: [SignLang, string][] = [
      ["arsl", "handshapes_ar"],
      ["asl", "handshapes_en"],
    ];
    // طلب تهجئة وصل قبل ما تنحمل أشكال اليد: نأجله لين تخلص بدل ما نعرضه كنص فقط
    const loading = files.map(([lang, file]) =>
      fetch(`/data/${file}.json`)
        .then((res) => (res.ok ? res.json() : {}))
        .then((data: Handshapes) => (shapes.current[lang] = data))
        .catch(() => {}),
    );
    const ready = Promise.all(loading);
    let loaded = false;
    ready.then(() => (loaded = true));

    // يتهجى النص حرفًا حرفًا بأشكال يد مأخوذة من صور حقيقية
    const start = (req: SpellRequest) => {
      const langShapes = shapes.current[req.signLang];
      const tokens = splitLetters(req.text ?? "", langShapes);
      if (!tokens.length) return;
      lastRequest.current = req;
      action.current?.stop();
      const names = [...restPose.current.keys()];
      const bone = (n: string) => avatar.getObjectByName(n)!;
      const current: Pose = new Map(names.map((n) => [n, bone(n).quaternion.clone()]));
      const sway = avatar.rotation.y;
      avatar.rotation.y = 0;
      const rest = restPose.current;
      const to: Pose[] = [];
      let last: Pose = rest;
      for (const tk of tokens) {
        if (tk.ch === " ")
          to.push(mixPose(last, rest, 0.4)); // مسافة بين كلمتين: اليد ترتخي
        else if (!tk.ok)
          to.push(mixPose(last, rest, 0.7)); // حرف بدون شكل يد: ما نخترع إشارة
        else {
          last = solveLetter(avatar, langShapes[tk.ch].landmarks, rest);
          to.push(last);
        }
      }
      current.forEach((q, n) => bone(n).quaternion.copy(q));
      avatar.rotation.y = sway;
      // يضمن نفس العظام في كل وضعية (العظام اللي ما تتحرك تبقى على وضعية الوقوف)
      const full = (p: Pose): Pose =>
        new Map([...rest].map(([n, q]) => [n, (p.get(n) ?? q).clone()]));
      const toFull = to.map(full);
      const from = [full(current), ...toFull.slice(0, -1)];
      spelling.current = {
        from,
        to: toFull,
        dip: tokens.map((tk, i) => i > 0 && tk.ok && tk.ch !== " " && tk.ch === tokens[i - 1].ch),
        tokens,
        clock: 0,
        shown: -1,
        question: req.question ?? questionType(req.text ?? ""),
      };
      paused.current = false;
      emitState();
    };
    const spell = (e: Event) => {
      const detail = (e as CustomEvent<string | SpellRequest>).detail;
      const req: SpellRequest =
        typeof detail === "string" ? { text: detail, signLang: "arsl" } : detail;
      if (loaded) start(req);
      else ready.then(() => start(req));
    };
    const control = (e: Event) => {
      const c = (e as CustomEvent<SpellControl>).detail;
      if (c.cmd === "pause" && spelling.current) paused.current = true;
      else if (c.cmd === "resume") paused.current = false;
      else if (c.cmd === "replay" && lastRequest.current) start(lastRequest.current);
      else if (c.cmd === "speed") speed.current = c.value;
      emitState();
    };
    window.addEventListener("spellText", spell);
    window.addEventListener("spellControl", control);
    return () => {
      window.removeEventListener("spellText", spell);
      window.removeEventListener("spellControl", control);
    };
  }, [avatar]);

  useEffect(() => {
    if (currentAction === "signing" || currentAction === "proactive_alert") play();
  }, [currentAction]);

  useFrame(({ clock }, delta) => {
    if (mixer.current) mixer.current.update(delta);
    const sp = spelling.current;
    if (sp) {
      if (!paused.current) sp.clock += delta * 1000 * speed.current;
      const n = sp.to.length;
      const i = Math.floor(sp.clock / LETTER_MS);
      const u = (sp.clock - i * LETTER_MS) / LETTER_MS; // 0..1 داخل الحرف
      let pose: Pose;
      if (i < n) {
        const k = smooth(u / TRANSITION);
        if (sp.dip[i]) {
          // حرف مكرر: نرتخي للنص ثم نرجع لنفس الشكل
          const dipPose = mixPose(sp.from[i], restPose.current, 0.3);
          pose =
            k < 0.5
              ? mixPose(sp.from[i], dipPose, smooth(k * 2))
              : mixPose(dipPose, sp.to[i], smooth(k * 2 - 1));
        } else pose = mixPose(sp.from[i], sp.to[i], k);
      } else {
        // بعد آخر حرف: رجوع ناعم لوضعية الوقوف
        const k = smooth((sp.clock - n * LETTER_MS) / (LETTER_MS * 0.8));
        pose = mixPose(sp.to[n - 1], restPose.current, k);
        if (k >= 1) spelling.current = null;
      }
      pose.forEach((q, name) => avatar.getObjectByName(name)!.quaternion.copy(q));
      const shown = Math.min(i, n);
      if (shown !== sp.shown) {
        // الشاشة تعرض الحرف اللي يأشّره الأفاتار الحين
        sp.shown = shown;
        window.dispatchEvent(
          new CustomEvent("spellProgress", {
            detail: {
              letters: sp.tokens.map((tk) => tk.ch),
              supported: sp.tokens.map((tk) => tk.ok),
              index: shown,
            },
          }),
        );
        emitState();
      }
      if (!spelling.current) emitState();
    }
    // تعابير السؤال تظهر أثناء التهجئة فقط
    const want: Record<string, number> = spelling.current?.question
      ? BROWS[spelling.current.question]
      : {};
    for (const k of BROW_KEYS) {
      const cur = brows.current[k] ?? 0;
      brows.current[k] = cur + ((want[k] ?? 0) - cur) * Math.min(1, delta * 6);
    }
    // حركة تنفّس خفيفة وهو واقف عشان ما يبان جامد
    const t = clock.elapsedTime;
    avatar.rotation.y = Math.sin(t * 0.6) * 0.05;

    // الوجه: رمش طبيعي، ابتسامة خفيفة، وحركة الفم مع الصوت
    const blinkPhase = t % 4.2;
    const blink = blinkPhase < 0.15 ? Math.sin((blinkPhase / 0.15) * Math.PI) : 0;
    const talking = typeof window !== "undefined" && window.speechSynthesis?.speaking;
    const mouth = talking ? 0.18 + 0.22 * Math.abs(Math.sin(t * 11) * Math.sin(t * 4.3)) : 0;
    const face: Record<string, number> = {
      eyeBlinkLeft: blink,
      eyeBlinkRight: blink,
      mouthSmile: 0.18,
      jawOpen: mouth,
      viseme_aa: mouth * 0.8,
      viseme_O: talking ? 0.25 * Math.abs(Math.sin(t * 6.1)) : 0,
      ...brows.current,
    };
    for (const mesh of faces.current) {
      for (const [name, value] of Object.entries(face)) {
        const i = mesh.morphTargetDictionary![name];
        if (i !== undefined) {
          const cur = mesh.morphTargetInfluences![i];
          mesh.morphTargetInfluences![i] = name.startsWith("eyeBlink")
            ? value
            : cur + (value - cur) * Math.min(1, delta * 18);
        }
      }
    }
  });

  return <primitive object={avatar} scale={0.017} position={[0, -2.0, 0]} />;
}

// لقطة نصف علوية تتكيف مع شكل الإطار (جوال طولي أو شاشة عريضة):
// الرأس واليد المتهجية دايمًا داخل الصورة، وأسفل الإطار فاضي لشريط الحروف
const FRAME = { top: 1.12, bottom: -0.3, width: 1.3, captionShare: 0.28 };
function Framing() {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const tan = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const aspect = size.width / Math.max(size.height, 1);
    const view = Math.max(
      (FRAME.top - FRAME.bottom) / (1 - FRAME.captionShare),
      FRAME.width / aspect,
    );
    const centerY = FRAME.top + 0.05 - view / 2;
    cam.position.set(0, centerY, view / 2 / tan);
    cam.lookAt(0, centerY, 0);
    cam.updateProjectionMatrix();
  }, [camera, size]);
  return null;
}

// إضاءة استوديو بدون إنترنت: انعكاسات ناعمة من غرفة افتراضية
function StudioEnvironment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.55;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

// لقطة قريبة لليد اليمنى أثناء التهجئة: نرسم المشهد مرة ثانية بكاميرا تتبع اليد
// في مربع صغير أعلى الإطار، عشان شكل الأصابع يبان بوضوح حتى على الجوال
const INSET = { share: 0.36, pad: 12, min: 96, max: 220 };
function insetSize(w: number, h: number) {
  return Math.round(THREE.MathUtils.clamp(Math.min(w, h) * INSET.share, INSET.min, INSET.max));
}
function HandCloseUp({ active }: { active: React.MutableRefObject<boolean> }) {
  const { gl, scene, camera, size } = useThree();
  const cam = useMemo(() => new THREE.PerspectiveCamera(30, 1, 0.01, 20), []);
  const target = useMemo(() => new THREE.Vector3(), []);
  const goal = useMemo(() => new THREE.Vector3(), []);
  const tip = useMemo(() => new THREE.Vector3(), []);
  const clear = useMemo(() => new THREE.Color("#140c28"), []);
  const prevClear = useMemo(() => new THREE.Color(), []);
  useFrame(() => {
    gl.autoClear = true;
    gl.setScissorTest(false);
    gl.setViewport(0, 0, size.width, size.height);
    gl.render(scene, camera);
    if (!active.current) return;
    // وسط اليد = منتصف المسافة بين الرسغ وطرف الإصبع الأوسط
    const wrist = scene.getObjectByName("RightHand");
    const end =
      scene.getObjectByName("RightHandMiddle3") ?? scene.getObjectByName("RightHandMiddle2");
    if (!wrist || !end) return;
    wrist.getWorldPosition(goal);
    end.getWorldPosition(tip);
    goal.lerp(tip, 0.8);
    goal.x -= 0.035; // الإبهام والأصابع تميل لجهة اليسار في الصورة
    target.lerp(goal, target.lengthSq() ? 0.25 : 1);
    cam.position.set(target.x, target.y + 0.02, target.z + 0.66);
    cam.lookAt(target);
    const w = insetSize(size.width, size.height);
    const x = INSET.pad;
    const y = size.height - w - INSET.pad;
    cam.aspect = 1;
    cam.updateProjectionMatrix();
    const prevAlpha = gl.getClearAlpha();
    gl.getClearColor(prevClear);
    gl.setScissorTest(true);
    gl.setScissor(x, y, w, w);
    gl.setViewport(x, y, w, w);
    gl.setClearColor(clear, 1);
    gl.clear(true, true);
    gl.autoClear = false;
    gl.render(scene, cam);
    gl.autoClear = true;
    gl.setScissorTest(false);
    gl.setClearColor(prevClear, prevAlpha);
  }, 1);
  return null;
}

export default function AvatarViewer({
  currentAction,
  closeUp = true,
}: {
  currentAction?: string;
  closeUp?: boolean;
}) {
  const { t } = useI18n();
  const wrap = useRef<HTMLDivElement>(null);
  const spelling = useRef(false);
  const [showInset, setShowInset] = useState(false);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const onState = (e: Event) => {
      const on = closeUp && (e as CustomEvent<SpellState>).detail.status !== "idle";
      spelling.current = on;
      setShowInset(on);
    };
    window.addEventListener("spellState", onState);
    return () => window.removeEventListener("spellState", onState);
  }, [closeUp]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setBox({ w: e.contentRect.width, h: e.contentRect.height }),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const inset = insetSize(box.w, box.h);
  return (
    <div ref={wrap} className="relative h-full w-full">
      <Canvas
        dpr={[1, 2]}
        shadows
        camera={{ position: [0, 0.3, 2.7], fov: 40 }}
        gl={{
          antialias: true,
          preserveDrawingBuffer: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.95,
        }}
      >
        <StudioEnvironment />
        <hemisphereLight args={["#f3eeff", "#2a1d4a", 0.35]} />
        {/* ضوء رئيسي دافي من الأمام مع ظلال ناعمة (اليد تبان فوق الصدر) */}
        <directionalLight
          position={[1.2, 2.6, 3]}
          intensity={1.6}
          color="#fff4e8"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0004}
          shadow-normalBias={0.02}
          shadow-camera-left={-1}
          shadow-camera-right={1}
          shadow-camera-top={2}
          shadow-camera-bottom={-0.5}
          shadow-camera-near={0.5}
          shadow-camera-far={8}
        />
        {/* إضاءة تعبئة باردة من الجهة الثانية */}
        <directionalLight position={[-2.4, 1.4, 2]} intensity={0.55} color="#dfe6ff" />
        {/* إضاءة حافة بنفسجية من الخلف تفصل الأفاتار عن الخلفية */}
        <directionalLight position={[-1.6, 2.4, -2.6]} intensity={1.6} color="#b794ff" />
        <directionalLight position={[1.8, 2, -2.4]} intensity={0.9} color="#8fb4ff" />
        <Framing />
        <Suspense fallback={null}>
          <AvatarModel action={currentAction} />
        </Suspense>
        {closeUp && <HandCloseUp active={spelling} />}
      </Canvas>
      {showInset && inset > 0 && (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-[3px] ring-1 ring-white/30 shadow-[0_8px_30px_rgba(0,0,0,0.45)]"
          style={{ left: INSET.pad, top: INSET.pad, width: inset, height: inset }}
        >
          <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/55 px-2 py-0.5 text-[9px] font-semibold text-white/85 backdrop-blur">
            {t("avatar.handView")}
          </span>
        </div>
      )}
    </div>
  );
}

// طلب تهجئة: النص ولغة الإشارة اللي يتهجى بها
// question: يدويًا، وإلا نستنتجه من علامة الاستفهام في النص
export type SpellRequest = {
  text: string;
  signLang: SignLang;
  question?: QuestionType;
};
