import { Check, Copy } from "lucide-react";
import { useState } from "react";

// Hiển thị chuỗi dài (email/UUID) không bị cắt: wrap tại vị trí bất kỳ + tooltip
// full text; copyable thêm nút copy cho giá trị cần dán lại (email, ID).
export function LongText({
  value,
  className = "",
  copyable = false,
}: {
  value: string;
  className?: string;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard bị chặn (http/permission) → bỏ qua, user vẫn bôi đen copy được
    }
  }

  return (
    <span className={`inline-flex min-w-0 items-start gap-1 ${className}`}>
      <span title={value} style={{ overflowWrap: "anywhere" }} className="min-w-0">
        {value}
      </span>
      {copyable && (
        <button
          type="button"
          onClick={copy}
          aria-label={`Copy ${value}`}
          className="mt-0.5 shrink-0 rounded p-0.5 text-[#8585A0] transition-colors hover:bg-white/10 hover:text-[#F0EDEB]"
        >
          {copied ? <Check className="h-3 w-3 text-[#2DBE6C]" /> : <Copy className="h-3 w-3" />}
        </button>
      )}
    </span>
  );
}
