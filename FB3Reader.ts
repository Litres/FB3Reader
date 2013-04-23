/// <reference path="FB3ReaderAllModules.ts" />

module FB3Reader {

	export class FB3Reader implements IFBReader {
		public HyphON: bool;
		public BookStyleNotes: bool;
		public Position: number;

		private FB3DOM: FB3DOM.IFB3DOM;
		private Alert: FB3ReaderSite.IAlert;

		constructor(public Site: FB3ReaderSite.IFB3ReaderSite, URL:string) {
			this.CreateDom(URL);
			this.Alert = Site.Alert;
		}

		private CreateDom(URL: string) {
			this.FB3DOM = new FB3DOM.FB3DOM(this,URL);
		}
		public GoTO(Bloc: FB3DOM.IPointer) {
		}
		public TOC() {
			return this.FB3DOM.TOC();
		}
	}

}