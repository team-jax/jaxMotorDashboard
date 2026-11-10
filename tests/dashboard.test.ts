import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { DashboardController } from "../src/domain/dashboard";
import { parseRobotModel } from "../src/domain/model";
const model = parseRobotModel(
  JSON.parse(
    fs.readFileSync(
      new URL("../public/models/jax/model.json", import.meta.url),
      "utf8",
    ),
  ),
);
function setup() {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  const controller = new DashboardController(storage);
  controller.setModel(model);
  return { controller, storage, values };
}
test("React controller keeps invalid angle input separate from the last valid preview", () => {
  const { controller: c } = setup();
  c.setTarget("20");
  assert.equal(c.selected.draft, 20);
  c.setTarget("999");
  assert(c.targetError);
  assert.equal(c.selected.draft, 20);
  c.sendSelected();
  assert.equal(c.selected.sent, null);
  c.setTarget("");
  assert(c.targetError);
  c.setTarget("30");
  c.sendSelected();
  assert.equal(c.selected.sent, 30);
});
test("existing browser sequence storage survives migration without automatic playback", () => {
  const { controller: c, storage } = setup();
  c.setTarget("20");
  c.captureStep();
  const restored = new DashboardController(storage);
  restored.setModel(model);
  assert.equal(restored.steps.length, 1);
  assert.equal(restored.steps[0].angles[c.selected.joint], 20);
  assert.equal(restored.player.state, "idle");
  assert(restored.jointControls.every((m) => m.sent === null));
});
test("sequence ownership prevents manual commands and source changes; emergency stop releases it safely", () => {
  const { controller: c } = setup();
  c.setTarget("20");
  c.captureStep();
  c.playSequence();
  assert(c.locked);
  const draft = c.selected.draft;
  c.setTarget("-20");
  c.setSource("motors");
  c.setSpeed(200);
  assert.equal(c.source, "joints");
  assert.equal(c.selected.draft, draft);
  assert.equal(c.speedScale, 1);
  c.tick(0.3, 0.3);
  const position = c.selected.current;
  c.pauseSequence();
  c.tick(0.5, 0.8);
  assert.equal(c.selected.current, position);
  c.emergencyStop();
  c.resetStop();
  c.tick(0.5, 1.3);
  assert.equal(c.selected.current, position);
  assert.equal(c.player.state, "stopped");
  assert(!c.locked);
});
test("saved hardware mappings restore uniquely while STM32 feedback stays unknown", () => {
  const { controller: c, storage } = setup();
  c.setSource("motors");
  c.setMapping("upper_arm_to_under_arm");
  const restored = new DashboardController(storage);
  restored.setModel(model);
  assert.equal(restored.hardwareMotors[0].joint, "upper_arm_to_under_arm");
  assert(
    restored.hardwareMotors
      .filter((m) => m.type === "servo")
      .every((m) => m.current === null),
  );
});
test("URDF parsing rejects broken trees and invalid geometry paths", () => {
  const cycle = structuredClone(model);
  cycle.joints[0].parent = cycle.joints[0].child;
  assert.throws(() => parseRobotModel(cycle));
  const bad = structuredClone(model);
  bad.links[0].visuals[0].file = "../outside.dae";
  assert.throws(() => parseRobotModel(bad));
});
