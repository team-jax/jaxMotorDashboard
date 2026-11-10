import type { RobotModel } from "./types";
export const modelBase = `${import.meta.env?.BASE_URL ?? "/"}models/jax/`;
export function parseRobotModel(value: unknown): RobotModel {
  if (!value || typeof value !== "object")
    throw Error("URDF 모델 형식이 올바르지 않습니다.");
  const m = value as RobotModel;
  if (
    typeof m.name !== "string" ||
    !Array.isArray(m.links) ||
    !Array.isArray(m.joints) ||
    !m.links.length
  )
    throw Error("URDF 모델 구성이 올바르지 않습니다.");
  const vector = (v: unknown) =>
    Array.isArray(v) &&
    v.length === 3 &&
    v.every((n) => typeof n === "number" && Number.isFinite(n));
  const names = new Set(m.links.map((l) => l.name));
  if (names.size !== m.links.length)
    throw Error("URDF 링크 이름이 중복됩니다.");
  for (const l of m.links) {
    if (typeof l.name !== "string" || !Array.isArray(l.visuals))
      throw Error("URDF 링크 형식 오류");
    for (const v of l.visuals)
      if (
        !vector(v.xyz) ||
        !vector(v.rpy) ||
        !vector(v.scale) ||
        typeof v.file !== "string" ||
        !/^[-\w.]+\.dae$/i.test(v.file)
      )
        throw Error("URDF 시각 메시 형식 오류");
  }
  const children = new Set<string>(),
    jointNames = new Set<string>();
  for (const j of m.joints) {
    if (
      !names.has(j.parent) ||
      !names.has(j.child) ||
      j.parent === j.child ||
      children.has(j.child) ||
      jointNames.has(j.name) ||
      !vector(j.xyz) ||
      !vector(j.rpy) ||
      !vector(j.axis) ||
      !["fixed", "revolute"].includes(j.type)
    )
      throw Error("URDF 관절 구성이 올바르지 않습니다.");
    children.add(j.child);
    jointNames.add(j.name);
    if (
      j.type === "revolute" &&
      (!j.limit ||
        !Number.isFinite(j.limit.lower) ||
        !Number.isFinite(j.limit.upper) ||
        j.limit.lower > j.limit.upper ||
        Math.hypot(...j.axis) === 0)
    )
      throw Error("URDF 관절 제한 오류");
  }
  const roots = m.links.filter((l) => !children.has(l.name));
  if (roots.length !== 1) throw Error("URDF 루트 링크 오류");
  const visited = new Set<string>();
  function visit(name: string) {
    if (visited.has(name)) throw Error("URDF 순환 참조");
    visited.add(name);
    m.joints.filter((j) => j.parent === name).forEach((j) => visit(j.child));
  }
  visit(roots[0].name);
  if (visited.size !== names.size)
    throw Error("연결되지 않은 URDF 링크가 있습니다.");
  return m;
}
