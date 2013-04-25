/// <reference path="FB3DOMHead.ts" />
/// <reference path="FB3DOMBlock.ts" />

module FB3DOM {

	class AsyncLoadConsumer {
		private Blocks: number[];
		private Done: boolean;
		private OnDone: IDOMTextReadyCallback;
		BlockLoaded(N: number): number {
			if (this.Done) return;
			for (var I = 0; I <= this.Blocks.length; I++) {
				if (this.Blocks[I] == N)
						this.Blocks.splice(I,1);
			}
			if (!this.Blocks.length) {
				var HTML = this.FB3DOM.GetHTML(this.FB3DOM.HyphOn, this.Range);
				IDOMTextReadyCallback(HTML);
				this.Done = true;
			}
		}
		constructor(private FB3DOM: IFB3DOM, private Range: IRange) {
			this.Blocks = FB3DOM.MissingRangeBlocks(Range);
		}
	}

	export class FB3DOM extends FB3Tag implements IFB3DOM {
		private RawData: Array;
		private LoadDequests: Array;
		
		constructor(private Alert: FB3ReaderSite.IAlert, private URL: string, public HyphOn: bool) {
			super(null, null, 0);
			this.RawData = new Array();
			this._Init();
		}

		public TOC() {
			return {
				Title: 'Title',
				Subitems: new Array(),
				StartBlock: 0,
				EndBlock: 30
			};
		}

		public GetCloseTag(Range: IRange): string {
			return '';
		}
		public GetInitTag(Range: IRange): string {
			return '';
		}

		public MissingRangeBlocks(Range: IRange): number[] {
			return [1];
		}

		// Wondering why I make _Init public? Because you can't inherite private methods, darling!
		public _Init() {
		}

	}

}


