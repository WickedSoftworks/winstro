import * as fs from "node:fs";
import * as path from "node:path";
import { createTaskLogger } from "../logging";

const requirementsLog = createTaskLogger("requirements_file");

const REQUIREMENTS_REGEX =
	/const\s+winget_requirements(?:\s*:\s*string\[\])?\s*=\s*\[([\s\S]*?)\]/m;

export function getRequirementsFilePath(): string {
	const fromEnv = process.env.WINSTRO_REQUIREMENTS_FILE?.trim();
	if (fromEnv) {
		return path.resolve(fromEnv);
	}

	return path.join(process.cwd(), "config", "requirements.winget.ts");
}

export function readRequirementsFromFile(): string[] {
	const requirementsPath = getRequirementsFilePath();

	try {
		if (!fs.existsSync(requirementsPath)) {
			requirementsLog.log(
				`[⚠] [winstro::requirements_file]: requirements file not found at ${requirementsPath}`,
				"yellow",
			);
			return [];
		}

		const content = fs.readFileSync(requirementsPath, "utf8");
		const match = content.match(REQUIREMENTS_REGEX);
		if (!match) {
			return [];
		}

		return Array.from(match[1].matchAll(/["']([^"']+)["']/g))
			.map((entry) => entry[1].trim())
			.filter((entry) => entry.length > 0);
	} catch (error) {
		requirementsLog.log(
			`[✗] [winstro::requirements_file]: failed to read requirements: ${error}`,
			"red",
		);
		return [];
	}
}

export function writeRequirementsToFile(packages: string[]): string {
	const requirementsPath = getRequirementsFilePath();
	const requirementsDir = path.dirname(requirementsPath);
	const content =
		`const winget_requirements: string[] = ${JSON.stringify(packages, null, 2)};\n` +
		"export default winget_requirements;\n";

	if (!fs.existsSync(requirementsDir)) {
		fs.mkdirSync(requirementsDir, { recursive: true });
	}

	fs.writeFileSync(requirementsPath, content, "utf8");
	return requirementsPath;
}
