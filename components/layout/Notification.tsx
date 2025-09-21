
import React from 'react';
import { NotificationType } from '../../types';

interface NotificationProps {
  notification: NotificationType;
}

const Notification: React.FC<NotificationProps> = ({ notification }) => {
  if (!notification.show) return null;

  const baseClasses = 'fixed top-5 right-5 text-white px-6 py-3 rounded-lg shadow-2xl z-50 transform transition-all duration-300';
  const stateClasses = notification.show ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0';
  
  const colors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500'
  };

  return (
    <div className={`${baseClasses} ${colors[notification.type]} ${stateClasses}`}>
      {notification.message}
    </div>
  );
};

export default Notification;
