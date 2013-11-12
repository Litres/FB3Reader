/// <reference path="../FB3ReaderHeaders.ts" />

module FB3Bookmarks {

	export interface IXPath extends Array<number> { }
	export interface InnerFB2 extends String {}

	export interface IBookmarksReadyCallback { (Bookmarks: IBookmarks): void; }

	export interface IBookmark {
		ID: string;
		Range: FB3DOM.IRange;
		XStart: IXPath; // xpath for start point
		XEnd: IXPath;		// xpath for end point
		Group: number;
		Class: string;
		Title: string;
		Note: InnerFB2;
		Extract: InnerFB2;
		RawText: string;
		ClassName(): string;		// css class name for selections of this type
		InitFromXY(X: number, Y: number): boolean;
		ExtendToXY(X: number, Y: number): boolean;
		RoundClone(): IBookmark;// clones itself and expand range to capture block-level elements
	}

	export interface IBookmarks {
		Ready: boolean;
		FB3DOM: FB3DOM.IFB3DOM;
		Reader: FB3Reader.IFBReader;
		Bookmarks: IBookmark[];
		CurPos: IBookmark;
		ClassPrefix: string;
		AddBookmark(Bookmark: IBookmark): void;
		DropBookmark(Bookmark: IBookmark): void;
		Load(ArtID: string, Callback?: IBookmarksReadyCallback);
		Store(): void;
	}

}