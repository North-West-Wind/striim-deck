type Listener = (...args: any[]) => void;

class ImageChooser {
	readonly columns = 4;
	readonly imageChooserDiv = document.getElementById("image-chooser")!;
	readonly imagePage = document.getElementById("image-page")!;
	readonly customImageButton = document.getElementById("custom-image")!;
	selected = 0;

	images: string[] = [];
	imgs: HTMLImageElement[];
	active = false;

	constructor() {
		this.imgs = [];
		const eventTarget = this.eventTarget;
		for (let ii = 0; ii < 8; ii++) {
			const img = document.getElementById("i" + ii) as HTMLImageElement;
			img.ontouchstart = function(ev) {
				var target = ev.currentTarget as HTMLImageElement;
				if (target.src) eventTarget.dispatchEvent(new CustomEvent("chosen", { detail: target.src }));
			};
			this.imgs.push(img);
		}
	}

	updateImages() {
		var eventTarget = this.eventTarget;
		fetch(serverUrl("/api/images"), { method: "GET", onOk: function(req) {
			var newImages: string[] = [];
			var split = req.responseText.split("\n");
			for (var ii = 0; ii < split.length; ii++) {
				if (!split[ii].trim()) continue;
				newImages.push(split[ii]);
			}
			images = newImages;
			eventTarget.dispatchEvent(new Event("update:success"));
		}, onNotOk: function(req) {
			eventTarget.dispatchEvent(new CustomEvent("update:failure", { detail: req }));
		} });
	}

	updateTags() {
		var page = Math.floor(this.selected / 8);
		for (var ii = 0; ii < 8; ii++) {
			var index = page * 8 + ii;
			if (index < images.length) this.imgs[ii].src = "/api/images/" + images[index];
			else this.imgs[ii].src = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs%3D";
		}
	}

	moveCursor(dx: number, dy: number) {
		var newSelected = this.selected;
		if (dy < 0) newSelected = newSelected - this.columns;
		else if (dy > 0) newSelected = newSelected + this.columns;
		else if (dx < 0) newSelected = newSelected - 1;
		else if (dx > 0) newSelected = newSelected + 1;
		if (newSelected < this.selected) newSelected = this.images.length + newSelected;
		newSelected %= images.length;
		var needUpdate = Math.floor(this.selected / 8) != Math.floor(newSelected / 8);
		this.selected = newSelected;
		this.imagePage.innerHTML = Math.ceil((this.selected + 1) / 8) + "/" + Math.ceil(images.length / 8);
		if (needUpdate) {
			state.setLoading(true);
			var updateTags = this.updateTags.bind(this);
			setTimeout(function() {
				updateTags();
				state.setLoading(false);
			}, 250);
		}
		for (var ii = 0; ii < this.imgs.length; ii++) {
			if (ii === (this.selected % this.imgs.length)) this.imgs[ii].classList.add("selected");
			else this.imgs[ii].classList.remove("selected");
		}
	}

	startFlow() {
		var realThis = this;
		// Fetch images
		state.setLoading(true);
		this.on("update:success", function() {
			log("updated images");
			state.setLoading(false);
			// Hydrate image list
			realThis.selected = 0;
			realThis.updateTags();
			realThis.imgs[0].classList.add("selected");
			realThis.imagePage.innerHTML = Math.ceil((realThis.selected + 1) / 8) + "/" + Math.ceil(images.length / 8);
			// Setup custom button logic
			realThis.customImageButton.ontouchstart = function() {
				var link = prompt("Enter link to image:");
				if (link === null) return;
				realThis.eventTarget.dispatchEvent(new CustomEvent("chosen", { detail: link }));
			}
			realThis.active = true;
			realThis.imageChooserDiv.classList.remove("disabled");
		});
		this.on("update:failure", function() {
			state.setLoading(false);
		});
		this.updateImages();
	}

	endFlow() {
		this.active = false;
		this.imageChooserDiv.classList.add("disabled");
		this.off("update:success");
		this.off("update:failure");
		this.off("chosen");
	}

	clickImage() {
		var img = this.imgs[this.selected % 8];
		if (img.ontouchstart) img.ontouchstart({ currentTarget: img } as any);
	}

	// Homemade event listener
	private readonly eventTarget = document.createElement("div");
	private eventListeners: { [key: string]: Listener[] } = {};
	on(type: string, listener: Listener) {
		if (this.eventListeners[type]) this.eventListeners[type].push(listener);
		else this.eventListeners[type] = [listener];
		this.eventTarget.addEventListener(type, listener);
	}

	off(type: string) {
		if (!this.eventListeners[type]) return;
		for (const listener of this.eventListeners[type])
			this.eventTarget.removeEventListener(type, listener);
	}
}

var imageChooser = new ImageChooser();