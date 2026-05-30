# Winstro UI

Web-based UI for winstro - Windows as a distro, built with Next.js and ShadCN UI.

## Features

- **Dashboard**: Overview of installed packages, configured apps, and backup status
- **Package Management**: Browse, install, upgrade, and uninstall packages via winget
- **CLI Mode**: Launch native winstro CLI workflows from the frontend
- **Backup & Restore**: Create backups of application configurations and restore them
- **Configuration**: Manage requirements.winget.ts and generate config from installed packages
- **Desktop Build**: Compile to an optimized Windows Electron executable

## Getting Started

### Prerequisites

- Bun runtime
- Windows with winget installed
- Winstro parent project

### Installation

1. Navigate to the UI directory:
```bash
cd src/ui
```

2. Install dependencies (if not already installed):
```bash
bun install
```

### Development

Run the development server:

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
bun run build
bun run start
```

### Run Electron (Dev)

Start the web UI first:

```bash
bun run dev
```

Then in another terminal:

```bash
bun run electron:dev
```

### Build Windows Electron Installer

```bash
bun run dist:win
```

This produces a Windows NSIS installer in `src/ui/release`.

## Project Structure

```
src/ui/
├── app/
│   ├── api/              # API routes for backend integration
│   │   ├── backup/       # Backup creation endpoint
│   │   ├── cli/          # CLI launch endpoint
│   │   ├── config/       # Configuration management
│   │   ├── packages/     # Package installation/management
│   │   └── restore/      # Restore from backup
│   ├── backup/           # Backup & restore page
│   ├── cli/              # CLI mode page
│   ├── config/           # Configuration management page
│   ├── packages/         # Package browsing page
│   ├── layout.tsx        # Root layout
│   ├── page.tsx          # Dashboard
│   └── globals.css       # Global styles
├── electron/
│   ├── main.cjs          # Electron main process
│   └── preload.cjs       # Secure preload bridge
├── scripts/
│   └── prepare-electron.mjs # Build prep (standalone + compiled CLI)
├── components/
│   ├── ui/               # ShadCN UI components
│   └── navigation.tsx    # Sidebar navigation
└── lib/
    └── utils.ts          # Utility functions
```

## API Routes

### GET /api/packages
Get list of installed packages via winget

### POST /api/packages
Install, uninstall, or upgrade a package
```json
{
  "packageId": "Microsoft.PowerToys",
  "action": "install" | "uninstall" | "upgrade"
}
```

### POST /api/backup
Create a backup of application configurations

### POST /api/restore
Restore configurations from a backup file
```json
{
  "backupPath": "C:\\path\\to\\backup.tar.gz"
}
```

### GET /api/config
Get configured packages from requirements.winget.ts

### POST /api/config
Generate configuration file from installed packages

### POST /api/cli
Launch a CLI mode in a separate terminal window
```json
{
  "mode": "interactive" | "headless" | "write" | "backup" | "restore"
}
```

## Technologies

- **Framework**: Next.js 16
- **UI Library**: ShadCN UI
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Runtime**: Bun
- **Desktop Runtime**: Electron
- **Windows Packaging**: electron-builder (NSIS)

## Notes

- The UI communicates with the winstro backend via API routes
- Some operations (backup, restore, config generation) may require admin privileges
- Package operations are executed using PowerShell and winget
- Electron builds are branded with publisher/company metadata: **Wicked Softworks**

