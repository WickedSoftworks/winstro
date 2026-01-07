import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import colors from '../../colors';
import commonAppConfigDirs from './config_dirs';

async function backup_configs(backup_path?: string): Promise<string> {
    try {
        colors.green('[✓] [winstro::backup_configs]: Starting configuration backup...');
        
        // Determine backup location
        const defaultBackupDir = path.join(process.env.USERPROFILE || '', 'AppData', 'Local', 'winstro-backups');
        const actualBackupDir = backup_path || defaultBackupDir;
        
        // Create backup directory if it doesn't exist
        if (!fs.existsSync(actualBackupDir)) {
            fs.mkdirSync(actualBackupDir, { recursive: true });
        }
        
        // Create timestamp for backup file
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `winstro-backup-${timestamp}.tar.gz`;
        const backupFilePath = path.join(actualBackupDir, backupFileName);
        
        // Create a temporary directory for staging config files
        const tempDir = path.join(actualBackupDir, 'temp-backup');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // Copy all config directories to temp directory
        colors.green('[✓] [winstro::backup_configs]: Copying configuration directories...');
        let copiedCount = 0;
        for (const configDir of commonAppConfigDirs) {
            const expandedPath = expandEnvVars(configDir);
            if (fs.existsSync(expandedPath)) {
                const destName = configDir.replace(/[%\\:]/g, '_');
                const destPath = path.join(tempDir, destName);
                try {
                    copyDirSync(expandedPath, destPath);
                    copiedCount++;
                } catch (err) {
                    colors.yellow(`[⚠ ] [winstro::backup_configs]: Failed to copy ${configDir}: ${err}`);
                }
            }
        }
        
        colors.green(`[✓] [winstro::backup_configs]: Copied ${copiedCount} configuration directories`);
        
        // Create a metadata file with the mapping
        const metadata = {
            timestamp: new Date().toISOString(),
            dirs: commonAppConfigDirs,
            copiedDirs: copiedCount,
        };
        fs.writeFileSync(path.join(tempDir, '_backup_metadata.json'), JSON.stringify(metadata, null, 2));
        
        // Compress to tar.gz
        colors.green('[✓] [winstro::backup_configs]: Compressing backup...');
        await compressDirectory(tempDir, backupFilePath);
        
        // Clean up temp directory
        fs.rmSync(tempDir, { recursive: true, force: true });
        
        colors.green(`[✓] [winstro::backup_configs]: Backup complete! Saved to: ${backupFilePath}`);
        console.log(`Size: ${(fs.statSync(backupFilePath).size / 1024 / 1024).toFixed(2)} MB`);
        
        return backupFilePath;
    } catch (err) {
        colors.yellow(`[✗] [winstro::backup_configs]: Backup failed: ${err}`);
        throw err;
    }
}

function expandEnvVars(str: string): string {
    return str.replace(/%USERPROFILE%/g, process.env.USERPROFILE || '')
              .replace(/%APPDATA%/g, process.env.APPDATA || '')
              .replace(/%LOCALAPPDATA%/g, process.env.LOCALAPPDATA || '');
}

function copyDirSync(src: string, dest: string): void {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    
    const files = fs.readdirSync(src);
    for (const file of files) {
        const srcPath = path.join(src, file);
        const destPath = path.join(dest, file);
        const stat = fs.statSync(srcPath);
        
        if (stat.isDirectory()) {
            copyDirSync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

async function compressDirectory(sourceDir: string, outputFile: string): Promise<void> {
    const tar = require('tar');
    await tar.c({ gzip: true, file: outputFile }, [sourceDir]);
}

export default backup_configs;
