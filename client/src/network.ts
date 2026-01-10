function serverUrl(url: string) {
	return "http://" + window.location.host + url;
}

function fetch(url: string, options?: { method?: string, body?: string, contentType?: string, onOk?: (req: XMLHttpRequest) => void, onNotOk?: (req: XMLHttpRequest) => void }) {
	var req = new XMLHttpRequest();
	if (options && options.method) req.open(options.method, url, true);
	else req.open("GET", url, true);
	req.onreadystatechange = function() {
		if (req.readyState == 4) {
			if (req.status >= 200 && req.status < 300) {
				if (options && options.onOk) options.onOk(req);
			} else if (options && options.onNotOk) {
				options.onNotOk(req);
			}
		}
	};
	if (options && options.body) {
		if (options.contentType) req.setRequestHeader("Content-type", options.contentType);
		else req.setRequestHeader("Content-Type", "text/plain");
		req.send(options.body);
	} else req.send();
	return req;
}

function log(message: string) {
	fetch(serverUrl("/api/log"), { method: "POST", body: message });
}

var images: string[] = [];
function updateImages(options?: { onOk?: (req: XMLHttpRequest) => void, onNotOk?: (req: XMLHttpRequest) => void }) {
	fetch(serverUrl("/api/images"), { method: "GET", onOk: function(req) {
		var newImages: string[] = [];
		var split = req.responseText.split("\n");
		for (var ii = 0; ii < split.length; ii++) {
			if (!split[ii].trim()) continue;
			newImages.push(split[ii]);
		}
		images = newImages;
		if (options && options.onOk) options.onOk(req);
	}, onNotOk: function(req) {
		if (options && options.onNotOk) options.onNotOk(req);
	} });
}