import "wiiu";

type GridBlock = {
	id: string;
	img: string;
}

var width = 5, height = 3, columns = 4;
var selected: number | undefined = undefined;
var imgSelected = 0;
var blocks: (GridBlock | null)[] = [];
var cells: HTMLDivElement[] = [];
var imageList: HTMLImageElement[] = [];
var waiting = false;

var imageChooserDiv = document.getElementById("image-chooser")!;
var imageListDiv = document.getElementById("image-list")!;
var customImageButton = document.getElementById("custom-image")!;
var overlayDiv = document.getElementById("overlay")!;

function setOverlay(enabled: boolean) {
	waiting = enabled;
	if (enabled) overlayDiv.classList.remove("disabled");
	else overlayDiv.classList.add("disabled");
}

function createNewBlock(cmd: string, img: string) {
	setOverlay(true);
	imageChooserDiv.classList.add("disabled");
	imageListDiv.innerHTML = "";
	fetch(serverUrl("/api/new"), { method: "POST", body: JSON.stringify({ index: selected, cmd: cmd, img: img }), onOk: function(req) {
		setOverlay(false);
		alert("Accepted");
		var block = JSON.parse(req.response) as GridBlock;
		blocks[selected!] = block;
		for (var ii = 0; ii < cells.length; ii++)
			if (ii === selected) {
				cells[ii].classList.remove("empty");
				cells[ii].innerHTML = '<img src="' + block.img + '">';
			}
	}, onNotOk: function(req) {
		setOverlay(false);
		if (req.status == 403) alert("Rejected");
		else alert("Error " + req.status);
	} });
}

function moveCursor(dx: number, dy: number) {
	if (waiting) return;
	if (!imageChooserDiv.classList.contains("disabled")) {
		var newSelected = imgSelected;
		if (dy < 0) newSelected = newSelected - columns;
		else if (dy > 0) newSelected = newSelected + columns;
		else if (dx < 0) {
			if (newSelected % columns == 0) newSelected = newSelected - 1 + columns;
			else newSelected = newSelected - 1;
		} else if (dx > 0) {
			newSelected = newSelected + 1;
			if (newSelected % columns == 0) newSelected -= columns;
		}
		if (newSelected < imageList.length) newSelected = imageList.length + newSelected;
		newSelected %= imageList.length;
		imgSelected = newSelected;
		for (var ii = 0; ii < imageList.length; ii++) {
			if (ii === imgSelected) {
				imageList[ii].classList.add("selected");
				imageList[ii].scrollIntoView();
			} else imageList[ii].classList.remove("selected");
		}
		return;
	}
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
		if (ii === selected) cells[ii].classList.add("selected");
		else cells[ii].classList.remove("selected");
	}
}

function clickBlock() {
	if (waiting) return;
	if (!imageChooserDiv.classList.contains("disabled")) {
		var img = imageList[imgSelected];
		if (img && img.onclick) img.onclick(new PointerEvent("click"));
		return;
	}
	if (selected === undefined) {
		moveCursor(0, 0);
		return;
	}
	while (blocks.length <= selected) blocks.push(null);
	if (blocks[selected]) {
		var cell = cells[selected];
		cell.classList.add("running");
		fetch(serverUrl("/api/run"), { method: "POST", body: blocks[selected]!.id, onOk: function() {
			cell.classList.remove("running");
			cell.classList.add("success");
			setTimeout(function() { cell.classList.remove("success"); }, 3000);
		}, onNotOk: function() {
			log("not ok");
			cell.classList.remove("running");
			cell.classList.add("failure");
			setTimeout(function() { cell.classList.remove("failure"); }, 3000);
		} });
	} else {
		var command = prompt("Enter command for button:");
		if (command === null) return;
		// Fetch images
		setOverlay(true);
		fetch(serverUrl("/api/images"), { onOk: function(req) {
			setOverlay(false);
			// Hydrate image list
			imgSelected = 0;
			var split = req.responseText.split("\n");
			for (var ii = 0; ii < split.length; ii++) {
				if (!split[ii].trim()) continue;
				var img = document.createElement("img");
				if (ii == 0) img.className = "selected";
				img.src = "/api/images/" + split[ii];
				img.onclick = function() {
					createNewBlock(command!, img.src);
				}
				imageList.push(img);
				imageListDiv.appendChild(img);
			}
			// Setup custom button logic
			customImageButton.onclick = function() {
				var link = prompt("Enter link to image:");
				if (link === null) return;
				createNewBlock(command!, link);
			}
			imageChooserDiv.classList.remove("disabled");
		}, onNotOk: function(req) {
			alert("Could not get image list. Status: " + req.status);
		} });
	}
}

function deleteBlock() {
	if (waiting) return;
	if (selected === undefined) {
		moveCursor(0, 0);
		return;
	}
	if (confirm("Are you sure you want to delete " + selected + "?")) {
		var block = blocks[selected]!;
		var copySelected = selected;
		fetch(serverUrl("/api/delete"), { method: "POST", body: block.id, onOk: function() {
			blocks[copySelected] = null;
			for (var ii = 0; ii < cells.length; ii++)
				if (ii === copySelected) {
					cells[ii].classList.add("empty");
					cells[ii].innerHTML = "";
				}
		} });
	}
}

window.addEventListener("keydown", function(event) {
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
			case "Enter": {
				clickBlock();
				break;
			}
			case "Delete": {
				deleteBlock();
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
	else if (button == "A") clickBlock();
	else if (button == "B") deleteBlock();
} as any);

var table = document.getElementById("grid")!;
for (var ii = 0; ii < height; ii++) {
	var tr = document.createElement("tr");
	for (var jj = 0; jj < width; jj++) {
		var index = ii * width + jj;
		var td = document.createElement("td");
		var block = blocks[index];
		var classes = "";
		if (!block) classes += " empty";
		if (index === selected) classes += " selected";
		var div = document.createElement("div");
		div.setAttribute("index", '' + index);
		div.className = classes;
		cells.push(div);
		td.appendChild(div);
		tr.appendChild(td);

		div.onclick = function(ev) {
			var index = parseInt((ev.target as HTMLDivElement).getAttribute("index") || "0");
			if (selected !== index) {
				selected = index;
				moveCursor(0, 0);
			} else clickBlock();
		};
	}
	table.appendChild(tr);
}

// Get initial blocks
fetch(serverUrl("/api/blocks"), { onOk: function(req) {
	var serverBlocks = JSON.parse(req.response) as ({ [key: string]: GridBlock & { index: number } });
	var keys = Object.keys(serverBlocks);
	for (var ii = 0; ii < keys.length; ii++) {
		var key = keys[ii];
		var block = serverBlocks[key];
		while (blocks.length < block.index) blocks.push(null);
		blocks[block.index] = block;
		cells[block.index].classList.remove("empty");
		cells[block.index].innerHTML = '<img src="' + block.img + '">';
	}
} });