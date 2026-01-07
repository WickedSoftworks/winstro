import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import colors from '../../colors';

async function restore_configs(backupFilePath: string): Promise<void> {
    try {
        if (!fs.existsSync(backupFilePath)) {
            colors.yellow(`[✗] [winstro::restore_configs]: Backup file not found: ${backupFilePath}`);
            throw new Error(`Backup file not found: ${backupFilePath}`);
        }
        
        colors.green('[✓] [winstro::restore_configs]: Starting configuration restore...');
        
        // Create temporary extraction directory
        const tempDir = path.join(process.env.TEMP || process.env.TMP || '', 'winstro-restore');
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
        fs.mkdirSync(tempDir, { recursive: true });
        
        // Extract backup
        colors.green('[✓] [winstro::restore_configs]: Extracting backup...');
        await decompressFile(backupFilePath, tempDir);
        
        // Read metadata
        const metadataPath = path.join(tempDir, '_backup_metadata.json');
        if (!fs.existsSync(metadataPath)) {
            colors.yellow('[⚠ ] [winstro::restore_configs]: Warning: Backup metadata not found');
        }
        
        const metadata = fs.existsSync(metadataPath) 
            ? JSON.parse(fs.readFileSync(metadataPath, 'utf-8'))
            : null;
        
        // Restore configuration directories
        colors.green('[✓] [winstro::restore_configs]: Restoring configuration directories...');
        let restoredCount = 0;
        
        const files = fs.readdirSync(tempDir);
        for (const file of files) {
            if (file === '_backup_metadata.json') continue;
            
            const sourcePath = path.join(tempDir, file);
            const originalDirName = file.replace(/_/g, (match, offset) => {
                // Try to reconstruct the original path
                return match;
            });
            
            // Map back to original directory
            const configDirs = metadata?.dirs || [];
            const originalPath = configDirs.find((dir: string) => 
                dir.replace(/[%\\:]/g, '_') === file
            );
            
            if (originalPath) {
                const expandedPath = expandEnvVars(originalPath);
                try {
                    // Backup existing config first
                    if (fs.existsSync(expandedPath)) {
                        const backupSuffix = `.backup-${new Date().getTime()}`;
                        fs.renameSync(expandedPath, expandedPath + backupSuffix);
                        colors.yellow(`[⚠ ] [winstro::restore_configs]: Backed up existing config: ${originalPath}${backupSuffix}`);
                    }
                    
                    // Restore config
                    copyDirSync(sourcePath, expandedPath);
                    restoredCount++;
                    colors.green(`[✓] [winstro::restore_configs]: Restored ${originalPath}`);
                } catch (err) {
                    colors.yellow(`[⚠ ] [winstro::restore_configs]: Failed to restore ${originalPath}: ${err}`);
                }
            }
        }
        
        // Clean up temp directory
        fs.rmSync(tempDir, { recursive: true, force: true });
        
        colors.green(`[✓] [winstro::restore_configs]: Restore complete! Restored ${restoredCount} configuration directories`);
        if (metadata) {
            colors.green(`[ℹ ] [winstro::restore_configs]: Backup was created on: ${metadata.timestamp}`);
        }
    } catch (err) {
        colors.yellow(`[✗] [winstro::restore_configs]: Restore failed: ${err}`);
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

async function decompressFile(sourceFile: string, outputDir: string): Promise<void> {
    const tar = require('tar');
    await tar.x({ file: sourceFile, cwd: outputDir, strip: 1 });
}

export default restore_configs;
