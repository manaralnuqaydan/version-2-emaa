import { ArrowLeft, Camera, Hand, Type } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { SignLanguagePicker } from "@/components/LanguageControls";
import { AppShell } from "@/components/layout/AppShell";
import { BrandMark } from "@/components/Brand";

// الشعار الكبير في الصفحة الرئيسية: اليد داخل مدارات تدور ببطء
function HeroVisual() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[240px] sm:max-w-[340px] lg:max-w-[460px]">
      <div className="absolute inset-[12%] rounded-full bg-[radial-gradient(circle,oklch(0.55_0.25_295/0.55),transparent_68%)] blur-2xl" />
      <div className="absolute inset-[4%] rounded-full border border-white/[0.06]" />
      <div className="absolute inset-[16%] rounded-full border border-dashed border-white/[0.08] animate-orbit" />
      <div className="absolute inset-0 grid place-items-center animate-float-soft">
        <BrandMark
          size={460}
          className="h-[86%] w-[86%] drop-shadow-[0_30px_60px_oklch(0.5_0.25_295/0.55)]"
        />
      </div>
    </div>
  );
}

// الوضعين: نص ← إشارة (الأفاتار) و إشارة ← نص (الكاميرا)
const MODES = [
  { to: "/chat", Icon: Type, Badge: Hand, title: "home2.goSignT", desc: "home2.goSignD" },
  { to: "/camera", Icon: Camera, Badge: Type, title: "home2.goTextT", desc: "home2.goTextD" },
] as const;

export function HomeScreen() {
  const { t } = useI18n();
  return (
    <AppShell>
      <section className="mx-auto grid w-full max-w-[1300px] flex-1 items-center gap-8 px-5 pt-4 pb-10 sm:px-8 sm:pt-8 lg:grid-cols-[1.1fr_1fr] lg:gap-6">
        <div className="order-2 flex flex-col items-center text-center lg:order-1 lg:items-start lg:text-start">
          <h1 className="text-balance text-[42px] font-black leading-[1.05] tracking-tight animate-fade-up sm:text-6xl lg:text-7xl ltr:font-display">
            <span className="block text-white">{t("home2.title1")}</span>
            <span className="block text-gradient pb-2">{t("home2.title2")}</span>
          </h1>
          <p className="mt-4 max-w-md text-pretty text-[16px] leading-relaxed text-white/65 animate-fade-up [animation-delay:80ms] sm:text-lg">
            {t("home2.lead")}
          </p>

          <div className="mt-8 grid w-full max-w-xl gap-3 animate-fade-up [animation-delay:160ms] sm:grid-cols-2">
            {MODES.map(({ to, Icon, title, desc }, i) => (
              <Link
                key={to}
                to={to}
                className={`group flex items-center gap-4 rounded-3xl p-5 text-start transition-transform hover:-translate-y-0.5 ${i === 0 ? "grad-purple shadow-glow" : "border border-white/12 bg-white/[0.06] hover:bg-white/[0.1]"}`}
              >
                <span
                  className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${i === 0 ? "bg-white/20" : "grad-purple shadow-soft"}`}
                >
                  <Icon className="h-6 w-6 text-white" />
                </span>
                <span className="flex-1">
                  <span className="block text-[19px] font-black text-white">{t(title)}</span>
                  <span
                    className={`mt-0.5 block text-[13px] ${i === 0 ? "text-white/80" : "text-white/60"}`}
                  >
                    {t(desc)}
                  </span>
                </span>
                <ArrowLeft className="h-5 w-5 shrink-0 text-white/70 transition-transform ltr:-scale-x-100 group-hover:rtl:-translate-x-0.5 group-hover:ltr:translate-x-0.5" />
              </Link>
            ))}
          </div>

          <div className="mt-6 flex items-center gap-2 animate-fade-up [animation-delay:240ms]">
            <span className="text-[13px] text-white/55">{t("home2.signHint")}</span>
            <SignLanguagePicker compact dark />
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <HeroVisual />
        </div>
      </section>
    </AppShell>
  );
}
