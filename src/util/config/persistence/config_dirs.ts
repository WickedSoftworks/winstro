// Common application directories that store user configurations
// These are apps that users typically have and would find annoying to reconfigure
const commonAppConfigDirs: string[] = [
	// Development Tools
	"%USERPROFILE%\\.ssh", // SSH keys
	"%USERPROFILE%\\.git", // Git configuration
	"%USERPROFILE%\\.docker", // Docker configuration
	"%USERPROFILE%\\AppData\\Local\\Programs\\Git", // Git for Windows
	"%USERPROFILE%\\AppData\\Local\\Microsoft\\VSCode", // VS Code settings
	"%APPDATA%\\Code", // VS Code backup location

	// Browsers
	"%USERPROFILE%\\AppData\\Local\\Google\\Chrome", // Google Chrome
	"%APPDATA%\\Mozilla\\Firefox", // Mozilla Firefox
	"%USERPROFILE%\\AppData\\Local\\Microsoft\\Edge", // Microsoft Edge
	"%USERPROFILE%\\AppData\\Local\\BraveSoftware\\Brave-Browser", // Brave Browser
	"%APPDATA%\\zen", // Zen Browser
	"%USERPROFILE%\\AppData\\Local\\Arc", // Arc Browser

	// Communication
	"%USERPROFILE%\\AppData\\Local\\Discord", // Discord

	// Media
	"%USERPROFILE%\\AppData\\Local\\VLC", // VLC Media Player
	"%USERPROFILE%\\AppData\\Local\\Spotify", // Spotify
	"%APPDATA%\\obs-studio", // OBS Studio

	// Productivity
	"%USERPROFILE%\\AppData\\Local\\Notion", // Notion
	"%USERPROFILE%\\AppData\\Local\\Obsidian", // Obsidian Notes

	// Gaming
	"%USERPROFILE%\\AppData\\Local\\Steam", // Steam
	"%USERPROFILE%\\AppData\\Local\\Epic Games", // Epic Games Launcher

	// Other Popular Apps
	"%USERPROFILE%\\AppData\\Local\\Telegram Desktop", // Telegram
	"%USERPROFILE%\\AppData\\Local\\Everything", // Everything Search

	// Terminals & Shells
	"%LOCALAPPDATA%\\Packages\\Microsoft.WindowsTerminal_8wekyb3d8bbwe", // Windows Terminal (settings)
	"%USERPROFILE%\\Documents\\PowerShell", // PowerShell profile and modules

	// JetBrains IDEs
	"%APPDATA%\\JetBrains", // JetBrains IDE settings (IntelliJ, PyCharm, etc.)

	// Node & development runtimes
	"%USERPROFILE%\\.npm", // npm cache and config
	"%USERPROFILE%\\.nvm", // NVM for Windows

	// Editors
	"%USERPROFILE%\\.vscode", // Visual Studio Code
	"%USERPROFILE%\\.vscode-insiders", // VS Code Insiders
	"%USERPROFILE%\\.config\\nvim", // Neovim config

	// Package managers
	"%ProgramData%\\chocolatey", // Chocolatey
	"%USERPROFILE%\\scoop", // Scoop

	// Communication / Collaboration
	"%APPDATA%\\Slack", // Slack
	"%APPDATA%\\Microsoft\\Teams", // Microsoft Teams

	// Security / Keys
	"%USERPROFILE%\\.gnupg", // GnuPG keys and configs
	"%APPDATA%\\KeePass", // KeePass

	// VPN
	"%USERPROFILE%\\AppData\\Local\\Surfshark", // Surfshark VPN
];

export default commonAppConfigDirs;
