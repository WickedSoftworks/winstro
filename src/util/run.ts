import { spawn } from "node:child_process";
import { createTaskLogger } from "./logging";

/**
 * Runs a command as a child process, logging its output to a task-specific logger
 * @param taskName The name of the task for logging purposes
 * @param command The command for the child process to execute
 * @param args The arguments to pass to the command
 * @param options Options for spawning the child process
 * @returns A promise that resolves with the exit code and stdout of the process
 */
export function run(
	taskName: string,
	command: string,
	args: string[] = [],
	options: { shell?: boolean } = { shell: true },
): Promise<{ code: number | null; stdout: string }> {
	const logger = createTaskLogger(taskName);
	return new Promise((resolve, reject) => {
		try {
			const child = spawn(command, args, { shell: options.shell ?? true });
			let stdout = "";

			child.stdout.on("data", (chunk) => {
				const txt = chunk.toString();
				stdout += txt;
				logger.log(txt);
			});

			child.stderr.on("data", (chunk) => {
				const txt = chunk.toString();
				logger.log(txt);
			});

			child.on("error", (err) => {
				logger.log(`[ERROR] ${err}`);
				reject(err);
			});

			child.on("close", (code) => {
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
