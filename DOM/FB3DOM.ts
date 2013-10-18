/// <reference path="FB3DOMHead.ts" />
/// <reference path="FB3DOMBlock.ts" />

module FB3DOM {
	declare var window;

	class AsyncLoadConsumer {
		private ImDone: boolean;
		BlockLoaded(N: number): boolean {
			if (this.ImDone) return false;
			for (var I = 0; I < this.WaitedBlocks.length; I++) {
				if (this.WaitedBlocks[I] == N)
					this.WaitedBlocks.splice(I,1);
			}
			if (!this.WaitedBlocks.length) {
				var PageData = new PageContainer();
				var HTML = this.FB3DOM.GetHTML(this.HyphOn, this.Range, this.IDPrefix, this.ViewPortW, this.ViewPortH, PageData);
				this.OnDone(PageData);
				return true;
			} else {
				return false;
			}
		}
		constructor(private FB3DOM: IFB3DOM,
			private WaitedBlocks: number[],
			private HyphOn: boolean,
			private Range: IRange,
			private IDPrefix: string,
			private ViewPortW: number,
			private ViewPortH: number,
			private OnDone: IDOMTextReadyCallback) {
		}
	}

	interface IJSonLoadingDone{ (JSON: string) };

	class PageContainer implements IPageContainer {
		public Body: InnerHTML[];
		public FootNotes: InnerHTML[];
		constructor () {
			this.Body = new Array();
			this.FootNotes = new Array();
		}
	}

	export class DOM extends FB3Tag implements IFB3DOM {
		private LoadDequests: Array;
		private HyphOn: boolean;
		private ActiveRequests: AsyncLoadConsumer[];
		public TOC: ITOC[];
		public DataChunks: IDataDisposition[];
		public Ready: boolean;
		private OnDoneFunc: any;
		private ArtID: string;
		public XPID: string;
		
		constructor(public Alert: FB3ReaderSite.IAlert,
			public Progressor: FB3ReaderSite.ILoadProgress,
			public DataProvider: FB3DataProvider.IJsonLoaderFactory) {
			super(null, null, 0);
			this.ActiveRequests = [];
			this.Ready = false;
			this.XPID = '';
		}

		public GetCloseTag(Range: IRange): string {
			return '';
		}
		public GetInitTag(Range: IRange): InnerHTML[] {
			return [];
		}

		private CheckAndPullRequiredBlocks(Range: IRange): number[] {
			return [1];
		}

		private AfterHeaderLoaded(Data: any):void {
			this.TOC = Data.Body;
			this.DataChunks = Data.Parts;
			this.Ready = true;
			this.OnDoneFunc(this);
		}

		// Wondering why I make Init public? Because you can't inherite private methods, darling!
		public Init(HyphOn: boolean, ArtID: string, OnDone: { (FB3DOM: IFB3DOM): void; }) {
			this.HyphOn = HyphOn;
			this.OnDoneFunc = OnDone;
			this.ArtID = ArtID;
			this.Childs = new Array();
			this.Progressor.HourglassOn(this, true, 'Loading meta...');
			this.DataProvider.Request(this.DataProvider.ArtID2URL(ArtID), (Data: any) => this.AfterHeaderLoaded(Data), this.Progressor);
			this.Progressor.HourglassOff(this);
		}
		public GetHTMLAsync(HyphOn: boolean, Range: IRange, IDPrefix: string, ViewPortW: number, ViewPortH: number, Callback: IDOMTextReadyCallback): void {
		
			var MissingChunks = this.CheckRangeLoaded(Range.From[0], Range.To[0]);
			if (MissingChunks.length == 0) {
				var PageData = new PageContainer();
				this.GetHTML(HyphOn, Range, IDPrefix, ViewPortW, ViewPortH, PageData);
				Callback(PageData);
			} else {
				this.ActiveRequests.push(new AsyncLoadConsumer(this, MissingChunks, HyphOn, Range, IDPrefix, ViewPortW, ViewPortH, Callback));
				for (var I = 0; I < MissingChunks.length; I++) {
					if (!this.DataChunks[MissingChunks[I]].loaded) {
						var AjRequest = this.DataProvider.Request(this.ChunkUrl(MissingChunks[I]),
							(Data: any, CustomData?: any) => this.OnChunkLoaded(Data, CustomData),
							this.Progressor, { ChunkN: MissingChunks[I]});
						this.DataChunks[MissingChunks[I]].loaded = 1;
					}
				}
			}
			
		}

		public ChunkUrl(N: number): string {
			return this.ArtID2URL(N);
		}

		public ArtID2URL(Chunk?: number): string {
			return this.DataProvider.ArtID2URL(this.ArtID, Chunk.toString());
		}


		private OnChunkLoaded(Data: Array<IJSONBlock>, CustomData?: any):void {
			
			var LoadedChunk: number = CustomData.ChunkN;
			var Shift = this.DataChunks[LoadedChunk].s;
			for (var I = 0; I < Data.length; I++) {
				this.Childs[I + Shift] = new FB3Tag(Data[I],this, I + Shift);
			}
			this.DataChunks[LoadedChunk].loaded = 2;

			var I = 0;
			while (I < this.ActiveRequests.length) {
				if (this.ActiveRequests[I].BlockLoaded(LoadedChunk)) {
					this.ActiveRequests.splice(I, 1);
				} else {
					I++;
				}
			}
			
		}

		private CheckRangeLoaded(From: number, To: number): number[] {
			var ChunksMissing = [];
			for (var I = 0; I < this.DataChunks.length; I++) {
				if ( // If this chunk intersects with our range
						(
							From <= this.DataChunks[I].s && To >= this.DataChunks[I].s
							||
							From <= this.DataChunks[I].e && To >= this.DataChunks[I].e
							||
							From >= this.DataChunks[I].s && To <= this.DataChunks[I].e
						)
						&& this.DataChunks[I].loaded != 2
					) {
					ChunksMissing.push(I);
				}
			}
			return ChunksMissing;
		}
	}

}


