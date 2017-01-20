interface IBarClass {
	type: string;
	obj: any;
	progress: any;
	dot: any;
	data?: Array<number>;
	dataCurrent?: number;
	swipeState: boolean;
	setValue(val?: number): void;
}

var doc = document;

module BarClassRe {
	export class BarClass implements IBarClass {
		public progress: any;
		public dot: any;
		public swipeState: boolean;
		private mouseMoveState: boolean;
		private dotMouseClick: boolean;
		private progressCurrentLeft: number;
		private progressLeft: number;
		private progressWidth: number;
		private dataMax: number;
		private barState: boolean;
		private debug: boolean;
		private stickyObjs;
		private eventType: string; // just literal for callback actions
		constructor(public type,
			public obj,
			private pda_state: boolean,
			private callback?,
			private spanInfo?,
			public data?,
			public dataCurrent?,
			private progressSticky?,
			private drawStickyPointState?,
			private invertData?) {
				this.eventType = null;
				this.barState = true;
				this.debug = false;
				this.mouseMoveState = true;
				this.progressCurrentLeft = 0;
				this.progressLeft = 0;
				this.swipeState = false;
				if (this.type == 'setting') {
					this.dataMax = this.data.length - 1;
				}
				this.initObjects();
				if (this.type == 'setting') {
					this.setValue();
				}
				this.setHandlers();
		}
		private initObjects() {
			this.obj = doc.querySelector(this.obj);
			if (this.type == 'setting' && this.drawStickyPointState) {
				this.drawStickyPoint();
			}
			this.progress = this.obj.querySelector('.progress');
			this.dot = this.obj.querySelector('.dot');
		}
		private setHandlers() {
			this.obj.onclick = (e) => this.barClickHandler(e);
			if (this.pda_state) {
				this.dot.ontouchstart = (e) => this.dotClickHandler(e);
				this.dot.ontouchend = (e) => this.swipeDone(e);
			} else {
				this.dot.onmousedown = (e) => this.dotClickHandler(e);
				this.dot.onmouseup = (e) => this.swipeDone(e);
			}
			var left = this.obj.parentNode.querySelector('.minus');
			if (left) {
				left.onclick = () => this.leftClick();
			}
			var right = this.obj.parentNode.querySelector('.plus');
			if (right) {
				right.onclick = () => this.rightClick();
			}
		}
		private getPercent(val, min, max): string {
			var p = 0;
			if (val <= min) {
				p = 0;
			} else if (val >= max) {
				p = 100;
			} else {
				p = val / (max / 100);
			}
			return p.toFixed(2);
		}
		private updateBar(val) {
			var x = parseFloat(this.getPercent(Math.abs(val), 0, this.obj.offsetWidth));
			this.progressWidth = x;
			this.debugLog('updateBar ' + x);
			switch (this.type) {
				case "progress":
					this.dataCurrent = x;
					break;
				case "setting":
					var prev = 0;
					for (var j = 0; j <= this.dataMax; j++) {
						var current = parseFloat(this.getPercent(j, 0, this.dataMax));
						if (current >= x) {
							this.dataCurrent = j;
							if (x + (current - prev) / 2 < current){
								this.dataCurrent--;
							}
							if (this.invertData) {
								this.invertDataCurrent();
							}
							break;
						}
						prev = current;
					}
					break;
			}
			this.setValue(this.progressWidth);
			this.callAction();
		}
		public setValue(val?: number) {
			switch (this.type) {
				case "progress":
					this.updateBarWidth(val);
					break;
				case "setting":
					var per: string = "0";
					// TODO: fix when last and first with this.progressSticky = true
					if (!val || this.progressSticky) {
						per = this.getPercent(this.dataCurrent, 0, this.dataMax);
					} else {
						per = val.toString();
					}
					if (this.invertData && this.dataCurrent == this.dataMax && parseInt(per) == 100) {
						per = "0";
					}
					if (this.spanInfo) {
						this.obj.querySelector('span').textContent = this.data[this.dataCurrent];
					}
					this.updateBarWidth(per);
					break;
			}
		}
		private invertDataCurrent() { // ugly workaround
			if (this.dataCurrent == 0) {
				this.dataCurrent = this.dataMax;
			} else {
				this.dataCurrent = this.dataMax - this.dataCurrent;
			}
		}
		private updateBarWidth(val) {
			this.progress.setAttribute('style', 'width:' + val + '%;');
			if (this.progressSticky) {
				this.updateStickyPointState();
			}
		}
		private getX(e): number {
			if (this.pda_state) {
				return this.getXPDA(e);
			} else {
				return this.getXNormal(e);
			}
		}
		private getXNormal(e): number {
			this.progressLeft = this.progress.getBoundingClientRect().left;
			this.progressCurrentLeft = e.clientX - this.progressLeft;
			this.progressCurrentLeft = this.progressCurrentLeft < 0 ? 0 : this.progressCurrentLeft;
			return this.progressCurrentLeft;
		}
		private getXPDA(e): number {
			if (e.type == 'click') {
				return this.getXNormal(e);
			}
			var touches = e.changedTouches || e.touches;
			return this.getXNormal(touches[0]);
		}
		private barClickHandler(e) {
			this.debugLog('barClickHandler');
			this.eventType = 'action_click';
			this.checkCurrentState();
			if (this.barState) {
				this.updateBar(this.getX(e));
			}
			e.stopPropagation();
		}
		private dotClickHandler(e) {
			this.debugLog('dotClickHandler');
			this.eventType = 'action_start';
			this.checkCurrentState();
			if (this.barState) {
				this.dotMouseClick = true;
				if (this.mouseMoveState) {
					if (this.pda_state) {
						this.obj.ontouchmove = (e) => this.swipeHandler(e);
					} else {
						this.obj.onmousemove = (e) => this.swipeHandler(e);
					}
				}
				doc.onmouseup = (e) => this.swipeDone(e, true);
				(<any> doc).ontouchend = (e) => this.swipeDone(e, true);
			}
			e.stopPropagation();
			return false;
		}
		private swipeHandler(e) {
			this.debugLog('swipeHandler');
			this.eventType = 'action_move';
			this.checkCurrentState();
			if (this.barState) {
				this.swipeState = true;
				this.updateBar(this.getX(e));
			}
			e.stopPropagation();
			return false;
		}
		private swipeDone(e, docState?) {
			this.debugLog('swipeDone');
			this.eventType = 'action_end';
			this.checkCurrentState();
			if (this.barState) {
				if (this.swipeState) {
					this.swipeState = false;
				}
				if (this.dotMouseClick) {
					this.dotMouseClick = false;
					if (!docState) {
						this.updateBar(this.getX(e));
					} else {
						this.eventType = 'action_end_doc';
						if (this.type == 'progress') {
							this.callAction();
						}
					}
				}
				doc.onmouseup = () => {};
				(<any> doc).ontouchend = () => {};
				this.obj.ontouchmove = () => {};
				this.obj.onmousemove = () => {};
			}
			e.stopPropagation();
		}
		private leftClick() {
			this.checkCurrentState();
			if (!this.barState || this.dataCurrent == 0) {
				return;
			}
			this.dataCurrent--;
			this.setValue();
			this.callAction();
		}
		private rightClick() {
			this.checkCurrentState();
			if (!this.barState || this.dataCurrent == this.dataMax) {
				return;
			}
			this.dataCurrent++;
			this.setValue();
			this.callAction();
		}
		private callAction() {
			if (this.callback) {
				this.callback(this.dataCurrent, this.eventType);
			}
		}
		private drawStickyPoint() {
			var track = this.obj.querySelector('.track');
			for (var j = 0; j <= this.dataMax; j++) {
				track.innerHTML += '<span data-pos="' + j + '" style="left:' +
					parseFloat(this.getPercent(j, 0, this.dataMax)) + '%;"></span>';
			}
			this.stickyObjs = this.obj.querySelectorAll('.track span');
		}
		private updateStickyPointState() {
			for (var j = 0; j < this.stickyObjs.length; j++) {
				var span = this.stickyObjs[j];
				if (span.getAttribute('data-pos') <= this.dataCurrent) {
					addClass(span, 'active');
				} else {
					removeClass(span, 'active');
				}
			}
		}
		private checkCurrentState() {
			if (this.obj.getAttribute('disabled') == 'true') {
				this.barState = false;
			} else {
				this.barState = true;
			}
		}
		private debugLog(str: string) {
			if (this.debug) {
				console.log(str);
			}
		}
	}
}