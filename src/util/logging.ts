import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import colors from './colors';

const ROOT_DIR = process.cwd();
const LOGS_DIR = path.join(ROOT_DIR, 'logs');

if (!fs.existsSync(LOGS_DIR)) {
    try {
        fs.mkdirSync(LOGS_DIR, { recursive: true });
    } catch (err) {}
}

function timestamp(): string {
    return new Date().toISOString();
}

export function createTaskLogger(taskName: string) {
    const filePath = path.join(LOGS_DIR, `${taskName}.log`);

    function write(line: string, color?: string) {
        const formatted = `[${timestamp()}] ${line.replace(/\r?\n$/,'')}\n`;
        try {
            fs.appendFileSync(filePath, formatted, { encoding: 'utf8' });
            // Also log in the console to prevent repeating logging everywhere
            (colors as any)[color ?? 'blue'](formatted);
        } catch (e) {
            try {
                fs.mkdirSync(path.dirname(filePath), { recursive: true });
                fs.appendFileSync(filePath, formatted, { encoding: 'utf8' });
            } catch {}
        }
    }

    return {
        log: (msg: string, color?: string) => write(msg, color),
        file: filePath,
    };
}

export function logNow(taskName: string, message: string) {
    const logger = createTaskLogger(taskName);
    logger.log(message);
}

export default { createTaskLogger, logNow };
