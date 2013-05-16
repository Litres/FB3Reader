/// <reference path="../FB3ReaderHeaders.ts" />

module FB3Bookmarks {

	export interface InnerFB2 extends String {}

	export interface IBookmarksReadyCallback { (Bookmarks: IBookmarks): void; }

	export interface IBookmark {
		ID: string;
		Group: number;
		Class: string;
		Title: string;
		Note: InnerFB2;
		Extract: InnerFB2;
		Fragment: FB3DOM.IRange;
	}


	export interface IBookmarks {
		Ready: boolean;
		FB3DOM: FB3DOM.IFB3DOM;
		Bookmarks: IBookmark[];
		Load(ArtID: string, Callback?: IBookmarksReadyCallback);
		Store(): void;
	}

}