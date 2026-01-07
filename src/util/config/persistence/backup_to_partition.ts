import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import colors from '../../colors';

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

async function backup_to_partition(backupFilePath: string): Promise<void> {
    try {
        // Step 1: Get backup file size
        colors.green('[✓] [winstro::backup_to_partition]: Calculating backup size...');
        const backupSize = fs.statSync(backupFilePath).size;
        const backupSizeMB = backupSize / 1024 / 1024;
        const backupSizeGB = backupSizeMB / 1024;
        colors.green(`[✓] [winstro::backup_to_partition]: Backup size: ${backupSizeGB.toFixed(2)} GB`);

        // Step 2: Find main disk
        colors.green('[✓] [winstro::backup_to_partition]: Finding main disk...');
        const mainDisk = await findMainDisk();
        colors.green(`[✓] [winstro::backup_to_partition]: Main disk found: ${mainDisk.friendlyName} (Disk ${mainDisk.diskNumber})`);
        colors.green(`[i] [winstro::backup_to_partition]: Total: ${(mainDisk.totalSize / 1024 / 1024 / 1024).toFixed(2)} GB, Free: ${(mainDisk.freeSpace / 1024 / 1024 / 1024).toFixed(2)} GB`);

        // Step 3: Check if there's enough space
        const requiredSpace = backupSize * 1.1; // 10% buffer
        if (mainDisk.freeSpace < requiredSpace) {
            colors.yellow(`[✗] [winstro::backup_to_partition]: Not enough free space. Required: ${(requiredSpace / 1024 / 1024 / 1024).toFixed(2)} GB, Available: ${(mainDisk.freeSpace / 1024 / 1024 / 1024).toFixed(2)} GB`);
            throw new Error('Insufficient disk space for partition creation');
        }

        // Step 4: Find available drive letter
        colors.green('[✓] [winstro::backup_to_partition]: Finding available drive letter...');
        const driveLetter = await findAvailableDriveLetter();
        colors.green(`[✓] [winstro::backup_to_partition]: Drive letter available: ${driveLetter}:`);

        // Step 5: Create partition
        colors.green(`[✓] [winstro::backup_to_partition]: Creating partition on Disk ${mainDisk.diskNumber}...`);
        const partitionInfo = await createPartition(mainDisk.diskNumber, backupSize, driveLetter);
        colors.green(`[✓] [winstro::backup_to_partition]: Partition created: ${driveLetter}:`);

        // Step 6: Format partition
        colors.green(`[✓] [winstro::backup_to_partition]: Formatting partition as NTFS...`);
        await formatPartition(driveLetter, 'winstro-backup');
        colors.green(`[✓] [winstro::backup_to_partition]: Partition formatted and labeled: winstro-backup`);

        // Step 7: Move backup to partition
        colors.green(`[✓] [winstro::backup_to_partition]: Moving backup to ${driveLetter}:\\...`);
        const fileName = path.basename(backupFilePath);
        const newBackupPath = path.join(`${driveLetter}:\\`, fileName);
        await moveFile(backupFilePath, newBackupPath);
        colors.green(`[✓] [winstro::backup_to_partition]: Backup moved to ${newBackupPath}`);

        console.log(`\n${colors.green('✓ SUCCESS')} Backup partition created!`);
        console.log(`Drive Letter: ${driveLetter}:`);
        console.log(`Label: winstro-backup`);
        console.log(`Format: NTFS`);
        console.log(`Backup Location: ${newBackupPath}\n`);
    } catch (err) {
        colors.yellow(`[✗] [winstro::backup_to_partition]: Operation failed: ${err}`);
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
        colors.yellow(`[⚠ ] [winstro::backup_to_partition]: Error finding disk: ${err}`);
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
        colors.yellow(`[⚠ ] [winstro::backup_to_partition]: Error finding drive letter: ${err}`);
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
        colors.yellow(`[⚠ ] [winstro::backup_to_partition]: Error creating partition: ${err}`);
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
        colors.yellow(`[⚠ ] [winstro::backup_to_partition]: Error formatting partition: ${err}`);
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
        colors.yellow(`[⚠ ] [winstro::backup_to_partition]: Error moving file: ${err}`);
        throw err;
    }
}

export default backup_to_partition;