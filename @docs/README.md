# Smart Course Platform Documentation

## Overview

This directory contains comprehensive documentation for the Smart Course Platform (BAKA Course Platform) - an Electron-based desktop application for convenient access to course information, homework, and documents.

## Documentation Structure

### [Project Architecture](./project-architecture.md)
Complete system architecture overview including:
- Technology stack and core frameworks
- Application structure and directory organization
- Data flow and IPC communication patterns
- Security considerations and performance optimizations
- Internationalization and build/deployment strategies

### [Frontend Components](./frontend-components.md)
React frontend documentation covering:
- Component architecture and hierarchy
- Reusable UI components library
- Authentication and navigation systems
- Data display components for courses, homework, and documents
- State management patterns and styling architecture
- Internationalization implementation and accessibility features

### [Backend APIs and Services](./backend-apis-services.md)
Electron main process documentation including:
- Core modules and service architecture
- Authentication and session management
- Data services with intelligent caching
- API communication and rate limiting
- File handling and streaming capabilities
- Error handling and logging systems

### [Data Models and Types](./data-models-types.md)
Comprehensive type system documentation covering:
- Shared TypeScript interfaces and types
- Authentication and session types
- Course, homework, and document data structures
- Schedule and timetable types
- Data transformation and sanitization
- Type safety patterns and validation

### [Configuration and Deployment](./configuration-deployment.md)
Development and deployment configuration including:
- TypeScript, Vite, and TailwindCSS configuration
- Code quality tools (ESLint, Prettier)
- Build system and Electron Builder setup
- CI/CD pipeline with GitHub Actions
- Cross-platform distribution strategy
- Security configuration and monitoring

## Quick Reference

### Key Technologies
- **Framework**: Electron + React 18 + TypeScript
- **Styling**: TailwindCSS with utility-first approach
- **Build Tools**: Vite + ESBuild + Electron Builder
- **State Management**: React hooks with prop drilling
- **Internationalization**: i18next with React integration
- **Testing**: GitHub Actions CI/CD pipeline

### Project Structure
```
src/
├── main/           # Electron main process (Node.js backend)
│   ├── handlers/   # IPC request handlers
│   ├── auth.ts     # Authentication management
│   ├── api.ts      # External API communication
│   ├── cache.ts    # Data caching system
│   └── ...
├── renderer/       # React frontend application
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── App.tsx      # Main application component
│   │   └── ...
└── shared/         # Shared types and utilities
    └── types/      # TypeScript type definitions
```

### Development Commands
```bash
# Development
yarn dev           # Start development servers
yarn lint          # Code linting
yarn prettier     # Code formatting

# Production
yarn build         # Build application
yarn build:dist    # Create distributables
yarn build:all     # Build for all platforms
```

### Documentation Updates

When modifying the codebase, update relevant documentation:

1. **Architecture Changes**: Update `project-architecture.md`
2. **New Components**: Document in `frontend-components.md`
3. **API Changes**: Update `backend-apis-services.md`
4. **Type Definitions**: Document in `data-models-types.md`
5. **Configuration Changes**: Update `configuration-deployment.md`

### File Naming Convention

Documentation files use descriptive, hyphenated names:
- `project-architecture.md` - Overall system design
- `frontend-components.md` - UI components and patterns
- `backend-apis-services.md` - Server-side functionality
- `data-models-types.md` - Type system and data structures
- `configuration-deployment.md` - Setup and deployment

## Contributing to Documentation

### Guidelines
1. **Keep documentation current** with code changes
2. **Use clear, concise language** for technical concepts
3. **Include code examples** where helpful
4. **Maintain consistent formatting** across all documents
5. **Update cross-references** when restructuring

### Markdown Standards
- Use descriptive headers (H1, H2, H3)
- Include code blocks with language specification
- Use bullet points for lists
- Add cross-references between documents
- Include practical examples and use cases

## Additional Resources

### External Documentation
- [Electron Documentation](https://www.electronjs.org/docs)
- [React Documentation](https://react.dev)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)
- [TailwindCSS Documentation](https://tailwindcss.com/docs)
- [Vite Documentation](https://vitejs.dev/guide)

### Development Tools
- [Visual Studio Code](https://code.visualstudio.com) - Recommended IDE
- [ESLint Extension](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
- [Prettier Extension](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
- [TypeScript Extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode.vscode-typescript-next)

## Support and Feedback

For questions about the documentation or suggestions for improvements:

1. **Review existing documentation** first
2. **Check code comments** for implementation details
3. **Consult external resources** for framework-specific questions
4. **Create issues** for documentation gaps or inaccuracies

---

*This documentation is maintained alongside the codebase to ensure accuracy and completeness.*