import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import type { IElectronAPI } from './types';

/** Assina um canal de eventos do processo principal e devolve a função de cancelamento */
function subscribe<T>(channel: string, callback: (data: T) => void) {
  const listener = (_: IpcRendererEvent, data: T) => callback(data);
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

const api: IElectronAPI = {
  app: {
    getInfo: () => ipcRenderer.invoke('app:get-info'),
  },

  whatsapp: {
    getStatus: () => ipcRenderer.invoke('whatsapp:get-status'),
    connect: () => ipcRenderer.invoke('whatsapp:connect'),
    disconnect: () => ipcRenderer.invoke('whatsapp:disconnect'),
    onStatusChange: (callback) => subscribe('whatsapp:status-update', callback),
  },

  leads: {
    getLeads: (filter) => ipcRenderer.invoke('leads:get-all', filter),
    addLeads: (leads) => ipcRenderer.invoke('leads:add', leads),
    deleteLead: (id) => ipcRenderer.invoke('leads:delete', id),
    updateLead: (id, fields) => ipcRenderer.invoke('leads:update', id, fields),
    resetFailed: () => ipcRenderer.invoke('leads:reset-failed'),
    clearLeads: (statusFilter) => ipcRenderer.invoke('leads:clear', statusFilter),
    getStats: () => ipcRenderer.invoke('leads:get-stats'),
    exportExcel: () => ipcRenderer.invoke('leads:export-excel'),
    importFile: () => ipcRenderer.invoke('leads:import-file'),
  },

  settings: {
    getSettings: () => ipcRenderer.invoke('settings:get'),
    saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  },

  scraper: {
    searchLeads: (filters) => ipcRenderer.invoke('scraper:search', filters),
    cancel: () => ipcRenderer.invoke('scraper:cancel'),
    onProgress: (callback) => subscribe('scraper:progress', callback),
  },

  campaign: {
    start: () => ipcRenderer.invoke('campaign:start'),
    pause: () => ipcRenderer.invoke('campaign:pause'),
    resume: () => ipcRenderer.invoke('campaign:resume'),
    stop: () => ipcRenderer.invoke('campaign:stop'),
    getStatus: () => ipcRenderer.invoke('campaign:get-status'),
    onProgress: (callback) => subscribe('campaign:progress', callback),
  },

  logs: {
    getLogs: () => ipcRenderer.invoke('logs:get'),
    clearLogs: () => ipcRenderer.invoke('logs:clear'),
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);
