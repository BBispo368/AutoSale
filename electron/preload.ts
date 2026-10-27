import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // WhatsApp
  whatsapp: {
    getStatus: () => ipcRenderer.invoke('whatsapp:get-status'),
    connect: () => ipcRenderer.invoke('whatsapp:connect'),
    disconnect: () => ipcRenderer.invoke('whatsapp:disconnect'),
    onStatusChange: (callback: (data: { status: string; qrCode: string | null }) => void) => {
      const listener = (_: any, data: any) => callback(data);
      ipcRenderer.on('whatsapp:status-update', listener);
      return () => ipcRenderer.removeListener('whatsapp:status-update', listener);
    },
  },

  // Leads
  leads: {
    getLeads: (filter?: { status?: string; search?: string }) =>
      ipcRenderer.invoke('leads:get-all', filter),
    addLeads: (leads: any[]) => ipcRenderer.invoke('leads:add', leads),
    deleteLead: (id: string) => ipcRenderer.invoke('leads:delete', id),
    updateLead: (id: string, fields: any) => ipcRenderer.invoke('leads:update', id, fields),
    clearLeads: (statusFilter?: string) => ipcRenderer.invoke('leads:clear', statusFilter),
    getStats: () => ipcRenderer.invoke('leads:get-stats'),
    exportExcel: () => ipcRenderer.invoke('leads:export-excel'),
    importFile: () => ipcRenderer.invoke('leads:import-file'),

  },

  // Settings
  settings: {
    getSettings: () => ipcRenderer.invoke('settings:get'),
    saveSettings: (settings: any) => ipcRenderer.invoke('settings:save', settings),
  },

  // Scraper de Empresas
  scraper: {
    searchLeads: (filters: { niche: string; city: string; state: string; limit?: number }) =>
      ipcRenderer.invoke('scraper:search', filters),
    onProgress: (callback: (data: { found: number; currentName: string }) => void) => {
      const listener = (_: any, data: any) => callback(data);
      ipcRenderer.on('scraper:progress', listener);
      return () => ipcRenderer.removeListener('scraper:progress', listener);
    },
  },

  // Disparador de Campanha
  campaign: {
    start: () => ipcRenderer.invoke('campaign:start'),
    pause: () => ipcRenderer.invoke('campaign:pause'),
    resume: () => ipcRenderer.invoke('campaign:resume'),
    stop: () => ipcRenderer.invoke('campaign:stop'),
    getStatus: () => ipcRenderer.invoke('campaign:get-status'),
    onProgress: (callback: (progress: any) => void) => {
      const listener = (_: any, data: any) => callback(data);
      ipcRenderer.on('campaign:progress', listener);
      return () => ipcRenderer.removeListener('campaign:progress', listener);
    },
  },

  // Logs
  logs: {
    getLogs: () => ipcRenderer.invoke('logs:get'),
    clearLogs: () => ipcRenderer.invoke('logs:clear'),
  },
});
