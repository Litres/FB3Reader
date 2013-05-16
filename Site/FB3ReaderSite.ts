/// <reference path="FB3ReaderSiteHead.ts" />

module FB3ReaderSite {

	export class ExampleSite implements IFB3ReaderSite {
		public Progressor: ILoadProgress;
		public NotePopup: INotePopup;
		public Alert: IAlert;
		constructor(public Canvas: HTMLElement) {
			this.Progressor = new ExampleProgressor();
			this.Alert = this.Progressor.Alert;
		}
		getElementById(elementId: string): HTMLElement {
			return document.getElementById(elementId);
		}

	}
	export class ExampleProgressor implements ILoadProgress {
		private Hourglasses: any;
		private Progresses: any;
		public Alert(Message: string): void {
			document.getElementById('AlertSpan').innerHTML = Message;
			//			window.alert(Message);
		}
		HourglassOn(Owner: any, Message?: string): void {
			this.Hourglasses[Owner.toString()] = 1;
			document.getElementById('MessSpan').innerHTML = Message;
			document.body.style.cursor = 'wait';
		}
		Progress(Owner: any, Progress: number): void {
			this.Progresses[Owner] = Progress;
			var N = 0;
			var OverallProgress = 0;
			for (var Progress in this.Progresses) {
				N++;
				OverallProgress = this.Progresses[Progress];
			}
			OverallProgress = OverallProgress / N;
			document.getElementById('ProgressSpan').innerHTML = OverallProgress.toFixed(1);
		}
		HourglassOff(Owner: any): void {
			this.Hourglasses[Owner] = 0;
			var HaveLive = 0;
			for (var Hourglass in this.Hourglasses) {
				if (this.Hourglasses[Hourglass] > 0) {
					HaveLive = 1;
					break;
				}
			}
			if (!HaveLive) {
				this.Hourglasses = {};
				this.Progresses = {};
				document.body.style.cursor = '';
			} else {
				this.Progress(Owner, 100);
			}
		}
		Tick(Owner: any): void {
			if (!this.Progresses[Owner]) {
				this.Progresses[Owner] = 1;
			} else if (this.Progresses[Owner] < 99) {
				this.Progresses[Owner] += 1;
			}
			this.Progress(Owner, this.Progresses[Owner]);
		}
		constructor() {
			this.Hourglasses = {};
			this.Progresses = {};
		}
	}

}
