import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "./common/StyledComponents";

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

      const api = window.electronAPI;

      if (!api?.checkForUpdates) {
        console.warn("Update API unavailable in current context");
        return;
      }

      const result = await api.checkForUpdates();

      if (result.hasUpdate && result.updateInfo) {
        console.log(
          `New version found: ${result.updateInfo.version} (current: ${result.currentVersion})`
        );
      } else if (result.error) {
        console.error("Update check failed:", result.error);
      } else {
        console.log(`Already using latest version (${result.currentVersion})`);
      }
    } catch (error) {
      console.error("Error occurred while checking for updates:", error);
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
        <Button
          onClick={handleCheckUpdates}
          disabled={isCheckingUpdates}
          variant="secondary"
          size="md"
          className="w-full flex items-center justify-center text-gray-700 bg-gray-100 hover:bg-gray-200"
        >
          <span className={`mr-2 ${isCheckingUpdates ? "animate-spin" : ""}`}>
            {isCheckingUpdates ? "⏳" : ""}
          </span>
          {isCheckingUpdates ? t("checkingUpdates") : t("checkUpdates")}
        </Button>
      </div>
    </nav>
  );
};

export default Sidebar;
