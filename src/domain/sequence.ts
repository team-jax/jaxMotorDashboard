import { inRange, send, canSend } from "./state";
import type { Motor, SequenceStep, SequenceState } from "./types";

export function validateSteps(steps: SequenceStep[], controls: Motor[]) {
  if (!Array.isArray(steps) || !steps.length || steps.length > 100)
    throw Error("단계를 1~100개 설정하세요.");
  if (!controls.length) throw Error("URDF 모델을 먼저 불러와야 합니다.");
  for (const [index, step] of steps.entries()) {
    if (
      !step ||
      typeof step.name !== "string" ||
      !Number.isFinite(step.speed) ||
      step.speed < 10 ||
      step.speed > 200 ||
      !Number.isFinite(step.wait) ||
      step.wait < 0 ||
      step.wait > 60
    )
      throw Error(
        `${index + 1}단계의 속도(10~200%)와 대기 시간(0~60초)을 확인하세요.`,
      );
    if (!step.angles || Object.keys(step.angles).length !== controls.length)
      throw Error(`${index + 1}단계의 관절 구성이 현재 URDF와 다릅니다.`);
    for (const m of controls)
      if (
        typeof step.angles[m.joint] !== "number" ||
        !inRange(m, step.angles[m.joint])
      )
        throw Error(
          `${index + 1}단계: ${m.name}의 각도가 허용 범위를 벗어났습니다.`,
        );
  }
  return true;
}
export class SequencePlayer {
  state: SequenceState = "idle";
  phase: "" | "moving" | "waiting" = "";
  index = -1;
  remaining = 0;
  repeat = false;
  steps: SequenceStep[] = [];
  reason = "";
  constructor(
    public controls: Motor[],
    public onStep: (step: SequenceStep, index: number) => void = () => {},
  ) {
    this.controls = controls;
    this.onStep = onStep;
    this.state = "idle";
    this.phase = "";
    this.index = -1;
    this.remaining = 0;
    this.repeat = false;
    this.steps = [];
    this.reason = "";
  }
  get busy() {
    return this.state === "playing" || this.state === "paused";
  }
  start(steps: SequenceStep[], repeat = false) {
    if (this.busy) throw Error("이미 시퀀스를 실행 중입니다.");
    validateSteps(steps, this.controls);
    if (
      this.controls.some((m) => !canSend(m, false) || m.scenario === "failure")
    )
      throw Error("오류 또는 연결 끊김 상태의 관절을 먼저 복구하세요.");
    this.steps = structuredClone(steps);
    this.repeat = repeat;
    this.reason = "";
    this.state = "playing";
    this.index = 0;
    this.beginStep();
  }
  beginStep() {
    const step = this.steps[this.index];
    if (
      this.controls.some((m) => !canSend(m, false) || m.scenario === "failure")
    ) {
      this.stop("관절 오류로 중지됨");
      return;
    }
    for (const m of this.controls) m.draft = step.angles[m.joint];
    for (const m of this.controls) {
      const result = send(m, false);
      if (!result.ok) {
        this.stop(result.message);
        return;
      }
    }
    this.phase = "moving";
    this.remaining = step.wait;
    this.onStep(step, this.index);
  }
  update(dt: number) {
    if (this.state !== "playing") return;
    if (this.controls.some((m) => !canSend(m, false) || m.error)) {
      this.stop("관절 오류로 중지됨");
      return;
    }
    if (this.phase === "moving") {
      if (this.controls.every((m) => m.status === "reached"))
        this.phase = "waiting";
      return;
    }
    this.remaining = Math.max(0, this.remaining - Math.max(0, dt));
    if (this.remaining > 1e-9) return;
    if (this.index + 1 < this.steps.length) {
      this.index++;
      this.beginStep();
    } else if (this.repeat) {
      this.index = 0;
      this.beginStep();
    } else {
      this.state = "completed";
      this.phase = "";
    }
  }
  pause() {
    if (this.state === "playing") this.state = "paused";
  }
  resume() {
    if (this.state === "paused") this.state = "playing";
  }
  stop(reason = "사용자가 중지함") {
    for (const m of this.controls) {
      m.status = "idle";
      m.motion = null;
      m.angularVelocity = 0;
      m.speed = 0;
    }
    this.state = "stopped";
    this.phase = "";
    this.reason = reason;
  }
}
