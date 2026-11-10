import {
  Component,
  Suspense,
  lazy,
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useDashboard } from "../hooks/useDashboard";
import { fmt, jointLabels } from "../domain/labels";
import type { PoseMode } from "../domain/types";
import { PanelTitle, toggleFullscreen } from "./common";
const RobotScene = lazy(() => import("./RobotScene"));
class SceneError extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="loading" role="alert">
        3D 모델을 표시하지 못했습니다. WebGL 지원 여부와 모델 파일을 확인한 뒤
        새로고침하세요. 다른 제어 기능은 계속 사용할 수 있습니다.
      </div>
    ) : (
      this.props.children
    );
  }
}
export function DigitalTwin() {
  const c = useDashboard(),
    m = c.selected;
  const panel = useRef<HTMLElement>(null),
    viewer = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false),
    [resetToken, setReset] = useState(0),
    [hover, setHover] = useState({ text: "", x: 0, y: 0 });
  const onReady = useCallback(() => setReady(true), []);
  const onHover = useCallback((text: string, x: number, y: number) => {
    const rect = viewer.current?.getBoundingClientRect();
    setHover({
      text,
      x: rect
        ? Math.max(10, Math.min(x - rect.left + 12, rect.width - 270))
        : 0,
      y: rect ? Math.min(y - rect.top + 15, rect.height - 60) : 0,
    });
  }, []);
  const pending = c.controls.some(
    (m) => m.joint && Math.abs(m.draft - (m.sent ?? m.current ?? 0)) > 0.05,
  );
  const mapped = c.hardwareMotors.filter((m) => m.joint).length;
  return (
    <section className="panel twin-panel" id="twin-panel" ref={panel}>
      <PanelTitle
        extra={
          <>
            <span className="panel-subtitle">JAXV2_Assembly · URDF</span>
            <button
              className="icon-button"
              id="fullscreen"
              aria-label="3D 뷰어 전체 화면"
              onClick={() =>
                void toggleFullscreen(panel.current, (message) =>
                  c.toast(message, "warning"),
                )
              }
            >
              ⛶
            </button>
          </>
        }
      >
        디지털 트윈
      </PanelTitle>
      <div className="viewer" id="viewer" ref={viewer}>
        <div className="scene-label">
          <span className="pill" id="pose-label">
            {c.poseMode === "actual"
              ? "현재 자세"
              : c.poseMode === "target"
                ? "목표 자세 · 미리보기"
                : "현재 + 목표 자세"}
          </span>
          {pending && c.poseMode !== "actual" && (
            <span className="pill amber" id="preview-state">
              미전송 목표 미리보기
            </span>
          )}
        </div>
        {c.model ? (
          <SceneError>
            <Suspense
              fallback={<div className="loading">3D 뷰어를 준비하는 중…</div>}
            >
              <RobotScene
                model={c.model}
                controller={c}
                resetToken={resetToken}
                onReady={onReady}
                onHover={onHover}
              />
            </Suspense>
            {!ready && (
              <div id="model-loading" className="loading" role="status">
                로봇 모델을 불러오는 중…
              </div>
            )}
          </SceneError>
        ) : (
          <div className="loading" role={c.modelError ? "alert" : "status"}>
            {c.modelError || "URDF 모델을 불러오는 중…"}
          </div>
        )}
        <div className="viewer-info">
          <span className="axis-key">
            <b>X</b>
            <b>Y</b>
            <b>Z</b>
          </span>
          <span>드래그 회전 · 휠 확대 · 우클릭 이동</span>
        </div>
        {hover.text && (
          <div
            className="joint-tooltip"
            style={{ left: hover.x, top: hover.y }}
          >
            {hover.text}
          </div>
        )}
      </div>
      <div
        className={`pose-readout ${!m.joint ? "unmapped" : ""}`}
        id="pose-readout"
      >
        {m.joint ? (
          <>
            {m.type === "model"
              ? m.name
              : `${m.name} → ${jointLabels[m.joint] ?? m.joint}`}{" "}
            · 현재 {m.current === null ? "피드백 없음" : fmt(m.current)} / 목표
            미리보기 {fmt(m.draft)} / 전송 목표 {fmt(m.sent)}
            {c.poseMode === "actual"
              ? " · 현재 자세만 보는 중 (미리보기 숨김)"
              : ""}
          </>
        ) : (
          `${m.name}: 3D 관절 미연결 — 모터 설정에서 대응 관절을 지정하세요.`
        )}
      </div>
      <div className="viewer-toolbar">
        <div className="segmented" id="pose-modes" aria-label="자세 표시 모드">
          {(["actual", "target", "both"] as PoseMode[]).map((mode) => (
            <button
              key={mode}
              data-mode={mode}
              className={c.poseMode === mode ? "active" : ""}
              aria-pressed={c.poseMode === mode}
              onClick={() => c.setPoseMode(mode)}
            >
              {{ actual: "현재", target: "목표", both: "겹쳐 보기" }[mode]}
            </button>
          ))}
        </div>
        <button
          id="reset-view"
          className="subtle"
          onClick={() => setReset((n) => n + 1)}
        >
          시점 초기화
        </button>
        <button
          id="reset-pose"
          className="subtle"
          disabled={c.locked}
          onClick={() => c.resetTarget(true)}
        >
          목표 자세 초기화
        </button>
      </div>
      <div className="legend">
        <span>
          <i className="swatch actual" />
          현재: {c.source === "joints" ? "모델 시뮬레이션" : "AK45 모의 피드백"}
        </span>
        <span>
          <i className="swatch target" />
          목표: 입력값 미리보기
        </span>
      </div>
      <div className="model-notice">
        {c.source === "joints"
          ? "URDF의 관절 이름·회전축·각도 제한을 그대로 사용합니다. 숫자와 슬라이더로 목표 자세를 미리 보고 이동 버튼으로 모델을 움직이세요. 하드웨어에는 전송하지 않습니다."
          : `${mapped}개 관절 연결됨 · 서보와 미연결 관절의 회색 형상은 기준 자세이며 실제 피드백이 아닙니다.`}
      </div>
    </section>
  );
}
