import { useState } from "react";
import { useDashboard } from "../hooks/useDashboard";
import type { SequenceStep } from "../domain/types";
import { Dialog, PanelTitle } from "./common";
function StepEditor({
  index,
  onClose,
}: {
  index: number;
  onClose: () => void;
}) {
  const c = useDashboard(),
    step = c.steps[index];
  const [name, setName] = useState(step.name),
    [speed, setSpeed] = useState(String(step.speed)),
    [wait, setWait] = useState(String(step.wait)),
    [error, setError] = useState("");
  const [angles, setAngles] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(step.angles).map(([key, value]) => [key, String(value)]),
    ),
  );
  function save() {
    try {
      if (
        !speed.trim() ||
        !wait.trim() ||
        Object.values(angles).some((value) => !value.trim())
      )
        throw Error("모든 각도와 속도, 대기 시간을 입력하세요.");
      const next: SequenceStep = {
        name,
        speed: Number(speed),
        wait: Number(wait),
        angles: Object.fromEntries(
          Object.entries(angles).map(([key, value]) => [key, Number(value)]),
        ),
      };
      c.saveStep(index, next);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  return (
    <Dialog title="시퀀스 단계 편집" onClose={onClose}>
      <div className="sequence-edit-settings">
        <label>
          단계 이름
          <input
            id="sequence-step-name"
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          이동 속도 (%)
          <input
            type="number"
            min="10"
            max="200"
            value={speed}
            onChange={(e) => setSpeed(e.target.value)}
          />
        </label>
        <label>
          도착 후 대기 (초)
          <input
            type="number"
            min="0"
            max="60"
            step=".1"
            value={wait}
            onChange={(e) => setWait(e.target.value)}
          />
        </label>
      </div>
      <div id="sequence-angle-fields">
        {c.jointControls.map((m) => (
          <label key={m.joint} className="batch-field">
            <span>
              {m.name}
              <small>
                {m.min.toFixed(1)}° ~ {m.max.toFixed(1)}°
              </small>
            </span>
            <input
              type="number"
              min={m.min}
              max={m.max}
              step=".1"
              value={angles[m.joint] ?? ""}
              onChange={(e) =>
                setAngles((a) => ({ ...a, [m.joint]: e.target.value }))
              }
              aria-label={m.name + " 단계 목표 각도"}
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
        <button className="primary" onClick={save} disabled={c.locked}>
          단계 저장
        </button>
      </div>
    </Dialog>
  );
}
export function SequencePanel() {
  const c = useDashboard(),
    p = c.player;
  const [editing, setEditing] = useState<number | null>(null);
  const unavailable = c.stopped || !c.model;
  return (
    <section className="panel sequence-panel">
      <PanelTitle
        extra={
          <>
            <span className="panel-subtitle">
              URDF 모델 전용 · 하드웨어 미전송
            </span>
            <button
              id="sequence-add"
              className="text-button"
              disabled={unavailable || c.locked || c.steps.length >= 100}
              onClick={() => c.captureStep()}
            >
              ＋ 현재 목표 자세 추가
            </button>
          </>
        }
      >
        동작 시퀀스
      </PanelTitle>
      <div className="sequence-toolbar">
        <button
          id="sequence-play"
          className="primary"
          disabled={unavailable || !c.steps.length || p.state === "playing"}
          onClick={() => c.playSequence()}
        >
          {p.state === "paused" ? "▶ 계속 재생" : "▶ 처음부터 재생"}
        </button>
        <button
          id="sequence-pause"
          disabled={p.state !== "playing"}
          onClick={() => c.pauseSequence()}
        >
          Ⅱ 일시정지
        </button>
        <button
          id="sequence-stop"
          disabled={!p.busy}
          onClick={() => c.stopSequence()}
        >
          ■ 중지
        </button>
        <label>
          <input
            id="sequence-repeat"
            type="checkbox"
            checked={c.repeat}
            disabled={unavailable || c.locked}
            onChange={(e) => c.setRepeat(e.target.checked)}
          />
          반복 재생
        </label>
        <span id="sequence-status" role="status">
          {c.sequenceStatus}
        </span>
      </div>
      <progress
        id="sequence-progress"
        max={Math.max(1, c.steps.length)}
        value={
          p.state === "completed"
            ? c.steps.length
            : Math.max(0, p.index + (p.phase === "waiting" ? 1 : 0))
        }
        aria-label="시퀀스 진행률"
      />
      {c.sequenceError && (
        <p id="sequence-error" className="input-error" role="alert">
          {c.sequenceError}
        </p>
      )}
      <div id="sequence-steps">
        {!c.steps.length && (
          <p className="sequence-empty">
            목표 각도를 설정하고 “현재 목표 자세 추가”를 누르세요. 단계를 편집해
            각도·속도·도착 후 대기 시간을 정할 수 있습니다.
          </p>
        )}
        {c.steps.map((step, index) => (
          <article
            key={index}
            className={`sequence-step ${p.busy && p.index === index ? "active" : ""}`}
          >
            <span className="sequence-number">{index + 1}</span>
            <div className="sequence-step-detail">
              <strong>{step.name}</strong>
              <small>
                {Object.keys(step.angles).length}개 관절 · 속도 {step.speed}% ·
                도착 후 {step.wait}초 대기
              </small>
            </div>
            <div className="sequence-step-actions">
              <button
                aria-label={`${index + 1}단계 미리보기`}
                disabled={unavailable || c.locked}
                onClick={() => c.previewStep(index)}
              >
                미리보기
              </button>
              <button
                aria-label={`${index + 1}단계 편집`}
                disabled={unavailable || c.locked}
                onClick={() => setEditing(index)}
              >
                편집
              </button>
              <button
                aria-label={`${index + 1}단계 위로 이동`}
                disabled={unavailable || c.locked || index === 0}
                onClick={() => c.moveStep(index, -1)}
              >
                ↑
              </button>
              <button
                aria-label={`${index + 1}단계 아래로 이동`}
                disabled={
                  unavailable || c.locked || index === c.steps.length - 1
                }
                onClick={() => c.moveStep(index, 1)}
              >
                ↓
              </button>
              <button
                aria-label={`${index + 1}단계 복제`}
                disabled={unavailable || c.locked || c.steps.length >= 100}
                onClick={() => c.duplicateStep(index)}
              >
                복제
              </button>
              <button
                aria-label={`${index + 1}단계 삭제`}
                disabled={unavailable || c.locked}
                onClick={() => c.deleteStep(index)}
              >
                삭제
              </button>
            </div>
          </article>
        ))}
      </div>
      <p className="sequence-note">
        모든 관절이 도착한 뒤 지정한 시간만큼 기다립니다. 일시정지는 현재 자세를
        유지합니다. 중지·긴급 정지 후에는 처음부터 다시 재생합니다. 설정은 현재
        브라우저에 자동 저장됩니다.
      </p>
      {editing !== null && (
        <StepEditor index={editing} onClose={() => setEditing(null)} />
      )}
    </section>
  );
}
