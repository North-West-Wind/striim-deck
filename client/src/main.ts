type GridBlock = {
	id: string;
	img: string;
}

var width = 5, height = 3;
var selected: number | undefined = undefined;
var blocks: (GridBlock | null)[] = [];

window.addEventListener("keydown", function(event) {
	if (!["ArrowUp", "ArrowLeft", "ArrowRight", "ArrowDown"].includes(event.key)) return;
	if (selected === undefined) selected = 0;
	else {
		var newSelected = selected;
		switch (event.key) {
			case "ArrowUp": {
				newSelected = selected - width;
				break;
			}
			case "ArrowDown": {
				newSelected = selected + width;
				break;
			}
			case "ArrowLeft": {
				if (selected % width == 0) newSelected = selected - 1 + width;
				else newSelected = selected - 1;
				break;
			}
			case "ArrowRight": {
				newSelected = selected + 1;
				if (newSelected % width == 0) newSelected -= width;
				break;
			}
		}
		if (newSelected < width * height) newSelected = width * height + newSelected;
		newSelected %= width * height;
		selected = newSelected;
	}
});

var table = document.getElementById("grid")!;
for (var ii = 0; ii < height; ii++) {
	var tr = document.createElement("tr");
	for (var jj = 0; jj < width; jj++) {
		var td = document.createElement("td");
		var block = blocks[ii * width + jj];
		var classes = "";
		if (!block) classes += " empty";
		if (ii * width + jj === selected) classes += " selected";
		td.innerHTML = '<div class="' + classes + '"></div>';
		tr.appendChild(td);
	}
	table.appendChild(tr);
}