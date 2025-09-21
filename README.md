# Smart Course Platform

An Electron-based desktop application for convenient access to course information, homework management, and document downloads.

## Features

- 📚 Course management and overview
- 📝 Homework tracking with due dates
- 📄 Document downloads and organization
- 📢 Announcements (coming soon)
- 🎨 Clean, modern interface

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
- `yarn preview` - Preview production build