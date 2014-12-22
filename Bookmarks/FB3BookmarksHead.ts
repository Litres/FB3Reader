/// <reference path="../FB3ReaderHeaders.ts" />

module FB3Bookmarks {

	export interface InnerFB2 extends String {}

	export interface IBookmarksReadyCallback { (Bookmarks: IBookmarks): void; }
	export interface IBookmarkSyncCallback { (): void; }

	export interface IBookmark {
		ID: string;
		Owner: IBookmarks;
		N: number;			// Represents IBookmarks.Bookmarks[N] position
		DateTime: number; // unix timestamp
		NotSavedYet: number; // Attr for just created Note
		TemporaryState: number; // new temporary bookmark
		SkipUpdateDatetime: boolean; // skip update datetime for current position when we have new curpos from server
		Range: FB3DOM.IRange;
		XStart: FB3DOM.IXPath; // xpath for start point
		XEnd: FB3DOM.IXPath;		// xpath for end point
		Group: number;
		Class?: string;
		Title?: string;
		Note?: InnerFB2[];
		RawText: string;
		XPathMappingReady: boolean; // For server-loaded bookmarks, used to watch fb2xpath -> internal xpath mapping progress
		ClassName(): string;		// css class name for selections of this type
		InitFromXY(X: number, Y: number, AllowBlock: boolean): boolean;
		InitFromXPath(XPath: FB3DOM.IXPath): boolean;
		InitFromRange(Range: FB3DOM.IRange): boolean;
		InitFromPosition(Position: FB3Reader.IPosition): boolean;
		ExtendToXY(X: number, Y: number, AllowBlock: boolean): boolean;
		RoundClone(ToBlock: boolean): IBookmark;// clones itself and expand range to capture block-level elements
		Detach(): void; // removes itself from the parent.
		RemapWithDOM(Callback: IBookmarkSyncCallback): void;
		PublicXML(): string;
		ParseXML(XML: any): void;
		MakePreviewFromNote(): string;
	}

	export interface IBookmarks {
		Ready: boolean;
		LockID?: string;
		LoadDateTime: number;
		FB3DOM: FB3DOM.IFB3DOM;
		Reader: FB3Reader.IFBReader;
		Bookmarks: IBookmark[];
		ClassPrefix: string;
		aldebaran: boolean;
		AddBookmark(Bookmark: IBookmark): void;
		DropBookmark(Bookmark: IBookmark): void;
		LoadFromCache(); // Loads bookmarks from localStorage
		Load(Callback?: IBookmarksReadyCallback); // Loads bookmarks from the server
		ReLoad();	// Updates itself from the server (may get new current position)
		ApplyPosition(): boolean;
		Store(): void;
		GetBookmarksInRange(Range?: FB3DOM.IRange): IBookmark[];
		MakeStoreXML(): string;
	}

}