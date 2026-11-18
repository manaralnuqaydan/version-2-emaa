import { Volume2, Sparkles, X, AlertCircle, Send, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import AvatarViewer from "../ui/AvatarViewer";
import SpellCaption from "../ui/SpellCaption";
import { speak, stopSpeaking } from "@/lib/speech";
import { translate, useI18n } from "@/lib/i18n";
import { SignLanguagePicker } from "@/components/LanguageControls";
import { AppShell } from "@/components/layout/AppShell";
import { askAssistant, spellOnAvatar, type AssistantReply, type ChatTurn } from "@/lib/assistant";

type Bubble = {
  role: "user" | "assistant";
  text: string;
  reply?: AssistantReply;
};

// 🔍 كلمات تدل على تعثر المستخدم (مطابقة كلمات بسيطة، مو تحليل بالذكاء الاصطناعي)
const proactiveKeywords = [
  "لا اعرف",
  "لا أعرف",
  "ما اعرف",
  "ما أعرف",
  "مدري",
  "خطأ",
  "غلط",
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
  "ما رضي",
  "رفض",
  "فشل",
  "don't know",
  "dont know",
  "problem",
  "error",
  "stuck",
  "confused",
  "don't understand",
  "dont understand",
  "difficult",
  "failed",
];

export function ChatScreen() {
  const { t, lang, signLang } = useI18n();
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [inputText, setInputText] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState(false);
  const [isProactive, setIsProactive] = useState(false);
  const retryCountRef = useRef(0);
  const historyRef = useRef<ChatTurn[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  const textOf = (r: AssistantReply) => (lang === "ar" ? r.ar : r.en) || r.ar || r.en;

  useEffect(() => {
    return () => stopSpeaking();
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [bubbles, thinking]);

  const playReply = (r: AssistantReply) => {
    speak(textOf(r));
    spellOnAvatar(r.sign, signLang);
  };

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || thinking) return;
    setInputText("");
    setError(false);
    const lower = message.toLowerCase();
    if (proactiveKeywords.some((k) => lower.includes(k))) {
      retryCountRef.current += 1;
      if (retryCountRef.current >= 2) setIsProactive(true);
    }
    const history = [...historyRef.current, { role: "user" as const, content: message }];
    historyRef.current = history;
    setBubbles((b) => [...b, { role: "user", text: message }]);
    setThinking(true);
    try {
      const reply = await askAssistant(history, lang, signLang);
      historyRef.current = [...history, { role: "assistant", content: reply.ar || reply.en }];
      setBubbles((b) => [...b, { role: "assistant", text: textOf(reply), reply }]);
      playReply(reply);
    } catch {
      // نرجع الرسالة للخانة عشان المستخدم يعيد الإرسال بدون ما يكتبها من جديد
      historyRef.current = history.slice(0, -1);
      setBubbles((b) => b.slice(0, -1));
      setInputText(message);
      setError(true);
    } finally {
      setThinking(false);
    }
  };

  const resetChat = () => {
    historyRef.current = [];
    retryCountRef.current = 0;
    setBubbles([]);
    setIsProactive(false);
    setError(false);
    stopSpeaking();
  };

  const lastReply = [...bubbles].reverse().find((b) => b.reply)?.reply;
  return (
    <AppShell
      fullHeight
      actions={
        <>
          <SignLanguagePicker compact dark />
        </>
      }
    >
      {isProactive && (
        <div className="mx-5 mb-2 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/20 p-3 text-xs text-amber-200">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
          <div className="flex-1 text-start">
            <span className="font-bold">{t("assistant.proactiveTitle")}</span>{" "}
            {t("assistant.proactiveReason")}
          </div>
          <button
            onClick={() => setIsProactive(false)}
            aria-label={t("common.hide")}
            className="text-amber-200/70 hover:text-amber-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="relative z-10 mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-4 px-4 pt-4 pb-4 sm:px-6 lg:min-h-0 lg:flex-row lg:items-stretch lg:gap-5 lg:pt-5">
        {/* الأفاتار */}
        <div className="relative flex min-h-[340px] flex-col overflow-hidden rounded-[28px] surface lg:min-h-0 lg:flex-[1.1]">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(70% 60% at 50% 18%, oklch(0.5 0.2 295 / 0.5), transparent 70%), linear-gradient(180deg, oklch(0.2 0.06 290 / 0.3), oklch(0.1 0.03 288 / 0.6))",
            }}
          />
          <div className="absolute right-3 top-3 z-10 rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[11px] font-semibold backdrop-blur">
            {t(`signLang.${signLang}`)}
          </div>
          <div className="relative h-[min(68vh,30rem)] w-full sm:h-[32rem] lg:h-full lg:flex-1">
            <AvatarViewer />
          </div>
          <SpellCaption
            dark
            idle={
              lastReply?.sign && (
                <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 rounded-2xl bg-black/40 px-3 py-2 text-[11px] text-white/80 backdrop-blur">
                  <span>{t("assistant.avatarSpells", { words: lastReply.sign })}</span>
                  <button
                    onClick={() => spellOnAvatar(lastReply.sign, signLang)}
                    aria-label={t("assistant.replaySign")}
                    className="grid h-7 w-7 place-items-center rounded-full bg-white/15 hover:bg-white/25"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            }
          />
        </div>

        {/* المحادثة */}
        <div className="relative flex min-h-[460px] flex-col overflow-hidden rounded-[28px] surface p-4 sm:p-5 lg:min-h-0 lg:flex-1 lg:p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl grad-purple shadow-soft">
                <Sparkles className="h-4 w-4 text-white" />
              </span>
              <span className="text-[14px] font-bold">{t("assistant.panelTitle")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={resetChat}
                className="h-8 rounded-full bg-white/[0.07] px-3 text-[11px] font-semibold hover:bg-white/15"
              >
                {t("common.newChat")}
              </button>
            </div>
          </div>

          <div
            ref={listRef}
            aria-live="polite"
            className="mt-4 flex min-h-[200px] flex-1 flex-col gap-3 overflow-y-auto pe-1"
          >
            {bubbles.length === 0 && (
              <div className="max-w-[85%] self-start rounded-2xl rounded-ss-md border border-white/[0.06] bg-white/[0.07] px-4 py-3 text-base font-semibold leading-relaxed">
                {translate(lang, "assistant.greeting")}
              </div>
            )}
            {bubbles.map((b, i) =>
              b.role === "user" ? (
                <div
                  key={i}
                  dir="auto"
                  className="max-w-[85%] self-end rounded-2xl rounded-se-md grad-purple px-4 py-2.5 text-[15px] shadow-soft"
                >
                  {b.text}
                </div>
              ) : (
                <div
                  key={i}
                  className="max-w-[85%] self-start rounded-2xl rounded-ss-md border border-white/[0.06] bg-white/[0.07] px-4 py-3"
                >
                  <div dir="auto" className="text-base font-semibold leading-relaxed">
                    {b.text}
                  </div>
                  {b.reply && (lang === "ar" ? b.reply.en : b.reply.ar) && (
                    <div dir="auto" className="mt-1.5 text-xs text-white/55">
                      {lang === "ar" ? b.reply.en : b.reply.ar}
                    </div>
                  )}
                  {b.reply && (
                    <button
                      onClick={() => playReply(b.reply!)}
                      aria-label={t("assistant.playVoice")}
                      title={t("assistant.playVoice")}
                      className="mt-2 grid h-7 w-7 place-items-center rounded-full bg-white/10 text-white/60 hover:bg-white/20 hover:text-white"
                    >
                      <Volume2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ),
            )}
            {thinking && (
              <div className="self-start rounded-2xl bg-white/10 px-4 py-2 text-[12px] text-white/70">
                {t("assistant.typing")}
              </div>
            )}
          </div>

          {error && (
            <div
              role="alert"
              className="mt-2 flex items-center gap-2 rounded-xl border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-[11px] text-rose-100"
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {t("assistant.serverDown")}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(inputText);
            }}
            className="mt-3 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/25 p-1.5 transition-colors focus-within:border-primary/60"
          >
            <input
              dir="auto"
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={t("assistant.placeholder")}
              aria-label={t("assistant.placeholder")}
              className="h-10 flex-1 bg-transparent px-3 text-[15px] text-white outline-none placeholder:text-white/40"
            />
            <button
              type="submit"
              disabled={thinking || !inputText.trim()}
              aria-label={t("common.send")}
              className="grid h-10 w-10 place-items-center rounded-xl grad-purple shadow-soft transition-all hover:opacity-90 disabled:opacity-50"
            >
              <Send className="h-4 w-4 text-white rtl:-scale-x-100" />
            </button>
          </form>
          <p className="mt-1.5 text-center text-[10px] text-white/45">{t("privacy.chatNote")}</p>
        </div>
      </div>
    </AppShell>
  );
}
