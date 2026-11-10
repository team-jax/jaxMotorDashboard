import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";
import { DashboardController } from "../domain/dashboard";
import { modelBase, parseRobotModel } from "../domain/model";
export const DashboardContext = createContext<DashboardController | null>(null);
export function useDashboard() {
  const controller = useContext(DashboardContext);
  if (!controller) throw Error("Dashboard provider missing");
  useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  return controller;
}
export function useDashboardLifecycle(controller: DashboardController) {
  useEffect(() => {
    const abort = new AbortController();
    let active = true;
    fetch(modelBase + "model.json", { signal: abort.signal })
      .then((response) => {
        if (!response.ok) throw Error("URDF 모델을 불러오지 못했습니다.");
        return response.json() as Promise<unknown>;
      })
      .then((data) => {
        if (active) controller.setModel(parseRobotModel(data));
      })
      .catch((error) => {
        if (active && !abort.signal.aborted) controller.setModelError(error);
      });
    let frame = 0,
      last = performance.now();
    const reset = () => (last = performance.now());
    const animate = (now: number) => {
      controller.tick(
        Math.min(Math.max(0, (now - last) / 1000), 0.05),
        now / 1000,
      );
      last = now;
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    document.addEventListener("visibilitychange", reset);
    return () => {
      active = false;
      abort.abort();
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", reset);
    };
  }, [controller]);
}
