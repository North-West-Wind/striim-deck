function log(message: string) {
	var req = new XMLHttpRequest();
	req.open("POST", "http://192.168.2.240:8000/api/log", true);
	req.setRequestHeader('Content-type', 'text/plain');
	req.send(message);
}