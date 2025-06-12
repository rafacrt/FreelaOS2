
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { useSession } from '@/hooks/useSession';
import { useNotificationStore } from '@/store/notification-store';
import NotificationDropdown from './NotificationDropdown';

export default function NotificationBell() {
  const session = useSession();
  const [showDropdown, setShowDropdown] = useState(false);
  const unreadCount = useNotificationStore((state) => {
    if (!session) return 0;
    const recipientId = session.sessionType === 'admin' ? 'all_admins' : session.id;
    return state.getUnreadCountForRecipient(session.sessionType, recipientId);
  });
  const bellRef = useRef<HTMLDivElement>(null);

  const toggleDropdown = () => {
    setShowDropdown((prev) => !prev);
  };

  const closeDropdown = () => {
    setShowDropdown(false);
  };
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(event.target as Node)) {
        closeDropdown();
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);


  if (!session) { // Don't show bell if no session (e.g. on login page)
    return null;
  }

  return (
    <div className="position-relative" ref={bellRef}>
      <button
        className={`btn btn-sm position-relative ${
          showDropdown ? 'btn-primary' : (unreadCount > 0 ? 'btn-outline-primary' : 'btn-outline-secondary')
        }`}
        onClick={toggleDropdown}
        aria-label={`Notificações ${unreadCount > 0 ? `(${unreadCount} não lidas)` : ''}`}
        title="Notificações"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger border border-light" style={{fontSize: '0.6em', padding: '0.25em 0.4em'}}>
            {unreadCount > 9 ? '9+' : unreadCount}
            <span className="visually-hidden">notificações não lidas</span>
          </span>
        )}
      </button>
      <NotificationDropdown show={showDropdown} onClose={closeDropdown} />
    </div>
  );
}
