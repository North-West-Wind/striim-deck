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
var imgs: HTMLImageElement[] = [];
var loading = false;
var command: string | null = null;

var imageChooserDiv = document.getElementById("image-chooser")!;
var customImageButton = document.getElementById("custom-image")!;
var imagePage = document.getElementById("image-page")!;
var blockPage = document.getElementById("block-page")!;
var loadingDiv = document.getElementById("loading")!;

var buttonLeft = document.getElementById("button-left")!;
var buttonRight = document.getElementById("button-right")!;

function setLoading(enabled: boolean) {
	loading = enabled;
	if (enabled) loadingDiv.classList.remove("hidden");
	else loadingDiv.classList.add("hidden");
}

function updateBlocks() {
	var page = Math.floor((selected || 0) / (width * height));
	blockPage.innerHTML = '' + (page + 1);
	if (page == 0) buttonLeft.classList.add("inactive");
	else buttonLeft.classList.remove("inactive");
	for (var ii = 0; ii < cells.length; ii++) {
		var jj = ii + page * width * height;
		if (jj === selected) cells[ii].classList.add("selected");
		else cells[ii].classList.remove("selected");

		if (blocks[jj]) {
			cells[ii].classList.remove("empty");
			cells[ii].innerHTML = '<img src="' + blocks[jj]!.img + '">';
		} else {
			cells[ii].classList.add("empty");
			cells[ii].innerHTML = "";
		}
	}
}

function createNewBlock(img: string) {
	setLoading(true);
	imageChooserDiv.classList.add("disabled");
	fetch(serverUrl("/api/new"), { method: "POST", body: JSON.stringify({ index: selected, cmd: command, img: img }), onOk: function(req) {
		setLoading(false);
		alert("Accepted");
		var block = JSON.parse(req.response) as GridBlock;
		blocks[selected!] = block;
		updateBlocks();
	}, onNotOk: function(req) {
		setLoading(false);
		if (req.status == 403) alert("Rejected");
		else alert("Error " + req.status);
	} });
}

function moveCursor(dx: number, dy: number) {
	if (loading) return;
	if (!imageChooserDiv.classList.contains("disabled")) {
		var newSelected = imgSelected;
		if (dy < 0) newSelected = newSelected - columns;
		else if (dy > 0) newSelected = newSelected + columns;
		else if (dx < 0) newSelected = newSelected - 1;
		else if (dx > 0) newSelected = newSelected + 1;
		if (newSelected < imgSelected) newSelected = images.length + newSelected;
		newSelected %= images.length;
		var needUpdate = Math.floor(imgSelected / 8) != Math.floor(newSelected / 8);
		imgSelected = newSelected;
		imagePage.innerHTML = Math.ceil((imgSelected + 1) / 8) + "/" + Math.ceil(images.length / 8);
		if (needUpdate) {
			setLoading(true);
			setTimeout(function() {
				updateImgTags();
				setLoading(false);
			}, 250);
		}
		for (var ii = 0; ii < imgs.length; ii++) {
			if (ii === (imgSelected % imgs.length)) imgs[ii].classList.add("selected");
			else imgs[ii].classList.remove("selected");
		}
		return;
	}
	if (selected === undefined) selected = 0;
	else {
		var newSelected = selected;
		if (dy < 0) {
			newSelected = newSelected - width;
			if (Math.floor(newSelected / (width * height)) != Math.floor(selected / (width * height)))
				newSelected += width * height;
		} else if (dy > 0) {
			newSelected = newSelected + width;
			if (Math.floor(newSelected / (width * height)) != Math.floor(selected / (width * height)))
				newSelected -= width * height;
		} else if (dx < 0) {
			if (newSelected % 5 == 0) newSelected -= width * height - 4;
			else newSelected = newSelected - 1;
		} else if (dx > 0) {
			if ((newSelected + 1) % 5 == 0) newSelected += width * height - 4;
			else newSelected = newSelected + 1;
		}
		if (newSelected < 0) newSelected = 0;
		selected = newSelected;
	}

	updateBlocks();
}

function clickBlock() {
	if (loading) return;
	if (!imageChooserDiv.classList.contains("disabled")) {
		var img = imgs[imgSelected % 8];
		if (img.ontouchstart) img.ontouchstart({ currentTarget: img } as any);
		return;
	}
	if (selected === undefined) {
		moveCursor(0, 0);
		return;
	}
	while (blocks.length <= selected) blocks.push(null);
	if (blocks[selected]) {
		var cell = cells[selected % (width * height)];
		cell.classList.add("running");
		fetch(serverUrl("/api/run"), { method: "POST", body: blocks[selected]!.id, onOk: function() {
			cell.classList.remove("running");
			cell.classList.add("success");
			setTimeout(function() { cell.classList.remove("success"); }, 3000);
		}, onNotOk: function() {
			cell.classList.remove("running");
			cell.classList.add("failure");
			setTimeout(function() { cell.classList.remove("failure"); }, 3000);
		} });
	} else {
		command = prompt("Enter command for button:");
		if (command === null) return;
		// Fetch images
		setLoading(true);
		updateImages({ onOk: function() {
			setLoading(false);
			// Hydrate image list
			imgSelected = 0;
			updateImgTags();
			imgs[0].classList.add("selected");
			imagePage.innerHTML = Math.ceil((imgSelected + 1) / 8) + "/" + Math.ceil(images.length / 8);
			// Setup custom button logic
			customImageButton.ontouchstart = function() {
				var link = prompt("Enter link to image:");
				if (link === null) return;
				createNewBlock(link);
			}
			imageChooserDiv.classList.remove("disabled");
		}, onNotOk: function(req) {
			setLoading(false);
			alert("Could not get image list. Status: " + req.status);
		} });
	}
}

function deleteBlock() {
	if (loading) return;
	if (selected === undefined) {
		moveCursor(0, 0);
		return;
	}
	if (confirm("Are you sure you want to delete " + selected + "?")) {
		var block = blocks[selected]!;
		var copySelected = selected;
		fetch(serverUrl("/api/delete"), { method: "POST", body: block.id, onOk: function() {
			blocks[copySelected] = null;
			updateBlocks();
		} });
	}
}

function updateImgTags() {
	var page = Math.floor(imgSelected / 8);
	for (var ii = 0; ii < 8; ii++) {
		var index = page * 8 + ii;
		if (index < images.length) imgs[ii].src = "/api/images/" + images[index];
		else imgs[ii].src = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs%3D";
	}
}

window.addEventListener("keydown", function(event) {
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

// Create table
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

		div.ontouchstart = function(ev) {
			if (selected === undefined) selected = 0;
			var index = parseInt((ev.currentTarget as HTMLDivElement).getAttribute("index") || "0") + Math.floor(selected / (width * height)) * width * height;
			if (selected !== index) {
				selected = index;
				moveCursor(0, 0);
			}
			clickBlock();
		};
	}
	table.appendChild(tr);
}

// Get img references
for (var ii = 0; ii < 8; ii++) {
	var img = document.getElementById("i" + ii) as HTMLImageElement;
	img.ontouchstart = function(ev) {
		var target = ev.currentTarget as HTMLImageElement;
		if (target.src) createNewBlock(target.src);
	};
	imgs.push(img);
}

// Page buttons
buttonLeft.ontouchstart = function() {
	if (selected === undefined) selected = 0;
	selected -= width * height;
	if (selected < 0) selected = 0;
	updateBlocks();
};
buttonRight.ontouchstart = function() {
	if (selected === undefined) selected = 0;
	selected += width * height;
	updateBlocks();
};

// Get initial blocks
fetch(serverUrl("/api/blocks"), { onOk: function(req) {
	var serverBlocks = JSON.parse(req.response) as ({ [key: string]: GridBlock & { index: number } });
	var keys = Object.keys(serverBlocks);
	for (var ii = 0; ii < keys.length; ii++) {
		var key = keys[ii];
		var block = serverBlocks[key];
		while (blocks.length < block.index) blocks.push(null);
		blocks[block.index] = block;
		if (block.index < width * height) {
			cells[block.index].classList.remove("empty");
			cells[block.index].innerHTML = '<img src="' + block.img + '">';
		}
	}
} });