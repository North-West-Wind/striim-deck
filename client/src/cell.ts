class Cell {
	index: number;
	div: HTMLDivElement;

	blockRef?: GridBlock;
	running: boolean;
	classResetTimer?: number;
	rect?: DOMRect;
	touchTime = 0;
	moved = false;

	constructor(index: number) {
		this.index = index;
		this.div = document.createElement("div");
		this.running = false;

		this.div.className = "empty";
		this.div.ontouchstart = () => {
			if (state.moving) this.touchTime = Date.now();
			else {
				if (blockManager.selected === undefined) blockManager.selected = 0;
				const blockIndex = index + Math.floor(blockManager.selected / blockManager.area()) * blockManager.area();
				if (blockManager.selected !== blockIndex) {
					blockManager.selected = blockIndex;
					state.moveCursor(0, 0);
				}
				state.click();
			}
		};
		this.div.ontouchmove = (ev) => {
			if (!state.moving || Date.now() - this.touchTime < 500) return;
			const div = ev.currentTarget as HTMLDivElement;
			const touch = ev.touches[0];
			div.classList.add("moving");
			div.style.transform = div.style.webkitTransform = `translate(-150%, -50%) translate(${touch.clientX}px, ${touch.clientY}px)`;
			this.moved = true;
		};
		this.div.ontouchend = (ev) => {
			const div = ev.currentTarget as HTMLDivElement;
			const touch = ev.changedTouches[0];
			if (this.moved) {
				div.style.transform = div.style.webkitTransform = "";
				div.classList.remove("moving");
				this.moved = false;
				for (const cell of state.cells)
					if (cell.isHovering(touch.clientX, touch.clientY)) {
						blockManager.selected = cell.index;
						blockManager.swapBlock(this.index, cell.index);
						break;
					}
			}
		};
	}

	addToRow(row: HTMLTableRowElement) {
		const td = document.createElement("td");
		td.appendChild(this.div);
		row.appendChild(td);
	}

	updateRect() {
		this.rect = this.div.getBoundingClientRect();
	}

	isHovering(x: number, y: number) {
		if (!this.rect) return false;
		return x > this.rect.left && x < this.rect.left + this.rect.width && y > this.rect.top && y < this.rect.top + this.rect.height;
	}

	update(selected: boolean, block?: GridBlock | null) {
		if (selected) this.div.classList.add("selected");
		else this.div.classList.remove("selected");

		if (block) {
			this.div.classList.remove("empty");
			this.div.innerHTML = `<img src="${block.img}">`;
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