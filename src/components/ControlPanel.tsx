import { useEffect, useState } from "react";
import { useDashboard } from "../hooks/useDashboard";
import { fmt, jointLabels } from "../domain/labels";
import { canEdit, canSend, statusOf } from "../domain/state";
import type { Scenario } from "../domain/types";
import { PanelTitle } from "./common";
export function ControlPanel() {
  const c = useDashboard(),
    m = c.selected;
  const [speedText, setSpeedText] = useState(String(c.speedScale * 100));
  useEffect(
    () => setSpeedText(String(Math.round(c.speedScale * 100))),
    [c.speedScale],
  );
  const speedValue = Number(speedText),
    speedError =
      !speedText.trim() ||
      !Number.isFinite(speedValue) ||
      speedValue < 10 ||
      speedValue > 200;
  const edit = !c.model || !canEdit(m, c.locked),
    offline = m.scenario === "offline",
    error = !!m.error || m.scenario === "error";
  const status =
    c.player.state === "paused" && m.type === "model"
      ? "시퀀스 일시정지"
      : statusOf(m, c.stopped);
  function updateSpeed(text: string) {
    setSpeedText(text);
    const value = Number(text);
    if (text.trim() && Number.isFinite(value) && value >= 10 && value <= 200)
      c.setSpeed(value);
  }
  return (
    <section className="panel control-panel">
      <PanelTitle
        extra={<span className="panel-subtitle">선택 → 각도 설정 → 전송</span>}
      >
        <span id="control-title">
          {m.type === "model" ? "관절 제어" : "모터 제어"}
        </span>
      </PanelTitle>
      <div className="control-scroll">
        <div className="selected-heading">
          <div>
            <span className="eyebrow" id="motor-type">
              {m.type === "model"
                ? "URDF 관절 · 모델 시뮬레이션"
                : m.type === "ak"
                  ? `AK45-36 · 모터 ID ${m.id}`
                  : `STM32 서보 · 모터 ID ${m.id}`}
            </span>
            <h2 id="selected-name">{m.name}</h2>
          </div>
          <span
            id="selected-status"
            className={`pill ${offline ? "" : error ? "red" : "green"}`}
          >
            ● {offline ? "연결 끊김" : error ? "오류" : "연결됨"}
          </span>
        </div>
        {m.type !== "model" && (
          <div className="mapping-field" id="mapping-field">
            <label htmlFor="joint-map">
              3D 관절 연결 <span>직접 지정</span>
            </label>
            <select
              id="joint-map"
              value={m.joint}
              disabled={c.locked || !c.model}
              onChange={(e) => c.setMapping(e.target.value)}
            >
              <option value="">연결 안 됨 · 관절을 직접 지정하세요</option>
              {c.model?.joints
                .filter((j) => j.type === "revolute")
                .map((j) => {
                  const owner = c.hardwareMotors.find(
                    (other) => other !== m && other.joint === j.name,
                  );
                  return (
                    <option key={j.name} value={j.name} disabled={!!owner}>
                      {jointLabels[j.name] ?? j.child}
                      {owner ? " · " + owner.name + " 사용 중" : ""}
                    </option>
                  );
                })}
            </select>
            <small id="mapping-help">
              {m.joint
                ? `URDF: ${m.joint}`
                : "모델에 반영하려면 모터에 대응하는 관절을 선택하세요."}
            </small>
          </div>
        )}
        <div className="current-position">
          <span id="current-label">
            {m.type === "model"
              ? "현재 모델 각도"
              : m.type === "ak"
                ? "현재 각도"
                : "실제 각도"}{" "}
            <small>
              {m.type === "model"
                ? "시뮬레이션"
                : m.type === "ak"
                  ? "모의 피드백"
                  : "피드백 미제공"}
            </small>
          </span>
          <strong id="current-position">
            {m.current === null ? (
              <span>확인할 수 없음</span>
            ) : (
              <>
                {m.current.toFixed(1)}
                <span>°</span>
              </>
            )}
          </strong>
          <p>
            {m.type === "model"
              ? "URDF 기준 모델 각도 · 실제 하드웨어 피드백 아님"
              : m.type === "servo"
                ? "목표값과 실제 도달 위치는 다를 수 있습니다."
                : offline
                  ? "연결 끊김 · 마지막 수신 각도"
                  : "모의 데이터 · 실제 하드웨어 미연결"}
          </p>
        </div>
        <section className="speed-control" aria-label="모델 이동 속도 설정">
          <div className="speed-heading">
            <label htmlFor="speed-input">모델 이동 속도</label>
            <div>
              <input
                id="speed-input"
                type="number"
                min="10"
                max="200"
                step="1"
                value={speedText}
                disabled={c.locked}
                onChange={(e) => updateSpeed(e.target.value)}
                aria-invalid={speedError}
                aria-describedby="speed-help speed-error"
              />
              <span>%</span>
            </div>
          </div>
          <input
            id="speed-slider"
            type="range"
            min="10"
            max="200"
            step="1"
            value={c.speedScale * 100}
            disabled={c.locked}
            onChange={(e) => updateSpeed(e.target.value)}
            aria-label="모델 이동 속도 슬라이더"
            style={{
              background: `linear-gradient(to right,#8183ff ${((c.speedScale * 100 - 10) / 190) * 100}%,#303a51 0)`,
            }}
          />
          <div className="range-labels">
            <span>느리게 10%</span>
            <button
              id="speed-reset"
              type="button"
              disabled={c.locked}
              onClick={() => updateSpeed("100")}
            >
              기본 100%
            </button>
            <span>빠르게 200%</span>
          </div>
          <p id="speed-help">
            전체 관절에 적용 · 이동 중에도 즉시 반영됩니다.
            <br />
            시뮬레이션 속도이며 실제 모터에는 전송하지 않습니다.
          </p>
          {speedError && (
            <p id="speed-error" className="input-error" role="alert">
              10%부터 200%까지 입력하세요. 마지막 속도를 유지합니다.
            </p>
          )}
        </section>
        <form
          id="command-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            c.sendSelected();
          }}
        >
          <div className="target-heading">
            <label htmlFor="target">목표 각도</label>
            <span>0.1°씩 조절</span>
          </div>
          <div className="angle-input">
            <button
              type="button"
              id="minus"
              disabled={edit}
              aria-label="목표 각도 0.1도 감소"
              onClick={() => c.stepTarget(-0.1)}
            >
              −
            </button>
            <div>
              <input
                id="target"
                type="number"
                min={m.min}
                max={m.max}
                step="0.1"
                value={c.targetText}
                onChange={(e) => c.setTarget(e.target.value)}
                onBlur={() => {
                  if (!c.targetError) {
                    c.syncTarget();
                    c.notify();
                  }
                }}
                disabled={edit}
                aria-invalid={!!c.targetError}
                aria-describedby="range-hint input-error"
              />
              <span>°</span>
            </div>
            <button
              id="plus"
              type="button"
              disabled={edit}
              aria-label="목표 각도 0.1도 증가"
              onClick={() => c.stepTarget(0.1)}
            >
              +
            </button>
          </div>
          <input
            id="slider"
            type="range"
            min={m.min}
            max={m.max}
            step="0.1"
            value={m.draft}
            disabled={edit}
            onChange={(e) => c.setTarget(e.target.value)}
            aria-label="목표 각도 조절"
            style={{
              background: `linear-gradient(to right,#8183ff ${((m.draft - m.min) / (m.max - m.min)) * 100}%,#303a51 0)`,
            }}
          />
          <div className="range-labels" id="range-hint">
            {[m.min, (m.min + m.max) / 2, m.max].map((n, i) => (
              <span key={i}>{fmt(n)}</span>
            ))}
          </div>
          <p className="field-help" id="limit-source">
            {m.joint
              ? `URDF 관절 범위 · ${fmt(m.min)} ~ ${fmt(m.max)} (하드웨어 범위 미확인)`
              : "관절 미연결 · 임시 데모 범위 −15.0° ~ +15.0°"}
          </p>
          {c.targetError && (
            <p id="input-error" className="input-error" role="alert">
              {c.targetError}
            </p>
          )}
          <div className="preview-hint">
            {m.joint
              ? "입력한 목표 자세를 파란색 모델로 미리 확인하세요."
              : "각도는 조절할 수 있습니다. 모델에 반영하고 전송하려면 관절을 선택하세요."}
          </div>
          <button
            id="send"
            className="primary send"
            type="submit"
            disabled={!c.model || !canSend(m, c.locked)}
          >
            {!m.joint
              ? "먼저 3D 관절을 연결하세요"
              : m.type === "model"
                ? "모델을 설정한 각도로 이동"
                : "설정한 각도로 이동"}
            <span>↗</span>
          </button>
          <button
            id="reset-target"
            type="button"
            className="reset-target"
            disabled={edit}
            onClick={() => c.resetTarget()}
          >
            {m.type === "model" ? "이 관절" : "이 모터"}의 목표 각도 초기화
          </button>
          <p className="command-note">
            입력만으로는 현재 모델이 움직이지 않습니다.
            <br />
            이동 버튼을 누르면 모의 명령을 전송합니다.
          </p>
        </form>
        <div className="command-summary">
          <span>마지막 전송 목표</span>
          <strong id="last-target">{fmt(m.sent)}</strong>
          <span>동작 상태</span>
          <strong
            id="motion"
            aria-live="polite"
            style={{
              color:
                c.stopped || error
                  ? "#fda4af"
                  : m.status === "reached"
                    ? "#6ee7b7"
                    : undefined,
            }}
          >
            {status}
          </strong>
          <span>
            {m.current === null ? "위치 피드백" : "전송 목표까지 남은 각도"}
          </span>
          <strong id="difference">
            {m.current === null
              ? "제공 안 됨"
              : m.sent === null || offline
                ? "—"
                : fmt(Math.abs(m.sent - m.current))}
          </strong>
        </div>
        <details className="demo-tools">
          <summary>모의 상황 테스트</summary>
          <label htmlFor="scenario">선택한 모터의 상황</label>
          <select
            id="scenario"
            value={m.scenario}
            disabled={c.locked}
            onChange={(e) => c.setScenario(e.target.value as Scenario)}
          >
            <option value="normal">정상 연결</option>
            <option value="offline">연결 끊김</option>
            <option value="error">모터 오류</option>
            <option value="failure">전송 실패</option>
          </select>
          <small>실제 모터에는 영향을 주지 않습니다.</small>
        </details>
      </div>
    </section>
  );
}
