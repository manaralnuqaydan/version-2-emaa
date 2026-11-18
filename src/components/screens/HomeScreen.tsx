import { ArrowLeft, Camera, Hand, LayoutGrid, MessageCircle, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { SignLanguagePicker } from "@/components/LanguageControls";
import { AppShell } from "@/components/layout/AppShell";
import { BrandMark } from "@/components/Brand";
import { useApiStatus } from "@/lib/useApiStatus";

function StatusPill() {
  const { t } = useI18n();
  const s = useApiStatus();
  const tone = !s
    ? { dot: "bg-white/40", text: t("home2.checking") }
    : !s.online
      ? { dot: "bg-rose-500", text: t("home2.offline") }
      : s.chatbot
        ? { dot: "bg-emerald-400", text: t("home2.onlineAi") }
        : { dot: "bg-amber-400", text: t("home2.noKey") };
  return (
    <div className="inline-flex h-8 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 text-[12px] text-white/75">
      <span className="relative grid h-2 w-2 place-items-center">
        {s?.online && (
          <span className={`absolute inset-0 animate-ping rounded-full ${tone.dot} opacity-60`} />
        )}
        <span className={`relative h-2 w-2 rounded-full ${tone.dot}`} />
      </span>
      {tone.text}
    </div>
  );
}

// الشعار الكبير في الصفحة الرئيسية: اليد داخل مدارات تدور ببطء
function HeroVisual() {
  const { t } = useI18n();
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[290px] sm:max-w-[400px] lg:max-w-[520px]">
      <div className="absolute inset-[12%] rounded-full bg-[radial-gradient(circle,oklch(0.55_0.25_295/0.55),transparent_68%)] blur-2xl" />
      <div className="absolute inset-[4%] rounded-full border border-white/[0.06]" />
      <div className="absolute inset-[16%] rounded-full border border-dashed border-white/[0.08] animate-orbit" />
      <div className="absolute inset-[28%] rounded-full border border-white/[0.05]" />
      <div className="absolute inset-0 grid place-items-center animate-float-soft">
        <BrandMark
          size={520}
          className="h-[86%] w-[86%] drop-shadow-[0_30px_60px_oklch(0.5_0.25_295/0.55)]"
        />
      </div>
      {/* بطاقتين صغيرتين توضح الاتجاهين */}
      <div className="absolute start-0 top-[14%] flex items-center gap-2 rounded-2xl surface px-3 py-2 text-[12px] font-semibold animate-fade-up [animation-delay:250ms]">
        <span className="grid h-7 w-7 place-items-center rounded-xl grad-purple">
          <Camera className="h-3.5 w-3.5 text-white" />
        </span>
        {t("home2.visualA")}
      </div>
      <div className="absolute bottom-[12%] end-0 flex items-center gap-2 rounded-2xl surface px-3 py-2 text-[12px] font-semibold animate-fade-up [animation-delay:450ms]">
        <span className="grid h-7 w-7 place-items-center rounded-xl bg-white/10">
          <Hand className="h-3.5 w-3.5 text-lavender" />
        </span>
        {t("home2.visualB")}
      </div>
    </div>
  );
}

const FEATURES = [
  { to: "/camera", Icon: Camera, title: "home2.f1t", desc: "home2.f1d" },
  { to: "/chat", Icon: Hand, title: "home2.f2t", desc: "home2.f2d" },
  { to: "/chat", Icon: MessageCircle, title: "home2.f3t", desc: "home2.f3d" },
] as const;

export function HomeScreen() {
  const { t } = useI18n();
  return (
    <AppShell>
      <section className="mx-auto grid w-full max-w-[1400px] flex-1 items-center gap-10 px-5 pt-4 pb-10 sm:px-8 sm:pt-8 lg:grid-cols-[1.05fr_1fr] lg:gap-6 lg:pt-14">
        <div className="order-2 flex flex-col items-center text-center lg:order-1 lg:items-start lg:text-start">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-[12px] font-semibold text-lavender">
              <Sparkles className="h-3.5 w-3.5" />
              {t("home2.eyebrow")}
            </span>
          </div>
          <h1 className="mt-5 text-balance text-[44px] font-black leading-[1.05] tracking-tight animate-fade-up [animation-delay:80ms] sm:text-6xl lg:text-7xl ltr:font-display">
            <span className="block text-white">{t("home2.title1")}</span>
            <span className="block text-gradient pb-2">{t("home2.title2")}</span>
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-[15px] leading-relaxed text-white/65 animate-fade-up [animation-delay:160ms] sm:text-base">
            {t("home2.lead")}
          </p>

          <div className="mt-8 flex w-full flex-col gap-3 animate-fade-up [animation-delay:240ms] sm:w-auto sm:flex-row">
            <Link
              to="/camera"
              className="group flex h-13 items-center justify-center gap-2.5 rounded-2xl grad-purple px-6 py-3.5 text-[15px] font-bold text-white shadow-glow transition-transform hover:-translate-y-0.5"
            >
              <Camera className="h-5 w-5" />
              {t("home2.ctaLive")}
              <ArrowLeft className="h-4 w-4 transition-transform ltr:-scale-x-100 group-hover:rtl:-translate-x-0.5 group-hover:ltr:translate-x-0.5" />
            </Link>
            <Link
              to="/chat"
              className="flex h-13 items-center justify-center gap-2.5 rounded-2xl border border-white/12 bg-white/[0.05] px-6 py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-white/[0.09]"
            >
              <MessageCircle className="h-5 w-5 text-lavender" />
              {t("home2.ctaChat")}
            </Link>
          </div>

          <div className="mt-7 flex flex-col items-center gap-3 animate-fade-up [animation-delay:320ms] sm:flex-row lg:items-center">
            <StatusPill />
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-white/50">{t("home2.signHint")}</span>
              <SignLanguagePicker compact dark />
            </div>
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <HeroVisual />
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1400px] px-5 pb-10 sm:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {FEATURES.map(({ to, Icon, title, desc }, i) => (
            <Link
              key={title}
              to={to}
              className="group relative overflow-hidden rounded-3xl surface p-6 transition-transform hover:-translate-y-1 animate-fade-up"
              style={{ animationDelay: `${400 + i * 90}ms` }}
            >
              <div className="absolute -end-10 -top-10 h-32 w-32 rounded-full bg-primary/20 blur-2xl transition-opacity group-hover:opacity-100 opacity-50" />
              <span className="relative grid h-11 w-11 place-items-center rounded-2xl grad-purple shadow-soft">
                <Icon className="h-5 w-5 text-white" />
              </span>
              <h3 className="relative mt-4 text-lg font-bold">{t(title)}</h3>
              <p className="relative mt-1.5 text-[13px] leading-relaxed text-white/60">{t(desc)}</p>
              <span className="relative mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-lavender">
                {t("home2.open")}
                <ArrowLeft className="h-3.5 w-3.5 ltr:-scale-x-100" />
              </span>
            </Link>
          ))}
        </div>
        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-white/[0.06] pt-6 text-[12px] text-white/40 sm:flex-row">
          <p>{t("home2.disclaimer")}</p>
          <Link
            to="/modes"
            className="inline-flex items-center gap-1.5 text-white/55 hover:text-white"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            {t("home2.modes")}
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
