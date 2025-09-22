import React from "react";

// Common utility functions for conditional classes
export const cn = (...classes: (string | undefined | null | false)[]): string => {
  return classes.filter(Boolean).join(" ");
};

// Container component
interface ContainerProps {
  children: React.ReactNode;
  padding?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export const Container: React.FC<ContainerProps> = ({
  children,
  padding = "lg",
  className = ""
}) => {
  const paddingClasses = {
    sm: "p-4",
    md: "p-6",
    lg: "p-8",
    xl: "p-10"
  };

  return (
    <div className={cn("w-full", paddingClasses[padding], className)}>
      {children}
    </div>
  );
};

// Page Header component
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions
}) => {
  return (
    <div className="flex justify-between items-start mb-8 pb-4 border-b border-gray-200">
      <div>
        <h2 className={cn(
          "text-2xl font-semibold text-gray-900 m-0",
          subtitle && "mb-2"
        )}>
          {title}
        </h2>
        {subtitle && (
          <p className="text-base text-gray-600 m-0">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex gap-4">
          {actions}
        </div>
      )}
    </div>
  );
};

// Button component
interface ButtonProps {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "success" | "danger" | "warning";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  size = "md",
  disabled = false,
  onClick,
  type = "button",
}) => {
  const baseClasses = "border-none rounded-md cursor-pointer font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2";

  const variantClasses = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",
    secondary: "bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500",
    success: "bg-green-600 text-white hover:bg-green-700 focus:ring-green-500",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
    warning: "bg-yellow-500 text-white hover:bg-yellow-600 focus:ring-yellow-500",
  };

  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
  };

  const disabledClasses = disabled
    ? "opacity-60 cursor-not-allowed bg-gray-400 hover:bg-gray-400"
    : "";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        baseClasses,
        !disabled && variantClasses[variant],
        sizeClasses[size],
        disabledClasses
      )}
    >
      {children}
    </button>
  );
};

// Card component
interface CardProps {
  children: React.ReactNode;
  padding?: "sm" | "md" | "lg";
  shadow?: "sm" | "md" | "lg";
  onClick?: () => void;
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  padding = "md",
  shadow = "md",
  onClick,
  className = "",
}) => {
  const baseClasses = "bg-white border border-gray-200 rounded-md";

  const paddingClasses = {
    sm: "p-3",
    md: "p-4",
    lg: "p-6"
  };

  const shadowClasses = {
    sm: "shadow-sm",
    md: "shadow-md",
    lg: "shadow-lg"
  };

  const hoverClasses = onClick
    ? "cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
    : "";

  return (
    <div
      className={cn(
        baseClasses,
        paddingClasses[padding],
        shadowClasses[shadow],
        hoverClasses,
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

// Grid component
interface GridProps {
  children: React.ReactNode;
  columns?: string;
  gap?: "sm" | "md" | "lg";
}

export const Grid: React.FC<GridProps> = ({
  children,
  columns = "repeat(auto-fill, minmax(320px, 1fr))",
  gap = "md",
}) => {
  const gapClasses = {
    sm: "gap-3",
    md: "gap-4",
    lg: "gap-6"
  };

  return (
    <div
      className={cn("grid", gapClasses[gap])}
      style={{ gridTemplateColumns: columns }}
    >
      {children}
    </div>
  );
};

// Loading component
interface LoadingProps {
  message?: string;
}

export const Loading: React.FC<LoadingProps> = ({ message = "Loading..." }) => {
  return (
    <div className="flex flex-col items-center justify-center p-10 text-gray-600">
      <div className="w-8 h-8 border-2 border-transparent border-t-blue-600 rounded-full animate-spin mb-4" />
      <p className="m-0 text-base">{message}</p>
    </div>
  );
};

// Error component
interface ErrorDisplayProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  title = "Error",
  message,
  onRetry,
  retryLabel = "Try Again",
}) => {
  return (
    <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-800 mb-4">
      <h3 className="m-0 mb-2 font-semibold">{title}</h3>
      <p className="m-0">{message}</p>
      {onRetry && (
        <div className="mt-3">
          <Button variant="danger" size="sm" onClick={onRetry}>
            {retryLabel}
          </Button>
        </div>
      )}
    </div>
  );
};

// Info Banner component
interface InfoBannerProps {
  children: React.ReactNode;
  variant?: "info" | "warning" | "success";
}

export const InfoBanner: React.FC<InfoBannerProps> = ({
  children,
  variant = "info",
}) => {
  const variantClasses = {
    info: "bg-blue-50 border-blue-200 text-blue-800",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
    success: "bg-green-50 border-green-200 text-green-800",
  };

  return (
    <div className={cn(
      "border rounded-md p-3 mb-4 text-sm",
      variantClasses[variant]
    )}>
      {children}
    </div>
  );
};

// Form Group component
interface FormGroupProps {
  label: string;
  children: React.ReactNode;
  error?: string;
}

export const FormGroup: React.FC<FormGroupProps> = ({
  label,
  children,
  error,
}) => {
  return (
    <div className="mb-4">
      <label className="block mb-2 font-medium text-gray-900">
        {label}
      </label>
      {children}
      {error && (
        <div className="text-red-600 text-sm mt-2">
          {error}
        </div>
      )}
    </div>
  );
};

// Input component
interface InputProps {
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

export const Input: React.FC<InputProps> = ({
  type = "text",
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
}) => {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      className={cn(
        "w-full px-3 py-2 border border-gray-300 rounded-md text-base text-gray-700",
        "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
        disabled ? "bg-gray-100 cursor-not-allowed" : "bg-white"
      )}
    />
  );
};

// Utility function for creating responsive grid columns
export const createGridColumns = (minWidth: number = 320) => {
  return `repeat(auto-fill, minmax(${minWidth}px, 1fr))`;
};