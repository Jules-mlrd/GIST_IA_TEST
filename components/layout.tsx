import React from "react";

interface LayoutProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ title, subtitle, children }) => {
  return (
    <div className="max-w-6xl mx-auto w-full py-8 px-2 md:px-0">
      {title && <h1 className="text-2xl font-bold mb-2">{title}</h1>}
      {subtitle && <h2 className="text-lg text-gray-600 mb-4">{subtitle}</h2>}
      {children}
    </div>
  );
};

export { Layout }; 