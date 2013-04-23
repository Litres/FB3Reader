/// <reference path="FB3ReaderAllModules.ts" />

module FB3Reader {
	// General-purpose interfaces
	export interface ITocNode {
		Title:string;
		Subitems:Array;
		StartBlock:number;
		EndBlock:number;
	}

	export interface IFBReader {
		Site: FB3ReaderSite.IFB3ReaderSite;
		HyphON: bool;
		BookStyleNotes: bool;
		Position: number;
		TOC(): ITocNode;
		GoTO(Bloc: FB3DOM.IPointer): void;
	}
}
