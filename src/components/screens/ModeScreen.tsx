import { ArrowLeft, Camera, MessageCircle, Type, Video } from "lucide-react";
import { Link } from "@tanstack/react-router";
import avatarSaudi from "@/assets/avatar-saudi.png";
import { useI18n } from "@/lib/i18n";
import { AppShell } from "@/components/layout/AppShell";

export function ModeScreen() {
  const { t } = useI18n();
  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 pt-8 pb-10 sm:px-8 lg:pt-14">
        <div className="text-center animate-fade-up">
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{t("modes.title")}</h1>
          <p className="mt-2 text-[14px] text-white/60">{t("modes.subtitle")}</p>
        </div>

        <div className="mt-9 grid gap-5 md:grid-cols-2">
          <Link
            to="/chat"
            className="group relative flex flex-col overflow-hidden rounded-[28px] surface p-6 transition-transform hover:-translate-y-1 animate-fade-up [animation-delay:180ms] sm:p-7"
          >
            <div className="absolute -end-16 -top-16 h-48 w-48 rounded-full bg-primary/25 blur-3xl" />
            <div className="relative flex items-start gap-5">
              <div className="flex-1">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] px-2.5 py-1 text-[11px] font-bold text-lavender">
                  <Type className="h-3 w-3" /> {t("modes.first")}
                </span>
                <h2 className="mt-3 text-xl font-black leading-snug sm:text-2xl">
                  {t("modes.chatTitle")}
                </h2>
                <p className="mt-2 text-[13px] leading-relaxed text-white/60">
                  {t("modes.chatDesc")}
                </p>
              </div>
              <div className="relative h-28 w-24 shrink-0 overflow-hidden rounded-3xl bg-gradient-to-b from-primary/40 to-primary/5 sm:h-32 sm:w-28">
                <img
                  src={avatarSaudi}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover object-top"
                />
              </div>
            </div>
            <span className="relative mt-6 inline-flex w-fit items-center gap-2 rounded-2xl grad-purple px-5 py-2.5 text-[14px] font-bold text-white shadow-soft">
              <MessageCircle className="h-4 w-4" />
              {t("modes.start")}
              <ArrowLeft className="h-4 w-4 ltr:-scale-x-100" />
            </span>
          </Link>

          <Link
            to="/camera"
            className="group relative flex flex-col overflow-hidden rounded-[28px] border border-primary/30 p-6 shadow-glow transition-transform hover:-translate-y-1 animate-fade-up [animation-delay:260ms] sm:p-7"
            style={{
              background:
                "radial-gradient(120% 90% at 100% 0%, oklch(0.45 0.22 295 / 0.6), transparent 60%), linear-gradient(160deg, oklch(0.26 0.12 292), oklch(0.16 0.07 285))",
            }}
          >
            <span className="absolute end-5 top-5 inline-flex items-center gap-1.5 rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-200">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" /> LIVE
            </span>
            <div className="relative flex items-start gap-5">
              <div className="flex-1">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold">
                  <Video className="h-3 w-3" /> {t("modes.second")}
                </span>
                <h2 className="mt-3 text-xl font-black leading-snug sm:text-2xl">
                  {t("modes.liveTitle")}
                </h2>
                <p className="mt-2 text-[13px] leading-relaxed text-white/65">
                  {t("modes.liveDesc")}
                </p>
              </div>
              <div className="relative mt-8 grid h-24 w-24 shrink-0 place-items-center rounded-3xl border border-white/15 bg-white/[0.06] sm:h-28 sm:w-28">
                <span className="absolute start-2.5 top-2.5 h-3 w-3 rounded-ss-md border-s-2 border-t-2 border-white/70" />
                <span className="absolute end-2.5 top-2.5 h-3 w-3 rounded-se-md border-e-2 border-t-2 border-white/70" />
                <span className="absolute bottom-2.5 start-2.5 h-3 w-3 rounded-es-md border-b-2 border-s-2 border-white/70" />
                <span className="absolute bottom-2.5 end-2.5 h-3 w-3 rounded-ee-md border-b-2 border-e-2 border-white/70" />
                <Camera className="h-8 w-8 text-white/90" strokeWidth={1.5} />
              </div>
            </div>
            <span className="relative mt-6 inline-flex w-fit items-center gap-2 rounded-2xl bg-white px-5 py-2.5 text-[14px] font-bold text-[oklch(0.3_0.15_292)] shadow-soft">
              <Camera className="h-4 w-4" />
              {t("modes.try")}
              <ArrowLeft className="h-4 w-4 ltr:-scale-x-100" />
            </span>
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
