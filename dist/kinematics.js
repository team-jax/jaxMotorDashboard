import * as THREE from 'three';
import {radians} from './state.js?v=20261029-urdf-direct-2';

// URDF origin uses fixed-axis roll, pitch, yaw: Rz(yaw) * Ry(pitch) * Rx(roll).
export function applyUrdfOrigin(object,{xyz,rpy}){
 object.position.fromArray(xyz);
 object.quaternion.setFromEuler(new THREE.Euler(...rpy,'ZYX'));
}
export function applyJointAngle(object,axis,degrees){
 object.quaternion.setFromAxisAngle(new THREE.Vector3(...axis).normalize(),radians(degrees));
}
