/// <reference path="../plugins/lz-string.d.ts" />
/// <reference path="../PagesPositionsCache/PPCache.ts" />

module LocalBookmarks {
    export class LocalBookmarksClass {
		private local;
		private LocalBookmarks;
		private storageVal: string;
		private LZState: boolean;
		private CurPos: any[];
		private DateTime: number;
		constructor(private ArtID: string) {
			this.LocalBookmarks = [];
			this.local = window.localStorage;
			this.storageVal = 'bookmarks';
			this.LZState = true; // for testing only, default = true
			this.GetBookmarks();
			this.CurPos = [0];
			this.DateTime = 0;
			var FoundBookmark;
			if (FoundBookmark = this.GetBookmarkByArt(this.ArtID)) {
				if (FoundBookmark.CurPos) {
				this.CurPos = FoundBookmark.CurPos;
			}
				if (FoundBookmark.DateTime) {
					this.DateTime = FoundBookmark.DateTime;
				}
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
			if (!FB3PPCache.CheckStorageAvail()) {
				return;
			}
			var bookmarksXML = this.local.getItem(this.storageVal);
			if (bookmarksXML) {
				var cacheData = this.DecodeData(bookmarksXML);
				this.LocalBookmarks = JSON.parse(cacheData);
			}
		}
		public StoreBookmarks(XMLString: string): void {
			if (!FB3PPCache.CheckStorageAvail()) {
				return;
			}
			if (this.LocalBookmarks.length >= 10) {
				this.LocalBookmarks.shift();
			}
			var localBookmarksTmp = {
				ArtID: this.ArtID,
				Cache: XMLString,
				CurPos: this.CurPos,
				DateTime: this.DateTime
			};
			for (var j = 0; j < this.LocalBookmarks.length; j++) {
				if (this.LocalBookmarks[j].ArtID == this.ArtID) {
					this.LocalBookmarks.splice(j, 1);
				}
			}
			this.LocalBookmarks.push(localBookmarksTmp);
			var BookmarksString = JSON.stringify(this.LocalBookmarks);
			var cacheData = this.EncodeData(BookmarksString);
			this.local.setItem(this.storageVal, cacheData);
		}
		public GetCurrentArtBookmarks(): string {
			if (!FB3PPCache.CheckStorageAvail()) {
				return;
			}
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
		public SetCurrentDateTime(value: number) {
			this.DateTime = value;
		}
		public GetCurrentDateTime(): number {
			return this.DateTime;
		}
		private EncodeData(Data: string): string {
			if (this.LZState) {
				return LZString.compressToUTF16(Data);
			} else {
				return Data;
			}
		}
		private DecodeData(Data: string): string {
			if (this.LZState) {
				return LZString.decompressFromUTF16(Data);
			} else {
				return Data;
			}
		}
	}
}