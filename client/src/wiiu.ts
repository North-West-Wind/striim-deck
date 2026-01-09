// From https://wiiubrew.org/wiki/Internet_Browser
var WiiUButton = {
	LLEFT: 0x40000000,
	LRIGHT: 0x20000000,
	LUP: 0x10000000,
	LDOWN: 0x08000000,
	RLEFT: 0x04000000,
	RRIGHT: 0x02000000,
	RUP: 0x01000000,
	RDOWN: 0x00800000,
	LCLICK: 0x00400000,
	RCLICK: 0x00200000,
	TV: 0x00010000,
	A: 0x00008000,
	B: 0x00004000,
	X: 0x00002000,
	Y: 0x00001000,
	DLEFT: 0x00000800,
	DRIGHT: 0x00000400,
	DUP: 0x00000200,
	DDOWN: 0x00000100,
	ZL: 0x00000080,
	ZR: 0x00000040,
	L: 0x00000020,
	R: 0x00000010,
	PLUS: 0x00000008,
	MINUS: 0x00000004,
	HOME: 0x00000002
};

function isHeld(button: keyof typeof WiiUButton, hold: number) {
	return (hold & WiiUButton[button]) != 0;
}

var previousHold: number | undefined = undefined;
window.addEventListener("load", function() {
	if (window.wiiu) {
		setInterval(function() {
			previousHold = window.wiiu.gamepad.hold;
			window.wiiu.gamepad.update();
			var keys = Object.keys(WiiUButton);
			for (var ii = 0; ii < keys.length; ii++) {
				var button = keys[ii] as keyof typeof WiiUButton;
				if (!isHeld(button, previousHold) && isHeld(button, window.wiiu.gamepad.hold)) window.dispatchEvent(new CustomEvent("buttondown", { detail: button }));
				else if (isHeld(button, previousHold) && isHeld(button, window.wiiu.gamepad.hold)) window.dispatchEvent(new CustomEvent("buttonhold", { detail: button }));
				else if (isHeld(button, previousHold) && !isHeld(button, window.wiiu.gamepad.hold)) window.dispatchEvent(new CustomEvent("buttonup", { detail: button }));
			}
		}, 20);
	}
});