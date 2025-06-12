
'use client';

import type { AppNotification } from '@/lib/types';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertCircle, CheckCircle, Info, FileText, XCircle } from 'lucide-react';
import { useNotificationStore } from '@/store/notification-store';

interface NotificationItemProps {
  notification: AppNotification;
}

const getIconForType = (type: AppNotification['type']) => {
  switch (type) {
    case 'os_created_by_partner':
      return <FileText size={16} className="text-primary me-2 flex-shrink-0" />;
    case 'os_approved':
      return <CheckCircle size={16} className="text-success me-2 flex-shrink-0" />;
    case 'os_refused':
      return <XCircle size={16} className="text-danger me-2 flex-shrink-0" />;
    case 'os_status_changed':
      return <Info size={16} className="text-info me-2 flex-shrink-0" />;
    default:
      return <AlertCircle size={16} className="text-secondary me-2 flex-shrink-0" />;
  }
};

export default function NotificationItem({ notification }: NotificationItemProps) {
  const markAsRead = useNotificationStore((state) => state.markAsRead);

  const handleNotificationClick = () => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
    // Navegação será feita pelo Link se houver `notification.link`
  };

  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), {
    addSuffix: true,
    locale: ptBR,
  });

  const itemContent = (
    <div
      className={`list-group-item list-group-item-action py-2 px-3 border-0 border-bottom ${
        notification.isRead ? 'bg-light-subtle text-muted' : 'bg-white fw-medium'
      }`}
      onClick={!notification.link ? handleNotificationClick : undefined} // Mark as read on click if no link
      style={{ cursor: notification.link ? 'default' : 'pointer' }}
    >
      <div className="d-flex w-100 justify-content-between align-items-start">
        <div className="d-flex align-items-center">
          {getIconForType(notification.type)}
          <p className="mb-1 small text-break" style={{lineHeight: '1.3'}}>
            {notification.message}
          </p>
        </div>
        {!notification.isRead && (
          <span className="badge bg-primary rounded-pill" style={{fontSize: '0.6em', marginTop: '0.2rem'}}>Nova</span>
        )}
      </div>
      <small className="text-muted" style={{ fontSize: '0.75em' }}>{timeAgo}</small>
    </div>
  );

  if (notification.link) {
    return (
      <Link href={notification.link} passHref legacyBehavior>
        <a className="text-decoration-none" onClick={handleNotificationClick}>
          {itemContent}
        </a>
      </Link>
    );
  }

  return itemContent;
}
