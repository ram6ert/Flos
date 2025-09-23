import React from "react";

interface UpdateStatusNotificationProps {
  type: "success" | "error" | "info";
  title: string;
  message: string;
  onClose: () => void;
}

const UpdateStatusNotification: React.FC<UpdateStatusNotificationProps> = ({
  type,
  title,
  message,
  onClose,
}) => {
  const getIcon = () => {
    switch (type) {
      case "success":
        return "✅";
      case "error":
        return "❌";
      case "info":
        return "ℹ️";
      default:
        return "ℹ️";
    }
  };

  const getBgColor = () => {
    switch (type) {
      case "success":
        return "bg-green-50 border-green-200";
      case "error":
        return "bg-red-50 border-red-200";
      case "info":
        return "bg-blue-50 border-blue-200";
      default:
        return "bg-blue-50 border-blue-200";
    }
  };

  const getTextColor = () => {
    switch (type) {
      case "success":
        return "text-green-800";
      case "error":
        return "text-red-800";
      case "info":
        return "text-blue-800";
      default:
        return "text-blue-800";
    }
  };

  return (
    <div className="fixed top-4 right-4 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
      <div className={`p-4 border-l-4 ${getBgColor()}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-start">
            <span className="text-xl mr-3">{getIcon()}</span>
            <div className="flex-1">
              <h3 className={`text-sm font-semibold ${getTextColor()}`}>
                {title}
              </h3>
              <p className={`text-sm mt-1 ${getTextColor()}`}>
                {message}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors text-lg ml-2"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateStatusNotification;

