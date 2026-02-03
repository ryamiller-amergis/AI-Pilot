# Development Scripts

## Changelog Management

### Adding Changelog Entries

Use the interactive changelog helper to easily add new entries:

```bash
node scripts/add-changelog.js
```

This will guide you through:
1. Creating a new version or adding to the current version
2. Adding multiple changes with types (feature, improvement, bugfix, breaking)
3. Automatically updating the changelog file

### Changelog Entry Types

- **✨ Feature**: New functionality or capabilities
- **🚀 Improvement**: Enhancements to existing features
- **🐛 Bugfix**: Bug fixes and corrections
- **⚠️ Breaking**: Breaking changes that require attention


### Manual Editing

You can also manually edit `public/CHANGELOG.json` if needed. The structure is:

```json
{
  "version": "1.4.0",
  "date": "2026-02-03",
  "title": "Release Title",
  "changes": [
    {
      "type": "feature|improvement|bugfix|breaking",
      "description": "Description of the change"
    }
  ]
}
```

## Best Practices

1. Add changelog entries as you develop features
2. Be descriptive but concise in your change descriptions
3. Group related changes together in one version
4. Update the version number in App.tsx when releasing
5. Use semantic versioning (MAJOR.MINOR.PATCH)
