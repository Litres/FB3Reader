/// <reference path="FB3ReaderAllModules.ts" />

module FB3Reader {

	export class FB3Reader implements IFBReader {
		private FB3DOM: FB3DOM.IFB3DOM;
		public Progress: FB3ReaderSite.ILoadProgress;
		public alert: FB3ReaderSite.IAlert;
		public NotePopup: FB3ReaderSite.INotePopup;

		constructor(Site: FB3ReaderSite.IFB3ReaderSite) {
			this.FB3DOM = new FB3DOM.FB3DOM();
		}

		Init(URL: string) {
			this.FB3DOM.Init(URL);
		}
		GoTO(Bloc: FB3DOM.IPointer) {
		}
	}

}