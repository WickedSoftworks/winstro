import { spawn } from "node:child_process";
import inquirer from "inquirer";
import { createTaskLogger } from "../logging";
import { writeRequirementsToFile } from "./requirements_file";

const logger = createTaskLogger("smart_write");

interface Package {
	name: string;
	id: string;
	version: string;
}

/**
 * Parses the output of the `winget list` command to extract installed packages
 * @param output The raw string output from `winget list`
 * @returns An array of Package objects representing installed packages
 */
function parseWingetList(output: string): Package[] {
	const lines = output.trim().split("\n");
	const packages: Package[] = [];
	const seenIds = new Set<string>();

	// Find the separator line (contains dashes)
	let dataStartIndex = -1;
	for (let i = 0; i < lines.length; i++) {
		if (lines[i].match(/^-+\s+-+/)) {
			dataStartIndex = i + 1;
			break;
		}
	}

	if (dataStartIndex === -1) {
		// Fallback: skip first 2 lines if no separator found
		dataStartIndex = 2;
	}

	for (let i = dataStartIndex; i < lines.length; i++) {
		const line = lines[i].trim();

		// Skip empty lines, progress bars, and status messages
		if (
			line.length === 0 ||
			line.includes("\\") ||
			line.includes("upgrades available") ||
			(line.includes("package") && line.includes("available"))
		) {
			continue;
		}

		// Split by 2 or more spaces to separate columns
		const parts = line.split(/\s{2,}/);

		if (parts.length >= 2) {
			const name = parts[0]?.trim() || "";
			const id = parts[1]?.trim() || "";
			const version = parts[2]?.trim() || "";

			// Only add valid packages with IDs that we haven't seen yet
			if (
				id &&
				id.length > 0 &&
				id !== "Id" &&
				!id.includes("--") &&
				!id.includes("…") &&
				!seenIds.has(id)
			) {
				packages.push({ name, id, version });
				seenIds.add(id);
			}
		}
	}

	return packages;
}

/**
 * Writes selected packages to requirements.winget.ts after prompting the user
 * @returns void
 */
export async function smart_write() {
	logger.log("Fetching installed packages from winget...", "blue");

	// Use a quieter approach to avoid verbose logging
	const result = await new Promise<string>((resolve, reject) => {
		const child = spawn("winget", ["list"], { shell: true });
		let stdout = "";

		child.stdout.on("data", (chunk) => {
			stdout += chunk.toString();
		});

		child.on("error", (err) => {
			reject(err);
		});

		child.on("close", (code) => {
			if (code === 0) {
				resolve(stdout);
			} else {
				reject(new Error(`winget list exited with code ${code}`));
			}
		});
	});

	const packages = parseWingetList(result);

	if (packages.length === 0) {
		logger.log("No packages found!", "red");
		return;
	}

	logger.log(`Found ${packages.length} packages`, "green");

	// Create choices for inquirer with better formatting
	const choices = packages.map((pkg, index) => ({
		name: `[${index + 1}/${packages.length}] ${pkg.name} (${pkg.id})`,
		value: pkg.id,
		checked: false,
	}));

	// Prompt user to select packages
	const answers = await inquirer.prompt([
		{
			type: "checkbox",
			name: "selectedPackages",
			message: `Select packages to keep (${packages.length} total, use space to select, enter to finish):`,
			choices: choices,
			pageSize: 20,
			loop: false,
		},
	]);

	const selectedPackages = answers.selectedPackages as string[];

	if (selectedPackages.length === 0) {
		logger.log("No packages selected. Aborting.", "yellow");
		return;
	}

	logger.log(`Selected ${selectedPackages.length} packages`, "green");

	try {
		const configPath = writeRequirementsToFile(selectedPackages);
		logger.log(
			`Successfully wrote ${selectedPackages.length} packages to requirements.winget.ts`,
			"green",
		);
		logger.log(`File path: ${configPath}`, "blue");
		logger.log(`Packages: ${selectedPackages.join(", ")}`, "blue");
	} catch (error) {
		logger.log(`Error writing to file: ${error}`, "red");
		throw error;
	}
}

export default smart_write;
