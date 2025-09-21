
import React from 'react';

interface EmptyStateProps {
    Icon: React.FC<React.SVGProps<SVGSVGElement>>;
    title: string;
    message: string;
    children?: React.ReactNode;
}

const EmptyState: React.FC<EmptyStateProps> = ({ Icon, title, message, children }) => (
    <div className="text-center flex flex-col items-center justify-center h-full text-gray-500 bg-gray-50 rounded-lg p-8 border-2 border-dashed">
        <Icon className="h-16 w-16 text-gray-400 mb-4" strokeWidth={1} />
        <h3 className="text-xl font-semibold text-gray-800">{title}</h3>
        <p className="text-sm mt-1 max-w-sm mx-auto">{message}</p>
        {children && <div className="mt-6">{children}</div>}
    </div>
);

export default EmptyState;
