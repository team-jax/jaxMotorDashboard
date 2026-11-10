export const jointLabels: Record<string, string> = {
  shoulder_pitch_to_shoulder_roll: "어깨 1",
  shoulder_roll_to_shoulder_yaw: "어깨 2",
  shoulder_yaw_to_upper_arm: "위팔",
  upper_arm_to_under_arm: "팔꿈치",
  under_arm_to_wrist_pitch: "손목 1",
  wrist_pitch_to_wrist_yaw: "손목 2",
  wrist_yaw_to_hand_base: "손목 3",
  hand_base_to_rotation_base: "그리퍼 회전",
  hand_base_to_finger_1_1: "손가락 1 · 1번 관절",
  finger_1_1_to_finger_1_2: "손가락 1 · 2번 관절",
  hand_base_to_finger_2_1: "손가락 2 · 1번 관절",
  finger_1_2_to_finger_2_2: "손가락 2 · 2번 관절",
  rotation_base_to_finger_3_1: "손가락 3 · 1번 관절",
  finger_3_1_to_finger_3_2: "손가락 3 · 2번 관절",
};
export const fmt = (n: number | null) =>
  n === null ? "—" : `${n.toFixed(1)}°`;
