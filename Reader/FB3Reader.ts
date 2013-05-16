/// <reference path="FB3ReaderHead.ts" />

module FB3Reader {

	export class Reader implements IFBReader {
		public HyphON: bool;
		public BookStyleNotes: bool;
		public Position: number;
		public NColumns: number;

		private Alert: FB3ReaderSite.IAlert;

		constructor(public ArtID: string,
			public Site: FB3ReaderSite.IFB3ReaderSite,
			private FB3DOM: FB3DOM.IFB3DOM,
			public Bookmarks: FB3Bookmarks.IBookmarks) {
			// First we start loading data - hopefully it will happend in the background
			this.Init();
			
			// Basic class init
			this.HyphON = true;
			this.NColumns = 0;

			// Environment research & canvas preparation
		}

		public Init(): void {
			this.FB3DOM.Init(this.HyphON, this.ArtID, () => { this.LoadDone() } );
			this.Bookmarks.Load(this.ArtID, () => { this.LoadDone() } );
		}

		private LoadDone(): void {
			if (this.FB3DOM.Ready && this.Bookmarks.Ready) {
				var Range: FB3DOM.IRange = { From: [0, 0, 2], To: [4, 5] };
				this.FB3DOM.GetHTMLAsync(true, Range, (HTML: string) => this.TestDOM(HTML));
			}
		}

		private TestDOM(HTML: string) {
			this.Site.Canvas.innerHTML = HTML;
		}

		public GoTO(NewPos: IPosition) {
		}
		public TOC() {
			return this.FB3DOM.TOC;
		}

		public ResetCache(): void { }
		public GetCachedPage(NewPos: IPosition): number { return 0 }
		public SearchForText(Text: string): FB3DOM.ITOC[]{ return null }

		private PrepareCanvas() {
			var InnerHTML = '<div class=" class="FB3ReaderColumnset' + this.NColumns+'">';
			for (var I = 0; I < this.NColumns; I++) {
				InnerHTML += '<div id="FB3ReaderColumn' + I + '" class="Cell'+I+'of' + this.NColumns+'"></div>';
			}
			InnerHTML += '</div>'
			this.Site.Canvas.innerHTML = InnerHTML;
		}

		private DrawPageFromPoint

	}

}