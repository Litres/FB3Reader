var LocalBookmarks;
(function (LocalBookmarks) {
    var LocalBookmarksClass = (function () {
        function LocalBookmarksClass(ArtID) {
            this.ArtID = ArtID;
            this.LocalBookmarks = [];
            this.local = window.localStorage;
            this.storageVal = 'bookmarks';
            this.LZState = true;
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
        LocalBookmarksClass.prototype.GetBookmarkByArt = function (ArtID) {
            for (var j = 0; j < this.LocalBookmarks.length; j++) {
                if (this.LocalBookmarks[j].ArtID == ArtID) {
                    return this.LocalBookmarks[j];
                }
            }
            return null;
        };
        LocalBookmarksClass.prototype.GetBookmarks = function () {
            if (!FB3PPCache.CheckStorageAvail()) {
                return;
            }
            var bookmarksXML = this.local.getItem(this.storageVal);
            if (bookmarksXML) {
                var cacheData = this.DecodeData(bookmarksXML);
                this.LocalBookmarks = JSON.parse(cacheData);
            }
        };
        LocalBookmarksClass.prototype.StoreBookmarks = function (XMLString) {
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
        };
        LocalBookmarksClass.prototype.GetCurrentArtBookmarks = function () {
            if (!FB3PPCache.CheckStorageAvail()) {
                return;
            }
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
        LocalBookmarksClass.prototype.SetCurrentDateTime = function (value) {
            this.DateTime = value;
        };
        LocalBookmarksClass.prototype.GetCurrentDateTime = function () {
            return this.DateTime;
        };
        LocalBookmarksClass.prototype.EncodeData = function (Data) {
            if (this.LZState) {
                return LZString.compressToUTF16(Data);
            }
            else {
                return Data;
            }
        };
        LocalBookmarksClass.prototype.DecodeData = function (Data) {
            if (this.LZState) {
                return LZString.decompressFromUTF16(Data);
            }
            else {
                return Data;
            }
        };
        return LocalBookmarksClass;
    }());
    LocalBookmarks.LocalBookmarksClass = LocalBookmarksClass;
})(LocalBookmarks || (LocalBookmarks = {}));
//# sourceMappingURL=LocalBookmarks.js.map