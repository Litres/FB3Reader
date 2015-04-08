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
		Note?: InnerFB2[]; // [0] - raw text, [1] - note comment typed by user
		RawText: string; // or4 uses it for text preview
		XPathMappingReady: boolean; // For server-loaded bookmarks, used to watch fb2xpath -> internal xpath mapping progress
		ClassName(): string;		// css class name for selections of this type
		RoundClone(ToBlock: boolean): IBookmark;// clones itself and expand range to capture block-level elements
		Detach(): void; // removes itself from the parent.
		RemapWithDOM(Callback: IBookmarkSyncCallback): void;
		PublicXML(): string;
		ParseXML(XML: any): void;
		MakePreviewFromNote(): string;
	}

	export interface IBookmarks {
		Host: string;
		Ready: boolean;
		LockID?: string;
		LoadDateTime: number;
		ReadyCallback: IBookmarkSyncCallback;
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
		GetBookmarksInRange(Type?:number, Range?: FB3DOM.IRange): IBookmark[];
		MakeStoreXML(): string;
		MakeStoreXMLAsync(Callback): string;	// sometimes we need this when we dont have cached chunks
																					// this will fix that problem
	}

}