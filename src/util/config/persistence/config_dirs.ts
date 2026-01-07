// Common application directories that store user configurations
// These are apps that users typically have and would find annoying to reconfigure
const commonAppConfigDirs: string[] = [
    // Development Tools
    '%USERPROFILE%\\.vscode',           // Visual Studio Code
    '%USERPROFILE%\\.ssh',              // SSH keys
    '%USERPROFILE%\\.git',              // Git configuration
    '%USERPROFILE%\\.docker',           // Docker configuration
    '%USERPROFILE%\\AppData\\Local\\Programs\\Git',  // Git for Windows
    '%USERPROFILE%\\AppData\\Local\\Microsoft\\VSCode', // VS Code settings
    '%APPDATA%\\Code',                  // VS Code backup location

    // Browsers
    '%USERPROFILE%\\AppData\\Local\\Google\\Chrome',  // Google Chrome
    '%APPDATA%\\Mozilla\\Firefox', // Mozilla Firefox
    '%USERPROFILE%\\AppData\\Local\\Microsoft\\Edge', // Microsoft Edge

    // Communication
    '%USERPROFILE%\\AppData\\Local\\Discord', // Discord

    // Media
    '%USERPROFILE%\\AppData\\Local\\VLC',     // VLC Media Player
    '%USERPROFILE%\\AppData\\Local\\Spotify', // Spotify
    '%APPDATA%\\obs-studio',                  // OBS Studio

    // Productivity
    '%USERPROFILE%\\AppData\\Local\\Notion',  // Notion
    '%USERPROFILE%\\AppData\\Local\\Obsidian', // Obsidian Notes

    // Gaming
    '%USERPROFILE%\\AppData\\Local\\Steam',   // Steam
    '%USERPROFILE%\\AppData\\Local\\Epic Games', // Epic Games Launcher

    // Other Popular Apps
    '%USERPROFILE%\\AppData\\Local\\Telegram Desktop', // Telegram
    '%USERPROFILE%\\AppData\\Local\\Everything', // Everything Search
];

export default commonAppConfigDirs;
