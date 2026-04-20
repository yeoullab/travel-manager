import { Button } from "@/components/ui/button";

type Props = {
  fromDay: number;
  toDay: number;
  onConfirm: () => void;
  onCancel: () => void;
};

export function DateShrinkConfirm({ fromDay, toDay, onConfirm, onCancel }: Props) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="text-ink-900 text-[16px] font-semibold">날짜를 줄이시겠어요?</p>
      <p className="text-ink-700 text-[14px]">
        Day {fromDay}~{toDay}의 일정은 마지막 Day로 이동돼요
      </p>
      <div className="flex gap-3">
        <Button variant="ghost" fullWidth onClick={onCancel}>
          취소
        </Button>
        <Button variant="primary" fullWidth onClick={onConfirm}>
          확인
        </Button>
      </div>
    </div>
  );
}
