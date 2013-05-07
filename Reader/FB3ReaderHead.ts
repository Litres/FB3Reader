/// <reference path="../FB3ReaderHeaders.ts" />

module FB3Reader {
	// General-purpose interfaces
	export interface IFBReader {
		Site: FB3ReaderSite.IFB3ReaderSite;
		HyphON: bool;
		BookStyleNotes: bool;
		Position: number;
		TOC(): FB3DOM.ITOC[];
		GoTO(Bloc: Array): void;
	}
}
