import { Button } from "@/components/Button";

type ConfirmDialogProps = {
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div
      className="absolute inset-0 z-10 flex items-end bg-accent/45 px-5 pb-[26px]"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full rounded-lg bg-bg p-5">
        <p className="mb-5 text-[17px] leading-[1.4] text-pretty">{message}</p>
        {/* Both choices share one design, so neither is nudged as the safe one. */}
        <div className="flex gap-2.5">
          <Button
            variant="secondary"
            block
            onClick={onCancel}
            className="min-h-[48px] text-base"
          >
            {cancelLabel}
          </Button>
          <Button
            variant="secondary"
            block
            onClick={onConfirm}
            className="min-h-[48px] text-base"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
