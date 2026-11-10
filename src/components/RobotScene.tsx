import { Suspense, useEffect, useMemo, useRef } from "react";
import {
  Canvas,
  useFrame,
  useLoader,
  useThree,
  type ThreeEvent,
} from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { ColladaLoader } from "three/addons/loaders/ColladaLoader.js";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { applyJointAngle, applyUrdfOrigin } from "../domain/kinematics";
import type { RobotModel } from "../domain/types";
import type { DashboardController } from "../domain/dashboard";
import { modelBase } from "../domain/model";
import { jointLabels } from "../domain/labels";
interface Props {
  model: RobotModel;
  controller: DashboardController;
  resetToken: number;
  onReady: () => void;
  onHover: (text: string, x: number, y: number) => void;
}
interface RobotInstance {
  root: THREE.Group;
  rotations: Map<string, THREE.Group>;
  meshes: Map<string, THREE.Mesh[]>;
  markers: Map<string, THREE.Mesh>;
}
function createRobot(
  model: RobotModel,
  assets: Map<string, THREE.Object3D>,
  target: boolean,
): RobotInstance {
  const root = new THREE.Group();
  root.rotation.x = -Math.PI / 2;
  const links = new Map<string, THREE.Group>(),
    rotations = new Map<string, THREE.Group>(),
    meshes = new Map<string, THREE.Mesh[]>(),
    markers = new Map<string, THREE.Mesh>();
  for (const link of model.links) {
    const group = new THREE.Group();
    group.name = link.name;
    group.userData.joint = model.joints.find(
      (j) => j.type === "revolute" && j.child === link.name,
    )?.name;
    links.set(link.name, group);
    const linkMeshes: THREE.Mesh[] = [];
    for (const visual of link.visuals) {
      const frame = new THREE.Group();
      applyUrdfOrigin(frame, visual);
      frame.scale.fromArray(visual.scale);
      const object = assets.get(visual.file)!.clone(true);
      object.quaternion.identity();
      object.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          node.material = new THREE.MeshStandardMaterial({
            color: target ? 0x3b82f6 : 0xb5c0d1,
            roughness: 0.62,
            metalness: 0.35,
            transparent: target,
            opacity: target ? 0.28 : 1,
            depthWrite: !target,
            side: THREE.DoubleSide,
          });
          node.renderOrder = target ? 2 : 0;
          linkMeshes.push(node);
        }
      });
      frame.add(object);
      group.add(frame);
    }
    meshes.set(link.name, linkMeshes);
  }
  for (const joint of model.joints) {
    const frame = new THREE.Group();
    applyUrdfOrigin(frame, joint);
    const rotation = new THREE.Group();
    frame.add(rotation);
    rotation.add(links.get(joint.child)!);
    links.get(joint.parent)!.add(frame);
    rotations.set(joint.name, rotation);
    if (!target && joint.type === "revolute") {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.012, 16, 12),
        new THREE.MeshBasicMaterial({
          color: 0x65738a,
          transparent: true,
          opacity: 0.85,
          depthTest: false,
        }),
      );
      marker.userData.joint = joint.name;
      marker.renderOrder = 5;
      frame.add(marker);
      markers.set(joint.name, marker);
    }
  }
  const children = new Set(model.joints.map((j) => j.child));
  for (const link of model.links)
    if (!children.has(link.name)) root.add(links.get(link.name)!);
  return { root, rotations, meshes, markers };
}
function Model({ model, controller: c, resetToken, onReady, onHover }: Props) {
  const urls = useMemo(
    () => [
      ...new Set(model.links.flatMap((l) => l.visuals.map((v) => v.file))),
    ],
    [model],
  );
  const colladas = useLoader(
    ColladaLoader,
    urls.map((file) => modelBase + file),
  );
  const [actual, target] = useMemo(() => {
    const assets = new Map(
      urls.map((file, index) => [file, colladas[index].scene]),
    );
    return [
      createRobot(model, assets, false),
      createRobot(model, assets, true),
    ];
  }, [model, urls, colladas]);
  const movable = useMemo(
    () => model.joints.filter((j) => j.type === "revolute"),
    [model],
  );
  useEffect(
    () => () => {
      for (const robot of [actual, target]) {
        for (const meshes of robot.meshes.values())
          for (const mesh of meshes)
            (mesh.material as THREE.Material).dispose();
        for (const marker of robot.markers.values()) {
          marker.geometry.dispose();
          (marker.material as THREE.Material).dispose();
        }
      }
    },
    [actual, target],
  );
  const bounds = useMemo(
    () => new THREE.Box3().setFromObject(actual.root),
    [actual],
  );
  const center = useMemo(() => bounds.getCenter(new THREE.Vector3()), [bounds]);
  const distance = Math.max(
    bounds.getSize(new THREE.Vector3()).length() * 1.65,
    1.2,
  );
  const { camera } = useThree();
  const orbit = useRef<OrbitControlsImpl>(null);
  useEffect(() => {
    camera.position
      .copy(center)
      .add(
        new THREE.Vector3(distance * 0.85, distance * 0.45, distance * 0.85),
      );
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.near = distance / 1000;
      camera.far = distance * 100;
      camera.updateProjectionMatrix();
    }
    orbit.current?.target.copy(center);
    orbit.current?.update();
  }, [camera, center, distance, resetToken]);
  useEffect(() => onReady(), [onReady]);
  useFrame(() => {
    actual.root.visible = c.poseMode !== "target";
    target.root.visible = c.poseMode !== "actual";
    for (const joint of movable) {
      const motor = c.controls.find((m) => m.joint === joint.name),
        selected = !!motor && c.key(motor) === c.key(c.selected);
      const angle =
        motor?.current !== null && motor?.scenario !== "offline"
          ? (motor?.current ?? 0)
          : 0;
      applyJointAngle(actual.rotations.get(joint.name)!, joint.axis, angle);
      applyJointAngle(
        target.rotations.get(joint.name)!,
        joint.axis,
        motor?.draft ?? 0,
      );
      for (const mesh of actual.meshes.get(joint.child) ?? []) {
        const material = mesh.material as THREE.MeshStandardMaterial;
        material.color.set(
          selected
            ? 0xaaa7ff
            : motor && motor.type !== "servo"
              ? 0xcbd5e1
              : 0x65738a,
        );
        material.emissive.set(selected ? 0x292453 : 0);
      }
      for (const mesh of target.meshes.get(joint.child) ?? []) {
        const material = mesh.material as THREE.MeshStandardMaterial;
        material.color.set(selected ? 0x8183ff : 0x3b82f6);
        material.opacity = selected ? 0.5 : 0.25;
      }
      const marker = actual.markers.get(joint.name);
      if (marker) {
        (marker.material as THREE.MeshBasicMaterial).color.set(
          selected ? 0xb7b4ff : motor ? 0x8183ff : 0x52617a,
        );
        marker.scale.setScalar(selected ? 1.5 : 1);
      }
    }
  });
  function jointFor(object: THREE.Object3D) {
    let node: THREE.Object3D | null = object;
    while (node) {
      if (typeof node.userData.joint === "string")
        return node.userData.joint as string;
      node = node.parent;
    }
    return null;
  }
  function pick(event: ThreeEvent<MouseEvent>) {
    if (event.delta > 5) return;
    const joint = jointFor(event.object);
    if (!joint) return;
    event.stopPropagation();
    const motor = c.controls.find((m) => m.joint === joint);
    if (motor) c.select(c.key(motor));
    else
      c.toast(
        `${jointLabels[joint] ?? joint}: 모터 설정 탭에서 대응 관절을 지정하세요.`,
        "warning",
      );
  }
  function hover(event: ThreeEvent<PointerEvent>) {
    const joint = jointFor(event.object);
    if (!joint) {
      onHover("", 0, 0);
      return;
    }
    event.stopPropagation();
    const motor = c.controls.find((m) => m.joint === joint);
    onHover(
      `${motor?.name ?? jointLabels[joint] ?? joint} · ${joint}${motor ? "" : " · 모터 미연결"}`,
      event.nativeEvent.clientX,
      event.nativeEvent.clientY,
    );
  }
  return (
    <>
      <primitive
        object={actual.root}
        dispose={null}
        onClick={pick}
        onPointerMove={hover}
        onPointerOut={() => onHover("", 0, 0)}
      />
      <primitive
        object={target.root}
        dispose={null}
        onClick={pick}
        onPointerMove={hover}
        onPointerOut={() => onHover("", 0, 0)}
      />
      <gridHelper
        args={[3, 30, 0x40516d, 0x263247]}
        position={[0, bounds.min.y - 0.004, 0]}
      />
      <axesHelper args={[0.17]} position={[-0.5, bounds.min.y, 0.4]} />
      <OrbitControls
        ref={orbit}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={0.25}
        maxDistance={7}
      />
    </>
  );
}
export default function RobotScene(props: Props) {
  return (
    <Canvas
      style={{ position: "absolute", inset: 0 }}
      dpr={[1, 2]}
      camera={{ fov: 40, near: 0.001, far: 100, position: [1, 1, 1] }}
      gl={{ antialias: true, alpha: true }}
      fallback={
        <div className="loading">
          이 브라우저에서 WebGL을 사용할 수 없습니다.
        </div>
      }
    >
      <hemisphereLight args={[0xe6f0ff, 0x253044, 2.8]} />
      <directionalLight color={0xffffff} intensity={3} position={[3, 5, 4]} />
      <directionalLight color={0x6c8fff} intensity={2} position={[-2, 2, -2]} />
      <Suspense fallback={null}>
        <Model {...props} />
      </Suspense>
    </Canvas>
  );
}
