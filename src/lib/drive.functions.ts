import { createServerFn } from "@tanstack/react-start";
import { fetchDriveWork } from "./drive.server";

export const getDriveWork = createServerFn({ method: "GET" }).handler(async () => {
  return await fetchDriveWork();
});
