class Cell {
	index: number;
	div: HTMLDivElement;

	blockRef?: GridBlock;
	running: boolean;
	classResetTimer?: number;

	constructor(index: number) {
		this.index = index;
		this.div = document.createElement("div");
		this.running = false;

		this.div.className = "empty";

		this.div.ontouchstart = function() {
			if (blockManager.selected === undefined) blockManager.selected = 0;
			const blockIndex = index + Math.floor(blockManager.selected / blockManager.area()) * blockManager.area();
			if (blockManager.selected !== blockIndex) {
				blockManager.selected = blockIndex;
				state.moveCursor(0, 0);
			}
			state.click();
		};
	}

	addToRow(row: HTMLTableRowElement) {
		const td = document.createElement("td");
		td.appendChild(this.div);
		row.appendChild(td);
	}

	update(selected: boolean, block?: GridBlock | null) {
		if (selected) this.div.classList.add("selected");
		else this.div.classList.remove("selected");

		if (block) {
			this.div.classList.remove("empty");
			this.div.innerHTML = '<img src="' + block.img + '">';
			this.blockRef = block;
		} else {
			this.div.classList.add("empty");
			this.div.innerHTML = "";
			this.blockRef = undefined;
		}
	}

	run() {
		if (this.running || !this.blockRef) return;
		this.running = true;
		this.div.classList.add("running");
		const handleRunResult = this.handleRunResult.bind(this);
		fetch(serverUrl("/api/run"), { method: "POST", body: this.blockRef.id, onOk: function() {
			handleRunResult(true);
		}, onNotOk: function() {
			handleRunResult(false);
		} });
	}

	handleRunResult(success: boolean) {
		this.running = false;
		this.div.classList.remove("running");
		if (success) this.div.classList.add("success");
		else this.div.classList.add("failure");
		if (this.classResetTimer) clearTimeout(this.classResetTimer);
		const classList = this.div.classList;
		this.classResetTimer = setTimeout(function() {
			classList.remove("success");
			classList.remove("failure");
		}, 3000);
	}
}