/// <reference path="FB3DOMHead.ts" />
/// <reference path="FB3DOMBlock.ts" />

module FB3DOM {
	declare var window;

	class AsyncLoadConsumer {
		private ImDone: boolean;
		BlockLoaded(N: number): boolean {
			if (this.ImDone) return false;
			var I = this.WaitedBlocks.indexOf(N);
			if (I != -1) {
				this.WaitedBlocks.splice(I, 1);
			}
			for (var I = 0; I < this.WaitedBlocks.length; I++) {
				if (this.WaitedBlocks[I] == N)
					this.WaitedBlocks.splice(I,1);
			}
			if (!this.WaitedBlocks.length) {
				if (this.OnGetDone) {
					var PageData = new PageContainer();
					var AllBookmarks = new Array();
					this.FB3DOM.GetHTML(this.HyphOn, this.BookStyleNotes, this.Range, this.IDPrefix, this.ViewPortW, this.ViewPortH, PageData);
					this.OnGetDone(PageData);
				} else {
					this.OnLoadDone();
				}
				return true;
			} else {
				return false;
			}
		}
		constructor(private FB3DOM: IFB3DOM,
			private WaitedBlocks: number[],
			private OnGetDone: IDOMTextReadyCallback,
			private OnLoadDone: IChunkLoadedCallback,
			private HyphOn?: boolean,
			private BookStyleNotes?: boolean,
			private Range?: IRange,
			private IDPrefix?: string,
			private ViewPortW?: number,
			private ViewPortH?: number) {
			for (var I = 0; I < this.WaitedBlocks.length; I++) {
				if (!this.FB3DOM.DataChunks[this.WaitedBlocks[I]].loaded) {
					this.FB3DOM.DataProvider.Request(this.FB3DOM.ChunkUrl(this.WaitedBlocks[I]),
						(Data: any, CustomData?: any) => this.FB3DOM.OnChunkLoaded(Data, CustomData),
						this.FB3DOM.Progressor, { ChunkN: this.WaitedBlocks[I] });
					this.FB3DOM.DataChunks[this.WaitedBlocks[I]].loaded = 1;
				}
			}
		}
	}

	interface IJSonLoadingDone{ (JSON: string) };

	export class PageContainer implements IPageContainer {
		public Body: InnerHTML[];
		public FootNotes: InnerHTML[];
		constructor () {
			this.Body = new Array();
			this.FootNotes = new Array();
		}
	}

	export class DOM extends FB3Tag implements IFB3DOM {
		private HyphOn: boolean;
		private ActiveRequests: AsyncLoadConsumer[];
		public TOC: ITOC[];
		public DataChunks: IDataDisposition[];
		public MetaData: IMetaData;
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
			this.XPath = new Array();
			this.Bookmarks = new Array();
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
			this.MetaData = Data.Meta;
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
		public GetHTMLAsync(HyphOn: boolean, BookStyleNotes:boolean, Range: IRange, IDPrefix: string, ViewPortW: number, ViewPortH: number, Callback: IDOMTextReadyCallback): void {
		
			var MissingChunks = this.CheckRangeLoaded(Range.From[0], Range.To[0]);
			if (MissingChunks.length == 0) {
				var PageData = new PageContainer();
				this.GetHTML(HyphOn, BookStyleNotes, Range, IDPrefix, ViewPortW, ViewPortH, PageData);
				Callback(PageData);
			} else {
				this.ActiveRequests.push(new AsyncLoadConsumer(this, MissingChunks, Callback, undefined, HyphOn, BookStyleNotes, Range, IDPrefix, ViewPortW, ViewPortH));
			}
			
		}

		public LoadChunks(MissingChunks: number[], Callback: IChunkLoadedCallback): void {
			this.ActiveRequests.push(new AsyncLoadConsumer(this, MissingChunks, undefined, Callback));
		}

		public ChunkUrl(N: number): string {
			return this.ArtID2URL(N.toString());
		}

		public ArtID2URL(Chunk?: string): string {
			return this.DataProvider.ArtID2URL(this.ArtID, Chunk);
		}

		public GetElementByAddr(Position: FB3Reader.IPosition): IFB3Block {
			var ResponcibleNode: IFB3Block = this;
			while (Position.length && ResponcibleNode.Childs) {
				ResponcibleNode = ResponcibleNode.Childs[Position.shift()];
			}
			return ResponcibleNode;
		}
		public GetAddrByXPath(XPath: FB3Bookmarks.IXPath): FB3Reader.IPosition {
			var Node: IFB3Block = this;
			var I = 0;
			while (I < Node.Childs.length) {
				if (Node.Childs[I] && Node.Childs[I].XPath){
					var PC = XPathCompare(XPath, Node.Childs[I].XPath);
					if (PC == -10
						|| PC == 0
						|| PC == 1 && (
							!Node.Childs[I].Childs || !Node.Childs[I].Childs.length
							)
						) {
						// This node is the exact xpath or the xpath points a bit above,
						// we assume this is it. Or xpath is more detailed than we can sww with our DOM map
						return Node.Childs[I].Position();
					} else if (PC == 1) {
						Node = Node.Childs[I];
						I = 0;
						continue;
					}
				}
				I++;
			}
			if (Node.Parent) {
				return Node.Position();
			} else {
				return [0]; // that's some unreasonable xpath, we have no idea where it can be
			}
		}

		public GetXPathFromPos(Position: FB3Reader.IPosition): FB3Bookmarks.IXPath {
			var Element = this.GetElementByAddr(Position);
			if (Element) {
				return Element.XPath;
			} else {
				return undefined;
			}
		}

		public GetHTML(HyphOn: boolean, BookStyleNotes:boolean, Range: IRange, IDPrefix: string, ViewPortW: number, ViewPortH: number, PageData: IPageContainer) {
			var FullBookmarksList: FB3Bookmarks.IBookmark[] = new Array;
			for (var I = 0; I < this.Bookmarks.length; I++) {
				FullBookmarksList = FullBookmarksList.concat(this.Bookmarks[I].Bookmarks);
			}
			super.GetHTML(HyphOn, BookStyleNotes, Range, IDPrefix, ViewPortW, ViewPortH, PageData, FullBookmarksList);
		}


		public OnChunkLoaded(Data: Array<IJSONBlock>, CustomData?: any):void {
			
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


