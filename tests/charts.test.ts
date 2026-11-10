import test from "node:test";
import assert from "node:assert/strict";
import { chartTypes, chartConfig } from "../src/domain/charts";
test("URDF graphs use calculated degrees per second and explicitly lack sensor measurements", () => {
  const configs = Object.fromEntries(
    chartTypes.map((type) => [type.key, chartConfig(type, { type: "model" })]),
  );
  assert.equal(configs.speed.key, "angularSpeed");
  assert.equal(configs.speed.unit, "°/s");
  assert(configs.speed.available);
  assert(configs.position.available);
  assert.equal(configs.amps.available, false);
  assert.equal(configs.temp.available, false);
});
test("AK45 graphs retain ERPM and simulated sensor channels", () => {
  const configs = chartTypes.map((type) => chartConfig(type, { type: "ak" }));
  assert(configs.every((config) => config.available));
  assert.equal(
    configs.find((config) => config.name === "회전 속도")!.unit,
    "ERPM",
  );
});
