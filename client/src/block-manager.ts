class BlockManager {
	readonly width = 5;
	readonly height = 3;
	blocks: (GridBlock | null)[] = [];
	selected?: number;
	command: string | null = null;

	area() {
		return this.width * this.height;
	}

	moveCursor(dx: number, dy: number) {
		if (this.selected === undefined) this.selected = 0;
		else {
			let newSelected = this.selected;
			if (dy < 0) {
				newSelected = newSelected - this.width;
				if (Math.floor(newSelected / (this.width * this.height)) != Math.floor(this.selected / (this.width * this.height)))
					newSelected += this.width * this.height;
			} else if (dy > 0) {
				newSelected = newSelected + this.width;
				if (Math.floor(newSelected / (this.width * this.height)) != Math.floor(this.selected / (this.width * this.height)))
					newSelected -= this.width * this.height;
			} else if (dx < 0) {
				if (newSelected % 5 == 0) newSelected -= this.width * this.height - 4;
				else newSelected = newSelected - 1;
			} else if (dx > 0) {
				if ((newSelected + 1) % 5 == 0) newSelected += this.width * this.height - 4;
				else newSelected = newSelected + 1;
			}
			if (newSelected < 0) newSelected = 0;
			this.selected = newSelected;
		}

		state.updateCells();
	}

	setBlock(index: number, block: GridBlock | null) {
		while (this.blocks.length < index) this.blocks.push(null);
		this.blocks[index] = block;
	}

	clickBlock() {
		if (this.selected === undefined) {
			state.moveCursor(0, 0);
			return;
		}
		while (this.blocks.length <= this.selected) this.blocks.push(null);
		if (this.blocks[this.selected]) state.cells[this.selected % this.area()].run();
		else {
			this.command = prompt("Enter command for button:");
			if (this.command === null) return;
			// Fetch images
			state.setLoading(true);
			imageChooser.on("update:failure", function(ev) {
				state.setLoading(false);
				alert("Could not get image list. Status: " + (ev as CustomEvent<XMLHttpRequest>).detail.status);
				imageChooser.endFlow();
			});
			var createBlock = this.createBlock.bind(this);
			imageChooser.on("chosen", function(ev) {
				state.setLoading(false);
				createBlock((ev as CustomEvent<string>).detail);
				imageChooser.endFlow();
			});
			imageChooser.startFlow();
		}
	}

	createBlock(img: string) {
		const realThis = this;
		state.setLoading(true);
		imageChooser.imageChooserDiv.classList.add("disabled");
		imageChooser.active = false;
		fetch(serverUrl("/api/new"), { method: "POST", body: JSON.stringify({ index: this.selected, cmd: this.command, img: img }), onOk: function(req) {
			state.setLoading(false);
			alert("Accepted");
			realThis.blocks[realThis.selected!] = JSON.parse(req.response) as GridBlock;
			state.updateCells();
		}, onNotOk: function(req) {
			state.setLoading(false);
			if (req.status == 403) alert("Rejected");
			else alert("Error " + req.status);
		} });
	}

	deleteBlock() {
		if (state.loading) return;
		if (this.selected === undefined) {
			state.moveCursor(0, 0);
			return;
		}
		if (confirm("Are you sure you want to delete " + this.selected + "?")) {
			const copySelected = this.selected;
			const commitDeleteBlock = this.commitDeleteBlock.bind(this);
			fetch(serverUrl("/api/delete"), { method: "POST", body: this.blocks[this.selected]!.id, onOk: function() {
				commitDeleteBlock(copySelected);
				state.updateCells();
			} });
		}
	}

	commitDeleteBlock(index: number) {
		this.blocks[index] = null;
	}

	swapBlock(a: number, b: number) {
		const tmp = this.blocks[a];
		this.blocks[a] = this.blocks[b];
		this.blocks[b] = tmp;
		state.updateCells();

		fetch("/api/swap", { method: "POST", body: a + " " + b });
	}
}

var blockManager = new BlockManager();