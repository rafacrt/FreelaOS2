
import { create } from 'zustand';
import type { AppNotification, NotificationRecipientType } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid'; // Adicionaremos uuid para IDs únicos

interface NotificationStoreState {
  notifications: AppNotification[];
  addNotification: (
    message: string,
    recipientType: NotificationRecipientType,
    recipientId: string, // 'all_admins' for admin, or specific partner ID
    type: AppNotification['type'],
    link?: string
  ) => void;
  getNotificationsForRecipient: (recipientType: NotificationRecipientType, recipientId: string) => AppNotification[];
  getUnreadCountForRecipient: (recipientType: NotificationRecipientType, recipientId: string) => number;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: (recipientType: NotificationRecipientType, recipientId: string) => void;
  // For dev/testing purposes
  _clearAllNotifications: () => void;
}

export const useNotificationStore = create<NotificationStoreState>((set, get) => ({
  notifications: [],
  addNotification: (message, recipientType, recipientId, type, link) => {
    const newNotification: AppNotification = {
      id: uuidv4(),
      recipientType,
      recipientId,
      message,
      link,
      type,
      createdAt: new Date().toISOString(),
      isRead: false,
    };
    set((state) => ({
      notifications: [newNotification, ...state.notifications].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    }));
  },
  getNotificationsForRecipient: (recipientType, recipientId) => {
    return get().notifications.filter(
      (n) =>
        n.recipientType === recipientType &&
        (recipientType === 'admin' ? n.recipientId === 'all_admins' : n.recipientId === recipientId)
    );
  },
  getUnreadCountForRecipient: (recipientType, recipientId) => {
    return get()
      .notifications.filter(
        (n) =>
          !n.isRead &&
          n.recipientType === recipientType &&
          (recipientType === 'admin' ? n.recipientId === 'all_admins' : n.recipientId === recipientId)
      )
      .length;
  },
  markAsRead: (notificationId) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === notificationId ? { ...n, isRead: true } : n
      ),
    }));
  },
  markAllAsRead: (recipientType, recipientId) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.recipientType === recipientType &&
        (recipientType === 'admin' ? n.recipientId === 'all_admins' : n.recipientId === recipientId)
          ? { ...n, isRead: true }
          : n
      ),
    }));
  },
  _clearAllNotifications: () => set({ notifications: [] }),
}));

// Helper function to dispatch notifications (can be called from other stores/actions)
export const notify = {
  admin: (message: string, type: AppNotification['type'], link?: string) => {
    useNotificationStore.getState().addNotification(message, 'admin', 'all_admins', type, link);
  },
  partner: (partnerId: string, message: string, type: AppNotification['type'], link?: string) => {
    useNotificationStore.getState().addNotification(message, 'partner', partnerId, type, link);
  },
};
