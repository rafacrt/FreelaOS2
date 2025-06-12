
'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from '@/hooks/useSession';
import { useNotificationStore } from '@/store/notification-store';
import type { AppNotification } from '@/lib/types';
import NotificationItem from './NotificationItem';
import { X } from 'lucide-react';

interface NotificationDropdownProps {
  onClose: () => void;
  show: boolean;
}

export default function NotificationDropdown({ onClose, show }: NotificationDropdownProps) {
  const session = useSession();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  
  const storeNotifications = useNotificationStore((state) => state.notifications);
  const getNotificationsForRecipient = useNotificationStore((state) => state.getNotificationsForRecipient);
  const markAllAsRead = useNotificationStore((state) => state.markAllAsRead);

  useEffect(() => {
    if (session) {
      const recipientId = session.sessionType === 'admin' ? 'all_admins' : session.id;
      setNotifications(getNotificationsForRecipient(session.sessionType, recipientId));
    } else {
      setNotifications([]);
    }
  }, [session, storeNotifications, getNotificationsForRecipient]);

  const handleMarkAllRead = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent dropdown from closing if inside
    if (session) {
      const recipientId = session.sessionType === 'admin' ? 'all_admins' : session.id;
      markAllAsRead(session.sessionType, recipientId);
    }
  };
  
  if (!show) return null;

  return (
    <div 
        className="position-absolute bg-body border rounded shadow-lg mt-2 end-0" 
        style={{ 
            width: '350px', 
            maxHeight: '400px', 
            zIndex: 1050, // Ensure it's above other elements
            overflowY: 'hidden', // Prevent double scrollbar, list-group handles its own
            display: 'flex',
            flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()} // Prevent clicks inside from closing immediately if parent handles that
    >
      <div className="d-flex justify-content-between align-items-center p-2 border-bottom bg-light">
        <h6 className="mb-0 small fw-bold text-muted text-uppercase">Notificações</h6>
        <button 
            type="button" 
            className="btn-close btn-sm" 
            aria-label="Fechar notificações"
            onClick={onClose}
        ></button>
      </div>

      {notifications.length === 0 ? (
        <div className="p-3 text-center text-muted small">Nenhuma notificação nova.</div>
      ) : (
        <div className="list-group list-group-flush overflow-auto flex-grow-1" style={{ maxHeight: 'calc(400px - 80px)'}}>
          {notifications.slice(0, 10).map((notification) => ( // Show latest 10
            <NotificationItem key={notification.id} notification={notification} />
          ))}
        </div>
      )}
      {notifications.length > 0 && (
        <div className="p-2 border-top text-center bg-light">
          <button 
            className="btn btn-sm btn-link text-primary" 
            onClick={handleMarkAllRead}
            disabled={notifications.every(n => n.isRead)}
            >
            Marcar todas como lidas
          </button>
          {/* <Link href="/notifications" className="btn btn-sm btn-outline-secondary ms-2" onClick={onClose}>
            Ver todas
          </Link> */}
        </div>
      )}
    </div>
  );
}
