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

// الشعار الجديد كامل (اليد + EMAA + إيماء) كصورة
export function BrandFull({ className = "", large = false }: { className?: string; large?: boolean }) {
  return (
    <img
      src={large ? "/brand/emaa-logo-full.png" : "/brand/emaa-logo-128.png"}
      alt="EMAA إيماء"
      draggable={false}
      className={`select-none ${className}`}
    />
  );
}

// شعار الهيدر
export function BrandLogo({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  return (
    <Link
      to="/home"
      aria-label={t("common.home")}
      className="group relative flex items-center rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="absolute inset-2 rounded-full bg-primary/25 blur-lg opacity-60 transition-opacity group-hover:opacity-100" />
      <BrandFull
        className={`relative w-auto drop-shadow-[0_4px_14px_oklch(0.6_0.25_295/0.5)] ${compact ? "h-10" : "h-14 sm:h-[60px]"}`}
      />
    </Link>
  );
}
