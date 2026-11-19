import { RotateCcw, Send, Trash2, Type } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import AvatarViewer from "../ui/AvatarViewer";
import SpellCaption from "../ui/SpellCaption";
import ProactiveAlert from "../ui/ProactiveAlert";
import { useI18n, type SignLang } from "@/lib/i18n";
import { SignLanguagePicker } from "@/components/LanguageControls";
import { AppShell } from "@/components/layout/AppShell";
import { controlSpelling, hasStruggleWord, spellOnAvatar, wrongScript } from "@/lib/avatar";

type Item = { text: string; signLang: SignLang };
type Alert = { kind: "struggle" } | null;

// نص ← إشارة: اللي تكتبه يتأشّر مباشرة بأشكال اليد من الداتاسيت (بدون أي مساعد خارجي)
export function ChatScreen() {
  const { t, signLang, setSignLang } = useI18n();
  const [items, setItems] = useState<Item[]>([]);
  const [inputText, setInputText] = useState("");
  const [alert, setAlert] = useState<Alert>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [items]);

  const sign = (text: string, lang: SignLang = signLang) => {
    controlSpelling({ cmd: "speed", value: 1 });
    spellOnAvatar(text, lang);
  };

  const send = (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    setInputText("");
    // يفهم العربي والإنجليزي: لغة الكتابة تحدد لغة الإشارة تلقائيًا (عربي ← ArSL، إنجليزي ← ASL)
    const lang = wrongScript(text, signLang) ?? signLang;
    if (lang !== signLang) setSignLang(lang);
    // رصد استباقي (مكتوب فقط): كلمات تدل على صعوبة
    setAlert(hasStruggleWord(text) ? { kind: "struggle" } : null);
    setItems((list) => [...list, { text, signLang: lang }]);
    sign(text, lang);
  };

  const replaySlower = () => {
    const last = items[items.length - 1];
    if (last) {
      spellOnAvatar(last.text, last.signLang);
      controlSpelling({ cmd: "speed", value: 0.5 });
    }
    setAlert(null);
  };

  return (
    <AppShell fullHeight actions={<SignLanguagePicker compact dark />}>
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
          <SpellCaption dark />
        </div>

        {/* الكتابة */}
        <div className="relative flex min-h-[420px] flex-col overflow-hidden rounded-[28px] surface p-4 sm:p-5 lg:min-h-0 lg:flex-1 lg:p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl grad-purple shadow-soft">
                <Type className="h-4 w-4 text-white" />
              </span>
              <span className="text-[14px] font-bold">{t("assistant.panelTitle")}</span>
            </div>
            {items.length > 0 && (
              <button
                onClick={() => {
                  setItems([]);
                  setAlert(null);
                }}
                aria-label={t("common.clear")}
                title={t("common.clear")}
                className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.07] text-white/70 hover:bg-white/15"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>

          {alert && (
            <div className="mt-3">
              <ProactiveAlert
                message={t("alert.struggle")}
                action={{ label: t("alert.slower"), onClick: replaySlower }}
                onClose={() => setAlert(null)}
              />
            </div>
          )}

          <div
            ref={listRef}
            aria-live="polite"
            className="mt-4 flex min-h-[160px] flex-1 flex-col gap-2.5 overflow-y-auto pe-1"
          >
            {items.length === 0 && (
              <div className="m-auto max-w-xs text-center text-[14px] leading-relaxed text-white/50">
                {t("t2s.empty")}
              </div>
            )}
            {items.map((it, i) => (
              <div
                key={i}
                className="flex max-w-[90%] items-center gap-2 self-end rounded-2xl rounded-se-md grad-purple px-4 py-2.5 shadow-soft"
              >
                <span dir="auto" className="text-[16px] font-semibold">
                  {it.text}
                </span>
                <button
                  onClick={() => sign(it.text, it.signLang)}
                  aria-label={t("t2s.replay")}
                  title={t("t2s.replay")}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/20 hover:bg-white/30"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

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
              className="h-11 flex-1 bg-transparent px-3 text-[16px] text-white outline-none placeholder:text-white/40"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              aria-label={t("common.send")}
              className="grid h-11 w-11 place-items-center rounded-xl grad-purple shadow-soft transition-all hover:opacity-90 disabled:opacity-50"
            >
              <Send className="h-4 w-4 text-white rtl:-scale-x-100" />
            </button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
