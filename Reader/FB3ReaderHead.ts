/// <reference path="../FB3ReaderHeaders.ts" />
/// <reference path="../plugins/moment.d.ts" />

module FB3Reader {

	export interface IPageRenderInstruction {
		Range?: FB3DOM.IRange;
		Start?: FB3ReaderAbstractClasses.IPosition;
		CacheAs?: number;
		Height?: number;
		NotesHeight?: number;
	}


	export interface IFBReader extends FB3ReaderAbstractClasses.IFBReaderPublic { // Keep in mind - all action calls, like PageForward, are asyncroneous
		Bookmarks: FB3Bookmarks.IBookmarks;
		HyphON: boolean;
		BookStyleNotes: boolean;
		BookStyleNotesTemporaryOff: boolean;
		NColumns: number;
		EnableBackgroundPreRender: boolean; // Should we scan the document?
		CurStartPos: FB3ReaderAbstractClasses.IPosition;	// Adress of the first visible block, READ ONLY!
		CurStartPage: number;	// Number of the first visible page (if any)
		LineHeight: number;		// Height of the line in P - in pixels, to align blocks vertically
		PagesPositionsCache: FB3PPCache.IFB3PPCache;
		CurVisiblePage: number;	// ID of the first page visible, shared for FB3ReaderPage only
		Version: string;        // Used to verify cache compatibility with the current renderer

		CanvasReadyCallback: FB3ReaderAbstractClasses.ICanvasReadyCallback; // fired when the page rendering complete

		Init(StartFrom: FB3ReaderAbstractClasses.IPosition, DateTime?: number): void;
		CacheForward: number;		// Number of PAGES (!) of forward cache, NColumns*CacheForward blocks will be created
		CacheBackward: number;	// Size of the backward cache (same structure)
		FB3DOM: FB3DOM.IFB3DOM; // Access to reader's DOM provider

		TOC(): FB3DOM.ITOC[];		// Table of contents (clone, with ITOC.bookmarks filled)
		GoTO(NewPos: FB3ReaderAbstractClasses.IPosition, Force?:boolean): void;
		GoToOpenPosition(NewPos: FB3ReaderAbstractClasses.IPosition): void;
		GoToXPath(XP: FB3DOM.IXPath): void;
		ResetCache(): void;
		GetCachedPage(NewPos: FB3ReaderAbstractClasses.IPosition): number;
		SearchForText(Text: string): FB3DOM.ITOC[];
		AfterCanvasResize(): void;
		PageForward(): void;
		PageBackward(): void;
		GoToPercent(Percent: number): void;
		IdleOn(): void;
		IdleOff(): void;
		CurPosPercent(): number;
		ElementAtXY(X: number, Y: number): FB3ReaderAbstractClasses.IPosition;
		// GetElementXY(Node: FB3DOM.IFB3Block): IDimensions;
		GetElementXYByPosition(Position: FB3ReaderAbstractClasses.IPosition): FB3ReaderAbstractClasses.IDimensions;	// Get element start xy and end xy related to window
		Reset(): void;      // Reopens reader on the current position. Call this after you have
												// changed CSS, resized canvas or some other distructive things
		Redraw(): void;     // pages refresh - only updates bookmarks
		RedrawVisible(): void; // light version of redraw, refresh only visible pages (boookmark selection)
		GetVisibleRange(): FB3DOM.IRange;
		PatchRangeTo(Range: FB3DOM.IRange): FB3DOM.IRange;

		Destroy: boolean; // hack for apps, like win8, when we change page, abort all
	}
}
