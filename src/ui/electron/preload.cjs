const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld(
	"winstroDesktop",
	Object.freeze({
		isDesktop: true,
		company: "Wicked Softworks",
	}),
);
