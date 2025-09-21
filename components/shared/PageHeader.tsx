import React from 'react';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle }) => {
    return (
        <div className="mb-8 border-b border-gray-200 pb-5">
            <h2 className="text-3xl font-semibold tracking-tight text-gray-900">{title}</h2>
            {subtitle && <p className="mt-2 text-base text-gray-600">{subtitle}</p>}
        </div>
    );
}

export default PageHeader;