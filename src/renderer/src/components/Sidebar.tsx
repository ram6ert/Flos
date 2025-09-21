import React from 'react';

type ActiveView = 'courses' | 'homework' | 'documents' | 'schedule';

interface SidebarProps {
  activeView: ActiveView;
  onViewChange: (view: ActiveView) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, onViewChange }) => {
  const menuItems = [
    { id: 'courses', label: 'Courses', icon: '📚' },
    { id: 'homework', label: 'Homework', icon: '📝' },
    { id: 'documents', label: 'Documents', icon: '📄' },
    { id: 'schedule', label: 'Schedule', icon: '📅' },
  ];

  return (
    <nav className="sidebar">
      {menuItems.map((item) => (
        <div
          key={item.id}
          className={`nav-item ${activeView === item.id ? 'active' : ''}`}
          onClick={() => onViewChange(item.id as ActiveView)}
        >
          <span style={{ marginRight: '0.5rem' }}>{item.icon}</span>
          {item.label}
        </div>
      ))}
    </nav>
  );
};

export default Sidebar;