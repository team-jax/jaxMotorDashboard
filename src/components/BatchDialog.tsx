import { useState } from "react";
import { useDashboard } from "../hooks/useDashboard";
import { Dialog } from "./common";
import { fmt } from "../domain/labels";
import { canEdit, inRange } from "../domain/state";
export function BatchDialog({ onClose }: { onClose: () => void }) {
  const c = useDashboard();
  const [angles, setAngles] = useState<Record<string, string>>(() =>
      Object.fromEntries(c.controls.map((m) => [c.key(m), m.draft.toFixed(1)])),
    ),
    [error, setError] = useState("");
  function apply(transmit: boolean) {
    for (const m of c.controls.filter((m) => canEdit(m, false)))
      if (!inRange(m, angles[c.key(m)])) {
        setError(
          `${m.name}: ${fmt(m.min)} ~ ${fmt(m.max)} 사이의 숫자를 입력하세요.`,
        );
        return;
      }
    if (
      c.applyBatch(
        Object.fromEntries(
          Object.entries(angles).map(([key, value]) => [key, Number(value)]),
        ),
        transmit,
      )
    )
      onClose();
  }
  return (
    <Dialog title="여러 관절의 목표 설정" onClose={onClose}>
      <p>전체 목표 자세를 미리 보거나 모의 명령을 함께 전송합니다.</p>
      <div id="batch-fields">
        {c.controls.map((m) => (
          <label key={c.key(m)} className="batch-field">
            <span>
              {m.name}
              <small>
                {fmt(m.min)} ~ {fmt(m.max)}
                {m.joint ? "" : " · 관절 연결 필요"}
              </small>
            </span>
            <input
              type="number"
              min={m.min}
              max={m.max}
              step=".1"
              value={angles[c.key(m)] ?? ""}
              onChange={(e) =>
                setAngles((a) => ({ ...a, [c.key(m)]: e.target.value }))
              }
              disabled={!canEdit(m, c.locked)}
              aria-label={m.name + " 목표 각도"}
            />
          </label>
        ))}
      </div>
      {error && (
        <p className="input-error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <button
          className="danger"
          onClick={() => {
            onClose();
            c.emergencyStop();
          }}
        >
          ■ 긴급 정지
        </button>
        <button onClick={() => apply(false)} disabled={c.locked}>
          목표 자세에 적용
        </button>
        <button
          className="primary"
          onClick={() => apply(true)}
          disabled={c.locked}
        >
          전체 모의 명령 전송
        </button>
      </div>
    </Dialog>
  );
}
