import * as fs from "node:fs";
import * as path from "node:path";
import colors from "./colors";

const ROOT_DIR = path.join(__dirname, "..", "..");
const LOGS_DIR = path.join(ROOT_DIR, "logs");

if (!fs.existsSync(LOGS_DIR)) {
	try {
		fs.mkdirSync(LOGS_DIR, { recursive: true });
	} catch (_err) {}
}

/**
 * Gets the current timestamp in ISO format for logging purposes
 * @returns An ISO Date string
 */
function timestamp(): string {
	return new Date().toISOString();
}

/**
 * Creates a logger for a specific task that writes logs to a file and optionally colors them in the console
 * @param taskName The name of the task for which to create the logger (used for naming the log file)
 * @returns An object with a log function and the log file path
 */
export function createTaskLogger(taskName: string) {
	const filePath = path.join(LOGS_DIR, `${taskName}.log`);

	function write(line: string, color?: string) {
		const formatted = `[${timestamp()}] ${line.replace(/\r?\n$/, "")}\n`;
		try {
			fs.appendFileSync(filePath, formatted, { encoding: "utf8" });
			// Also log in the console to prevent repeating logging everywhere
			const colorName = (color ?? "blue") as keyof typeof colors;
			if (typeof colors[colorName] === "function") {
				(colors[colorName] as (text: string) => void)(formatted);
			} else {
				console.log(formatted);
			}
		} catch (_e) {
			try {
				fs.mkdirSync(path.dirname(filePath), { recursive: true });
				fs.appendFileSync(filePath, formatted, { encoding: "utf8" });
			} catch {}
		}
	}

	return {
		log: (msg: string, color?: string) => write(msg, color),
		file: filePath,
	};
}

/**
 * Logs a message immediately for a specific task
 * @param taskName The name of the task for which to log the message
 * @param message The message to log
 */
export function logNow(taskName: string, message: string) {
	const logger = createTaskLogger(taskName);
	logger.log(message);
}

export default { createTaskLogger, logNow };
