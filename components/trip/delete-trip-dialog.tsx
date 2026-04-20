import { ConfirmDialog } from "@/components/ui/dialog";

type Props = {
  open: boolean;
  tripTitle: string;
  isShared: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function DeleteTripDialog({ open, tripTitle, isShared, onConfirm, onCancel }: Props) {
  return (
    <ConfirmDialog
      open={open}
      onClose={onCancel}
      title={`'${tripTitle}'을(를) 삭제하시겠어요?`}
      description={
        <>
          일정·경비·기록이 모두 함께 사라집니다.
          {isShared && (
            <span className="text-error mt-1 block">파트너의 데이터도 함께 삭제됩니다.</span>
          )}
        </>
      }
      primaryLabel="삭제"
      onPrimary={onConfirm}
      secondaryLabel="취소"
      onSecondary={onCancel}
      destructive
    />
  );
}
