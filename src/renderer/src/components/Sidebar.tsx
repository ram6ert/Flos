import React, { useState } from "react";
import { useTranslation } from "react-i18next";

type ActiveView = "courses" | "homework" | "documents" | "flow-schedule";

interface SidebarProps {
  activeView: ActiveView;
  onViewChange: (view: ActiveView) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, onViewChange }) => {
  const { t } = useTranslation();
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);

  const menuItems = [
    { id: "courses", label: t("courses"), icon: "📚" },
    { id: "homework", label: t("homework"), icon: "📝" },
    { id: "documents", label: t("documents"), icon: "📄" },
    { id: "flow-schedule", label: t("schedule"), icon: "🌊" },
  ];

  const handleCheckUpdates = async () => {
    try {
      setIsCheckingUpdates(true);
      const result = await window.electronAPI.checkForUpdates();

      if (result.hasUpdate && result.updateInfo) {
        console.log(`发现新版本: ${result.updateInfo.version} (当前: ${result.currentVersion})`);
      } else if (result.error) {
        console.error("检查更新失败:", result.error);
      } else {
        console.log(`当前已是最新版本 (${result.currentVersion})`);
      }
    } catch (error) {
      console.error("检查更新时发生错误:", error);
    } finally {
      setIsCheckingUpdates(false);
    }
  };

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

      <div className="p-4 border-t border-gray-200">
        <button
          onClick={handleCheckUpdates}
          disabled={isCheckingUpdates}
          className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <span className={`mr-2 ${isCheckingUpdates ? "animate-spin" : ""}`}>
            {isCheckingUpdates ? "⏳" : ""}
          </span>
          {isCheckingUpdates ? t("checkingUpdates", "检查中...") : t("checkUpdates", "检查更新")}
        </button>
      </div>
    </nav>
  );
};

export default Sidebar;

