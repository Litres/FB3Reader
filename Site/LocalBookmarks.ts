/// <reference path="../plugins/lz-string.d.ts" />

module LocalBookmarks {
	export class LocalBookmarksClass {
		private local;
		private LocalBookmarks;
		private storageVal: string;
		private LZState: boolean;
		private CurPos: any[];
		constructor(private ArtID: string) {
			this.LocalBookmarks = [];
			this.local = window.localStorage;
			this.storageVal = 'bookmarks';
			this.LZState = true; // for testing only, default = true
			this.GetBookmarks();
			this.CurPos = [0];
			var FoundBookmark;
			if (FoundBookmark = this.GetBookmarkByArt(this.ArtID)) {
				this.CurPos = FoundBookmark.CurPos;
			}
		}

		private GetBookmarkByArt(ArtID: string) {
			for (var j = 0; j < this.LocalBookmarks.length; j++) {
				if (this.LocalBookmarks[j].ArtID == ArtID) {
					return this.LocalBookmarks[j];
				}
			}
			return null;
		}
		public GetBookmarks(): void {
			var bookmarksXML = this.local.getItem(this.storageVal);
			if (bookmarksXML) {
				if (this.LZState)
					var cacheData = LZString.decompressFromUTF16(bookmarksXML);
				this.LocalBookmarks = JSON.parse(this.LZState ? cacheData : bookmarksXML);
			}
		}
		public StoreBookmarks(XMLString: string): void {
			if (this.LocalBookmarks.length >= 10) {
				this.LocalBookmarks.shift();
			}
			var localBookmarksTmp = {
				ArtID: this.ArtID,
				Cache: XMLString,
				CurPos: this.CurPos
			};
			for (var j = 0; j < this.LocalBookmarks.length; j++) {
				if (this.LocalBookmarks[j].ArtID == this.ArtID) {
					this.LocalBookmarks.splice(j, 1);
				}
			}
			this.LocalBookmarks.push(localBookmarksTmp);
			var BookmarksString = JSON.stringify(this.LocalBookmarks);
			if (this.LZState)
				var cacheData = LZString.compressToUTF16(BookmarksString);
			this.local.setItem(this.storageVal, this.LZState ? cacheData : BookmarksString);
		}
		public GetCurrentArtBookmarks(): string {
			var FoundBookmark;
			if (FoundBookmark = this.GetBookmarkByArt(this.ArtID)){
				return FoundBookmark.Cache;
			} else {
				return null;
			}
		}
		public SetCurrentPosition(LitresCurPos: any[]) {
			this.CurPos = LitresCurPos;
		}
		public GetCurrentPosition(): any[] {
			return this.CurPos;
		}
	}
}