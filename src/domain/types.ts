export type Vec3 = [number, number, number];
export interface Origin {
  xyz: Vec3;
  rpy: Vec3;
}
export interface Joint extends Origin {
  name: string;
  type: "fixed" | "revolute";
  parent: string;
  child: string;
  axis: Vec3;
  limit: {
    lower: number;
    upper: number;
    effort: number;
    velocity: number;
  } | null;
}
export interface Link {
  name: string;
  visuals: (Origin & { file: string; scale: Vec3 })[];
}
export interface RobotModel {
  name: string;
  links: Link[];
  joints: Joint[];
}
export type Scenario = "normal" | "offline" | "error" | "failure";
export type MotorStatus = "idle" | "moving" | "reached" | "sent";
export type Source = "joints" | "motors";
export type PoseMode = "actual" | "target" | "both";
export interface Sample {
  t: number;
  position: number;
  target: number | null;
  speed: number;
  angularSpeed: number;
  amps: number | null;
  temp: number | null;
}
export interface Motion {
  from: number;
  to: number;
  elapsed: number;
  duration: number;
}
export interface Motor {
  name: string;
  type: "ak" | "servo" | "model";
  id: number;
  joint: string;
  current: number | null;
  draft: number;
  sent: number | null;
  min: number;
  max: number;
  status: MotorStatus;
  scenario: Scenario;
  error: string;
  speed: number;
  angularVelocity: number;
  amps: number;
  temp: number;
  history: Sample[];
  motion: Motion | null;
}
export interface SequenceStep {
  name: string;
  speed: number;
  wait: number;
  angles: Record<string, number>;
}
export type SequenceState =
  "idle" | "playing" | "paused" | "completed" | "stopped";
export interface Toast {
  id: number;
  message: string;
  type: "success" | "warning" | "error";
}
