# Configuration and Deployment Documentation

## Overview

The Smart Course Platform uses modern tooling for development, building, and deployment. The project is configured for cross-platform distribution with automated CI/CD pipelines.

## Development Configuration

### TypeScript Configuration

#### Main TypeScript Config (`tsconfig.json`)

Frontend and shared types configuration.

```json
{
  "compilerOptions": {
    "target": "ES2020", // Modern JavaScript target
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext", // Latest module system
    "moduleResolution": "bundler", // Bundler-aware resolution
    "jsx": "react-jsx", // React JSX transform
    "strict": true, // Strict type checking
    "noUnusedLocals": true, // Catch unused variables
    "noUnusedParameters": true, // Catch unused parameters
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true, // Speed up builds
    "isolatedModules": true, // Vite compatibility
    "noEmit": true, // Let Vite handle emit
    "resolveJsonModule": true, // JSON import support
    "allowImportingTsExtensions": true
  },
  "include": ["src/renderer", "src/shared"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

#### Node.js TypeScript Config (`tsconfig.node.json`)

Build tools and Node.js scripts configuration.

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.mjs"]
}
```

#### Main Process TypeScript Config (`tsconfig.main.json`)

Electron main process configuration.

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "CommonJS", // Node.js compatibility
    "target": "ES2020", // Node.js 16+ support
    "moduleResolution": "node", // Node.js resolution
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "declaration": false,
    "outDir": "dist/main"
  },
  "include": ["src/main/**/*"],
  "exclude": ["src/renderer", "node_modules"]
}
```

### Vite Configuration (`vite.config.mjs`)

Frontend build configuration with modern tooling.

```javascript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    react(), // React JSX/TSX support
    tailwindcss(), // TailwindCSS integration
  ],
  root: path.join(__dirname, "src/renderer"),
  base: "./", // Relative paths for Electron
  build: {
    outDir: path.join(__dirname, "dist/renderer"),
    emptyOutDir: true, // Clean output directory
    sourcemap: process.env.NODE_ENV === "development",
    minify: process.env.NODE_ENV === "production" ? "esbuild" : false,
    rollupOptions: {
      input: path.join(__dirname, "src/renderer/index.html"),
    },
  },
  server: {
    port: 5173, // Development server port
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src/renderer"),
      "@shared": path.resolve(__dirname, "src/shared"),
    },
  },
  css: {
    devSourcemap: process.env.NODE_ENV === "development",
  },
});
```

**Key Features:**

- **React Plugin**: JSX/TSX processing with hot reload
- **TailwindCSS**: Direct Vite integration
- **Path Aliases**: Clean import paths
- **Development Sourcemaps**: Enhanced debugging
- **Production Optimization**: ESBuild minification

### TailwindCSS Configuration (`tailwind.config.js`)

Utility-first CSS framework configuration.

```javascript
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./src/renderer/src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eff6ff", // Light blue
          500: "#3b82f6", // Primary blue
          600: "#2563eb", // Medium blue
          700: "#1d4ed8", // Dark blue
        },
      },
      spacing: {
        18: "4.5rem", // Custom spacing
        22: "5.5rem",
      },
      maxHeight: {
        96: "24rem", // Extended max heights
      },
      transitionDelay: {
        150: "150ms", // Custom transition timing
      },
      aspectRatio: {
        video: "16 / 9", // Video aspect ratio
      },
      gridTemplateRows: {
        0: "0fr", // Collapsed grid rows
        1: "1fr", // Expanded grid rows
      },
    },
  },
  plugins: [
    require("@tailwindcss/forms"), // Enhanced form styling
  ],
};
```

**Design System:**

- **Blue Color Palette**: Primary branding colors
- **Extended Spacing**: Additional size utilities
- **Custom Utilities**: Video ratios, grid templates
- **Form Plugin**: Enhanced form control styling

## Code Quality Configuration

### ESLint Configuration (`.eslintrc.json`)

TypeScript and React linting rules.

```json
{
  "extends": ["plugin:react-hooks/recommended"],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaFeatures": { "jsx": true },
    "ecmaVersion": 2020,
    "sourceType": "module"
  },
  "plugins": ["react-hooks", "unused-imports"],
  "rules": {
    "unused-imports/no-unused-imports": "error",
    "unused-imports/no-unused-vars": [
      "warn",
      {
        "vars": "all",
        "varsIgnorePattern": "^_",
        "args": "after-used",
        "argsIgnorePattern": "^_"
      }
    ],
    "@typescript-eslint/no-unused-vars": "off"
  },
  "settings": {
    "react": { "version": "detect" }
  },
  "ignorePatterns": ["dist/**/*"]
}
```

**Key Rules:**

- **React Hooks**: Enforces React Hooks rules
- **Unused Imports**: Automatic cleanup of unused imports
- **TypeScript Integration**: TypeScript-aware linting
- **Ignore Patterns**: Excludes build outputs

### Prettier Configuration (`.prettierrc`)

Code formatting standards.

```json
{
  "semi": true, // Semicolons required
  "trailingComma": "es5", // ES5 trailing commas
  "singleQuote": false, // Double quotes
  "printWidth": 80, // Line width limit
  "tabWidth": 2, // 2-space indentation
  "useTabs": false // Spaces over tabs
}
```

**Formatting Rules:**

- **Consistent Semicolons**: Required for clarity
- **Double Quotes**: Consistent string quoting
- **80 Character Limit**: Readable line lengths
- **2-Space Indentation**: Clean, consistent spacing

## Build Configuration

### Package.json Scripts

Development and build workflow commands.

```json
{
  "scripts": {
    // Development
    "dev": "concurrently \"yarn dev:vite\" \"yarn dev:electron\"",
    "dev:vite": "vite",
    "dev:electron": "cross-env NODE_ENV=development electron .",

    // Production Build
    "build": "cross-env NODE_ENV=production yarn build:vite && yarn build:electron",
    "build:vite": "cross-env NODE_ENV=production vite build",
    "build:electron": "esbuild src/main/index.ts --bundle --minify --platform=node --target=node16 --format=cjs --outfile=dist/main/index.min.js --external:electron --sourcemap && esbuild src/main/preload.ts --bundle --minify --target=chrome58 --outfile=dist/main/preload.js --external:electron --sourcemap",

    // Distribution
    "build:dist": "cross-env NODE_ENV=production yarn build && electron-builder",
    "build:win": "cross-env NODE_ENV=production yarn build && electron-builder --win",
    "build:mac": "cross-env NODE_ENV=production yarn build && electron-builder --mac",
    "build:linux": "cross-env NODE_ENV=production yarn build && electron-builder --linux",
    "build:all": "cross-env NODE_ENV=production yarn build && electron-builder --mac --win --linux",

    // Development Tools
    "preview": "vite preview",
    "lint": "eslint . --ext .ts,.tsx,.js,.jsx",
    "prettier": "prettier --write . --ignore-path .gitignore"
  }
}
```

### Electron Builder Configuration

Multi-platform distribution configuration in `package.json`.

```json
{
  "build": {
    "appId": "com.smartcourse.platform",
    "productName": "BAKA Course Platform",
    "directories": {
      "output": "release"
    },
    "files": [
      "dist/**/*",
      "assets/**/*",
      "package.json",
      "!**/*.map" // Exclude source maps
    ],
    "publish": {
      "provider": "github",
      "owner": "Baka-Course-Platform",
      "repo": "Baka-Course-Platform"
    },

    // macOS Configuration
    "mac": {
      "category": "public.app-category.education",
      "icon": "assets/icon.icns",
      "identity": null, // Disable code signing
      "gatekeeperAssess": false,
      "hardenedRuntime": false,
      "target": [
        { "target": "dmg", "arch": ["arm64"] },
        { "target": "zip", "arch": ["arm64"] }
      ]
    },

    // Windows Configuration
    "win": {
      "target": [
        { "target": "nsis", "arch": ["x64", "ia32"] },
        { "target": "portable", "arch": ["x64"] }
      ],
      "icon": "assets/icon.ico"
    },

    // Linux Configuration
    "linux": {
      "target": "AppImage",
      "icon": "assets/icon.png"
    },

    // NSIS Installer Configuration
    "nsis": {
      "oneClick": false, // Allow custom install location
      "allowToChangeInstallationDirectory": true
    }
  }
}
```

**Platform Targets:**

- **macOS**: DMG disk images and ZIP archives (ARM64)
- **Windows**: NSIS installers and portable executables (x64, ia32)
- **Linux**: AppImage packages (universal)

## CI/CD Pipeline

### GitHub Actions Workflow (`.github/workflows/build.yml`)

Automated build and release pipeline.

#### Build Job Matrix

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, windows-latest, macos-latest]

runs-on: ${{ matrix.os }}
```

**Cross-platform Build Strategy:**

- **Ubuntu**: Linux AppImage builds
- **Windows**: NSIS installer and portable builds
- **macOS**: DMG and ZIP builds (ARM64 optimized)

#### Build Steps

```yaml
steps:
  - name: Checkout code
    uses: actions/checkout@v4

  - name: Setup Node.js
    uses: actions/setup-node@v4
    with:
      node-version: "18"
      cache: "yarn"

  - name: Install dependencies
    run: yarn install --frozen-lockfile

  - name: Build distributables
    run: yarn build:dist
    env:
      NODE_ENV: production
      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Key Features:**

- **Node.js 18**: Modern JavaScript runtime
- **Yarn Caching**: Faster dependency installation
- **Frozen Lockfile**: Reproducible builds
- **Environment Variables**: Production configuration

#### Artifact Upload

Platform-specific artifact collection and storage.

```yaml
# Windows Artifacts
- name: Upload artifacts (Windows)
  if: matrix.os == 'windows-latest'
  uses: actions/upload-artifact@v4
  with:
    name: smart-course-platform-windows
    path: |
      release/*.exe
      release/*.msi
    retention-days: 30

# macOS Artifacts
- name: Upload artifacts (macOS)
  if: matrix.os == 'macos-latest'
  path: |
    release/*.dmg
    release/*.zip

# Linux Artifacts
- name: Upload artifacts (Linux)
  if: matrix.os == 'ubuntu-latest'
  path: |
    release/*.AppImage
    release/*.deb
    release/*.rpm
```

#### Release Job

Automated GitHub release creation and distribution.

```yaml
release:
  needs: build
  runs-on: ubuntu-latest
  if: github.ref == 'refs/heads/release' && github.event_name == 'push'

  steps:
    - name: Get version from package.json
      id: version
      run: echo "version=$(node -p "require('./package.json').version")" >> $GITHUB_OUTPUT

    - name: Create Release
      uses: softprops/action-gh-release@v1
      with:
        tag_name: v${{ steps.version.outputs.version }}
        name: BAKA Course Platform v${{ steps.version.outputs.version }}
        files: |
          artifacts/smart-course-platform-windows/*
          artifacts/smart-course-platform-macos/*
          artifacts/smart-course-platform-linux/*
        generate_release_notes: true
```

**Release Features:**

- **Automatic Versioning**: From package.json version
- **Multi-platform Assets**: All build artifacts included
- **Release Notes**: Auto-generated from commits
- **Public Distribution**: GitHub Releases integration

#### Repository Mirroring

Automated mirroring to public distribution repository.

```yaml
- name: Mirror release to public repository
  uses: softprops/action-gh-release@v1
  with:
    repository: Baka-Course-Platform/Baka-Course-Platform
    token: ${{ secrets.BAKA_ACCESS_TOKEN }}
```

#### Release Management

Automatic cleanup of old releases to maintain storage efficiency.

```yaml
- name: Keep only the latest releases
  uses: actions/github-script@v6
  with:
    script: |
      const releases = await github.rest.repos.listReleases({
        owner: 'Baka-Course-Platform',
        repo: 'Baka-Course-Platform'
      });

      const releasesToDelete = releases.data.slice(1);

      for (const release of releasesToDelete) {
        await github.rest.repos.deleteRelease({
          owner: 'Baka-Course-Platform',
          repo: 'Baka-Course-Platform',
          release_id: release.id
        });
      }
```

## Environment Configuration

### Development Environment

```bash
# Start development servers
yarn dev                    # Both Vite and Electron
yarn dev:vite              # Frontend only
yarn dev:electron          # Electron only

# Code quality
yarn lint                  # ESLint checking
yarn prettier             # Code formatting
```

### Production Build

```bash
# Full production build
yarn build                 # Build both frontend and backend
yarn build:dist           # Build and package for distribution

# Platform-specific builds
yarn build:win            # Windows installer
yarn build:mac            # macOS DMG/ZIP
yarn build:linux          # Linux AppImage
yarn build:all            # All platforms
```

### Environment Variables

```bash
NODE_ENV=development       # Development mode
NODE_ENV=production        # Production mode
GH_TOKEN=<token>          # GitHub release token
BAKA_ACCESS_TOKEN=<token> # Public repo access token
```

## Security Configuration

### Content Security Policy

Electron security best practices implemented:

```typescript
// Main process security
app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor');

// Renderer process isolation
webSecurity: true,
nodeIntegration: false,
contextIsolation: true,
preload: path.join(__dirname, 'preload.js')
```

### Secure Storage

- **Credentials**: Encrypted local storage
- **Session Tokens**: Secure cookie management
- **API Keys**: Environment variable injection
- **File Access**: Sandboxed file operations

## Monitoring and Logging

### Build Monitoring

- **GitHub Actions**: Build status and artifact tracking
- **Dependency Updates**: Automated vulnerability scanning
- **Performance Metrics**: Build time and size tracking

### Application Logging

```typescript
// Structured logging levels
Logger.event("Application startup");
Logger.debug("Debug information");
Logger.warn("Warning condition");
Logger.error("Error with details", error);
```

### Error Reporting

- **Client Errors**: Captured and logged locally
- **Build Errors**: GitHub Actions reporting
- **Runtime Errors**: Graceful error handling
- **Update Errors**: User-friendly error messages

## Deployment Best Practices

### Version Management

- **Semantic Versioning**: MAJOR.MINOR.PATCH format
- **Automated Tagging**: Git tags from package.json
- **Release Notes**: Generated from commit history
- **Rollback Strategy**: Previous release availability

### Distribution Strategy

- **Multi-platform**: Windows, macOS, Linux support
- **Auto-updates**: Built-in update checking
- **Offline Operation**: Full offline functionality
- **Progressive Updates**: Incremental feature rollouts

### Performance Optimization

- **Bundle Splitting**: Efficient code organization
- **Asset Optimization**: Compressed images and assets
- **Lazy Loading**: On-demand component loading
- **Memory Management**: Efficient resource usage
