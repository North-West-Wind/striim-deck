class State {
	readonly loadingDiv = document.getElementById("loading")!;
	readonly blockPage = document.getElementById("block-page")!;
	readonly buttonLeft = document.getElementById("button-left")!;
	readonly buttonRight = document.getElementById("button-right")!;
	readonly buttonMode = document.getElementById("button-mode")!;
	loading = false;
	moving = false;
	cells: Cell[] = [];

	constructor() {
		this.buttonLeft.ontouchstart = () => {
			if (blockManager.selected === undefined) blockManager.selected = 0;
			blockManager.selected -= blockManager.width * blockManager.height;
			if (blockManager.selected < 0) blockManager.selected = 0;
			this.updateCells();
		};
		this.buttonRight.ontouchstart = () => {
			if (blockManager.selected === undefined) blockManager.selected = 0;
			blockManager.selected += blockManager.width * blockManager.height;
			this.updateCells();
		};
		
		this.buttonMode.ontouchstart = () => {
			this.moving = !this.moving;
			if (this.moving) {
				this.buttonMode.innerHTML = "Moving";
				this.buttonMode.classList.add("moving");
			} else {
				this.buttonMode.innerHTML = "Running";
				this.buttonMode.classList.remove("moving");
			}
		};
	}

	setLoading(enabled: boolean) {
		this.loading = enabled;
		if (enabled) this.loadingDiv.classList.remove("hidden");
		else this.loadingDiv.classList.add("hidden");
	}

	updateCells() {
		const page = Math.floor((blockManager.selected || 0) / blockManager.area());
		this.blockPage.innerHTML = '' + (page + 1);
		if (page == 0) this.buttonLeft.classList.add("inactive");
		else this.buttonLeft.classList.remove("inactive");
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

	isHovering(x: number, y: number) {
		let rect = this.buttonLeft.getBoundingClientRect();
		if (x > rect.left && x < rect.left + rect.width && y > rect.top && y < rect.top + rect.height) return -1;
		rect = this.buttonRight.getBoundingClientRect();
		if (x > rect.left && x < rect.left + rect.width && y > rect.top && y < rect.top + rect.height) return 1;
		return 0;
	}
}

var state = new State();