import {
  createMotors,
  createJointControls,
  limitsFor,
  clamp,
  inRange,
  send,
  tickMotor,
  canEdit,
} from "./state";
import { SequencePlayer, validateSteps } from "./sequence";
import { jointLabels } from "./labels";
import type {
  Motor,
  RobotModel,
  SequenceStep,
  Source,
  PoseMode,
  Scenario,
  Toast,
} from "./types";
type StoragePort = Pick<Storage, "getItem" | "setItem">;
const SEQUENCE_KEY = "jax-model-sequence-v1",
  MAPPING_KEY = "jax-joint-mappings-v1";
export class DashboardController {
  model: RobotModel | null = null;
  modelError = "";
  hardwareMotors = createMotors();
  jointControls: Motor[] = [];
  source: Source = "joints";
  selectedKey = "";
  poseMode: PoseMode = "both";
  stopped = false;
  speedScale = 1;
  targetText = "0.0";
  targetError = "";
  steps: SequenceStep[] = [];
  repeat = false;
  sequenceError = "";
  toasts: (Toast & { expires: number })[] = [];
  player: SequencePlayer;
  private revision = 0;
  private listeners = new Set<() => void>();
  private toastId = 0;
  private sampleElapsed = 0;
  constructor(private storage?: StoragePort) {
    this.player = new SequencePlayer([], (step) => {
      this.speedScale = step.speed / 100;
      this.syncTarget();
      this.notify();
    });
    try {
      const saved = JSON.parse(
        storage?.getItem(SEQUENCE_KEY) ?? "null",
      ) as unknown;
      if (
        saved &&
        typeof saved === "object" &&
        "steps" in saved &&
        Array.isArray(saved.steps) &&
        saved.steps.length <= 100
      ) {
        this.steps = saved.steps;
        this.repeat = "repeat" in saved && saved.repeat === true;
      }
    } catch {
      this.sequenceError = "저장된 시퀀스를 읽지 못했습니다. 다시 설정하세요.";
    }
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.revision;
  notify = () => {
    this.revision++;
    this.listeners.forEach((listener) => listener());
  };
  get controls() {
    return this.source === "joints" ? this.jointControls : this.hardwareMotors;
  }
  get selected(): Motor {
    return (
      this.controls.find((m) => this.key(m) === this.selectedKey) ??
      this.controls[0] ??
      this.hardwareMotors[0]
    );
  }
  get locked() {
    return this.stopped || this.player.busy;
  }
  key(m: Motor) {
    return m.type === "model" ? m.joint : m.name;
  }
  syncTarget() {
    this.targetText = this.selected.draft.toFixed(1);
    this.targetError = "";
  }
  toast(message: string, type: Toast["type"] = "success") {
    this.toasts.push({
      id: ++this.toastId,
      message,
      type,
      expires: Date.now() + 5500,
    });
    this.notify();
  }
  dismissToast(id: number) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.notify();
  }
  setModel(model: RobotModel) {
    this.model = model;
    this.modelError = "";
    this.jointControls = createJointControls(model, jointLabels);
    this.player.controls = this.jointControls;
    try {
      const mappings = JSON.parse(
        this.storage?.getItem(MAPPING_KEY) ?? "{}",
      ) as Record<string, unknown>;
      const assigned = new Set<string>();
      for (const m of this.hardwareMotors) {
        const joint = model.joints.find(
          (j) => j.type === "revolute" && j.name === mappings[m.name],
        );
        if (joint && !assigned.has(joint.name)) {
          assigned.add(joint.name);
          m.joint = joint.name;
          Object.assign(m, limitsFor(joint));
          m.draft = clamp(m, m.draft);
          if (m.current !== null) m.current = clamp(m, m.current);
        }
      }
    } catch {
      /* Broken local preferences must not block the robot model. */
    }
    if (this.steps.length) {
      try {
        validateSteps(this.steps, this.jointControls);
      } catch (e) {
        this.steps = [];
        this.sequenceError = `저장된 시퀀스를 복원하지 못했습니다: ${this.message(e)}`;
      }
    }
    this.selectedKey = this.key(this.jointControls[0]);
    this.syncTarget();
    this.notify();
  }
  setModelError(error: unknown) {
    this.modelError = this.message(error);
    this.notify();
  }
  setSource(source: Source) {
    if (this.locked || !this.model) return;
    this.source = source;
    this.selectedKey = this.key(this.controls[0]);
    this.syncTarget();
    this.notify();
  }
  select(key: string) {
    if (!this.controls.some((m) => this.key(m) === key)) return;
    this.selectedKey = key;
    this.syncTarget();
    this.notify();
  }
  setPoseMode(mode: PoseMode) {
    this.poseMode = mode;
    this.notify();
  }
  setTarget(text: string) {
    if (!canEdit(this.selected, this.locked)) return;
    this.targetText = text;
    if (!inRange(this.selected, text)) {
      this.targetError = `${this.selected.min.toFixed(1)}° ~ ${this.selected.max.toFixed(1)}° 사이의 숫자를 입력하세요.`;
    } else {
      this.targetError = "";
      this.selected.draft = Number(text);
    }
    this.notify();
  }
  stepTarget(delta: number) {
    if (!canEdit(this.selected, this.locked)) return;
    this.selected.draft = clamp(
      this.selected,
      (Number(this.targetText) || 0) + delta,
    );
    this.syncTarget();
    this.notify();
  }
  resetTarget(all = false) {
    if (this.locked) return;
    for (const m of all ? this.controls : [this.selected])
      m.draft = clamp(m, m.current ?? m.sent ?? 0);
    this.syncTarget();
    this.notify();
  }
  setSpeed(percent: number) {
    if (
      this.locked ||
      !Number.isFinite(percent) ||
      percent < 10 ||
      percent > 200
    )
      return;
    this.speedScale = percent / 100;
    this.notify();
  }
  sendSelected() {
    if (this.locked) return;
    if (this.targetError || !inRange(this.selected, this.targetText)) {
      this.toast("목표 각도를 확인하세요.", "warning");
      return;
    }
    const result = send(this.selected, this.stopped);
    if (result.ok) {
      this.selected.draft = this.selected.sent ?? this.selected.draft;
      this.syncTarget();
    }
    this.toast(result.message, result.ok ? "success" : "error");
  }
  setMapping(name: string) {
    if (this.locked || this.selected.type === "model" || !this.model) return;
    const m = this.selected,
      joint = this.model.joints.find(
        (j) => j.type === "revolute" && j.name === name,
      );
    if (
      name &&
      (!joint ||
        this.hardwareMotors.some(
          (other) => other !== m && other.joint === name,
        ))
    ) {
      this.toast("이미 연결된 관절이거나 유효하지 않은 관절입니다.", "warning");
      return;
    }
    m.joint = name;
    Object.assign(m, limitsFor(joint));
    m.draft = clamp(m, m.draft);
    if (m.current !== null) m.current = clamp(m, m.current);
    m.sent = null;
    m.status = "idle";
    m.motion = null;
    m.history = [];
    this.save(
      MAPPING_KEY,
      Object.fromEntries(this.hardwareMotors.map((m) => [m.name, m.joint])),
    );
    this.syncTarget();
    this.notify();
  }
  setScenario(scenario: Scenario) {
    if (this.locked) return;
    const m = this.selected;
    m.scenario = scenario;
    m.status = "idle";
    m.motion = null;
    m.angularVelocity = 0;
    m.speed = 0;
    m.error = scenario === "error" ? "모의 모터 오류 E01" : "";
    this.toast(
      scenario === "normal"
        ? `${m.name} 모의 연결을 복구했습니다.`
        : scenario === "offline"
          ? `${m.name} 연결이 끊겼습니다.`
          : scenario === "error"
            ? `${m.name} 오류가 발생했습니다.`
            : "다음 명령이 실패하도록 설정했습니다.",
      scenario === "normal"
        ? "success"
        : scenario === "error"
          ? "error"
          : "warning",
    );
  }
  emergencyStop() {
    if (this.player.busy) this.player.stop("긴급 정지");
    for (const m of [...this.hardwareMotors, ...this.jointControls]) {
      m.status = "idle";
      m.motion = null;
      m.angularVelocity = 0;
      m.speed = 0;
    }
    this.stopped = true;
    this.toast("긴급 정지 · 모든 모의 이동을 멈췄습니다.", "warning");
  }
  resetStop() {
    this.stopped = false;
    this.toast(
      "제어 잠금을 해제했습니다. 이전 이동은 자동으로 재개되지 않습니다.",
    );
  }
  resetCharts() {
    this.selected.history = [];
    this.notify();
  }
  applyBatch(angles: Record<string, number>, transmit: boolean): boolean {
    if (this.locked) return false;
    const affected = this.controls.filter((m) => canEdit(m, false));
    for (const m of affected)
      if (!inRange(m, angles[this.key(m)])) {
        this.toast(`${m.name}의 목표 각도를 확인하세요.`, "warning");
        return false;
      }
    for (const m of affected) m.draft = angles[this.key(m)];
    this.syncTarget();
    if (transmit) {
      const results = affected.map((m) => send(m, false)),
        failed = results.filter((r) => !r.ok).length;
      this.toast(
        failed
          ? `${results.length - failed}개 전송 완료 · ${failed}개 전송 실패`
          : `${results.length}개 모의 명령을 전송했습니다.`,
        failed ? "error" : "success",
      );
    } else this.toast("목표 자세를 적용했습니다. 아직 전송하지 않았습니다.");
    return true;
  }
  captureStep() {
    if (this.locked || !this.jointControls.length) return;
    if (this.source === "joints" && this.targetError) {
      this.sequenceError = "현재 목표 각도 입력을 먼저 확인하세요.";
      this.notify();
      return;
    }
    if (this.steps.length >= 100) {
      this.sequenceError = "최대 100단계까지 추가할 수 있습니다.";
      this.notify();
      return;
    }
    this.steps.push({
      name: `자세 ${this.steps.length + 1}`,
      speed: this.speedScale * 100,
      wait: 1,
      angles: Object.fromEntries(
        this.jointControls.map((m) => [m.joint, m.draft]),
      ),
    });
    this.saveSequence();
  }
  saveStep(index: number, step: SequenceStep) {
    if (this.locked) throw Error("시퀀스를 중지한 뒤 편집하세요.");
    if (!step.name.trim()) throw Error("단계 이름을 입력하세요.");
    validateSteps([step], this.jointControls);
    this.steps[index] = structuredClone({
      ...step,
      name: step.name.trim().slice(0, 60),
    });
    this.saveSequence();
  }
  previewStep(index: number) {
    if (this.locked) return;
    try {
      const step = this.steps[index];
      validateSteps([step], this.jointControls);
      this.source = "joints";
      this.selectedKey = this.key(this.jointControls[0]);
      this.jointControls.forEach((m) => (m.draft = step.angles[m.joint]));
      this.speedScale = step.speed / 100;
      this.syncTarget();
      this.notify();
    } catch (e) {
      this.sequenceError = this.message(e);
      this.notify();
    }
  }
  moveStep(index: number, delta: number) {
    if (this.locked || !this.steps[index + delta]) return;
    [this.steps[index], this.steps[index + delta]] = [
      this.steps[index + delta],
      this.steps[index],
    ];
    this.saveSequence();
  }
  duplicateStep(index: number) {
    if (this.locked || this.steps.length >= 100) return;
    this.steps.splice(index + 1, 0, structuredClone(this.steps[index]));
    this.saveSequence();
  }
  deleteStep(index: number) {
    if (this.locked) return;
    this.steps.splice(index, 1);
    this.saveSequence();
  }
  setRepeat(repeat: boolean) {
    if (this.locked) return;
    this.repeat = repeat;
    this.saveSequence();
  }
  playSequence() {
    if (this.stopped) return;
    try {
      if (this.player.state === "paused") this.player.resume();
      else {
        validateSteps(this.steps, this.jointControls);
        this.source = "joints";
        this.selectedKey = this.key(this.jointControls[0]);
        this.player.start(this.steps, this.repeat);
      }
      this.sequenceError = "";
      this.syncTarget();
      this.notify();
    } catch (e) {
      this.sequenceError = this.message(e);
      this.notify();
    }
  }
  pauseSequence() {
    this.player.pause();
    this.jointControls.forEach((m) => {
      m.angularVelocity = 0;
      m.speed = 0;
    });
    this.notify();
  }
  stopSequence() {
    this.player.stop();
    this.notify();
  }
  tick(dt: number, t: number) {
    const before = this.player.state;
    for (const m of [...this.hardwareMotors, ...this.jointControls])
      if (
        tickMotor(
          m,
          dt,
          this.stopped ||
            (m.type === "model" && this.player.state === "paused"),
          this.speedScale,
        ) &&
        !this.player.busy
      )
        this.toast(
          `${m.name}이 목표 ${m.sent?.toFixed(1)}°에 도착했습니다. (시뮬레이션)`,
        );
    this.player.update(dt);
    if (before !== this.player.state) {
      if (this.player.state === "completed")
        this.toast("시퀀스 재생을 완료했습니다.");
      else this.notify();
    }
    this.sampleElapsed += dt;
    if (this.sampleElapsed >= 0.1) {
      this.sampleElapsed = 0;
      for (const m of [...this.hardwareMotors, ...this.jointControls].filter(
        (m) => m.type !== "servo" && m.scenario !== "offline",
      )) {
        m.history.push({
          t,
          position: m.current ?? 0,
          target: m.sent,
          speed: m.speed,
          angularSpeed: m.angularVelocity,
          amps: m.type === "model" ? null : m.amps,
          temp: m.type === "model" ? null : m.temp,
        });
        m.history = m.history.filter((p) => p.t > t - 65);
      }
      this.toasts = this.toasts.filter((item) => item.expires > Date.now());
      this.notify();
    }
  }
  get sequenceStatus() {
    const p = this.player;
    if (this.stopped) return "긴급 정지 · 재생 중단";
    if (p.state === "paused")
      return `일시정지 · ${p.index + 1} / ${this.steps.length}단계`;
    if (p.state === "playing")
      return `${p.index + 1} / ${this.steps.length}단계 · ${p.phase === "waiting" ? `도착 후 대기 ${p.remaining.toFixed(1)}초` : "이동 중"}`;
    if (p.state === "completed") return "모든 단계 재생 완료";
    if (p.state === "stopped") return `중지 · ${p.reason}`;
    return `${this.steps.length}단계 · 브라우저 자동 저장`;
  }
  private saveSequence() {
    this.sequenceError = "";
    this.save(SEQUENCE_KEY, { steps: this.steps, repeat: this.repeat });
    this.notify();
  }
  private save(key: string, value: unknown) {
    try {
      this.storage?.setItem(key, JSON.stringify(value));
    } catch {
      this.toast("브라우저에 설정을 저장하지 못했습니다.", "warning");
    }
  }
  private message(e: unknown) {
    return e instanceof Error ? e.message : String(e);
  }
}
