import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";

// شعار emaa: اليد البنفسجية (الصورة الأصلية بعد إزالة الخلفية)
export function BrandMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      src={size > 96 ? "/brand/emaa-mark.png" : "/brand/emaa-mark-256.png"}
      alt=""
      aria-hidden
      width={size}
      height={size}
      draggable={false}
      className={`select-none ${className}`}
      // لو الحجم محدد بالكلاسات (h-/w-) نخليها هي اللي تتحكم
      style={/(^|\s)(h|w)-/.test(className) ? undefined : { width: size, height: size }}
    />
  );
}

// الشعار الكامل: اليد + كلمة emaa (+ إيماء بالعربي)
export function BrandLogo({ compact = false }: { compact?: boolean }) {
  const { lang, t } = useI18n();
  return (
    <Link
      to="/home"
      aria-label={t("common.home")}
      className="group flex items-center gap-2 rounded-2xl pe-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="relative grid h-10 w-10 place-items-center">
        <span className="absolute inset-0 rounded-full bg-primary/25 blur-md transition-opacity group-hover:opacity-100 opacity-60" />
        <BrandMark
          size={44}
          className="relative -my-1 drop-shadow-[0_4px_14px_oklch(0.6_0.25_295/0.6)]"
        />
      </span>
      {!compact && (
        <span dir="ltr" className="flex items-baseline gap-2 leading-none">
          <span className="wordmark text-[22px]">emaa</span>
          {lang === "ar" && <span className="text-[13px] font-semibold text-white/55">إيماء</span>}
        </span>
      )}
    </Link>
  );
}
