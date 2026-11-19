import {
  Sparkles,
  RefreshCw,
  X,
  Camera,
  Pause,
  AlertCircle,
  Lightbulb,
  Delete,
  Space,
} from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import CameraConsent, { hasCameraConsent } from "@/components/ui/CameraConsent";
import { useI18n } from "@/lib/i18n";
import { AppShell } from "@/components/layout/AppShell";
import ProactiveAlert from "@/components/ui/ProactiveAlert";
import { ASL_WORD_MIN_MOTION, isAslWord, visionTip, type Tip } from "@/lib/signRouter";
import {
  ARASL_LETTERS,
  MIN_CONFIDENCE,
  PREDICT_INTERVAL_MS,
  SIGN_API_URL,
  STABLE_READS,
  WORD_GAP_MS,
  correctWord,
  suggestWords,
} from "@/lib/arasl";
import {
  MIN_SIGN_FRAMES,
  SIGN_END_MS,
  hasHands,
  holisticFrame,
  loadHolisticScript,
  resampleSequence,
  type HolisticResults,
} from "@/lib/aslWords";

type Landmark = { x: number; y: number };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tracker = any;

const proactiveKeywords = [
  "لا اعرف",
  "لا أعرف",
  "ما اعرف",
  "ما أعرف",
  "مدري",
  "خطأ",
  "غلط",
  "خطأ في",
  "مشكلة",
  "مشكله",
  "علق",
  "تعليق",
  "ما فهمت",
  "مافهمت",
  "صعب",
  "معقد",
  "مو واضح",
  "غير واضح",
  "عيد",
  "إعادة",
  "كيف",
  "طريقة",
  "ما رضي",
  "رفض",
  "فشل",
  "dont know",
  "problem",
  "error",
  "stuck",
  "confused",
  "hard",
  "help",
];

type ApiStatus = { asl_words?: boolean } | null;

export function CameraScreen() {
  const { t, signLang, setSignLang } = useI18n();
  const [signTranslation, setSignTranslation] = useState("");
  const [isDetecting, setIsDetecting] = useState(false);
  const [handVisible, setHandVisible] = useState(false);
  const [apiError, setApiError] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [isProactive, setIsProactive] = useState<boolean>(false);
  const [proactiveReason, setProactiveReason] = useState<string>("");
  const tRef = useRef(t);
  tRef.current = t;
  const [apiStatus, setApiStatus] = useState<ApiStatus>(null);
  // متتبع واحد (Holistic) للعربي والإنجليزي: اليد للحروف العربية، والحركة كاملة لكلمات ASL
  const holisticRef = useRef<Tracker>(null);
  const signFramesRef = useRef<number[][]>([]);
  const lastHandsAtRef = useRef(0);
  const [wordHint, setWordHint] = useState<string | null>(null);
  // وين بدأت الإشارة الحالية في النص، عشان لو طلعت كلمة إنجليزية نبدل الحروف اللي انكتبت أثناءها
  const segmentStartRef = useRef(0);
  const segmentLettersRef = useRef(0);
  // رصد استباقي من الصورة نفسها: قرّب يدك، الإضاءة، وسط الصورة
  const [tip, setTip] = useState<Tip | null>(null);
  const tipRef = useRef<{ key: Tip | null; since: number; shownAt: number }>({
    key: null,
    since: 0,
    shownAt: 0,
  });
  const darkRef = useRef(false);
  const lastLightCheck = useRef(0);
  const detectStartRef = useRef(0);
  const lightCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const retryCountRef = useRef<number>(0);
  const [askConsent, setAskConsent] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastPredictTime = useRef<number>(0);
  const isDetectingRef = useRef(false);
  const requestInFlight = useRef(false);
  const cropCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // الموديل يتعرف على حروف ArASL، فنجمعها هنا في كلمات
  const wordRef = useRef<string>("");
  const pendingLetterRef = useRef<string>("");
  const pendingCountRef = useRef(0);
  const committedLetterRef = useRef<string>("");

  // نسأل الخادم وش الموديلات المتاحة فعلًا (مثلًا: هل موديل ASL متدرب؟)
  useEffect(() => {
    fetch(`${SIGN_API_URL}/`)
      .then((res) => res.json())
      .then((data) => {
        setApiStatus(data.models ?? null);
      })
      .catch(() => setApiStatus(null));
  }, []);
  const aslWordsReady = !!apiStatus?.asl_words;
  const aslWordsReadyRef = useRef(aslWordsReady);
  aslWordsReadyRef.current = aslWordsReady;

  // نحمّل المتتبع مرة وحدة
  useEffect(() => {
    loadHolisticScript()
      .then(() => {
        const Holistic = (window as Tracker).Holistic;
        const h = new Holistic({
          locateFile: (file: string) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/holistic@0.5.1675471629/${file}`,
        });
        h.setOptions({
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        h.onResults((r: HolisticResults) => onHolisticResults(r));
        holisticRef.current = h;
      })
      .catch(() => setApiError(true));
    return () => {
      isDetectingRef.current = false;
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // الإضاءة: نصغّر الصورة ونحسب متوسط السطوع مرة كل ثانية
  const checkLight = (now: number) => {
    const video = videoRef.current;
    if (!video?.videoWidth || now - lastLightCheck.current < 1000) return;
    lastLightCheck.current = now;
    lightCanvasRef.current ??= Object.assign(document.createElement("canvas"), {
      width: 16,
      height: 12,
    });
    const ctx = lightCanvasRef.current.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, 16, 12);
    const px = ctx.getImageData(0, 0, 16, 12).data;
    let sum = 0;
    for (let i = 0; i < px.length; i += 4)
      sum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    darkRef.current = sum / (px.length / 4) < 55;
  };

  // نعرض النصيحة إذا استمرت الحالة لحظة، ونخليها ظاهرة شوي عشان ما ترمش
  const updateTip = (key: Tip | null, now: number) => {
    const s = tipRef.current;
    if (key !== s.key) {
      s.key = key;
      s.since = now;
    }
    if (key && now - s.since > 800) {
      if (tip !== key) setTip(key);
      s.shownAt = now;
    } else if (!key && now - s.shownAt > 2000) {
      setTip((cur) => (cur ? null : cur));
    }
  };

  // كل لقطة: الحروف العربية من شكل اليد (أثناء الإشارة)، وكلمات ASL من الحركة كاملة (بعد ما تنزل اليد)
  const onHolisticResults = (r: HolisticResults) => {
    if (!isDetectingRef.current) return;
    const now = Date.now();
    const hand = r.rightHandLandmarks ?? r.leftHandLandmarks;
    const visible = hasHands(r);
    setHandVisible(visible);
    checkLight(now);
    updateTip(
      visionTip({
        hand,
        dark: darkRef.current,
        msWithoutHand: now - Math.max(lastHandsAtRef.current, detectStartRef.current),
      }),
      now,
    );
    if (visible && hand) {
      if (!signFramesRef.current.length) {
        segmentStartRef.current = wordRef.current.length;
        segmentLettersRef.current = 0;
      }
      signFramesRef.current.push(holisticFrame(r));
      lastHandsAtRef.current = now;
      if (requestInFlight.current || now - lastPredictTime.current < PREDICT_INTERVAL_MS) return;
      lastPredictTime.current = now;
      const image = cropHand(hand);
      if (image) sendImageToAPI(image);
      return;
    }
    const frames = signFramesRef.current;
    if (!frames.length || now - lastHandsAtRef.current < SIGN_END_MS) return;
    signFramesRef.current = [];
    if (frames.length >= MIN_SIGN_FRAMES && aslWordsReadyRef.current)
      sendSequenceToAPI(resampleSequence(frames), segmentStartRef.current);
  };

  // بعد ما تخلص الإشارة: هل هي كلمة من كلمات ASL اللي تدرب عليها الموديل الإنجليزي؟
  // إذا نعم نبدل الحروف العربية اللي انكتبت أثناءها بالكلمة. وإذا لا تبقى الحروف العربية.
  const sendSequenceToAPI = async (frames: number[][], segmentStart: number) => {
    try {
      const res = await fetch(`${SIGN_API_URL}/predict-asl-word`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frames }),
      });
      const data: {
        prediction: string;
        confidence: number;
        motion?: number;
        top: { word: string }[];
      } = await res.json();
      setApiError(false);
      if (!data.prediction) return;
      const letters = segmentLettersRef.current;
      if (!isAslWord(data.confidence, data.motion ?? 0, letters)) {
        // ما هي كلمة إنجليزية ولا انكتب حرف عربي: نقترح أقرب الكلمات بدل ما نخمّن
        setWordHint(
          letters === 0 && (data.motion ?? 0) >= ASL_WORD_MIN_MOTION && data.confidence >= 35
            ? data.top.map((w) => w.word).join("، ")
            : null,
        );
        return;
      }
      setWordHint(null);
      setConfidence(data.confidence);
      setSignLang("asl");
      const before = wordRef.current.slice(0, segmentStart);
      const gap = before && !before.endsWith(" ") ? " " : "";
      setWord(before + gap + data.prediction + " ");
      committedLetterRef.current = "";
      pendingCountRef.current = 0;
    } catch (err) {
      setApiError(true);
      console.error("خطأ في الاتصال بالـ API:", err);
    }
  };

  const setWord = (text: string) => {
    wordRef.current = text;
    setSignTranslation(text);
  };

  const processFrame = useCallback(async () => {
    if (!isDetectingRef.current || !videoRef.current) return;
    if (holisticRef.current) await holisticRef.current.send({ image: videoRef.current });
    animFrameRef.current = requestAnimationFrame(processFrame);
  }, []);

  const startDetection = useCallback(async () => {
    setCameraError(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      isDetectingRef.current = true;
      detectStartRef.current = Date.now();
      lastHandsAtRef.current = 0;
      setIsDetecting(true);
      animFrameRef.current = requestAnimationFrame(processFrame);
    } catch (err) {
      console.error("خطأ في الكاميرا:", err);
      setCameraError(true);
    }
  }, [processFrame]);

  const stopDetection = useCallback(() => {
    isDetectingRef.current = false;
    setIsDetecting(false);
    setHandVisible(false);
    setTip(null);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
  }, []);

  // يقص مربعًا حول اليد بحجم صور ArASL (64×64) ويرجعه كصورة JPEG
  const cropHand = (landmarks: Landmark[]) => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    const xs = landmarks.map((lm) => lm.x * video.videoWidth);
    const ys = landmarks.map((lm) => lm.y * video.videoHeight);
    const minX = Math.min(...xs),
      maxX = Math.max(...xs);
    const minY = Math.min(...ys),
      maxY = Math.max(...ys);
    const size = Math.max(maxX - minX, maxY - minY) * 1.8; // أفضل هامش في اختبار صور ArASL
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2 + size * 0.1; // صور ArASL تظهر جزءًا من المعصم
    if (!cropCanvasRef.current) {
      cropCanvasRef.current = document.createElement("canvas");
      cropCanvasRef.current.width = 64;
      cropCanvasRef.current.height = 64;
    }
    const ctx = cropCanvasRef.current.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, 64, 64);
    ctx.drawImage(video, cx - size / 2, cy - size / 2, size, size, 0, 0, 64, 64);
    return cropCanvasRef.current.toDataURL("image/jpeg", 0.9);
  };

  const sendImageToAPI = async (image: string) => {
    requestInFlight.current = true;
    try {
      const res = await fetch(`${SIGN_API_URL}/predict-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });
      const data = await res.json();
      setApiError(false);
      if (!ARASL_LETTERS.includes(data.prediction)) return;
      handlePrediction(data.prediction, data.confidence ?? 0);
    } catch (err) {
      setApiError(true);
      console.error("خطأ في الاتصال بالـ API:", err);
    } finally {
      requestInFlight.current = false;
    }
  };

  const handlePrediction = (letter: string, conf: number) => {
    setConfidence(conf);

    // فلتر التردد: تكرار الثقة المنخفضة يفعّل الإرشاد الاستباقي
    if (conf < MIN_CONFIDENCE) {
      pendingCountRef.current = 0;
      retryCountRef.current += 1;
      if (retryCountRef.current >= 8) triggerProactiveMode(tRef.current("alert.lowConfidence"));
      return;
    }

    // نضيف الحرف بعد تكراره في قراءات متتالية، ولا نكرره حتى يتغير أو تختفي اليد
    pendingCountRef.current = letter === pendingLetterRef.current ? pendingCountRef.current + 1 : 1;
    pendingLetterRef.current = letter;
    if (pendingCountRef.current < STABLE_READS || letter === committedLetterRef.current) return;

    committedLetterRef.current = letter;
    retryCountRef.current = 0;
    segmentLettersRef.current += 1;
    if (signLang !== "arsl") setSignLang("arsl");
    setWord(wordRef.current + letter);
    checkProactiveContext(wordRef.current);
  };

  // عند اختفاء اليد يمكن تكرار نفس الحرف (مثل: لل)، وإذا طال اختفاؤها تنتهي الكلمة
  useEffect(() => {
    if (handVisible || !isDetecting) return;
    committedLetterRef.current = "";
    pendingCountRef.current = 0;
    const timer = setTimeout(finishWord, WORD_GAP_MS);
    return () => clearTimeout(timer);
  }, [handVisible, isDetecting]);

  // ينهي الكلمة الحالية: يصححها لأقرب كلمة معروفة ثم ينطقها
  const finishWord = (chosen?: string) => {
    const text = wordRef.current;
    if (!text || text.endsWith(" ")) return;
    const start = text.lastIndexOf(" ") + 1;
    const word = chosen ?? correctWord(text.slice(start));
    setWord(text.slice(0, start) + word + " ");
    committedLetterRef.current = "";
  };

  const addSpace = () => finishWord();

  const deleteLetter = () => {
    const letters = Array.from(wordRef.current);
    letters.pop();
    setWord(letters.join(""));
    committedLetterRef.current = "";
  };

  const clearTranslation = () => {
    setWord("");
    pendingLetterRef.current = "";
    committedLetterRef.current = "";
    setConfidence(null);
    setIsProactive(false);
    retryCountRef.current = 0;
  };

  const resetAll = clearTranslation;

  const checkProactiveContext = (text: string) => {
    const lower = text.toLowerCase();
    const hasStrugglingWord = proactiveKeywords.some((keyword) => lower.includes(keyword));
    if (hasStrugglingWord) {
      retryCountRef.current += 1;
      if (retryCountRef.current >= 2) triggerProactiveMode(tRef.current("alert.partnerStruggle"));
    }
  };

  // مساعدة استباقية: تنبيه وإرشاد عند تكرار الثقة المنخفضة أو كلمات الصعوبة
  // (مطابقة كلمات وقواعد بسيطة، مو تحليل بالذكاء الاصطناعي)
  const triggerProactiveMode = (reason: string) => {
    setIsProactive(true);
    setProactiveReason(reason);
  };

  const partialWord = signTranslation.endsWith(" ") ? "" : (signTranslation.split(" ").pop() ?? "");
  const suggestions = suggestWords(partialWord);

  const statusLabel = !isDetecting
    ? t("live.pressStart")
    : apiError
      ? t("common.serverOffline")
      : handVisible
        ? t("live.translating")
        : t("live.showHand");

  return (
    <AppShell
      fullHeight
      actions={
        <>
          <button
            onClick={resetAll}
            aria-label={t("common.newChat")}
            title={t("common.newChat")}
            className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.04] hover:bg-white/10"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </>
      }
    >
      {/* رصد استباقي: تنبيه مكتوب فقط */}
      {isProactive && (
        <div className="mx-auto mt-3 w-[calc(100%-2rem)] max-w-[900px] sm:w-[calc(100%-3rem)]">
          <ProactiveAlert message={proactiveReason} onClose={() => setIsProactive(false)} />
        </div>
      )}

      {/* main */}
      <div className="relative z-10 mx-auto flex w-full max-w-[900px] flex-1 flex-col px-4 pt-4 pb-4 sm:px-6 lg:min-h-0 lg:pt-5">
        {/* الكاميرا وتحتها الترجمة (عربي أو إنجليزي) */}
        <div className="relative flex flex-col overflow-hidden rounded-[28px] surface p-4 sm:p-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:p-6">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(80% 50% at 0% 0%, oklch(0.45 0.2 295 / 0.35), transparent 70%)",
            }}
          />

          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] backdrop-blur">
              <span className="relative grid h-1.5 w-1.5 place-items-center">
                <span
                  className={`absolute inset-0 rounded-full ${isDetecting ? (apiError ? "bg-amber-400" : "animate-ping bg-rose-400") : "bg-green-400"}`}
                />
                <span
                  className={`relative h-1.5 w-1.5 rounded-full ${isDetecting ? (apiError ? "bg-amber-500" : "bg-rose-500") : "bg-green-500"}`}
                />
              </span>
              <span className="font-semibold">{statusLabel}</span>
            </div>
          </div>

          {wordHint && (
            <div
              role="status"
              className="relative mt-2 rounded-xl bg-white/10 px-3 py-2 text-[11px] text-white/80"
            >
              {t("live.wordUnsure", { words: wordHint })}
            </div>
          )}
          {cameraError && (
            <div
              role="alert"
              className="relative mt-2 flex items-center gap-2 rounded-xl border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-[11px] text-rose-100"
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-300" />
              {t("live.cameraDenied")}
            </div>
          )}

          <div className="relative mt-3 aspect-[4/3] w-full shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/40 lg:aspect-auto lg:min-h-[260px] lg:flex-1">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full -scale-x-100 object-cover"
            />
            {isDetecting && (
              <div
                className="absolute inset-x-6 top-4 h-px animate-scan rounded-full"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, oklch(0.85 0.18 295), transparent)",
                }}
              />
            )}
            {!isDetecting && (
              <div className="absolute inset-0 grid place-items-center text-center text-xs text-white/50">
                <div>
                  <Camera className="mx-auto mb-2 h-8 w-8 text-white/30" strokeWidth={1.4} />
                  {t("live.hintAny")}
                </div>
              </div>
            )}
            <div className="absolute end-3 top-3 rounded-xl glass-dark px-3 py-1.5 text-center">
              <div className="text-[9px] text-white/60">{t("live.confidence")}</div>
              <div className="text-base font-black text-gradient">
                {confidence !== null ? `${Math.round(confidence)}%` : "-"}
              </div>
            </div>
            {isDetecting && partialWord && (
              <div
                dir="auto"
                className="absolute start-3 top-3 max-w-[60%] truncate rounded-2xl grad-purple px-4 py-2 text-2xl font-black shadow-glow"
              >
                {partialWord}
              </div>
            )}
            {isDetecting && tip && (
              <div
                role="status"
                className="absolute inset-x-3 bottom-14 mx-auto flex w-fit items-center gap-1.5 rounded-full border border-amber-300/50 bg-amber-500/85 px-3 py-1.5 text-[12px] font-bold text-white shadow-glow backdrop-blur"
              >
                <Lightbulb className="h-3.5 w-3.5" />
                {t(`tip.${tip}`)}
              </div>
            )}
            {askConsent && (
              <CameraConsent
                onAccept={() => {
                  setAskConsent(false);
                  startDetection();
                }}
                onCancel={() => setAskConsent(false)}
              />
            )}
            <button
              onClick={
                isDetecting
                  ? stopDetection
                  : () => (hasCameraConsent() ? startDetection() : setAskConsent(true))
              }
              className={`absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2 text-xs font-bold shadow-glow transition-all ${isDetecting ? "bg-rose-500 text-white" : "grad-purple text-white"}`}
            >
              {isDetecting ? (
                <>
                  <Pause className="h-3.5 w-3.5" /> {t("live.stop")}
                </>
              ) : (
                <>
                  <Camera className="h-3.5 w-3.5" /> {t("live.start")}
                </>
              )}
            </button>
          </div>

          {/* اقتراحات تكمل الكلمة اللي تتهجاها */}
          <div
            className="relative mt-3 flex min-h-8 flex-wrap items-center justify-center gap-1.5"
            dir="auto"
          >
            {suggestions.length > 0 ? (
              suggestions.map((word) => (
                <button
                  key={word}
                  onClick={() => finishWord(word)}
                  className="rounded-full bg-white/10 px-3 py-1 text-sm font-bold hover:bg-white/20"
                >
                  {word}
                </button>
              ))
            ) : (
              <span className="text-[11px] text-white/45">
                {isDetecting ? t("live.spellHint") : t("live.idleHint")}
              </span>
            )}
          </div>

          <div className="relative mt-3 rounded-2xl surface-inset p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[10px] text-white/60">
                <Sparkles className="h-3 w-3 text-primary" />
                <span>{t("live.signText")}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={addSpace}
                  aria-label={t("live.endWord")}
                  title={t("live.endWord")}
                  className="grid h-7 w-7 place-items-center rounded-full bg-white/10 hover:bg-white/20"
                >
                  <Space className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={deleteLetter}
                  aria-label={t("live.deleteLetter")}
                  title={t("live.deleteLetter")}
                  className="grid h-7 w-7 place-items-center rounded-full bg-white/10 hover:bg-white/20"
                >
                  <Delete className="h-3.5 w-3.5 rtl:-scale-x-100" />
                </button>
              </div>
            </div>
            <div className="relative mt-2">
              <textarea
                dir="auto"
                aria-label={t("live.signText")}
                value={signTranslation}
                placeholder={t("live.waiting")}
                onChange={(e) => {
                  setWord(e.target.value);
                  checkProactiveContext(e.target.value);
                }}
                rows={2}
                className="w-full resize-none rounded-xl bg-white/[0.04] px-10 py-2 text-start text-lg font-semibold leading-snug text-white outline-none ring-1 ring-white/10 placeholder:text-white/40 focus:ring-primary/50 md:text-xl"
              />
              <button
                onClick={clearTranslation}
                aria-label={t("common.clear")}
                className="absolute end-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-white/10 text-white/70 hover:bg-white/20"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
