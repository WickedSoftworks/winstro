import { spawn } from "child_process";
import { createTaskLogger } from "./logging";

export function run(taskName: string, command: string, args: string[] = [], options: { shell?: boolean } = { shell: true }): Promise<{ code: number | null, stdout: string }>{
    const logger = createTaskLogger(taskName);
    return new Promise((resolve, reject) => {
        try {
            const child = spawn(command, args, { shell: options.shell ?? true });
            let stdout = '';

            child.stdout.on('data', (chunk) => {
                const txt = chunk.toString();
                stdout += txt;
                logger.log(txt);
            });

            child.stderr.on('data', (chunk) => {
                const txt = chunk.toString();
                logger.log(txt);
            });

            child.on('error', (err) => {
                logger.log(`[ERROR] ${err}`);
                reject(err);
            });

            child.on('close', (code) => {
                logger.log(`Process exited with code ${code}`);
                resolve({ code, stdout });
            });
        } catch (err) {
            const logger2 = createTaskLogger(taskName);
            logger2.log(`[ERROR] ${err}`);
            reject(err);
        }
    });
}

export default run;