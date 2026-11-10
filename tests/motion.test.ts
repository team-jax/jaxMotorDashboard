import type { Motor } from "../src/domain/types";
import test from "node:test";
import assert from "node:assert/strict";
import { createMotors, send, tickMotor } from "../src/domain/state";
function moving(target = 14) {
  const m = createMotors()[0];
  m.joint = "test";
  m.current = 0;
  m.min = -180;
  m.max = 180;
  m.draft = target;
  send(m, false);
  return m as Motor & { current: number };
}
test("smooth acceleration and braking arrive exactly without overshoot", () => {
  const m = moving(60),
    positions: number[] = [],
    speeds: number[] = [];
  for (let i = 0; i < 1000 && m.status === "moving"; i++) {
    tickMotor(m, 1 / 120, false);
    positions.push(m.current);
    speeds.push(m.angularVelocity);
  }
  assert.equal(m.current, 60);
  assert.equal(m.status, "reached");
  assert(
    positions.every(
      (p, i) => p >= 0 && p <= 60 && (i === 0 || p >= positions[i - 1]),
    ),
  );
  assert(speeds[0] < 0.01);
  assert(Math.max(...speeds) <= 18 + 1e-8);
  assert(speeds.at(-2)! < 0.02);
  assert.equal(speeds.at(-1), 0);
});
test("trajectory is independent of frame rate and does not round away tiny frame increments", () => {
  const low = moving(),
    high = moving();
  for (let i = 0; i < 30; i++) tickMotor(low, 1 / 30, false);
  for (let i = 0; i < 144; i++) tickMotor(high, 1 / 144, false);
  assert(Math.abs(low.current - high.current) < 1e-9);
  const tiny = moving(0.1);
  tickMotor(tiny, 1 / 144, false);
  assert(tiny.current > 0 && tiny.current < 0.001);
});
test("stop freezes model on the very next frame and reset does not resume it", () => {
  const m = moving();
  tickMotor(m, 0.3, false);
  const position = m.current;
  tickMotor(m, 0.1, true);
  assert.equal(m.current, position);
  assert.equal(m.angularVelocity, 0);
  m.status = "idle";
  tickMotor(m, 1, false);
  assert.equal(m.current, position);
});
test("retarget begins at the current pose and completes in the other direction", () => {
  const m = moving(60);
  tickMotor(m, 1, false);
  const position = m.current;
  m.draft = -30;
  send(m, false);
  assert.equal(m.current, position);
  assert.equal(m.motion!.from, position);
  for (let i = 0; i < 1000 && m.status === "moving"; i++)
    tickMotor(m, 1 / 120, false);
  assert.equal(m.current, -30);
});

test("speed multiplier changes travel time while preserving the eased path", () => {
  const slow = moving(60),
    normal = moving(60),
    fast = moving(60);
  tickMotor(slow, 1, false, 0.5);
  tickMotor(normal, 1, false, 1);
  tickMotor(fast, 1, false, 2);
  assert(slow.current < normal.current && normal.current < fast.current);
  const equivalent = moving(60);
  tickMotor(equivalent, 2, false, 1);
  assert(Math.abs(fast.current - equivalent.current) < 1e-10);
  assert(
    Math.abs(fast.angularVelocity - 2 * equivalent.angularVelocity) < 1e-10,
  );
});
test("changing speed in motion never jumps or resets the pose", () => {
  const m = moving(60);
  tickMotor(m, 1, false, 1);
  const before = m.current;
  tickMotor(m, 0, false, 2);
  assert.equal(m.current, before);
  tickMotor(m, 0.01, false, 0.1);
  assert(m.current > before && m.current - before < 0.1);
  tickMotor(m, 100, false, 2);
  assert.equal(m.current, 60);
  assert.equal(m.status, "reached");
});
test("speed control bounds and stop apply at every multiplier", () => {
  const low = moving(60),
    minimum = moving(60),
    high = moving(60),
    maximum = moving(60);
  tickMotor(low, 1, false, 0);
  tickMotor(minimum, 1, false, 0.1);
  tickMotor(high, 1, false, 99);
  tickMotor(maximum, 1, false, 2);
  assert.equal(low.current, minimum.current);
  assert.equal(high.current, maximum.current);
  const position = high.current;
  tickMotor(high, 1, true, 2);
  assert.equal(high.current, position);
  assert.equal(high.angularVelocity, 0);
  const bad = moving(60);
  tickMotor(bad, 1, false, NaN);
  assert(Number.isFinite(bad.current));
});
