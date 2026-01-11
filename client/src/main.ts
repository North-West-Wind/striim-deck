type GridBlock = {
	id: string;
	img: string;
}

var buttonLeft = document.getElementById("button-left")!;
var buttonRight = document.getElementById("button-right")!;

window.addEventListener("keydown", function(event) {
	switch (event.key) {
		case "ArrowUp": {
			state.moveCursor(0, -1);
			break;
		}
		case "ArrowDown": {
			state.moveCursor(0, 1);
			break;
		}
		case "ArrowLeft": {
			state.moveCursor(-1, 0);
			break;
		}
		case "ArrowRight": {
			state.moveCursor(1, 0);
			break;
		}
		case "Enter": {
			state.click();
			break;
		}
		case "Delete": {
			blockManager.deleteBlock();
			break;
		}
	}
});

window.addEventListener("buttondown", function(event: CustomEvent<keyof typeof WiiUButton>) {
	var button = event.detail;
	if (button == "LUP" || button == "RUP" || button == "DUP") state.moveCursor(0, -1);
	else if (button == "LDOWN" || button == "RDOWN" || button == "DDOWN") state.moveCursor(0, 1);
	else if (button == "LLEFT" || button == "RLEFT" || button == "DLEFT") state.moveCursor(-1, 0);
	else if (button == "LRIGHT" || button == "RRIGHT" || button == "DRIGHT") state.moveCursor(1, 0);
	else if (button == "A") state.click();
	else if (button == "B") blockManager.deleteBlock();
} as any);

// Create table
var table = document.getElementById("grid")!;
for (var ii = 0; ii < blockManager.height; ii++) {
	var tr = document.createElement("tr");
	for (var jj = 0; jj < blockManager.width; jj++) {
		var cell = new Cell(ii * blockManager.width + jj);
		state.cells.push(cell);
		cell.addToRow(tr);
	}
	table.appendChild(tr);
}

// Page buttons
buttonLeft.ontouchstart = function() {
	if (blockManager.selected === undefined) blockManager.selected = 0;
	blockManager.selected -= blockManager.width * blockManager.height;
	if (blockManager.selected < 0) blockManager.selected = 0;
	state.updateCells();
};
buttonRight.ontouchstart = function() {
	if (blockManager.selected === undefined) blockManager.selected = 0;
	blockManager.selected += blockManager.width * blockManager.height;
	state.updateCells();
};

// Get initial blocks
fetch(serverUrl("/api/blocks"), { onOk: function(req) {
	var serverBlocks = JSON.parse(req.response) as ({ [key: string]: GridBlock & { index: number } });
	var keys = Object.keys(serverBlocks);
	for (var ii = 0; ii < keys.length; ii++) {
		var key = keys[ii];
		var block = serverBlocks[key];
		blockManager.setBlock(block.index, block);
		if (block.index < blockManager.area())
			state.cells[block.index].update(false, block);
	}
} });