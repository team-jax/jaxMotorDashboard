import { useEffect, useMemo, useRef, useState } from "react";
import { useDashboard } from "../hooks/useDashboard";
import { chartTypes, chartConfig, type ChartKey } from "../domain/charts";
import type { Motor, Sample } from "../domain/types";
import { fmt } from "../domain/labels";
import { statusOf, canSend } from "../domain/state";
import { PanelTitle, toggleFullscreen } from "./common";
function Chart({
  type,
  motor,
}: {
  type: (typeof chartTypes)[number];
  motor: Motor;
}) {
  const c = useDashboard();
  const config = chartConfig(type, motor);
  const card = useRef<HTMLElement>(null),
    svg = useRef<SVGSVGElement>(null);
  const [windowSeconds, setWindow] = useState(30),
    [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (!config.available) return;
      e.preventDefault();
      setWindow((value) =>
        Math.min(60, Math.max(3, value * (e.deltaY > 0 ? 1.25 : 0.8))),
      );
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [config.available]);
  const end = motor.history.at(-1)?.t ?? 0,
    data = motor.history.filter((p) => p.t >= end - windowSeconds);
  const values = data
    .flatMap((p) =>
      type.key === "position"
        ? [p.position, p.target ?? p.position]
        : [p[config.key]],
    )
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  const rawMin = values.length ? Math.min(...values) : 0,
    rawMax = values.length ? Math.max(...values) : 1,
    padding = Math.max(
      (rawMax - rawMin) * 0.15,
      type.key === "temp" ? 0.5 : type.key === "amps" ? 0.1 : 1,
    ),
    min = rawMin - padding,
    max = rawMax + padding;
  const x = (t: number) =>
      36 + ((t - (end - windowSeconds)) / windowSeconds) * 274,
    y = (value: number) => 107 - ((value - min) / (max - min)) * 94;
  function paths(key: typeof config.key | "target") {
    const segments: string[] = [];
    let points: string[] = [];
    for (const p of data) {
      const value = p[key];
      if (value === null || !Number.isFinite(value)) {
        if (points.length) segments.push(points.join(" "));
        points = [];
      } else points.push(`${x(p.t).toFixed(2)},${y(value).toFixed(2)}`);
    }
    if (points.length) segments.push(points.join(" "));
    return segments;
  }
  let sample: Sample | undefined;
  if (hover !== null && data.length) {
    const time = end - windowSeconds + hover * windowSeconds;
    sample = data.reduce((a, b) =>
      Math.abs(b.t - time) < Math.abs(a.t - time) ? b : a,
    );
  }
  return (
    <section ref={card} className="chart-card" id={`chart-${type.key}`}>
      <div className="chart-title">
        <strong>{type.name}</strong>
        <span className="chart-unit">{config.unit}</span>
        <button
          aria-label={`${type.name} 그래프 확대 초기화`}
          onClick={() => setWindow(30)}
        >
          ↺
        </button>
        <button
          aria-label={`${type.name} 그래프 전체 화면`}
          onClick={() =>
            void toggleFullscreen(card.current, (message) =>
              c.toast(message, "warning"),
            )
          }
        >
          ⛶
        </button>
      </div>
      <div className="chart-container">
        <svg
          ref={svg}
          role="img"
          aria-label={`${type.name} 시간 그래프`}
          viewBox="0 0 320 135"
          preserveAspectRatio="none"
          onPointerMove={(e) => {
            if (!config.available) return;
            const rect = e.currentTarget.getBoundingClientRect();
            setHover(
              Math.max(
                0,
                Math.min(
                  1,
                  (((e.clientX - rect.left) / rect.width) * 320 - 36) / 274,
                ),
              ),
            );
          }}
          onPointerLeave={() => setHover(null)}
        >
          {!config.available ? (
            <>
              <text
                x="160"
                y="61"
                fill="#b8c5db"
                fontSize="13"
                textAnchor="middle"
              >
                센서 데이터 없음
              </text>
              <text
                x="160"
                y="84"
                fill="#7f90ab"
                fontSize="9"
                textAnchor="middle"
              >
                URDF 모델에는 이 측정값이 포함되지 않습니다
              </text>
            </>
          ) : (
            <>
              {[0, 1, 2].map((i) => {
                const value = min + ((max - min) * i) / 2;
                return (
                  <g key={i}>
                    <line
                      x1="36"
                      x2="310"
                      y1={y(value)}
                      y2={y(value)}
                      stroke="#253147"
                      strokeWidth=".8"
                    />
                    <text
                      x="30"
                      y={y(value) + 3}
                      fill="#73849e"
                      fontSize="8"
                      textAnchor="end"
                    >
                      {value.toFixed(1)}
                    </text>
                    <text
                      x={36 + i * 137}
                      y="127"
                      fill="#73849e"
                      fontSize="8"
                      textAnchor={
                        i === 0 ? "start" : i === 2 ? "end" : "middle"
                      }
                    >
                      {i === 2
                        ? "현재"
                        : `−${Math.round(windowSeconds * (1 - i / 2))}초`}
                    </text>
                  </g>
                );
              })}
              {paths(config.key).map((points, i) => (
                <polyline
                  key={i}
                  points={points}
                  fill="none"
                  stroke={type.color}
                  strokeWidth="1.7"
                />
              ))}
              {type.key === "position" &&
                paths("target").map((points, i) => (
                  <polyline
                    key={`target-${i}`}
                    points={points}
                    fill="none"
                    stroke="#5ea4ff"
                    strokeDasharray="4 4"
                    strokeWidth="1.7"
                  />
                ))}
              {sample && (
                <line
                  x1={x(sample.t)}
                  x2={x(sample.t)}
                  y1="13"
                  y2="107"
                  stroke="#7890b2"
                  strokeDasharray="2 3"
                />
              )}
            </>
          )}
        </svg>
        {sample && config.available && (
          <div className="chart-tooltip">
            {(end - sample.t).toFixed(1)}초 전 ·{" "}
            {Number(sample[config.key]).toFixed(1)} {config.unit}
            {type.key === "position" && sample.target !== null
              ? ` / 목표 ${fmt(sample.target)}`
              : ""}
          </div>
        )}
      </div>
      <div className="chart-tip">
        {!config.available
          ? "실제 센서 피드백이 연결되면 표시됩니다"
          : `최근 ${Math.round(windowSeconds)}초 · ${type.key === "position" ? "실선 현재 / 점선 전송 목표" : motor.type === "model" ? "모델 계산값 · 휠 확대" : "휠 확대 · 마우스로 값 확인"}`}
      </div>
    </section>
  );
}
export function Telemetry() {
  const c = useDashboard(),
    m = c.selected;
  const [shown, setShown] = useState<Record<ChartKey, boolean>>({
      position: true,
      speed: true,
      amps: true,
      temp: true,
    }),
    [epoch, setEpoch] = useState(0);
  const values = useMemo(
    () => [
      ["현재 각도", m.current === null ? "—" : m.current.toFixed(1), "°"],
      ["전송 목표", m.sent === null ? "—" : m.sent.toFixed(1), "°"],
      [
        "회전 속도",
        m.type === "model" ? m.angularVelocity.toFixed(1) : m.speed.toFixed(0),
        m.type === "model" ? "°/s" : "ERPM",
      ],
      ["전류", m.type === "model" ? "—" : m.amps.toFixed(2), "A"],
      ["온도", m.type === "model" ? "—" : m.temp.toFixed(1), "°C"],
      [
        "오류 상태",
        m.error ||
          (m.scenario === "error"
            ? "모의 오류 E01"
            : m.scenario === "offline"
              ? "연결 끊김"
              : "정상"),
        "",
      ],
    ],
    [
      m.current,
      m.sent,
      m.angularVelocity,
      m.speed,
      m.amps,
      m.temp,
      m.type,
      m.error,
      m.scenario,
    ],
  );
  return (
    <section className="panel telemetry-panel">
      <PanelTitle
        extra={
          <>
            <span className="panel-subtitle" id="telemetry-source">
              {m.type === "model"
                ? "각도·속도: 모델 계산 / 전류·온도: 센서 데이터 없음"
                : m.type === "servo"
                  ? "목표값 / PWM 설정 정보"
                  : "모의 피드백 · 최근 30초"}
            </span>
            {m.type !== "servo" && (
              <button
                className="text-button"
                id="reset-charts"
                onClick={() => {
                  c.resetCharts();
                  setEpoch((n) => n + 1);
                }}
              >
                그래프 초기화
              </button>
            )}
          </>
        }
      >
        모터 상태 모니터링 <span id="telemetry-name">{m.name}</span>
      </PanelTitle>
      {m.type === "servo" ? (
        <div id="servo-telemetry" className="servo-telemetry">
          <div>
            <span>모터 ID</span>
            <strong>{m.id}</strong>
          </div>
          <div>
            <span>설정한 목표 각도</span>
            <strong>{fmt(m.draft)}</strong>
          </div>
          <div>
            <span>PWM 펄스폭</span>
            <strong>정보 없음</strong>
            <small>PWM 변환 규칙 미제공</small>
          </div>
          <div>
            <span>제어 상태</span>
            <strong>
              {canSend(m, c.locked) ? "모의 전송 가능" : statusOf(m, c.stopped)}
            </strong>
          </div>
          <p>
            STM32 서보는 실제 각도·속도·전류·온도 피드백이 제공되지 않습니다.
            목표 각도는 실제 도달 위치를 의미하지 않습니다.
          </p>
        </div>
      ) : (
        <div id="ak-telemetry">
          <div className="telemetry-values">
            {values.map(([label, value, unit]) => (
              <div className="telemetry-value" key={label}>
                <span>{label}</span>
                <strong>
                  {m.scenario === "offline" && label !== "오류 상태"
                    ? "—"
                    : value}
                  <small>{value === "—" ? "" : unit}</small>
                </strong>
              </div>
            ))}
          </div>
          <div
            className="chart-options"
            id="chart-options"
            aria-label="그래프 표시 선택"
          >
            {chartTypes.map((type) => (
              <label key={type.key}>
                <input
                  type="checkbox"
                  checked={shown[type.key]}
                  onChange={(e) =>
                    setShown((s) => ({ ...s, [type.key]: e.target.checked }))
                  }
                />
                {type.name}
              </label>
            ))}
          </div>
          <div className="charts" id="charts">
            {chartTypes
              .filter((type) => shown[type.key])
              .map((type) => (
                <Chart key={`${type.key}-${epoch}`} type={type} motor={m} />
              ))}
          </div>
        </div>
      )}
    </section>
  );
}
