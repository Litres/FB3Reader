import {IFB3PPCache} from "../Storage/Storage.head";
import {FB3ReaderPage} from "./FB3ReaderPage";
import {ICanvasReadyCallback, IDimensions, IFBReaderPublic, IPosition} from "../FB3ReaderHeaders";
import {FB3BookReadProgress} from "./ReadProgress";
import {IActiveZone, IFB3DOM, IRange, ITOC, IXPath} from "../DOM/FB3DOM.head";
import {IBookmarks} from "../Bookmarks/FB3Bookmarks.head";

export interface IPageRenderInstruction {
	Range?: IRange;
	Start?: IPosition;
	CacheAs?: number;
	Height?: number;
	NotesHeight?: number;
}

export interface IFBReader extends IFBReaderPublic { // Keep in mind - all action calls, like PageForward, are asyncroneous
	Bookmarks: IBookmarks;
	HyphON: boolean;
	BookStyleNotes: boolean;
	BookStyleNotesTemporaryOff: boolean;
	NColumns: number;
	EnableBackgroundPreRender: boolean; // Should we scan the document?
	CurStartPos: IPosition;	// Adress of the first visible block, READ ONLY!
	CurStartPage: number;	// Number of the first visible page (if any)
	LineHeight: number;		// Height of the line in P - in pixels, to align blocks vertically
	PagesPositionsCache: IFB3PPCache;
	CurVisiblePage: number;	// ID of the first page visible, shared for FB3ReaderPage only
	Version: string;        // Used to verify cache compatibility with the current renderer
	StartTime: number;  // Starttime when all elements are initialized

	// SetPageReadTimer(Page: any);
	SetPageReadTimer(Page: FB3ReaderPage.ReaderPage);
	ResetPageTimers(caller: string);
	SetPageViewTimer();

	CanvasReadyCallback: ICanvasReadyCallback; // fired when the page rendering complete

	Init(StartFrom: IPosition, DateTime?: number): void;
	CacheForward: number;		// Number of PAGES (!) of forward cache, NColumns*CacheForward blocks will be created
	CacheBackward: number;	// Size of the backward cache (same structure)
	FB3DOM: IFB3DOM; // Access to reader's DOM provider

	TOC(): ITOC[];		// Table of contents (clone, with ITOC.bookmarks filled)
	GoTO(NewPos: IPosition, Force?:boolean): void;
	GoToOpenPosition(NewPos: IPosition): void;
	GoToXPath(XP: IXPath): void;
	ResetCache(): void;
	GetCachedPage(NewPos: IPosition): number;
	SearchForText(Text: string): ITOC[];
	AfterCanvasResize(): void;
	PageForward(): void;
	PageBackward(): void;
	GoToPercent(Percent: number, ProgressBar?: boolean): void;
	IdleOn(): void;
	IdleOff(): void;
	CurPosPercent(): number;
	ElementAtXY(X: number, Y: number): IPosition;
	// GetElementXY(Node: FB3DOM.IFB3Block): IDimensions;
	GetElementXYByPosition(Position: IPosition): IDimensions;	// Get element start xy and end xy related to window
	Reset(): void;      // Reopens reader on the current position. Call this after you have
											// changed CSS, resized canvas or some other distructive things
	Redraw(callback?: Function): void;     // pages refresh - only updates bookmarks
	RedrawVisible(): void; // light version of redraw, refresh only visible pages (boookmark selection)
	GetVisibleRange(): IRange;
	PatchRangeTo(Range: IRange): IRange;
	GetFB3Fragment(): object;
	HasFB3Fragment(): boolean;


	ActiveZones(): IActiveZone[];
	CallActiveZoneCallback(id: string): boolean;

	ColumnWidth(): number;

	IsTrackReadingActive(): boolean; // returns true if TrackReading is enabled
	GetPagesQueueLen(): number;
	ReadProgress: FB3BookReadProgress.BookReadProgress;

	Destroy: boolean; // hack for apps, like win8, when we change page, abort all
	RedrawInProgress: number;
}
