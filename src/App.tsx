import { useState } from "react";
import { DashboardController } from "./domain/dashboard";
import {
  DashboardContext,
  useDashboard,
  useDashboardLifecycle,
} from "./hooks/useDashboard";
import { MotorList } from "./components/MotorList";
import { ControlPanel } from "./components/ControlPanel";
import { DigitalTwin } from "./components/DigitalTwin";
import { SequencePanel } from "./components/SequencePanel";
import { Telemetry } from "./components/Telemetry";
import { BatchDialog } from "./components/BatchDialog";
function Dashboard() {
  const c = useDashboard();
  const [batch, setBatch] = useState(false);
  return (
    <>
      <header className="app-header">
        <a className="brand" href="./">
          JAX<span> / </span>
        </a>
        <div className="product">
          Control Panel<small>로봇 제어 워크스페이스</small>
        </div>
        <div className="header-state">
          <span className="pill amber">● 시뮬레이션</span>
          <span>
            {c.controls.filter((m) => m.scenario !== "offline").length} /{" "}
            {c.controls.length} 모의 연결
          </span>
        </div>
        <button id="stop" className="danger" onClick={() => c.emergencyStop()}>
          ■ 긴급 정지
        </button>
      </header>
      <div className="workspace-bar">
        <span>
          <i className="dot" /> JAX V2{" "}
          <span className="muted">/ 단일 팔 + 그리퍼</span>
        </span>
        <span className="muted">
          하드웨어 미연결 · 모든 명령과 AK45 피드백은 모의 데이터입니다
        </span>
      </div>
      {c.stopped && (
        <div id="emergency" className="emergency" role="alert">
          <div>
            <strong>긴급 정지 중 — 모든 제어가 잠겼습니다</strong>
            <p>
              웹 시뮬레이션 정지입니다. 하드웨어 비상 정지 장치와는 별개입니다.
            </p>
          </div>
          <button id="reset-stop" onClick={() => c.resetStop()}>
            긴급 정지 해제
          </button>
        </div>
      )}
      <main className="workspace">
        <MotorList onBatch={() => setBatch(true)} />
        <DigitalTwin />
        <ControlPanel />
        <SequencePanel />
        <Telemetry />
      </main>
      <footer>
        <span>
          JAX Control Panel <b>v2.0</b> · 프론트엔드 프로토타입
        </span>
        <span>
          모터 14개 · URDF 링크 {c.model?.links.length ?? "—"}개 ·{" "}
          {c.stopped ? "긴급 정지 중" : "모의 제어 준비됨"}
        </span>
      </footer>
      <div id="toasts" aria-live="polite">
        {c.toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            <span>
              {toast.type === "error"
                ? "✕"
                : toast.type === "warning"
                  ? "⚠"
                  : "✓"}
            </span>
            <span>{toast.message}</span>
            <button
              className="toast-close"
              aria-label="알림 닫기"
              onClick={() => c.dismissToast(toast.id)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      {batch && <BatchDialog onClose={() => setBatch(false)} />}
    </>
  );
}
export default function App() {
  const [controller] = useState(() => {
    let storage: Storage | undefined;
    try {
      storage = window.localStorage;
    } catch {
      /* Private browsing may disable storage. */
    }
    return new DashboardController(storage);
  });
  useDashboardLifecycle(controller);
  return (
    <DashboardContext.Provider value={controller}>
      <Dashboard />
    </DashboardContext.Provider>
  );
}
