/// <reference path="FB3ReaderHead.ts" />

module FB3Reader {

	export class FB3Reader implements IFBReader {
		public HyphON: bool;
		public BookStyleNotes: bool;
		public Position: number;

		private Alert: FB3ReaderSite.IAlert;

		constructor(public Site: FB3ReaderSite.IFB3ReaderSite,
			private FB3DOM: FB3DOM.IFB3DOM) {
		}

		public GoTO(Bloc: FB3DOM.IPointer) {
		}
		public TOC() {
			return this.FB3DOM.TOC();
		}
	}

}