/// <reference path="FB3ReaderHead.ts" />

module FB3Reader {

	export class Reader implements IFBReader {
		public HyphON: bool;
		public BookStyleNotes: bool;
		public Position: number;

		private Alert: FB3ReaderSite.IAlert;

		constructor(public Site: FB3ReaderSite.IFB3ReaderSite,
			private FB3DOM: FB3DOM.IFB3DOM) {
			var Range: FB3DOM.IRange = { From: [0,0,2], To: [4,5] };
			FB3DOM.GetHTMLAsync(true, Range, (HTML: string) => this.TestDOM(HTML));
		}

		private TestDOM(HTML: string) {
			this.Site.Canvas.innerHTML = HTML;
		}

		public GoTO(Bloc: Array) {
		}
		public TOC() {
			return this.FB3DOM.TOC;
		}
	}

}