import type { SequencePlayer as Player } from "../src/domain/sequence";
import type { RobotModel, Motor, Scenario } from "../src/domain/types";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { SequencePlayer, validateSteps } from "../src/domain/sequence";
import { createJointControls, tickMotor } from "../src/domain/state";
const model = JSON.parse(
  fs.readFileSync(
    new URL("../public/models/jax/model.json", import.meta.url),
    "utf8",
  ),
) as RobotModel;
function setup() {
  const controls = createJointControls(model);
  const observed: number[] = [];
  const player = new SequencePlayer(controls, (step, index) =>
    observed.push(index),
  );
  return { controls, player, observed };
}
function step(controls: Motor[], angle = 0, wait = 0, speed = 100) {
  return {
    name: "테스트 자세",
    speed,
    wait,
    angles: Object.fromEntries(
      controls.map((m, i) => [m.joint, i === 0 ? angle : 0]),
    ),
  };
}
function tick(player: Player, dt: number) {
  if (player.state !== "paused")
    for (const m of player.controls)
      tickMotor(m, dt, false, (player.steps[player.index]?.speed ?? 100) / 100);
  player.update(dt);
}
test("steps wait for all joints then observe unscaled arrival delay before advancing", () => {
  const { controls, player, observed } = setup();
  const first = step(controls, 10, 0.5, 200);
  first.angles.upper_arm_to_under_arm = 30;
  player.start([first, step(controls, -10)]);
  for (let i = 0; i < 1000 && player.phase !== "waiting"; i++)
    tick(player, 0.01);
  assert.equal(player.index, 0);
  assert(controls.every((m) => m.status === "reached"));
  tick(player, 0.49);
  assert.equal(player.index, 0);
  tick(player, 0.02);
  assert.equal(player.index, 1);
  for (let i = 0; i < 1000 && player.busy; i++) tick(player, 0.01);
  assert.equal(player.state, "completed");
  assert.equal(controls[0].current, -10);
  assert.deepEqual(observed, [0, 1]);
});
test("pause freezes both active motion and remaining wait, resume continues at same pose", () => {
  const { controls, player } = setup();
  player.start([step(controls, 20, 1)]);
  tick(player, 0.3);
  const before = controls[0].current;
  player.pause();
  tick(player, 10);
  assert.equal(controls[0].current, before);
  assert.equal(player.remaining, 1);
  player.resume();
  for (let i = 0; i < 1000 && player.phase !== "waiting"; i++)
    tick(player, 0.01);
  tick(player, 0.2);
  const remaining = player.remaining;
  player.pause();
  tick(player, 10);
  assert.equal(player.remaining, remaining);
  player.resume();
  tick(player, remaining + 0.01);
  assert.equal(player.state, "completed");
});
test("stop cancels pending stages and freezes current position", () => {
  const { controls, player, observed } = setup();
  player.start([step(controls, 20), step(controls, -20)]);
  tick(player, 0.3);
  const before = controls[0].current;
  player.stop("긴급 정지");
  for (let i = 0; i < 200; i++) tick(player, 0.1);
  assert.equal(controls[0].current, before);
  assert.equal(player.state, "stopped");
  assert.deepEqual(observed, [0]);
  assert(controls.every((m) => m.motion === null));
});
test("later invalid stages reject playback atomically before the first move", () => {
  const { controls, player } = setup();
  const invalid = step(controls, 90);
  assert.throws(() => player.start([step(controls, 20), invalid]), /허용 범위/);
  assert(controls.every((m) => m.sent === null));
  for (const value of [-1, 61, NaN])
    assert.throws(() =>
      validateSteps([{ ...step(controls), wait: value }], controls),
    );
  for (const value of [0, 201, NaN])
    assert.throws(() =>
      validateSteps([{ ...step(controls), speed: value }], controls),
    );
});
test("repeat returns to the first stage and stop exits the loop", () => {
  const { controls, player, observed } = setup();
  player.start([step(controls)], true);
  for (let i = 0; i < 6; i++) tick(player, 0.1);
  assert(observed.length > 1);
  assert.equal(player.state, "playing");
  player.stop();
  tick(player, 10);
  assert.equal(player.state, "stopped");
});
test("player copies the configured sequence and stops on a runtime motor error", () => {
  const { controls, player } = setup();
  const steps = [step(controls, 20)];
  player.start(steps);
  steps[0].angles[controls[0].joint] = -20;
  assert.equal(player.steps[0].angles[controls[0].joint], 20);
  controls[1].scenario = "error";
  tick(player, 0.1);
  assert.equal(player.state, "stopped");
  assert(controls.every((m) => m.status === "idle"));
});
