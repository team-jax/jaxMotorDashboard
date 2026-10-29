import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {applyUrdfOrigin,applyJointAngle} from '../dist/kinematics.js';
const model=JSON.parse(fs.readFileSync(new URL('../dist/models/jax/model.json',import.meta.url)));
test('URDF elbow angle moves downstream links while preserving upstream links',()=>{
 const links=new Map(model.links.map(link=>[link.name,new THREE.Group()]));
 const rotations=new Map();
 for(const joint of model.joints){const origin=new THREE.Group();applyUrdfOrigin(origin,joint);const rotation=new THREE.Group();origin.add(rotation);rotation.add(links.get(joint.child));links.get(joint.parent).add(origin);rotations.set(joint.name,rotation);}
 const root=links.get('base_link');root.updateMatrixWorld(true);
 const world=name=>links.get(name).getWorldPosition(new THREE.Vector3());
 const before=world('Wrist_Pitch'),shoulder=world('Shoulder_Roll'),elbow=world('Under_Arm');
 const joint=model.joints.find(j=>j.name==='upper_arm_to_under_arm');
 applyJointAngle(rotations.get(joint.name),joint.axis,90);root.updateMatrixWorld(true);
 const after=world('Wrist_Pitch');
 assert(after.distanceTo(before)>.05,'90° elbow rotation must visibly move the wrist');
 assert(world('Shoulder_Roll').distanceTo(shoulder)<1e-10,'upstream shoulder stays fixed');
 assert(Math.abs(after.distanceTo(elbow)-before.distanceTo(elbow))<1e-10,'link length stays constant');
 applyJointAngle(rotations.get(joint.name),joint.axis,0);root.updateMatrixWorld(true);
 assert(world('Wrist_Pitch').distanceTo(before)<1e-10,'zero degrees restores original pose');
});
test('90 degrees is a quarter turn rather than 90 radians',()=>{const group=new THREE.Group();applyJointAngle(group,[0,0,1],90);const result=new THREE.Vector3(1,0,0).applyQuaternion(group.quaternion);assert(result.distanceTo(new THREE.Vector3(0,1,0))<1e-10);});
