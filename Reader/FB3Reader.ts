/// <reference path="FB3ReaderHead.ts" />

module FB3Reader {
	interface IDumbCallback {()}

	class ReaderPage {
		private Element: HTMLDivElement;
		private ID: number;
		private OnDrawDone: IDumbCallback;
		public Ready: bool;
		public PageN: number;
		 // column number
		Show(): void { }
		Hide(): void { }
		constructor(public ColumnN: number,
			private FB3DOM: FB3DOM.IFB3DOM,
			private FBReader: IFBReader) {
			this.Ready = false;
			this.PageN = 0;
		}
		GetInitHTML(ID: number): FB3DOM.InnerHTML {
			this.ID = ID;
			return '<div id="FB3ReaderColumn' + this.ID + '" class="FB2readerCell' + this.ColumnN + 'of' + this.FBReader.NColumns + ' FB2readerPage"><div class="FBReaderAbsDiv">...</div></div>';
		}
		BindToHTMLDoc(Site: FB3ReaderSite.IFB3ReaderSite): void {
			this.Element = <HTMLDivElement> Site.getElementById('FB3ReaderColumn' + this.ID);
		}

		DrawInit(StartPos: IPosition, OnDrawDone: IDumbCallback): void {
			var FragmentEnd = StartPos[0] + 10;
			if (FragmentEnd > this.FB3DOM.TOC[this.FB3DOM.TOC.length - 1].e) {
				FragmentEnd = this.FB3DOM.TOC[this.FB3DOM.TOC.length - 1].e;
			}
			var Range: FB3DOM.IRange = { From: StartPos, To: [FragmentEnd] };
			this.OnDrawDone = OnDrawDone;
			this.FB3DOM.GetHTMLAsync(this.FBReader.HyphON, Range, (HTML: string) => this.DrawEnd(HTML));
		}

		DrawEnd(HTML: string) {
			this.Element.innerHTML = HTML;
			this.OnDrawDone();
		}

		EndPos(): IPosition {
			return null;
		}
	}

	class RenderQueue {
		private timeoutId: any;
		private Pos: number;
		constructor(public Pages: ReaderPage[], StartPos: IPosition) {
			this.Pages[0].DrawInit(StartPos, () => this.RenderNext());
		}
		RenderNext(): void {
			this.Pos++;
			var NextPage = this.Pages[this.Pos];
			if (NextPage) {
				setTimeout(() => this._RenderNext(), 10);
			}
		}
		_RenderNext(): void {
			this.Pages[this.Pos].DrawInit(this.Pages[this.Pos-1].EndPos(), () => this.RenderNext());
		}
	}

	export class Reader implements IFBReader {
		public HyphON: bool;
		public BookStyleNotes: bool;
		public Position: number;
		public NColumns: number;
		public CacheForward: number;
		public CacheBackward: number;

		private Alert: FB3ReaderSite.IAlert;
		private Pages: ReaderPage[];

		constructor(public ArtID: string,
			public Site: FB3ReaderSite.IFB3ReaderSite,
			private FB3DOM: FB3DOM.IFB3DOM,
			public Bookmarks: FB3Bookmarks.IBookmarks) {
			// First we start loading data - hopefully it will happend in the background
			this.Init();

			// Basic class init
			this.HyphON = true;
			this.NColumns = 2;
			this.CacheForward = 6;
			this.CacheBackward = 2;

			// Environment research & canvas preparation
			this.PrepareCanvas();
			this.ResetCache();
		}

		public Init(): void {
			this.FB3DOM.Init(this.HyphON, this.ArtID, () => { this.LoadDone() } );
			this.Bookmarks.Load(this.ArtID, () => { this.LoadDone() } );
		}

		private LoadDone(): void {
			if (this.FB3DOM.Ready && this.Bookmarks.Ready) {
				var ReadPos: Array;
				if (this.Bookmarks && this.Bookmarks.CurPos) {
					ReadPos = this.Bookmarks.CurPos.Fragment.From;
				} else {
					ReadPos = [0];
				}
				this.GoTO(ReadPos);
				//var Range: FB3DOM.IRange = { From: [0, 0, 2], To: [4, 5] };
				//this.FB3DOM.GetHTMLAsync(true, Range, (HTML: string) => this.TestDOM(HTML));
			}
		}

		private TestDOM(HTML: string) { // fake
			this.Site.getElementById('FB3ReaderColumn0').innerHTML = '<div class="FBReaderAbsDiv">'+HTML+'</div>';
		}

		public GoTO(NewPos: IPosition) {
			var GotoPage = this.GetCachedPage(NewPos);
			if (GotoPage != undefined) {
				this.GoTOPage(GotoPage);
			} else {
				this.GoToOpenPosition(NewPos);
			}
		}
		public GoTOPage(Page: number): void {

		}

		private FillPage

		public GoToOpenPosition(NewPos: IPosition): void {
			var FragmentEnd = NewPos[0] + 10;
			if (FragmentEnd > this.FB3DOM.TOC[this.FB3DOM.TOC.length - 1].e) {
				FragmentEnd = this.FB3DOM.TOC[this.FB3DOM.TOC.length - 1].e;
			}
			var Range: FB3DOM.IRange = { From: NewPos, To: [FragmentEnd] };
			this.FB3DOM.GetHTMLAsync(this.HyphON, Range, (HTML: string) => this.TestDOM(HTML));
		}


		public TOC() {
			return this.FB3DOM.TOC;
		}

		public ResetCache(): void { }
		public GetCachedPage(NewPos: IPosition): number { return undefined }
		public SearchForText(Text: string): FB3DOM.ITOC[]{ return null }

		private PrepareCanvas() {
			var InnerHTML = '<div class="FB3ReaderColumnset' + this.NColumns + '" id="FB3ReaderHostDiv" style="width:100%; overflow:hidden; height:100%">';
			this.Pages = new Array();
			for (var I = 0; I < (this.CacheBackward + this.CacheForward + 1); I++) {
				for (var J = 0; J < this.NColumns; J++) {
					var NewPage = new ReaderPage(J, this.FB3DOM, this);
					this.Pages[this.Pages.length] = NewPage;
					InnerHTML += NewPage.GetInitHTML(I*J);
				}
			}
			InnerHTML += '</div>'
			this.Site.Canvas.innerHTML = InnerHTML;
		}

//		private DrawPageFromPoint

	}

}