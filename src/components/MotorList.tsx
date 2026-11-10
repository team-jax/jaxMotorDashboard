import { useState } from "react";
import { useDashboard } from "../hooks/useDashboard";
import { fmt } from "../domain/labels";
import type { Motor } from "../domain/types";
export function MotorList({ onBatch }: { onBatch: () => void }) {
  const c = useDashboard();
  const [search, setSearch] = useState("");
  const [groups, setGroups] = useState<Record<Motor["type"], boolean>>({
    model: true,
    ak: true,
    servo: true,
  });
  const query = search.trim().toLowerCase(),
    visible = c.controls.filter((m) =>
      `${m.name} ${m.id}`.toLowerCase().includes(query),
    );
  return (
    <aside className="panel motor-panel">
      <div className="panel-title">
        <h1 id="list-title">
          {c.source === "joints" ? "URDF 관절" : "모터 목록"}
        </h1>
        <span className="counter">{c.controls.length}</span>
      </div>
      <div className="source-tabs segmented" aria-label="제어 대상">
        {(["joints", "motors"] as const).map((source) => (
          <button
            key={source}
            id={source === "joints" ? "joint-source" : "motor-source"}
            disabled={c.locked || !c.model}
            className={c.source === source ? "active" : ""}
            aria-pressed={c.source === source}
            onClick={() => {
              setSearch("");
              c.setSource(source);
            }}
          >
            {source === "joints" ? "URDF 관절" : "모터 설정"}
          </button>
        ))}
      </div>
      <div className="search-wrap">
        <input
          type="search"
          id="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={
            c.source === "joints" ? "관절 이름 검색" : "모터 이름 또는 ID 검색"
          }
          aria-label="관절 또는 모터 검색"
        />
      </div>
      <div className="list-scroll" id="motor-list">
        {(["model", "ak", "servo"] as const).map((type) => {
          const items = visible.filter((m) => m.type === type);
          if (!items.length) return null;
          return (
            <details
              className="motor-group"
              key={type}
              open={!!query || groups[type]}
              onToggle={(e) => {
                const open = e.currentTarget.open;
                if (!query && groups[type] !== open)
                  setGroups((g) => ({ ...g, [type]: open }));
              }}
            >
              <summary>
                {type === "model"
                  ? "URDF 회전 관절"
                  : type === "ak"
                    ? "AK45 모터"
                    : "STM32 서보"}
                <span>{items.length}</span>
              </summary>
              <div className="group-items">
                {items.map((m) => {
                  const active = c.key(c.selected) === c.key(m),
                    error = !!m.error || m.scenario === "error",
                    offline = m.scenario === "offline";
                  return (
                    <button
                      key={c.key(m)}
                      className={`motor-item ${active ? "active" : ""} ${error ? "error" : ""} ${offline ? "offline" : ""}`}
                      aria-pressed={active}
                      aria-label={`${m.name}, ${offline ? "연결 끊김" : error ? "오류" : "연결됨"}, ${m.current === null ? "실제 각도 피드백 없음" : "현재 " + fmt(m.current)}`}
                      onClick={() => c.select(c.key(m))}
                    >
                      <i
                        className="dot"
                        style={{
                          background: offline
                            ? "#64748b"
                            : error
                              ? "#fb7185"
                              : "#4ade80",
                        }}
                      />
                      <span className="motor-name">
                        {m.name}
                        <small>
                          {m.type === "model" ? "URDF" : "ID " + m.id} ·{" "}
                          {offline
                            ? "연결 끊김"
                            : m.type === "model"
                              ? "모델 직접 제어"
                              : m.joint
                                ? "관절 연결됨"
                                : "관절 미연결"}
                        </small>
                      </span>
                      <span className="motor-angle">
                        {m.error ||
                          (error
                            ? "모터 오류"
                            : m.current === null
                              ? "피드백 없음"
                              : fmt(m.current))}
                      </span>
                    </button>
                  );
                })}
              </div>
            </details>
          );
        })}
        {!visible.length && (
          <p className="empty-list">
            {c.model ? "검색 결과가 없습니다." : "모델을 불러오는 중…"}
          </p>
        )}
      </div>
      <div className="sidebar-bottom">
        <span className="dot" />
        <span id="mapping-count">
          {c.source === "joints"
            ? `URDF 관절 ${c.jointControls.length}개 · 바로 조절 가능`
            : `관절 연결 ${c.hardwareMotors.filter((m) => m.joint).length} / 14`}
        </span>
        <button
          id="batch-open"
          className="text-button"
          disabled={c.locked || !c.model}
          onClick={onBatch}
        >
          {c.source === "joints" ? "여러 관절 설정 ↗" : "여러 모터 설정 ↗"}
        </button>
      </div>
    </aside>
  );
}
