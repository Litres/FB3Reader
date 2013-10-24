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

	export interface IFBReader { // Keep in mind - all action calls, like PageForward, are asyncroneous
		Site: FB3ReaderSite.IFB3ReaderSite;
		Bookmarks: FB3Bookmarks.IBookmarks;
		ArtID: string;
		HyphON: boolean;
		BookStyleNotes: boolean;
		NColumns: number;
		EnableBackgroundPreRender: boolean; // Should we scan the document?
		TextPercent: number;	  // Percantage of the shown text - progress
		CurStartPos: IPosition;	// Adress of the first visible block
		CurStartPage: number;		// Number of the first visible page (if any)
		LastPage: number;				// Last page N. Undefined if calc in progress

		Init(): void;
		CacheForward: number; // Number of PAGES (!) of forward cache, NColumns*CacheForward blocks will be created
		CacheBackward: number; // Size of the backward cache (same structure)

		PagesPositionsCache: IPageRenderInstruction[]; // Cached data for pages positions

		TOC(): FB3DOM.ITOC[];
		GoTO(NewPos: IPosition): void;
		//		GoTOPage(Page: number): void;
		GoToOpenPosition(NewPos: IPosition): void;
		ResetCache(): void;
		GetCachedPage(NewPos: IPosition): number;
		SearchForText(Text: string): FB3DOM.ITOC[];
		AfterCanvasResize(): void;
		PageForward(): void;
		PageBackward(): void;
		GoToPercent(Percent: number): void;
		IdleOn(): void;
		IdleOff(): void;
		CurPosPercent(): number;
	}
}
