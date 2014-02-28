/// <reference path="FB3BookmarksHead.ts" />
var FB3Bookmarks;
(function (FB3Bookmarks) {
    var LitResBookmarksProcessor = (function () {
        function LitResBookmarksProcessor(FB3DOM) {
            this.FB3DOM = FB3DOM;
            this.Ready = false;
            this.FB3DOM.Bookmarks.push(this);
            this.ClassPrefix = 'my_';
            this.Bookmarks = new Array();
        }
        LitResBookmarksProcessor.prototype.AddBookmark = function (Bookmark) {
            this.Bookmarks.push(Bookmark);
        };
        LitResBookmarksProcessor.prototype.DropBookmark = function (Bookmark) {
            for (var I = 0; I < this.Bookmarks.length; I++) {
                if (this.Bookmarks[I] == Bookmark) {
                    this.Bookmarks.splice(I, 1);
                    return;
                }
            }
        };

        // fake methods below - todo to implement them
        LitResBookmarksProcessor.prototype.Load = function (ArtID, Callback) {
            this.Ready = true; //fake
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
            this.Class = 'default';
            this.Range = { From: undefined, To: undefined };
        }
        Bookmark.prototype.InitFromXY = function (X, Y) {
            var BaseFrom = this.Owner.Reader.ElementAtXY(X, Y);
            if (BaseFrom) {
                this.Range.From = BaseFrom.slice(0);
                this.Range.To = BaseFrom;
                this.GetDataFromText();
                return true;
            } else {
                return undefined;
            }
        };

        Bookmark.prototype.ExtendToXY = function (X, Y) {
            var BaseTo = this.Owner.Reader.ElementAtXY(X, Y);
            if (BaseTo) {
                this.Range.To = BaseTo;
                this.GetDataFromText();
                return true;
            } else {
                return undefined;
            }
        };

        Bookmark.prototype.RoundClone = function (ToBlock) {
            var Clone = new Bookmark(this.Owner);

            Clone.Range = FB3Reader.RangeClone(this.Range);

            if (ToBlock) {
                this.RoundToBlockLVLUp(Clone.Range.From);
                this.RoundToBlockLVLDn(Clone.Range.To);
            } else {
                this.RoundToWordLVLUp(Clone.Range.From);
                this.RoundToWordLVLDn(Clone.Range.To);
            }

            Clone.GetDataFromText();
            Clone.Group = this.Group;
            Clone.Class = this.Class;

            return Clone;
        };

        Bookmark.prototype.Detach = function () {
            this.Owner.DropBookmark(this);
            // this.Owner.Store();
        };

        Bookmark.prototype.RoundToWordLVLDn = function (Adress) {
            var Block = this.Owner.FB3DOM.GetElementByAddr(Adress.slice(0));
            var PosInBlock = Adress[Adress.length - 1];
            while (Block.Parent && (!Block.TagName || !Block.TagName.match(FB3DOM.BlockLVLRegexp))) {
                Block = Block.Parent;
                PosInBlock = Adress[Adress.length - 1];
                Adress.pop();
            }
            while (PosInBlock < Block.Childs.length && !Block.Childs[PosInBlock].Childs && !Block.Childs[PosInBlock].text.match(/\s$/)) {
                PosInBlock++;
            }
            Adress.push(PosInBlock);
        };
        Bookmark.prototype.RoundToWordLVLUp = function (Adress) {
            var Block = this.Owner.FB3DOM.GetElementByAddr(Adress.slice(0));
            var PosInBlock = Adress[Adress.length - 1];
            while (Block.Parent && (!Block.TagName || !Block.TagName.match(FB3DOM.BlockLVLRegexp))) {
                Block = Block.Parent;
                PosInBlock = Adress[Adress.length - 1];
                Adress.pop();
            }
            PosInBlock++;
            while (PosInBlock >= 0 && !Block.Childs[PosInBlock - 1].Childs && !Block.Childs[PosInBlock - 1].text.match(/\s$/)) {
                PosInBlock--;
            }
            Adress.push(PosInBlock);
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
            if (Block.TagName && Block.TagName.match(FB3DOM.BlockLVLRegexp)) {
                return;
            }
            if (Block.Parent.Childs.length > Block.ID + 1) {
                Adress[Adress.length - 1]++;
            } else {
                Adress.push(Block.Childs.length);
            }
        };

        Bookmark.prototype.ClassName = function () {
            return this.Owner.ClassPrefix + 'selec_' + this.Group + '_' + this.Class;
        };

        Bookmark.prototype.GetDataFromText = function () {
            var PageData = new FB3DOM.PageContainer();
            this.Owner.FB3DOM.GetHTML(this.Owner.Reader.HyphON, this.Owner.Reader.BookStyleNotes, FB3Reader.RangeClone(this.Range), '', 100, 100, PageData);

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
