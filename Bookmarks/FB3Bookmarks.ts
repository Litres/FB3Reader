/// <reference path="FB3BookmarksHead.ts" />

module FB3Bookmarks {
	export class LitResBookmarksProcessor implements IBookmarks {
		public Bookmarks: IBookmark[];
		public Ready: boolean;
		constructor(public FB3DOM: FB3DOM.IFB3DOM) {
			this.Ready = false;
		}
		Load(ArtID: string, Callback?: IBookmarksReadyCallback) {
			this.Ready = true; //fake
		}
		Store(): void { } // fake
	}
}