/// <reference types="vite/client" />

import type { WorkProcNaviApi } from "../shared/types";

declare global {
  interface Window {
    workProcNavi: WorkProcNaviApi;
  }
}
