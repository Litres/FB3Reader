/// <reference path="FB3ReaderAllModules.ts" />

module FB3Reader {
	// General-purpose interfaces
	export interface ITocNode {
		Title:string;
		Subitems:Array;
		StartBlock:number;
		EndBlock:number;
	}
	export interface IFB3ReaderNavigator {
		PositionPercent():number;
		TOC():ITocNode;
	}
	export interface IFB3ReaderCustomiser {
		HyphON:bool;
		BookStyleNotes:bool;
	}

	// FBReaderItself
	export interface IFBReader {
		Progress:FB3ReaderSite.ILoadProgress;
		alert:FB3ReaderSite.IAlert;
		NotePopup:FB3ReaderSite.INotePopup;

//		constructor(URL:string);

		GoTO(Bloc: FB3DOM.IPointer): void;
	}
}
