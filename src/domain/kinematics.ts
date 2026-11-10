import * as THREE from "three";
import { radians } from "./state";
import type { Origin, Vec3 } from "./types";
// URDF origin: Rz(yaw) * Ry(pitch) * Rx(roll).
export function applyUrdfOrigin(
  object: THREE.Object3D,
  { xyz, rpy }: Origin,
): void {
  object.position.fromArray(xyz);
  object.quaternion.setFromEuler(new THREE.Euler(...rpy, "ZYX"));
}
export function applyJointAngle(
  object: THREE.Object3D,
  axis: Vec3,
  angle: number,
): void {
  object.quaternion.setFromAxisAngle(
    new THREE.Vector3(...axis).normalize(),
    radians(angle),
  );
}
