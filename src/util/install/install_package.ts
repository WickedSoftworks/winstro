import { readRequirementsFromFile } from "../config/requirements_file";
import { createTaskLogger } from "../logging";
import { run as runProcess } from "../run";

const ipLog = createTaskLogger("install_package");

async function install_package() {
	const winget_requirements = readRequirementsFromFile();

	if (winget_requirements.length === 0) {
		ipLog.log(
			"[⚠] [winstro::install_package]: no package requirements found; nothing to install",
			"yellow",
		);
		return;
	}

	for (const requirement of winget_requirements) {
		const args = [
			"install",
			requirement,
			"--silent",
			"--accept-package-agreements",
			"--accept-source-agreements",
		];
		ipLog.log(
			`Starting install for ${requirement} with args: ${args.join(" ")}`,
			"green",
		);
		try {
			const res = await runProcess("install_package", "winget", args);
			if (res.code !== 0) {
				ipLog.log(
					`[✗] [winstro::install_package]: error installing package ${requirement}, exit ${res.code}`,
					"red",
				);
				throw new Error(`Exit code ${res.code}`);
			}
			ipLog.log(
				`Finished ${requirement} successfully (exit ${res.code})`,
				"green",
			);
		} catch (_error) {
			// already logged; continue with next package
		}
	}
}

export default install_package;
