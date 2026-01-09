function fetch(url: string, options?: { method?: string, body?: string, contentType?: string, callback?: (req: XMLHttpRequest) => void }) {
	var req = new XMLHttpRequest();
	if (options && options.method) req.open(options.method, url, true);
	else req.open("GET", url, true);
	req.onreadystatechange = function() {
		if (options && options.callback)
			options.callback(req);
	};
	if (options && options.body) {
		if (options.contentType) req.setRequestHeader("Content-type", options.contentType);
		else req.setRequestHeader("Content-Type", "text/plain");
		req.send(options.body);
	} else req.send();
	return req;
}

function log(message: string) {
	fetch("http://192.168.2.240:8000/api/log", { method: "POST", body: message });
}
