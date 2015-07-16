/// <reference path="Reader/FB3ReaderHead.ts" />
/// <reference path="Site/FB3ReaderSiteHead.ts" />
/// <reference path="DOM/FB3DOMHead.ts" />
/// <reference path="DataProvider/FB3DataProviderHead.ts" />
/// <reference path="Bookmarks/FB3BookmarksHead.ts" />
/// <reference path="PagesPositionsCache/PPCacheHead.ts" />

module FB3ReaderAbstractClasses {

	export interface IPosition extends Array<number> { }

	export interface ICanvasReadyCallback { (VisibleRange: FB3DOM.IRange): void; }

	export interface IDimensions {
		Start: { X: string; Y: string };
		End: { X: string; Y: string };
		LineHeight: string;
	}

	export interface IFBReaderPublic {
		// ======= read-only properities =========
		CurStartPos: IPosition;	// Adress of the first visible block, READ ONLY!
		CurStartPage: number;	// Number of the first visible page (if any), READ ONLY

		// ======= read-write properities =========
		HyphON: boolean;		// Hyphenation used? Call Reset() if changed
		BookStyleNotes: boolean;// Call Reset() if changed
		NColumns: number;		// Call Reset() if changed
		Version: string;        // Used to verify cache (in)compatibility with the current renderer. Set at startup
		CanvasReadyCallback: ICanvasReadyCallback; // fired when the page rendering complete
		CacheForward: number;	// Number of PAGES (!) of forward cache, [NColumns*CacheForward] div-blocks will
								// be created, [NColumns] of them visible
		CacheBackward: number;	// Size of the backward cache (same structure)


		// ======= Basic usage functions =========
		Init(StartFrom: IPosition, DateTime?: number): void; // Call once you are done with setup
		PageForward(): void;
		PageBackward(): void;
		GoToXPath(XP: FB3DOM.IXPath): void;	// Jump to external XPath (compared to internal position)
		GoToPercent(Percent: number): void;	// Jump to percent
		GoTO(NewPos: IPosition,		// Internal position jump, Force means DO redraw
			Force?: boolean): void; // (wich may not happen if NewPos is already visible)
		CurPosPercent(): number;	// Current reading progress. At startup is calculates blocks, but as soon as
									// backgrould render finished it calculates current PAGE percentage

		AfterCanvasResize(): void;	// You are expected to call this one of reader canvas resized
		Reset(): void;				// Reopens reader on the current position. Call this after you have
									// changed CSS, resized canvas or some other distructive things

		TOC(): FB3DOM.ITOC[];		// Return table of contents (with ITOC.bookmarks filled)
		SearchForText(Text: string): FB3DOM.ITOC[]; // unimplemented, should return TOC-like list of found positions

		Redraw(): void;				// pages refresh - only updates bookmarks on ALL canvas
		RedrawVisible(): void;		// light version of redraw, refresh only visible pages (usabble during boookmark selection)


		// Dedicated stuff
		ElementAtXY(X: number, Y: number): IPosition;			 // Relates canvas X:Y point to the DOM node's position
		GetElementXYByPosition(Position: IPosition): IDimensions;// Get element start xy and end xy related to window by position
		GetVisibleRange(): FB3DOM.IRange;						 // What is visible now in DOM position terms
		Destroy: boolean; // hack for apps, like win8, when we change page, abort all, etc. Supress all and any async activity


		// Linked objects - you feed this to FB3Reader.Reader() constructor, can use later on
		Site: FB3ReaderSite.IFB3ReaderSite;
		Bookmarks: FB3Bookmarks.IBookmarks;
		PagesPositionsCache: FB3PPCache.IFB3PPCache;
		FB3DOM: FB3DOM.IFB3DOM;
	}

}