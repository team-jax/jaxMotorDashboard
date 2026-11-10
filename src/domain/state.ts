import type { Joint, Motor, RobotModel } from "./types";
export const SERVO_NAMES = [
  "F1_1",
  "F1_2",
  "F2_1",
  "F2_2",
  "F3_1",
  "F3_2",
  "F_ROT",
  "W_X",
  "W_YAW",
  "W_PITCH",
];
export const degrees = (rad: number) => (rad * 180) / Math.PI;
export const radians = (deg: number) => (deg * Math.PI) / 180;
export const round = (n: number) => Math.round(n * 10) / 10;
function motor(
  fields: Pick<Motor, "name" | "type" | "id" | "current"> & Partial<Motor>,
): Motor {
  return {
    draft: fields.current ?? 0,
    sent: null,
    joint: "",
    min: -15,
    max: 15,
    status: "idle",
    scenario: "normal",
    error: "",
    speed: 0,
    angularVelocity: 0,
    amps: 0,
    temp: 26,
    history: [],
    motion: null,
    ...fields,
  };
}
export function createMotors(): Motor[] {
  return [
    ...Array.from({ length: 4 }, (_, i) =>
      motor({
        name: `AK45-${i + 1}`,
        type: "ak",
        id: i + 1,
        current: [10.2, -5.1, 0, 0][i],
      }),
    ),
    ...SERVO_NAMES.map((name, id) =>
      motor({ name, type: "servo", id, current: null }),
    ),
  ];
}
export function limitsFor(joint?: Joint | null) {
  return joint?.limit
    ? {
        min: Math.ceil(degrees(joint.limit.lower) * 10 - 0.001) / 10,
        max: Math.floor(degrees(joint.limit.upper) * 10 + 0.001) / 10,
      }
    : { min: -15, max: 15 };
}
export function inRange(
  m: Pick<Motor, "min" | "max">,
  value: unknown,
): boolean {
  return (
    (typeof value === "number" ||
      (typeof value === "string" && value.trim() !== "")) &&
    Number.isFinite(Number(value)) &&
    Number(value) >= m.min &&
    Number(value) <= m.max
  );
}
export const clamp = (m: Pick<Motor, "min" | "max">, n: number) =>
  round(Math.min(m.max, Math.max(m.min, n)));
export const canEdit = (m: Motor, stopped: boolean) =>
  !stopped && m.scenario !== "offline" && m.scenario !== "error";
export const canSend = (m: Motor, stopped: boolean) =>
  !!m.joint && canEdit(m, stopped);
export function send(
  m: Motor,
  stopped: boolean,
): { ok: boolean; message: string } {
  if (!m.joint)
    return { ok: false, message: "먼저 모터에 대응하는 3D 관절을 연결하세요." };
  if (!canSend(m, stopped))
    return {
      ok: false,
      message: stopped
        ? "긴급 정지 중에는 전송할 수 없습니다."
        : m.scenario === "offline"
          ? "모터 연결이 끊겼습니다."
          : "모터 오류를 해제한 뒤 다시 시도하세요.",
    };
  if (!inRange(m, m.draft))
    return { ok: false, message: "목표 각도가 허용 범위를 벗어났습니다." };
  if (m.scenario === "failure") {
    m.error = "명령 전송 실패";
    return { ok: false, message: `${m.name} 명령 전송에 실패했습니다.` };
  }
  m.error = "";
  m.sent = round(m.draft);
  m.motion =
    m.current === null
      ? null
      : {
          from: m.current,
          to: m.sent,
          elapsed: 0,
          duration: Math.max(0.35, (Math.abs(m.sent - m.current) * 1.875) / 18),
        };
  m.status =
    m.type === "servo"
      ? "sent"
      : Math.abs((m.current ?? 0) - m.sent) < 1e-9
        ? "reached"
        : "moving";
  return {
    ok: true,
    message:
      m.type === "servo"
        ? `${m.name} 목표 ${m.sent.toFixed(1)}° 전송 완료 · 실제 위치는 미확인입니다.`
        : `${m.name} → ${m.sent.toFixed(1)}° 모의 명령을 전송했습니다.`,
  };
}
// Quintic easing: zero velocity and acceleration at both ends. Only UI values are rounded.
export function tickMotor(
  m: Motor,
  dt: number,
  stopped: boolean,
  speedScale = 1,
): boolean {
  const rate = Number.isFinite(speedScale)
    ? Math.min(2, Math.max(0.1, speedScale))
    : 1;
  let reached = false;
  m.angularVelocity = 0;
  if (
    !stopped &&
    m.scenario === "normal" &&
    m.status === "moving" &&
    m.motion
  ) {
    const motion = m.motion;
    motion.elapsed = Math.min(
      motion.duration,
      motion.elapsed + Math.max(0, dt) * rate,
    );
    const t = motion.elapsed / motion.duration,
      eased = t * t * t * (10 + t * (-15 + 6 * t));
    m.current = motion.from + (motion.to - motion.from) * eased;
    m.angularVelocity =
      (((motion.to - motion.from) * 30 * t * t * (1 - t) * (1 - t)) /
        motion.duration) *
      rate;
    if (t >= 1) {
      m.current = motion.to;
      m.status = "reached";
      m.motion = null;
      m.angularVelocity = 0;
      reached = true;
    }
  }
  // Synthetic ERPM for the AK45 demo, never interpreted as hardware feedback.
  m.speed = m.angularVelocity ? (m.angularVelocity / 18) * 420 : 0;
  m.amps = m.speed ? 1.8 : 0.12;
  m.temp += m.speed ? dt * 0.04 : -(m.temp - 26) * dt * 0.015;
  return reached;
}
export function statusOf(m: Motor, stopped: boolean): string {
  if (stopped) return "긴급 정지";
  if (m.scenario === "offline") return "연결 끊김";
  if (m.scenario === "error") return "모터 오류";
  if (m.error) return m.error;
  return {
    idle: "대기 중",
    moving: "이동 중",
    reached: "이동 완료",
    sent: "전송 완료 · 위치 미확인",
  }[m.status];
}
export function createJointControls(
  model: RobotModel,
  labels: Record<string, string> = {},
): Motor[] {
  return model.joints
    .filter((j) => j.type === "revolute")
    .map((joint, id) => {
      const limits = limitsFor(joint),
        initial = Math.max(limits.min, Math.min(limits.max, 0));
      return motor({
        name: labels[joint.name] ?? joint.child,
        type: "model",
        id,
        joint: joint.name,
        current: initial,
        draft: initial,
        ...limits,
      });
    });
}
