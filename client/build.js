const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Transpile TS
execSync("tsc");

// Transform HTML
const scriptRegex = /<script\s+src="(.+)"><\/script>/;
let content = fs.readFileSync("index.html", "utf8");
let matches = content.match(scriptRegex);
while (matches) {
	content = content.replace(scriptRegex, `<script type="text/javascript">${fs.readFileSync(path.join("dist", matches[1]))}</script>`);
	matches = content.match(scriptRegex);
}
content = content.replaceAll(/.*Object.defineProperty.*/gm, "");
content = content.replaceAll(/.*require.*/gm, "");
fs.writeFileSync("dist/index.html", content);

// Transform CSS
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
fs.writeFileSync("dist/style.css", content);