class Cell {
	index: number;
	div: HTMLDivElement;

	blockRef?: GridBlock;
	running: boolean;
	classResetTimer?: number;
	rect?: DOMRect;
	touched = false;
	touchTime = 0;
	moved = false;

	constructor(index: number) {
		this.index = index;
		this.div = document.createElement("div");
		this.running = false;

		this.div.className = "empty";
		this.div.onmousedown = () => !window.wiiu && this.onTouchStart();
		this.div.ontouchstart = () => this.onTouchStart();
		// Mouse move sucks. Imma just ignore it
		this.div.ontouchmove = (ev) => {
			if (ev.touches.length)
				this.onTouchMove({ x: ev.touches[0].clientX, y: ev.touches[0].clientY });
		};
		this.div.onmouseup = (ev) => !window.wiiu && this.onTouchEnd({ x: ev.clientX, y: ev.clientY });
		this.div.ontouchend = (ev) => {
			if (ev.changedTouches.length)
				this.onTouchEnd({ x: ev.changedTouches[0].clientX, y: ev.changedTouches[0].clientY });
		};
		this.div.onmouseenter = () => {
			blockManager.selected = this.index + blockManager.pageOffset();
			state.updateCells();
		};
	}

	onTouchStart() {
		if (state.moving) {
			this.touched = true;
			this.touchTime = Date.now();
		} else {
			if (blockManager.selected === undefined) blockManager.selected = 0;
			const blockIndex = this.index + Math.floor(blockManager.selected / blockManager.area()) * blockManager.area();
			if (blockManager.selected !== blockIndex) {
				blockManager.selected = blockIndex;
				state.moveCursor(0, 0);
			}
			state.click();
		}
	}

	onTouchMove(pos: { x: number, y: number }) {
		if (!this.touched || !state.moving || Date.now() - this.touchTime < 500) return;
		this.div.classList.add("moving");
		this.div.style.transform = this.div.style.webkitTransform = `translate(-150%, -50%) translate(${pos.x}px, ${pos.y}px)`;
		this.moved = true;
	}

	onTouchEnd(pos: { x: number, y: number }) {
		if (this.moved) {
			this.div.style.transform = this.div.style.webkitTransform = "";
			this.div.classList.remove("moving");
			this.moved = false;
			const currentPage = Math.floor((blockManager.selected || 0) / blockManager.area());
			for (const cell of state.cells)
				if (cell.isHovering(pos.x, pos.y)) {
					blockManager.selected = cell.index + currentPage * blockManager.area();
					blockManager.swapBlock(this.index + currentPage * blockManager.area(), cell.index + currentPage * blockManager.area());
					return;
				}
			const buttonHover = state.isHovering(pos.x, pos.y);
			if (buttonHover < 0 && currentPage > 0)
				for (let ii = currentPage * blockManager.area() - 1; ii >= 0; ii--) {
					if (!blockManager.blocks[ii]) {
						blockManager.selected = ii;
						blockManager.swapBlock(this.index + currentPage * blockManager.area(), ii);
						break;
					}
				}
			else if (buttonHover > 0) {
				for (let ii = (currentPage + 1) * blockManager.area(); ii < blockManager.blocks.length; ii++) {
					if (!blockManager.blocks[ii]) {
						blockManager.selected = ii;
						blockManager.swapBlock(this.index + currentPage * blockManager.area(), ii);
						return;
					}
				}
				let newIndex: number;
				if (Math.floor(blockManager.blocks.length / blockManager.area()) == currentPage) newIndex = (currentPage + 1) * blockManager.area();
				else newIndex = blockManager.blocks.length;
				blockManager.selected = newIndex;
				blockManager.swapBlock(this.index + currentPage * blockManager.area(), newIndex);
			}
		}
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
			if (block.img != this.blockRef?.img) this.div.innerHTML = `<img src="${block.img}">`;
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