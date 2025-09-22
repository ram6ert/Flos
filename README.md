# BAKA Course Platform

An Electron-based desktop application for convenient access to course information, homework management, and document downloads with full GBK encoding support.

## Features

- 📚 Course management and overview with real-time updates
- 📝 Homework tracking with due dates and submission status
- 📄 Document downloads and organization
- 📅 Weekly schedule visualization with flow-based layout
- 🔤 Full GBK encoding support for Chinese content
- 🎨 Clean, modern interface with responsive design

## Tech Stack

- **Electron** - Desktop app framework
- **React** - Frontend framework
- **TypeScript** - Type safety
- **Vite** - Fast build tool
- **CSS** - Styling

## Development

### Prerequisites

- Node.js (v16 or higher)
- Yarn package manager

### Setup

1. Install dependencies:

```bash
yarn install
```

2. Start development server:

```bash
yarn dev
```

This will start both the Vite dev server and Electron app.

### Building

Build the application for production:

```bash
yarn build
```

Create distributable packages:

```bash
yarn build:dist
```

## Project Structure

```
src/
├── main/           # Electron main process
│   ├── index.ts    # Main entry point
│   └── preload.ts  # Preload script
├── renderer/       # React frontend
│   └── src/
│       ├── components/  # React components
│       ├── App.tsx     # Main app component
│       └── main.tsx    # React entry point
└── shared/         # Shared types and utilities
    └── types.ts    # TypeScript type definitions
```

## Scripts

- `yarn dev` - Start development environment
- `yarn build` - Build for production
- `yarn build:dist` - Create distributable packages
- `yarn build:win` - Build Windows distributables
- `yarn build:mac` - Build macOS distributables
- `yarn build:linux` - Build Linux distributables
- `yarn build:all` - Build for all platforms
- `yarn preview` - Preview production build
- `yarn lint` - Run ESLint code analysis
- `yarn prettier` - Format code with Prettier

## Download

Get the latest release from our [GitHub Releases page](https://github.com/Baka-Course-Platform/Baka-Course-Platform/releases) with builds available for:

- **Windows**: `.exe` installer and `.msi` package
- **macOS**: `.dmg` disk image and `.zip` archive
- **Linux**: `.AppImage`, `.deb`, and `.rpm` packages
