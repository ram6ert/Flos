import React from "react";
import { useTranslation } from "react-i18next";

type ActiveView = "courses" | "homework" | "documents" | "flow-schedule";

interface SidebarProps {
  activeView: ActiveView;
  onViewChange: (view: ActiveView) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, onViewChange }) => {
  const { t } = useTranslation();
  const menuItems = [
    { id: "courses", label: t("courses"), icon: "📚" },
    { id: "homework", label: t("homework"), icon: "📝" },
    { id: "documents", label: t("documents"), icon: "📄" },
    { id: "flow-schedule", label: t("schedule"), icon: "🌊" },
  ];

  return (
    <nav className="w-64 bg-white border-r border-gray-200 overflow-y-auto">
      {menuItems.map((item) => (
        <div
          key={item.id}
          className={`p-4 cursor-pointer border-b border-gray-100 transition-colors duration-200 hover:bg-gray-400 ${
            activeView === item.id
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "text-gray-700"
          }`}
          onClick={() => onViewChange(item.id as ActiveView)}
        >
          <span className="mr-2">{item.icon}</span>
          {item.label}
        </div>
      ))}
    </nav>
  );
};

export default Sidebar;
