/// <reference path="FB3BookmarksHead.ts" />
var FB3Bookmarks;
(function (FB3Bookmarks) {
    var LitResBookmarksProcessor = (function () {
        function LitResBookmarksProcessor() {
            this.Ready = false;
        }
        LitResBookmarksProcessor.prototype.Load = function (ArtID, Callback) {
            this.Ready = true;
        };
        LitResBookmarksProcessor.prototype.Store = function () {
        };
        return LitResBookmarksProcessor;
    })();
    FB3Bookmarks.LitResBookmarksProcessor = LitResBookmarksProcessor;
    var Bookmark = (function () {
        function Bookmark(Owner) {
            this.Owner = Owner;
            this.Group = 0;
        }
        Bookmark.prototype.InitFromXY = function (X, Y, X1, Y1) {
            this.Range.From = this.Owner.Reader.ElementAtXY(X, Y);
            if (X1 != undefined && Y1 != undefined) {
                this.Range.To = this.Owner.Reader.ElementAtXY(X1, Y1);
            } else {
                this.Range.To = this.Range.From;
            }
            var PageData = new FB3DOM.PageContainer();
            this.Owner.FB3DOM.GetHTML(this.Owner.Reader.HyphON, this.Range, '', 100, 100, PageData);

            // We first remove unknown characters
            var InnerHTML = PageData.Body.join('').replace(/<(?!\/?p\b|\/?strong\b|\/?em\b)[^>]*>/, '');

            // Then we extract plain text
            this.Title = InnerHTML.replace(/<[^>]+>/gi, '').substr(0, 100);
            this.RawText = InnerHTML.replace(/(\s\n\r)+/, ' ');
            this.RawText = this.RawText.replace(/<(\/)?strong[^>]*>/, '[$1b]');
            this.RawText = this.RawText.replace(/<(\/)?em[^>]*>/, '[$1i]');
            this.RawText = this.RawText.replace('</p>', '\n');
            this.RawText = this.RawText.replace(/<\/?[^>]+>/, '');
            this.Note = this.Raw2FB2(this.RawText);

            // todo - should fill this.Extract with something equal|close to raw fb2 fragment
            this.XStart = this.Owner.FB3DOM.GetXPath(this.Range.From);
            this.XEnd = this.Owner.FB3DOM.GetXPath(this.Range.To);
        };

        Bookmark.prototype.Raw2FB2 = function (RawText) {
            RawText = RawText.replace(/\[(\/)?b[^>]*\]/, '<$1strong>');
            RawText = RawText.replace(/\[(\/)?i[^>]*\]/, '<$1emphasis>');
            RawText = '<p>' + RawText.replace(/\n/, '</p><p>') + '</p>';
            return RawText;
        };
        return Bookmark;
    })();
    FB3Bookmarks.Bookmark = Bookmark;
})(FB3Bookmarks || (FB3Bookmarks = {}));
//# sourceMappingURL=FB3Bookmarks.js.map
