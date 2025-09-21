import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({ children, className = '' }) => {
  return (
    <div className={`bg-white rounded-xl shadow-lg border border-gray-200/75 p-6 sm:p-8 ${className}`}>
      {children}
    </div>
  );
};

export default Card;