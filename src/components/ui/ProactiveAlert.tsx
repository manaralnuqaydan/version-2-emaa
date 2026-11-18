import { AlertCircle, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/** رصد استباقي: تنبيه مكتوب فقط (بدون صوت) يقترح خطوة تساعد المستخدم */
export default function ProactiveAlert({
  message,
  action,
  onClose,
}: {
  message: string;
  action?: { label: string; onClick: () => void };
  onClose: () => void;
}) {
  const { t } = useI18n();
  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-2xl border border-amber-400/35 bg-amber-500/15 px-4 py-3 text-[13px] text-amber-100 animate-fade-up"
    >
      <AlertCircle className="h-5 w-5 shrink-0 text-amber-300" />
      <p className="flex-1 text-start leading-relaxed">{message}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="shrink-0 rounded-full bg-amber-400 px-3.5 py-1.5 text-[12px] font-bold text-[oklch(0.25_0.06_70)] hover:bg-amber-300"
        >
          {action.label}
        </button>
      )}
      <button
        onClick={onClose}
        aria-label={t("common.hide")}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-amber-200/70 hover:bg-white/10 hover:text-amber-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
