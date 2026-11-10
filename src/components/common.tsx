import { useEffect, useRef, type ReactNode } from "react";
export function PanelTitle({
  children,
  extra,
}: {
  children: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <div className="panel-title">
      <h2>{children}</h2>
      {extra}
    </div>
  );
}
export function Dialog({
  children,
  title,
  onClose,
}: {
  children: ReactNode;
  title: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog ref={ref} onCancel={onClose} onClose={onClose}>
      <div className="dialog-heading">
        <h2>{title}</h2>
        <button type="button" aria-label={title + " 닫기"} onClick={onClose}>
          ✕
        </button>
      </div>
      {children}
    </dialog>
  );
}
export async function toggleFullscreen(
  element: HTMLElement | null,
  onError: (message: string) => void,
) {
  if (!element) return;
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await element.requestFullscreen();
  } catch {
    onError("이 브라우저에서는 전체 화면을 사용할 수 없습니다.");
  }
}
