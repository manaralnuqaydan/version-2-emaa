import { useI18n } from "@/lib/i18n";
import { BrandMark } from "@/components/Brand";

export function SplashScreen() {
  const { t } = useI18n();
  return (
    <div className="relative grid min-h-dvh w-full place-items-center overflow-hidden app-bg px-6 text-white">
      <div className="absolute left-1/2 top-1/2 h-[min(90vw,720px)] w-[min(90vw,720px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,oklch(0.5_0.24_295/0.45),transparent_65%)] blur-2xl" />

      <div className="relative flex flex-col items-center text-center">
        <div className="relative animate-fade-up">
          <div className="absolute inset-[8%] rounded-full border border-white/[0.07]" />
          <div className="absolute inset-[22%] rounded-full border border-dashed border-white/[0.09] animate-orbit" />
          <BrandMark
            size={360}
            className="relative h-[clamp(200px,38vh,360px)] w-[clamp(200px,38vh,360px)] animate-float-soft drop-shadow-[0_30px_70px_oklch(0.55_0.26_295/0.6)]"
          />
        </div>

        <h1 dir="ltr" className="mt-2 animate-fade-up [animation-delay:150ms]">
          <span className="wordmark text-[clamp(56px,11vw,104px)] leading-none">emaa</span>
        </h1>
        <div className="mt-1 text-xl font-bold text-white/70 animate-fade-up [animation-delay:250ms]">
          إيماء
        </div>
        <p className="mt-4 max-w-sm text-[15px] text-white/60 animate-fade-up [animation-delay:350ms]">
          {t("splash.tagline")}
        </p>

        <div className="mt-10 h-1 w-48 overflow-hidden rounded-full bg-white/10 animate-fade-up [animation-delay:450ms]">
          <div
            className="h-full animate-loading rounded-full rtl:ms-auto"
            style={{
              background: "linear-gradient(90deg, oklch(0.75 0.2 295), oklch(0.82 0.13 255))",
            }}
          />
        </div>
      </div>
    </div>
  );
}
