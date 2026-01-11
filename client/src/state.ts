class State {
	readonly loadingDiv = document.getElementById("loading")!;
	readonly blockPage = document.getElementById("block-page")!;
	loading: boolean;
	cells: Cell[] = [];

	constructor() {
		this.loading = false;
		// DO NOT INIT cells HERE. It's not imported yet
	}

	setLoading(enabled: boolean) {
		this.loading = enabled;
		if (enabled) this.loadingDiv.classList.remove("hidden");
		else this.loadingDiv.classList.add("hidden");
	}

	updateCells() {
		const page = Math.floor((blockManager.selected || 0) / blockManager.area());
		this.blockPage.innerHTML = '' + (page + 1);
		if (page == 0) buttonLeft.classList.add("inactive");
		else buttonLeft.classList.remove("inactive");
		for (let ii = 0; ii < this.cells.length; ii++) {
			const jj = ii + page * blockManager.area();
			this.cells[ii].update(jj === blockManager.selected, blockManager.blocks[jj]);
		}
	}

	moveCursor(dx: number, dy: number) {
		if (this.loading) return;
		if (imageChooser.active) imageChooser.moveCursor(dx, dy);
		else blockManager.moveCursor(dx, dy);
	}

	click() {
		if (this.loading) return;
		if (imageChooser.active) imageChooser.clickImage();
		else blockManager.clickBlock();
	}
}

var state = new State();