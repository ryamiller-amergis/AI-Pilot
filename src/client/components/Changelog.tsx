import React, { useState, useEffect } from 'react';
import './Changelog.css';

interface ChangelogChange {
  type: 'feature' | 'improvement' | 'bugfix' | 'breaking';
  description: string;
}

interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  changes: ChangelogChange[];
}

interface ChangelogProps {
  isOpen: boolean;
  onClose: () => void;
  onMarkAsRead: () => void;
}

export const Changelog: React.FC<ChangelogProps> = ({ isOpen, onClose, onMarkAsRead }) => {
  const [changelog, setChangelog] = useState<ChangelogEntry[]>([]);
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Fetch changelog data
    fetch('/CHANGELOG.json')
      .then(res => res.json())
      .then(data => {
        setChangelog(data);
        // Auto-expand the latest version
        if (data.length > 0) {
          setExpandedVersions(new Set([data[0].version]));
        }
      })
      .catch(err => console.error('Failed to load changelog:', err));
  }, []);

  const toggleVersion = (version: string) => {
    const newExpanded = new Set(expandedVersions);
    if (newExpanded.has(version)) {
      newExpanded.delete(version);
    } else {
      newExpanded.add(version);
    }
    setExpandedVersions(newExpanded);
  };

  const handleClose = () => {
    onMarkAsRead();
    onClose();
  };

  const getChangeIcon = (type: string) => {
    switch (type) {
      case 'feature':
        return '✨';
      case 'improvement':
        return '🚀';
      case 'bugfix':
        return '🐛';
      case 'breaking':
        return '⚠️';
      default:
        return '•';
    }
  };

  const getChangeClass = (type: string) => {
    switch (type) {
      case 'feature':
        return 'change-feature';
      case 'improvement':
        return 'change-improvement';
      case 'bugfix':
        return 'change-bugfix';
      case 'breaking':
        return 'change-breaking';
      default:
        return '';
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="changelog-overlay" onClick={handleClose} />
      <div className="changelog-modal">
        <div className="changelog-header">
          <div>
            <h2>What's New</h2>
            <p className="changelog-subtitle">Recent updates and improvements</p>
          </div>
          <button onClick={handleClose} className="changelog-close-btn">
            ×
          </button>
        </div>

        <div className="changelog-content">
          {changelog.length === 0 ? (
            <div className="changelog-loading">Loading changelog...</div>
          ) : (
            <div className="changelog-list">
              {changelog.map((entry, index) => (
                <div key={entry.version} className="changelog-entry">
                  <div 
                    className="changelog-entry-header"
                    onClick={() => toggleVersion(entry.version)}
                  >
                    <div className="changelog-entry-info">
                      <div className="changelog-version-row">
                        <span className="changelog-version">v{entry.version}</span>
                        {index === 0 && <span className="changelog-new-badge">NEW</span>}
                      </div>
                      <h3 className="changelog-title">{entry.title}</h3>
                      <span className="changelog-date">{new Date(entry.date).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}</span>
                    </div>
                    <span className="changelog-toggle">
                      {expandedVersions.has(entry.version) ? '▼' : '▶'}
                    </span>
                  </div>

                  {expandedVersions.has(entry.version) && (
                    <div className="changelog-changes">
                      {entry.changes.map((change, changeIndex) => (
                        <div key={changeIndex} className={`changelog-change ${getChangeClass(change.type)}`}>
                          <span className="change-icon">{getChangeIcon(change.type)}</span>
                          <span className="change-description">{change.description}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="changelog-footer">
          <button onClick={handleClose} className="changelog-done-btn">
            Got it!
          </button>
        </div>
      </div>
    </>
  );
};
