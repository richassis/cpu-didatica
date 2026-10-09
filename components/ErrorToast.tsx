"use client";

import { useT } from "@/lib/i18n";

/**
 * An error shown under the top bar until it is closed. `className` places it.
 */
export default function ErrorToast({
  message,
  onClose,
  className,
}: {
  message: string;
  onClose: () => void;
  className: string;
}) {
  const t = useT();
  return (
    <div
      className={`absolute top-full z-50 mt-2 rounded-lg border border-st-error bg-surface px-3 py-2 ${className}`}
    >
      <p className="text-small leading-snug text-st-error">{message}</p>
      <button
        onClick={onClose}
        className="mt-1 text-small text-fg-muted underline-offset-2 hover:underline"
      >
        {t.bar.toast.close}
      </button>
    </div>
  );
}
