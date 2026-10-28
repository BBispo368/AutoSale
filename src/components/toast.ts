// Tipos compartilhados do sistema de notificações (toast) exibido pelo App
export type ToastType = 'success' | 'error' | 'info';

export type ShowToast = (type: ToastType, message: string) => void;
