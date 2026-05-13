import { createMeshConfig } from "@baditaflorin/mesh-common";

export const config = createMeshConfig({
  appName: "mesh-exquisite-corpse",
  description: "Three-peer collaborative drawing — head, body, legs hidden until reveal",
  accentHex: "#14b8a6",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
});
