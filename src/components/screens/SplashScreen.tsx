import { useI18n } from "@/lib/i18n";
import { BrandFull } from "@/components/Brand";

export function SplashScreen() {
  const { t } = useI18n();
  return (
    <div className="relative grid min-h-dvh w-full place-items-center overflow-hidden app-bg px-6 text-white">
      <div className="absolute left-1/2 top-1/2 h-[min(90vw,720px)] w-[min(90vw,720px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,oklch(0.5_0.24_295/0.45),transparent_65%)] blur-2xl" />

      <div className="relative flex flex-col items-center text-center">
        <div className="relative animate-fade-up">
          <div className="absolute inset-[8%] rounded-full border border-white/[0.07]" />
          <div className="absolute inset-[22%] rounded-full border border-dashed border-white/[0.09] animate-orbit" />
          <BrandFull
            large
            className="relative h-auto w-[min(86vw,560px)] animate-float-soft drop-shadow-[0_30px_70px_oklch(0.55_0.26_295/0.6)]"
          />
        </div>

        <div className="mt-3 flex flex-col items-center gap-0.5 animate-fade-up [animation-delay:350ms]">
          <p dir="rtl" lang="ar" className="text-sm font-medium text-white/45">تواصل يفهمك بدون كلام</p>
          <p dir="ltr" lang="en" className="text-xs text-white/40">Communication that understands you, without words</p>
          <p dir="ltr" lang="ko" className="text-xs text-white/40">말 없이도 당신을 이해하는 소통</p>
        </div>

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
