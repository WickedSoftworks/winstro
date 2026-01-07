import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import colors from '../../colors';
import commonAppConfigDirs from './config_dirs';

interface DiskInfo {
    diskNumber: number;
    totalSize: number;
    freeSpace: number;
    friendlyName: string;
}

interface PartitionInfo {
    driveLetter: string;
    isAvailable: boolean;
}

async function smart_backup(backupFilePath?: string): Promise<void> {
    try {
        // Step 0: Backup file creation
        colors.green(`[✓] [winstro::smart_backup]: Creating the config backup...`);
        // Always create the backup via backup_configs() and use that file
        const generatedBackupPath = await backup_configs();
        backupFilePath = generatedBackupPath;
        colors.green(`[✓] [winstro::smart_backup]: Config backup created: ${backupFilePath}`);
        
        // Step 1: Get backup file size
        colors.green('[✓] [winstro::smart_backup]: Calculating backup size...');
        const backupSize = fs.statSync(backupFilePath).size;
        const backupSizeMB = backupSize / 1024 / 1024;
        const backupSizeGB = backupSizeMB / 1024;
        colors.green(`[✓] [winstro::smart_backup]: Backup size: ${backupSizeGB.toFixed(2)} GB`);

        // Step 2: Find main disk
        colors.green('[✓] [winstro::smart_backup]: Finding main disk...');
        const mainDisk = await findMainDisk();
        colors.green(`[✓] [winstro::smart_backup]: Main disk found: ${mainDisk.friendlyName} (Disk ${mainDisk.diskNumber})`);
        colors.green(`[i] [winstro::smart_backup]: Total: ${(mainDisk.totalSize / 1024 / 1024 / 1024).toFixed(2)} GB, Free: ${(mainDisk.freeSpace / 1024 / 1024 / 1024).toFixed(2)} GB`);

        // Step 3: Check if there's enough space
        const requiredSpace = backupSize * 1.1; // 10% buffer
        if (mainDisk.freeSpace < requiredSpace) {
            colors.yellow(`[✗] [winstro::smart_backup]: Not enough free space. Required: ${(requiredSpace / 1024 / 1024 / 1024).toFixed(2)} GB, Available: ${(mainDisk.freeSpace / 1024 / 1024 / 1024).toFixed(2)} GB`);
            throw new Error('Insufficient disk space for partition creation');
        }

        // Step 4: Find available drive letter
        colors.green('[✓] [winstro::smart_backup]: Finding available drive letter...');
        const driveLetter = await findAvailableDriveLetter();
        colors.green(`[✓] [winstro::smart_backup]: Drive letter available: ${driveLetter}:`);

        // Step 5: Create partition
        colors.green(`[✓] [winstro::smart_backup]: Creating partition on Disk ${mainDisk.diskNumber}...`);
        const partitionInfo = await createPartition(mainDisk.diskNumber, backupSize, driveLetter);
        colors.green(`[✓] [winstro::smart_backup]: Partition created: ${driveLetter}:`);

        // Step 6: Format partition
        colors.green(`[✓] [winstro::smart_backup]: Formatting partition as NTFS...`);
        await formatPartition(driveLetter, 'winstro-backup');
        colors.green(`[✓] [winstro::smart_backup]: Partition formatted and labeled: winstro-backup`);

        // Step 7: Move backup to partition
        colors.green(`[✓] [winstro::smart_backup]: Moving backup to ${driveLetter}:\\...`);
        const fileName = path.basename(backupFilePath);
        const newBackupPath = path.join(`${driveLetter}:\\`, fileName);
        await moveFile(backupFilePath, newBackupPath);
        colors.green(`[✓] [winstro::smart_backup]: Backup moved to ${newBackupPath}`);

        console.log(`\n${colors.green('✓ SUCCESS')} Backup partition created!`);
        console.log(`Drive Letter: ${driveLetter}:`);
        console.log(`Label: winstro-backup`);
        console.log(`Format: NTFS`);
        console.log(`Backup Location: ${newBackupPath}\n`);
    } catch (err) {
        colors.yellow(`[✗] [winstro::smart_backup]: Operation failed: ${err}`);
        throw err;
    }
}

async function findMainDisk(): Promise<DiskInfo> {
    try {
        const psCommand = `
            Get-Disk | Where-Object { $_.BusType -ne 'USB' } | Select-Object -First 1 | 
            ForEach-Object {
                $freeSpace = (Get-Partition -DiskNumber $_.Number | Measure-Object -Property Size -Sum).Sum
                $usedSpace = Get-PartitionSupportedSize -DriveLetter C: -ErrorAction SilentlyContinue
                @{
                    DiskNumber = $_.Number
                    TotalSize = $_.Size
                    FreeSpace = ($_.Size - $freeSpace)
                    FriendlyName = $_.FriendlyName
                } | ConvertTo-Json
            }
        `;
        
        const result = execSync(`powershell -Command "${psCommand.replace(/"/g, '\\"')}"`, { encoding: 'utf-8' });
        const diskInfo = JSON.parse(result);
        
        return {
            diskNumber: diskInfo.DiskNumber,
            totalSize: diskInfo.TotalSize,
            freeSpace: diskInfo.FreeSpace,
            friendlyName: diskInfo.FriendlyName,
        };
    } catch (err) {
        colors.yellow(`[⚠] [winstro::smart_backup]: Error finding disk: ${err}`);
        throw err;
    }
}

async function findAvailableDriveLetter(): Promise<string> {
    try {
        // Start with W: as preferred, then try others
        const preferredLetter = 'W';
        const psCommand = `
            @{
                Preferred = '${preferredLetter}'
                UsedLetters = ([System.IO.DriveInfo]::GetDrives() | ForEach-Object { $_.Name[0] })
            } | ConvertTo-Json
        `;
        
        const result = execSync(`powershell -Command "${psCommand.replace(/"/g, '\\"')}"`, { encoding: 'utf-8' });
        const driveInfo = JSON.parse(result);
        const usedLetters = driveInfo.UsedLetters;

        // Check if W: is available
        if (!usedLetters.includes(preferredLetter)) {
            return preferredLetter;
        }

        // Find next available letter
        for (let i = 90; i >= 65; i--) { // Z to A
            const letter = String.fromCharCode(i);
            if (!usedLetters.includes(letter)) {
                return letter;
            }
        }

        throw new Error('No available drive letters');
    } catch (err) {
        colors.yellow(`[⚠] [winstro::smart_backup]: Error finding drive letter: ${err}`);
        throw err;
    }
}

async function createPartition(diskNumber: number, sizeInBytes: number, driveLetter: string): Promise<void> {
    try {
        const psCommand = `
            $disk = Get-Disk -Number ${diskNumber}
            $partition = New-Partition -DiskNumber ${diskNumber} -Size ${sizeInBytes} -DriveLetter '${driveLetter}'
            $partition | Select-Object DriveLetter, Size | ConvertTo-Json
        `;
        
        execSync(`powershell -Command "${psCommand.replace(/"/g, '\\"')}"`, { encoding: 'utf-8' });
    } catch (err) {
        colors.yellow(`[⚠] [winstro::smart_backup]: Error creating partition: ${err}`);
        throw err;
    }
}

async function formatPartition(driveLetter: string, volumeLabel: string): Promise<void> {
    try {
        const psCommand = `
            Format-Volume -DriveLetter ${driveLetter} -FileSystem NTFS -NewFileSystemLabel "${volumeLabel}" -Confirm:$false
        `;
        
        execSync(`powershell -Command "${psCommand.replace(/"/g, '\\"')}"`, { encoding: 'utf-8' });
    } catch (err) {
        colors.yellow(`[⚠] [winstro::smart_backup]: Error formatting partition: ${err}`);
        throw err;
    }
}

async function moveFile(source: string, destination: string): Promise<void> {
    try {
        const psCommand = `
            Move-Item -Path "${source}" -Destination "${destination}" -Force
        `;
        
        execSync(`powershell -Command "${psCommand.replace(/"/g, '\\"')}"`, { encoding: 'utf-8' });
    } catch (err) {
        colors.yellow(`[⚠] [winstro::smart_backup]: Error moving file: ${err}`);
        throw err;
    }
}

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
                    colors.yellow(`[⚠] [winstro::backup_configs]: Failed to copy ${configDir}: ${err}`);
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

export default smart_backup;