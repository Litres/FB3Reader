/// <reference path="../FB3ReaderHeaders.ts" />

module FB3Reader {

	export interface IPosition extends Array {}
	// General-purpose interfaces
	export interface IFBReader {
		Site: FB3ReaderSite.IFB3ReaderSite;
		Bookmarks: FB3Bookmarks.IBookmarks;
		ArtID: string;
		HyphON: bool;
		BookStyleNotes: bool;
		NColumns: number;
		Position: number;
		Init(): void;
		CacheForward: number; // Number of PAGES (!) of forward cache
		CacheBackward: number; // Number of PAGES (!) of backward cache

		TOC(): FB3DOM.ITOC[];
		GoTO(NewPos: IPosition): void;
		GoTOPage(Page: number): void;
		GoToOpenPosition(NewPos: IPosition): void;
		ResetCache(): void;
		GetCachedPage(NewPos: IPosition): number;
		SearchForText(Text: string): FB3DOM.ITOC[];

	}
}
