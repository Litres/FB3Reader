/// <reference path="../FB3ReaderHeaders.ts" />

module FB3Reader {

	export interface IPosition extends Array<number> {}

	export interface IPageRenderInstruction {
		Range?: FB3DOM.IRange;
		Start?: IPosition;
		CacheAs?: number;
		Height?: number;
		NotesHeight?: number;
	}

	export interface IFBReader {
		Site: FB3ReaderSite.IFB3ReaderSite;
		Bookmarks: FB3Bookmarks.IBookmarks;
		ArtID: string;
		HyphON: bool;
		BookStyleNotes: bool;
		NColumns: number;
		TextPercent: number;	// Percantage of the shown text - progress
		CurStartPos: IPosition;		// Adress of the first visible block

		Init(): void;
		CacheForward: number; // Number of PAGES (!) of forward cache
		CacheBackward: number; // Number of PAGES (!) of backward cache

		PagesPositionsCache: IPageRenderInstruction[]; // Cached data for pages positions

		TOC(): FB3DOM.ITOC[];
		GoTO(NewPos: IPosition): void;
		GoTOPage(Page: number): void;
		GoToOpenPosition(NewPos: IPosition): void;
		ResetCache(): void;
		GetCachedPage(NewPos: IPosition): number;
		SearchForText(Text: string): FB3DOM.ITOC[];
		AfterCanvasResize(): void;
		IdleOn(): void;
		IdleOff(): void;
	}
}
