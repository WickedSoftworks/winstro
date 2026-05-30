const { app, BrowserWindow, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const http = require("node:http");
const { spawn } = require("node:child_process");

const APP_ID = "com.wickedsoftworks.winstro";
const COMPANY_NAME = "Wicked Softworks";
const DEV_RENDERER_URL =
	process.env.ELECTRON_RENDERER_URL || "http://127.0.0.1:3000";
const PROD_PORT = Number(process.env.WINSTRO_ELECTRON_PORT || 3210);
const SERVER_BOOT_TIMEOUT_MS = 30000;

let mainWindow = null;
let nextServerProcess = null;
let rendererUrl = DEV_RENDERER_URL;

app.setAppUserModelId(APP_ID);
app.name = "winstro";

// Prefer low-memory behavior for low-end devices.
app.commandLine.appendSwitch(
	"disable-features",
	"CalculateNativeWinOcclusion,BackForwardCache",
);
app.commandLine.appendSwitch("force-color-profile", "srgb");

if (!app.requestSingleInstanceLock()) {
	app.quit();
}

function wait(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pathExists(targetPath) {
	try {
		await fs.access(targetPath);
		return true;
	} catch {
		return false;
	}
}

function pingServer(url) {
	return new Promise((resolve) => {
		const req = http.get(url, (res) => {
			res.resume();
			resolve(Boolean(res.statusCode && res.statusCode < 500));
		});

		req.on("error", () => resolve(false));
		req.setTimeout(2000, () => {
			req.destroy();
			resolve(false);
		});
	});
}

async function waitForServer(url, timeoutMs) {
	const startedAt = Date.now();

	while (Date.now() - startedAt < timeoutMs) {
		if (await pingServer(url)) {
			return;
		}
		await wait(300);
	}

	throw new Error(`Timed out waiting for renderer server at ${url}`);
}

async function ensureRequirementsFile(defaultRequirementsPath) {
	const configDir = path.join(app.getPath("userData"), "config");
	const requirementsPath = path.join(configDir, "requirements.winget.ts");

	await fs.mkdir(configDir, { recursive: true });

	if (!(await pathExists(requirementsPath))) {
		await fs.copyFile(defaultRequirementsPath, requirementsPath);
	}

	return requirementsPath;
}

async function startPackagedNextServer() {
	const runtimeDir = path.join(process.resourcesPath, "app-runtime");
	const serverEntry = path.join(runtimeDir, "src", "ui", "server.js");
	const defaultsRequirements = path.join(
		process.resourcesPath,
		"defaults",
		"config",
		"requirements.winget.ts",
	);
	const cliExecutable = path.join(
		process.resourcesPath,
		"winstro-cli",
		"winstro-cli.exe",
	);

	if (!(await pathExists(serverEntry))) {
		throw new Error(
			`Electron runtime missing Next standalone server at ${serverEntry}`,
		);
	}

	if (!(await pathExists(defaultsRequirements))) {
		throw new Error(
			`Default requirements file not found at ${defaultsRequirements}`,
		);
	}

	const requirementsPath = await ensureRequirementsFile(defaultsRequirements);

	const env = {
		...process.env,
		NODE_ENV: "production",
		PORT: String(PROD_PORT),
		HOSTNAME: "127.0.0.1",
		WINSTRO_REQUIREMENTS_FILE: requirementsPath,
	};

	if (await pathExists(cliExecutable)) {
		env.WINSTRO_CLI_EXE = cliExecutable;
	}

	nextServerProcess = spawn(process.execPath, [serverEntry], {
		cwd: path.join(runtimeDir, "src", "ui"),
		env: {
			...env,
			ELECTRON_RUN_AS_NODE: "1",
		},
		windowsHide: true,
		stdio: "ignore",
	});

	rendererUrl = `http://127.0.0.1:${PROD_PORT}`;
	await waitForServer(rendererUrl, SERVER_BOOT_TIMEOUT_MS);
}

function stopNextServer() {
	if (nextServerProcess && !nextServerProcess.killed) {
		nextServerProcess.kill();
	}
	nextServerProcess = null;
}

async function createWindow() {
	mainWindow = new BrowserWindow({
		width: 1280,
		height: 820,
		minWidth: 1024,
		minHeight: 700,
		show: false,
		autoHideMenuBar: true,
		backgroundColor: "#0d1117",
		title: `winstro - ${COMPANY_NAME}`,
		webPreferences: {
			preload: path.join(__dirname, "preload.cjs"),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true,
			spellcheck: false,
			devTools: !app.isPackaged,
			v8CacheOptions: "code",
		},
	});

	mainWindow.webContents.setWindowOpenHandler(({ url }) => {
		shell.openExternal(url);
		return { action: "deny" };
	});

	mainWindow.once("ready-to-show", () => {
		mainWindow.show();
	});

	await mainWindow.loadURL(rendererUrl);
}

app.on("second-instance", () => {
	if (mainWindow) {
		if (mainWindow.isMinimized()) {
			mainWindow.restore();
		}
		mainWindow.focus();
	}
});

app.whenReady().then(async () => {
	try {
		if (app.isPackaged) {
			await startPackagedNextServer();
		} else {
			rendererUrl = DEV_RENDERER_URL;
		}

		await createWindow();
	} catch (error) {
		console.error(
			"[winstro::electron] Failed to start desktop runtime:",
			error,
		);
		app.quit();
	}
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
	}
});

app.on("before-quit", () => {
	stopNextServer();
});

app.on("activate", async () => {
	if (BrowserWindow.getAllWindows().length === 0) {
		await createWindow();
	}
});
