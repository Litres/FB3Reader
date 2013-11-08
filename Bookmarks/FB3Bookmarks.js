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
            this.Range = { From: undefined, To: undefined };
        }
        Bookmark.prototype.InitFromXY = function (X, Y) {
            var BaseFrom = this.Owner.Reader.ElementAtXY(X, Y);
            this.Range.From = BaseFrom.slice(0);
            if (RoundToBlock) {
                // We search for first block-level parent if required
                this.RoundToBlockLVLUp(this.Range.From);
            }
            if (X1 != undefined && Y1 != undefined) {
                this.Range.To = this.Owner.Reader.ElementAtXY(X1, Y1);
            } else {
                this.Range.To = BaseFrom;
            }
            if (RoundToBlock) {
                // We search for first block-level parent if required
                this.RoundToBlockLVLDn(this.Range.To);
            }
            var PageData = new FB3DOM.PageContainer();
            this.Owner.FB3DOM.GetHTML(this.Owner.Reader.HyphON, FB3Reader.RangeClone(this.Range), '', 100, 100, PageData);

            // We first remove unknown characters
            var InnerHTML = PageData.Body.join('').replace(/<(?!\/?p\b|\/?strong\b|\/?em\b)[^>]*>/, '');

            // Then we extract plain text
            this.Title = InnerHTML.replace(/<[^>]+>|\u00AD/gi, '').substr(0, 50).replace(/\s+\S*$/, '');
            this.RawText = InnerHTML.replace(/(\s\n\r)+/gi, ' ');
            this.RawText = this.RawText.replace(/<(\/)?strong[^>]*>/gi, '[$1b]');
            this.RawText = this.RawText.replace(/<(\/)?em[^>]*>/gi, '[$1i]');
            this.RawText = this.RawText.replace(/<\/p>/gi, '\n');
            this.RawText = this.RawText.replace(/<\/?[^>]+>|\u00AD/gi, '');
            this.RawText = this.RawText.replace(/^\s+|\s+$/gi, '');
            this.Note = this.Raw2FB2(this.RawText);

            // todo - should fill this.Extract with something equal|close to raw fb2 fragment
            this.XStart = this.Owner.FB3DOM.GetXPathFromPos(this.Range.From.slice(0));
            this.XEnd = this.Owner.FB3DOM.GetXPathFromPos(this.Range.To.slice(0));
        };

        Bookmark.prototype.RoundToBlockLVLUp = function (Adress) {
            var Block = this.Owner.FB3DOM.GetElementByAddr(Adress.slice(0));
            while (Block.Parent && (!Block.TagName || !Block.TagName.match(FB3DOM.BlockLVLRegexp))) {
                Block = Block.Parent;
                Adress.pop();
            }
        };
        Bookmark.prototype.RoundToBlockLVLDn = function (Adress) {
            this.RoundToBlockLVLUp(Adress);
            var Block = this.Owner.FB3DOM.GetElementByAddr(Adress.slice(0));
            if (Block.Parent.Childs.length > Block.ID + 1) {
                Adress[Adress.length - 1]++;
            } else {
                Adress.push(Block.Childs.length);
            }
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
