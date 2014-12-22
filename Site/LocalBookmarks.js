/// <reference path="../plugins/lz-string.d.ts" />
var LocalBookmarks;
(function (LocalBookmarks) {
    var LocalBookmarksClass = (function () {
        function LocalBookmarksClass(ArtID) {
            this.ArtID = ArtID;
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
        LocalBookmarksClass.prototype.GetBookmarkByArt = function (ArtID) {
            for (var j = 0; j < this.LocalBookmarks.length; j++) {
                if (this.LocalBookmarks[j].ArtID == ArtID) {
                    return this.LocalBookmarks[j];
                }
            }
            return null;
        };
        LocalBookmarksClass.prototype.GetBookmarks = function () {
            var bookmarksXML = this.local.getItem(this.storageVal);
            if (bookmarksXML) {
                if (this.LZState)
                    var cacheData = LZString.decompressFromUTF16(bookmarksXML);
                this.LocalBookmarks = JSON.parse(this.LZState ? cacheData : bookmarksXML);
            }
        };
        LocalBookmarksClass.prototype.StoreBookmarks = function (XMLString) {
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
        };
        LocalBookmarksClass.prototype.GetCurrentArtBookmarks = function () {
            var FoundBookmark;
            if (FoundBookmark = this.GetBookmarkByArt(this.ArtID)) {
                return FoundBookmark.Cache;
            }
            else {
                return null;
            }
        };
        LocalBookmarksClass.prototype.SetCurrentPosition = function (LitresCurPos) {
            this.CurPos = LitresCurPos;
        };
        LocalBookmarksClass.prototype.GetCurrentPosition = function () {
            return this.CurPos;
        };
        return LocalBookmarksClass;
    })();
    LocalBookmarks.LocalBookmarksClass = LocalBookmarksClass;
})(LocalBookmarks || (LocalBookmarks = {}));
//# sourceMappingURL=LocalBookmarks.js.map