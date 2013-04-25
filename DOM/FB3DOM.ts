/// <reference path="FB3DOMHead.ts" />
/// <reference path="FB3DOMBlock.ts" />

module FB3DOM {
	declare var window;

	class AsyncLoadConsumer {
		private ImDone: boolean;
		BlockLoaded(N: number): number {
			if (this.ImDone) return;
			for (var I = 0; I <= this.WaitedBlocks.length; I++) {
				if (this.WaitedBlocks[I] == N)
					this.WaitedBlocks.splice(I,1);
			}
			if (!this.WaitedBlocks.length) {
				var HTML = this.FB3DOM.GetHTML(this.FB3DOM.HyphOn, this.Range);
				IDOMTextReadyCallback(HTML);
				this.ImDone = true;
			}
		}
		constructor(private FB3DOM: IFB3DOM,
			private WaitedBlocks: number[],
			private Range: IRange,
			private OnDone: IDOMTextReadyCallback) {
		}
	}

	interface IJSonLoadingDone{ (JSON: string) };

	export class DOM extends FB3Tag implements IFB3DOM {
		private RawData: Array;
		private LoadDequests: Array;
		public HyphOn: bool;
		private ActiveRequests: number = 0;
		
		constructor(public Alert: FB3ReaderSite.IAlert,
			public Progressor: FB3ReaderSite.ILoadProgress,
			public DataProvider: FB3DataProvider.IJsonLoaderFactory) {
			super(null, null, 0);
			this.RawData = new Array();
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

		private CheckAndPullRequiredBlocks(Range: IRange): number[] {
			return [1];
		}

		// Wondering why I make _Init public? Because you can't inherite private methods, darling!
		public Init(HyphOn: bool, URL: string, OnDone: { (FB3DOM: IFB3DOM): void; }) {
			this.HyphOn = HyphOn;
		}
	}

}


