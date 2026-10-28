// Os tipos vivem em electron/types.ts para que processo principal e interface usem a mesma definição
import type { IElectronAPI } from '../../electron/types';

export type * from '../../electron/types';

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
