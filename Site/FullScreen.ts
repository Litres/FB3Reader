/// <reference path="FullScreenHead.ts" />

module FullScreenSupport {
	export class FullScreenClass implements IFullScreenClass {
		public fullScreen: boolean;
		private buttonClicked: boolean;
		private hotkeyClicked: boolean;
		private doc: any;
		private wrap: any;
		private button: HTMLElement; // fullscreen button in menu
		private UIElements: Array<HTMLElement>;
		private fullScreenToogleOn: any;
		private fullScreenToogleOff: any;
		private debug: boolean;
		private fullscreenButton;
		private normalscreenButton;
		private ButtonClass: string[] = ['menu-fullscreen', 'menu-normalscreen'];
		constructor(public fullScreenCallback, private footer: HTMLElement, public Parent: EventsModule.IEventActions) {
			this.debug = false;
			this.fullScreen = false;
			this.buttonClicked = false;
			this.hotkeyClicked = false;
			this.UIElements = [];
			this.doc = document;
			this.wrap = (<any> this.doc.querySelector('.wrapper')); // TODO: fix in future
			this.fullscreenButton = (<HTMLElement> this.doc.querySelector('.menu-fullscreen').parentNode);
			this.normalscreenButton = (<HTMLElement> this.doc.querySelector('.menu-normalscreen').parentNode);
			this.setUIElements();
			this.setHandlers();
			this.Parent.WindowsCarry.RegisterWindow(this);
		}
		private setHandlers() {
			this.wrap.addEventListener("fullscreenchange", () => this.fullScreenChange(), false);
			this.wrap.addEventListener("msfullscreenchange", () => this.fullScreenChange(), false);
			this.wrap.addEventListener("mozfullscreenchange", () => this.fullScreenChange(), false);
			this.wrap.addEventListener("webkitfullscreenchange", () => this.fullScreenChange(), false);
			window.addEventListener('keyup', (t) => this.fullScreenHotkey(t), false);
			if (this.wrap.mozRequestFullScreen)
				window.addEventListener('resize', (t) => this.mozEscapeFullscreen(t), false);
			var buyButton = (<HTMLElement> document.querySelector('#buy-book'));
			buyButton.addEventListener('click',
				() => {
					if (this.fullScreen) {
						this.ButtonHandler();
					}
				},
				false
			);
		}
		private setFullscreenOn() {
			if (this.wrap.requestFullscreen) {
				this.wrap.requestFullscreen();
			} else if (this.wrap.msRequestFullscreen) {
				this.wrap.msRequestFullscreen();
			} else if (this.wrap.mozRequestFullScreen) {
				this.wrap.mozRequestFullScreen();
			} else if (this.wrap.webkitRequestFullscreen) {
				this.wrap.webkitRequestFullscreen();
			} else if (this.wrap.webkitRequestFullScreen) {
				this.wrap.webkitRequestFullScreen();
			}
		}
		private mozEscapeFullscreen(e) {
			// ugly firefox! hate firefox!
			this.debugLog('mozEscapeFullscreen');
			var mozDoc = (<any> document);
			if ((<any> window.navigator).standalone ||
				(mozDoc.fullScreenElement && mozDoc.fullScreenElement != null) ||
				(mozDoc.mozFullScreen || mozDoc.webkitIsFullScreen) || (!window.screenTop && !window.screenY)) {
			} else if (this.fullScreen) {
				this.hotkeyClicked = true;
				this.toggleFullScreen();
			}
			e.cancelBubble = true;
			e.stopPropagation();
			return false;
		}
		private setFullscreenOff() {
			if (this.doc.exitFullscreen) {
				this.doc.exitFullscreen();
			} else if (this.doc.msExitFullscreen) {
				this.doc.msExitFullscreen();
			} else if (this.doc.mozCancelFullScreen) {
				this.doc.mozCancelFullScreen();
			} else if (this.doc.webkitExitFullscreen) {
				this.doc.webkitExitFullscreen();
			} else if (this.doc.webkitCancelFullScreen) {
				this.doc.webkitCancelFullScreen();
			}
		}
		private fullScreenButton() {
			this.debugLog('fullScreenButton');
			this.buttonClicked = true;
			this.toggleFullScreen();
		}
		private fullScreenChange() {
			if (this.buttonClicked) {
				this.debugLog('fullScreenChange ' + this.buttonClicked);
				this.buttonClicked = false;
			} else {
				this.debugLog('fullScreenChange');
				this.toggleFullScreen();
			}
		}
		private fullScreenHotkey(e) {
			this.debugLog('fullScreenHotkey');
			var keyCode = e.keyCode || e.which;
			if (keyCode == 122) { // F11 to skip fullscreen on|off
				this.hotkeyClicked = true;
				this.toggleFullScreen();
			}
			e.cancelBubble = true;
			e.stopPropagation();
			return false;
		}
		private toggleFullScreen() {
			this.debugLog('toggleFullScreen ' + this.fullScreen);
			if (this.hotkeyClicked) { // allready fullscreen fired by browser
				this.hotkeyClicked = false;
			} else {
				if (this.fullScreen) {
					this.setFullscreenOff();
				} else {
					this.setFullscreenOn();
				}
			}
			if (this.fullScreen) {
				this.fullscreenButton.style.display = 'inline-block';
				this.normalscreenButton.style.display = 'none';
				this.showUIElements();
				this.fullScreenCallback();
				this.fullScreen = false;
			} else {
				this.fullscreenButton.style.display = 'none';
				this.normalscreenButton.style.display = 'inline-block';
				this.hideUIElements();
				this.fullScreen = true;
			}
		}
		private setUIElements() {
			this.debugLog('setUIElements');
			this.UIElements.push((<HTMLElement> this.footer.querySelector('.footer-info')));
		}
		private hideUIElements() {
			this.debugLog('hideUIElements');
			this.updateUIElements('none');
		}
		private showUIElements() {
			this.debugLog('showUIElements');
			this.updateUIElements('block');
		}
		private updateUIElements(state) {
			for (var j in this.UIElements) {
				this.UIElements[j].style.display = state;
			}
		}
		private debugLog(str: string) {
			if (this.debug) {
				console.log(str);
			}
		}
		public ButtonHandler(): void {
			return this.fullScreenButton();
		}
		public showHiddenElements(): void {}
	}

	export class PDAFullScreenClass implements IFullScreenClass {
		public fullScreen: boolean;
		private doc: any;
		private fullscreenButton;
		private normalscreenButton;
		private UIElements: Array<HTMLElement>;
		private animating: boolean;
		private UIElementsState: boolean;
		private ButtonClass: string[] = ['menu-fullscreen', 'menu-normalscreen'];
		constructor(public fullScreenCallback, private toggleCallback, public Parent: EventsModule.IEventActions) {
			this.animating = false;
			this.fullScreen = false;
			this.UIElementsState = true;
			this.UIElements = [];
			this.doc = document;
			this.fullscreenButton = (<HTMLElement> this.doc.querySelector('.menu-fullscreen').parentNode);
			this.normalscreenButton = (<HTMLElement> this.doc.querySelector('.menu-normalscreen').parentNode);
			this.setUIElements();
			this.Parent.WindowsCarry.RegisterWindow(this);
		}
		private setUIElements() {
			this.UIElements.push(<HTMLElement> this.doc.querySelector('.header'));
		}
		private hideUIElements() {
			this.updateUIElements('none');
		}
		private showUIElements() {
			this.updateUIElements('block');
		}
		private updateUIElements(state) {
			for (var j in this.UIElements) {
				this.UIElements[j].style.display = state;
				// TODO: replace to animation, someday
			}
		}
		private showTopbar(obj) {
			this.scrollToNative(obj, 1, 40, () => {
				// removeClass(<HTMLElement> obj, 'hidden');
			});
		}
		private hideTopbar(obj) {
			this.scrollToNative(obj, -1, 40, () => {
				// addClass(<HTMLElement> obj, 'hidden');
			});
		}
		private scrollToNative(obj, dir, height, callback) {
			if (this.animating) {
				return;
			}
			this.animating = true;
			this.animation(obj, dir, height, callback);
		}
		private animation(el, dir, h, callback) {
			var top = parseFloat(el.style.top) || 0;
			if (Math.round(top) == (dir > 0 ? 0 : h * dir)) {
				callback();
				this.animating = false;
				return;
			}
			setTimeout(() => {
				var height = top + (dir > 0 ? h : h * dir)/60;
				el.style.top = height.toFixed(2) + 'px';
				this.animation(el, dir, h, callback);
			}, 5);
		}
		private fullScreenButton() {
			this.toggleUIElements(this.fullScreen);
			if (!this.fullScreen) {
				this.fullScreen = true;
				this.fullscreenButton.style.display = 'none';
				this.normalscreenButton.style.display = 'inline-block';
			} else {
				this.fullScreen = false;
				this.fullscreenButton.style.display = 'inline-block';
				this.normalscreenButton.style.display = 'none';
			}
			this.fullScreenCallback(this.fullScreen);
		}
		private toggleUIElements(state): void {
			if (!state) {
				this.hideUIElements();
				this.UIElementsState = false;
			} else {
				this.showUIElements();
				this.UIElementsState = true;
			}
			this.toggleCallback(this.UIElementsState);
		}
		public showHiddenElements(): void {
			this.toggleUIElements(!this.UIElementsState);
		}
		public ButtonHandler(): void {
			return this.fullScreenButton();
		}
	}
}

// LitresFullScreen = new FullScreenSupport.FullScreenClass(topButtonsRemoveActive);