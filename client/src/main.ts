import "wiiu";

type GridBlock = {
	id: string;
	img: string;
}

var width = 5, height = 3;
var selected: number | undefined = undefined;
var blocks: (GridBlock | null)[] = [];
var cells: HTMLDivElement[] = [];

function moveCursor(dx: number, dy: number) {
	if (selected === undefined) selected = 0;
	else {
		var newSelected = selected;
		if (dy < 0) newSelected = newSelected - width;
		else if (dy > 0) newSelected = newSelected + width;
		else if (dx < 0) {
			if (newSelected % width == 0) newSelected = newSelected - 1 + width;
			else newSelected = newSelected - 1;
		} else if (dx > 0) {
			newSelected = newSelected + 1;
			if (newSelected % width == 0) newSelected -= width;
		}
		if (newSelected < width * height) newSelected = width * height + newSelected;
		newSelected %= width * height;
		selected = newSelected;
	}

	for (var ii = 0; ii < cells.length; ii++) {
		var classes = "";
		if (!blocks[ii]) classes += " empty";
		if (ii === selected) classes += " selected";
		cells[ii].className = classes;
	}
}

window.addEventListener("keydown", function(event) {
	if (!["ArrowUp", "ArrowLeft", "ArrowRight", "ArrowDown"].includes(event.key)) return;
	if (selected === undefined) selected = 0;
	else {
		switch (event.key) {
			case "ArrowUp": {
				moveCursor(0, -1);
				break;
			}
			case "ArrowDown": {
				moveCursor(0, 1);
				break;
			}
			case "ArrowLeft": {
				moveCursor(-1, 0);
				break;
			}
			case "ArrowRight": {
				moveCursor(1, 0);
				break;
			}
		}
	}
});

window.addEventListener("buttondown", function(event: CustomEvent<keyof typeof WiiUButton>) {
	var button = event.detail;
	if (button == "LUP" || button == "RUP" || button == "DUP") moveCursor(0, -1);
	else if (button == "LDOWN" || button == "RDOWN" || button == "DDOWN") moveCursor(0, 1);
	else if (button == "LLEFT" || button == "RLEFT" || button == "DLEFT") moveCursor(-1, 0);
	else if (button == "LRIGHT" || button == "RRIGHT" || button == "DRIGHT") moveCursor(1, 0);
} as any);

var table = document.getElementById("grid")!;
for (var ii = 0; ii < height; ii++) {
	var tr = document.createElement("tr");
	for (var jj = 0; jj < width; jj++) {
		var td = document.createElement("td");
		var block = blocks[ii * width + jj];
		var classes = "";
		if (!block) classes += " empty";
		if (ii * width + jj === selected) classes += " selected";
		var div = document.createElement("div");
		div.className = classes;
		cells.push(div);
		td.appendChild(div);
		tr.appendChild(td);
	}
	table.appendChild(tr);
}