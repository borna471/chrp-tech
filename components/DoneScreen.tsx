import { Button } from "@/components/Button";
import type { InspectionView } from "@/lib/useInspection";

type DoneScreenProps = {
  view: InspectionView;
  onBack: () => void;
};

export function DoneScreen({ view, onBack }: DoneScreenProps) {
  return (
    <div className="flex flex-1 flex-col px-5 pb-[30px]">
      <div className="flex flex-1 flex-col justify-center">
        <div className="mb-2.5 text-[11px] font-semibold tracking-[.14em] text-aqua-700 uppercase">
          Assessment complete
        </div>
        <h1 className="mb-3.5 text-[34px] leading-[1.15] font-semibold">
          All {view.totalCount} photos are in.
        </h1>
        <p className="text-[17px] leading-[1.45] text-pretty text-accent-800">
          Thanks, {view.firstName}. Chrp is reviewing your home now. If anything
          needs a second look we&apos;ll text you this same link — no login, no
          app to install.
        </p>
      </div>
      <Button
        variant="secondary"
        block
        onClick={onBack}
        className="min-h-[52px] p-[15px] text-base"
      >
        Back to my photo list
      </Button>
    </div>
  );
}
