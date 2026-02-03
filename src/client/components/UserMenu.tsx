import React, { useState, useRef, useEffect } from 'react';
import './UserMenu.css';

interface UserMenuProps {
  onOpenChangelog: () => void;
  onToggleTheme: () => void;
  onLogout: () => void;
  theme: 'light' | 'dark';
  hasUnreadChangelog: boolean;
}

export const UserMenu: React.FC<UserMenuProps> = ({
  onOpenChangelog,
  onToggleTheme,
  onLogout,
  theme,
  hasUnreadChangelog,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleChangelogClick = () => {
    onOpenChangelog();
    setIsOpen(false);
  };

  const handleThemeClick = () => {
    onToggleTheme();
    setIsOpen(false);
  };

  const handleLogoutClick = () => {
    onLogout();
    setIsOpen(false);
  };

  return (
    <div className="user-menu" ref={menuRef}>
      <button
        className="user-menu-trigger"
        onClick={() => setIsOpen(!isOpen)}
        title="User Menu"
      >
        <span className="user-icon">👤</span>
        {hasUnreadChangelog && <span className="user-menu-badge"></span>}
      </button>

      {isOpen && (
        <div className="user-menu-dropdown">
          <button className="user-menu-item" onClick={handleChangelogClick}>
            <span className="menu-item-icon">✨</span>
            <span className="menu-item-text">What's New</span>
            {hasUnreadChangelog && <span className="menu-item-badge">NEW</span>}
          </button>

          <button className="user-menu-item" onClick={handleThemeClick}>
            <span className="menu-item-icon">{theme === 'light' ? '🌙' : '☀️'}</span>
            <span className="menu-item-text">
              {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
            </span>
          </button>

          <div className="user-menu-divider"></div>

          <button className="user-menu-item user-menu-item-danger" onClick={handleLogoutClick}>
            <span className="menu-item-icon">🚪</span>
            <span className="menu-item-text">Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
};
