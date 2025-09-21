import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-800 text-white p-4 mt-8">
      <div className="container mx-auto text-center text-sm">
        © {new Date().getFullYear()} 個人財務導航中心。
      </div>
    </footer>
  );
};

export default Footer;
