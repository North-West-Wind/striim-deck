const { Canvas, loadImage } = require("skia-canvas");
const { execSync } = require("child_process");
const fs = require("fs");

// Transpile TS
execSync("npm run build");

// Render SVG
(async () => {
	const canvas = new Canvas(256, 256);
	const ctx = canvas.getContext("2d");
	const svg = await loadImage("icon.svg");
	ctx.drawImage(svg, 0, 0, 256, 256);
	fs.writeFileSync("dist/icon.png", await canvas.png);
})();

// Copy HTML
fs.cpSync("index.html", "dist/index.html");

// Copy CSS
fs.cpSync("style.css", "dist/style.css");

// Transform CSS for Wii U
const unitRegex = /(-?(?:(?:\d+)?\.)?\d+)v(w|h|min|max)/;
const WIDTH = 854;
const HEIGHT = 448;
content = fs.readFileSync("style.css", "utf8");
matches = content.match(unitRegex);
while (matches) {
	let value = Number(matches[1]);
	const unit = matches[2];
	switch (unit) {
		case "max":
		case "w": {
			value = Math.round(WIDTH * value / 100);
			break;
		}
		case "min":
		case "h": {
			value = Math.round(HEIGHT * value / 100);
			break;
		}
	}

	content = content.replace(unitRegex, `${value}px`);
	matches = content.match(unitRegex);
}
fs.writeFileSync("dist/style.wiiu.css", content);