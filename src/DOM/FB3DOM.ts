import {
	IChunkLoadedCallback,
	IDataDisposition,
	IDOMTextReadyCallback, IFB3Block,
	IFB3DOM,
	IJSONBlock,
	IMetaData, InnerHTML, IPageContainer, IRange, ITOC, IXPath
} from "./FB3DOM.head";
import {FB3MediaCache} from "../MediaCache/MediaCache";
import {FB3DOMBlock} from "./FB3DOMBlock";
import {IBookmark, IBookmarks} from "../Bookmarks/FB3Bookmarks.head";
import {IFB3ReaderSite, ILoadProgress} from "../Site/FB3ReaderSite.head";
import {IFB3PPCache} from "../Storage/Storage.head";
import {IJsonLoaderFactory} from "../DataProvider/FB3DataProvider.head";
import {IPosition} from "../FB3ReaderHeaders";

export module FB3DOM {
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
					var PageData = new FB3DOMBlock.PageContainer();
					var AllBookmarks = new Array();
					this.FB3DOM.GetHTML(this.HyphOn, this.BookStyleNotes, this.Range, this.IDPrefix, this.ViewPortW, this.ViewPortH, PageData);
					this.OnGetDone(PageData);
				} else if (this.OnLoadDone) {
					this.OnLoadDone();
				}
				return true;
			} else {
				return false;
			}
		}
		Reset(): void {
			this.OnLoadDone = null;
			this.OnGetDone = null;
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

	export class DOM extends FB3DOMBlock.FB3Tag implements IFB3DOM {
		private HyphOn: boolean;
		private ActiveRequests: AsyncLoadConsumer[];
		private FullTOC: Object;
		public TOC: ITOC[];
		public DataChunks: IDataDisposition[];
		public MetaData: IMetaData;
		public FullLength: number;
		public Ready: boolean;
		private OnDoneFunc: any;
		public XPID: string;
		public Bookmarks: IBookmarks[];
		public MediaCacheLoader: FB3MediaCache.MediaCacheLoader = undefined;

		constructor(public Site: IFB3ReaderSite,
			public Progressor: ILoadProgress,
			public DataProvider: IJsonLoaderFactory,
			public PagesPositionsCache: IFB3PPCache) {
			super(null, null, null, 0);
			this.ActiveRequests = [];
			this.Ready = false;
			this.XPID = '';
			this.XPath = new Array();
			this.Bookmarks = new Array();
		}

		public Reset(): void {
			for (var I = 0; I < this.ActiveRequests.length; I++) {
				this.ActiveRequests[I].Reset();
			}
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
			Data = Data.length ? Data[0] : Data; // hack for winjs app
			this.FullTOC = Data;
			this.TOC = Data.Body;
			this.DataChunks = Data.Parts;
			this.MetaData = Data.Meta;
			this.Ready = true;
			if (Data["fb3-fragment"]) {
				this.FullLength = Data["fb3-fragment"].full_length;
			} else {
				this.FullLength = Data.full_length;
			}
			this.OnDoneFunc(this);
		}

		public GetFullTOC(): object {
			return this.FullTOC;
		}

		// Wondering why I make Init public? Because you can't inherite private methods, darling!
		public Init(HyphOn: boolean, OnDone: { (FB3DOM: IFB3DOM): void; }) {
			this.HyphOn = HyphOn;
			this.OnDoneFunc = OnDone;
			this.Childs = new Array();
			this.Progressor.HourglassOn(this, true, 'Loading meta...');
			this.DataProvider.Request(this.DataProvider.ArtID2URL(), (Data: any) => this.AfterHeaderLoaded(Data), this.Progressor, undefined, true);
			this.Progressor.HourglassOff(this);
		}
		public GetHTMLAsync(HyphOn: boolean, BookStyleNotes:boolean, Range: IRange, IDPrefix: string, ViewPortW: number, ViewPortH: number, Callback: IDOMTextReadyCallback): void {

			var MissingChunks = this.CheckRangeLoaded(Range.From[0], Range.To[0]);
			if (MissingChunks.length == 0) {
				var PageData = new FB3DOMBlock.PageContainer();
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
			return this.DataProvider.ArtID2URL(Chunk);
		}

		public GetElementByAddr(Position: IPosition): IFB3Block {
			var ResponcibleNode: IFB3Block = this;
			Position = Position.slice(0);
			while (Position.length && ResponcibleNode.Childs && ResponcibleNode.Childs[Position[0]]) {
				ResponcibleNode = ResponcibleNode.Childs[Position.shift()];
			}
			return ResponcibleNode;
		}
		public GetAddrByXPath(XPath: IXPath): IPosition {
			var Node: IFB3Block = this;
			var I = 0;
			while (I < Node.Childs.length) {
				if (Node.Childs[I] && Node.Childs[I].XPath){
					var PC = FB3DOMBlock.XPathCompare(XPath, Node.Childs[I].XPath);
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

		public GetXPathFromPos(Position: IPosition, End?:boolean): IXPath {
			var Element = this.GetElementByAddr(Position);
			if (Element) {
				var XPath = Element.XPath.slice(0);
				if (End && Element.text && XPath[XPath.length - 1].match && XPath[XPath.length - 1].match(/^\.\d+$/)) {
					var EndChar = XPath[XPath.length - 1].replace('.', '') * 1
						+ Element.text.replace(/\u00AD|&shy;|\s$/g,'').length - 1; // First char already counted in number
					XPath[XPath.length - 1] = '.' + EndChar;
				}
				return XPath;
			} else {
				return undefined;
			}
		}

		public GetHTML(HyphOn: boolean, BookStyleNotes: boolean, Range: IRange, IDPrefix: string, ViewPortW: number, ViewPortH: number, PageData: IPageContainer) {
			if (Range.From.length == 1 && this.Childs[Range.From[0]] && this.Childs[Range.From[0]].TagName == 'empty-line') {
				Range.From[0]++;	// We do not need empty-line at the start of the page,
									// see FallOut for more hacks on this
			}
			var FullBookmarksList: IBookmark[] = new Array;
			for (var I = 0; I < this.Bookmarks.length; I++) {
				FullBookmarksList = FullBookmarksList.concat(this.Bookmarks[I].Bookmarks);
			}
			super.GetHTML(HyphOn, BookStyleNotes, Range, IDPrefix, ViewPortW, ViewPortH, PageData, FullBookmarksList);
		}

		public GetXML( Range: IRange, PageData: IPageContainer) {
			super.GetXML(Range, PageData);
		}

		public OnChunkLoaded(Data: Array<IJSONBlock>, CustomData?: any):void {

			var LoadedChunk: number = CustomData.ChunkN;
			var Shift = this.DataChunks[LoadedChunk].s;
			for (var I = 0; I < Data.length; I++) {
				this.Childs[I + Shift] = FB3DOMBlock.TagClassFactory(Data[I], this, I + Shift, 0, 0, false, false, this); //new FB3Tag(Data[I], this, I + Shift);
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

		public XPChunk(X: IXPath): number {
			for (var I = 0; I < this.DataChunks.length; I++) {
				var xps = FB3DOMBlock.XPathCompare(X, this.DataChunks[I].xps);
				var xpe = FB3DOMBlock.XPathCompare(X, this.DataChunks[I].xpe);
				if (!xps || !xpe || xps > 0 && xpe < 10) {
					return I;
				}
			}
			return undefined; // In case we have out-of-field pointer - define it implicitly
		}

	}

}
