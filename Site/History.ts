interface IHistory {
	HistoryData: any[];
	Reader: FB3Reader.IFBReader;
	push(Data: FB3DOM.IXPath): void;
}
module WebHistory {
	export class HistoryClass implements IHistory {
		public HistoryData: any[];
		private MaxLen: number;
		private JustAddedHash: boolean;
		constructor(public Reader: FB3Reader.IFBReader, private skipHash?: boolean) {
			this.MaxLen = 10;
			this.HistoryData = [];
			this.JustAddedHash = false;
			if (!this.skipHash) {
				window.onhashchange = () => this.backAction();
			}
		}
		public push(Data: FB3DOM.IXPath): void {
			if (this.checkHistory() >= this.MaxLen) {
				this.HistoryData.shift();
			}
			if (!this.skipHash) {
				this.JustAddedHash = true;
				window.location.hash = 'back_' + Data.join('_');
			}
			this.HistoryData.push(Data);
			LitresReaderSite.HistoryAfterUpdate();
		}
		private checkHistory(): number {
			return this.HistoryData.length;
		}
		private back(): FB3DOM.IXPath {
			return this.HistoryData.pop();
		}
		private backAction() {
			if (this.JustAddedHash) {
				this.JustAddedHash = false;
				return;
			}
			// console.log('hashchange');
			if (this.checkHistory()) {
				this.Reader.GoTO(this.back());
				if (this.checkHistory() == 0) {
					LitresReaderSite.HistoryAfterLast();
				}
			}
		}
	}
}