import type { Motor } from "./types";
export type ChartKey = "position" | "speed" | "amps" | "temp";
export const chartTypes: {
  key: ChartKey;
  name: string;
  unit: string;
  color: string;
}[] = [
  { key: "position", name: "각도", unit: "°", color: "#a5a0ff" },
  { key: "speed", name: "회전 속도", unit: "ERPM", color: "#63bcf7" },
  { key: "amps", name: "전류", unit: "A", color: "#55d4b2" },
  { key: "temp", name: "온도", unit: "°C", color: "#efbc78" },
];
export function chartConfig(
  type: (typeof chartTypes)[number],
  motor: Pick<Motor, "type">,
) {
  const model = motor.type === "model";
  return {
    ...type,
    key: model && type.key === "speed" ? ("angularSpeed" as const) : type.key,
    unit: model && type.key === "speed" ? "°/s" : type.unit,
    available: !model || !["amps", "temp"].includes(type.key),
  };
}
