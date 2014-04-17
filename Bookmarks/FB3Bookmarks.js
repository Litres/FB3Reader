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
            this.CurPos = new Bookmark(this);
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
            var _this = this;
            this.LoadEndCallback = Callback;

            // do some data transfer init stuff here, set AfterTransferFromServerComplete to run at the end
            setTimeout(function () {
                return _this.AfterTransferFromServerComplete();
            }, 200); // for now we just fire it as it is
        };

        LitResBookmarksProcessor.prototype.AfterTransferFromServerComplete = function (XML) {
            this.ParseXML(XML);
            this.LoadEndCallback(this);
        };

        LitResBookmarksProcessor.prototype.ParseXML = function (XML) {
            // do some xml-parsing upon data receive here to make pretty JS-bookmarks from ugly XML
        };

        LitResBookmarksProcessor.prototype.Store = function () {
        };

        LitResBookmarksProcessor.prototype.ApplyPosition = function () {
            // If DOM.TOC not ready yet, we can't expand XPath for any way - we wait while Reader.LoadDone fire this
            if (!this.FB3DOM.Ready) {
                return;
            }
            this.Ready = true;
            this.Reader.GoTO(this.CurPos.Range.From.slice(0));
        };

        LitResBookmarksProcessor.prototype.ReLoad = function (ArtID) {
            var _this = this;
            var TemporaryNotes = new LitResBookmarksProcessor(this.FB3DOM);
            TemporaryNotes.Load(ArtID, function (Bookmarks) {
                return _this.ReLoadComplete(Bookmarks);
            });
        };

        LitResBookmarksProcessor.prototype.ReLoadComplete = function (TemporaryNotes) {
            // merge data from TemporaryNotes to this, then dispose of temporary LitResBookmarksProcessor
        };
        return LitResBookmarksProcessor;
    })();
    FB3Bookmarks.LitResBookmarksProcessor = LitResBookmarksProcessor;

    var Bookmark = (function () {
        function Bookmark(Owner) {
            this.Owner = Owner;
            this.ID = this.MakeSelectionID();
            this.Group = 0;
            this.Class = 'default';
            this.Range = { From: [20], To: [0] };
            this.XPathMappingReady = true;
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
            if (BaseTo && BaseTo.length > 1) {
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
            while (PosInBlock < Block.Childs.length - 1 && !Block.Childs[PosInBlock].Childs && !Block.Childs[PosInBlock].text.match(/\s$/)) {
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
            if (PosInBlock < Block.Childs.length - 2) {
                PosInBlock++;
            }
            while (PosInBlock > 0 && !Block.Childs[PosInBlock - 1].Childs && !Block.Childs[PosInBlock - 1].text.match(/\s$/)) {
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
        Bookmark.prototype.MakeSelectionID = function () {
            var MakeSelectionIDSub = function (chars, len) {
                var text = '';
                for (var i = 0; i < len; i++) {
                    text += chars.charAt(Math.floor(Math.random() * chars.length));
                }
                return text;
            };
            var text = '', chars = 'ABCDEFabcdef0123456789';
            text += MakeSelectionIDSub(chars, 8) + '-';
            text += MakeSelectionIDSub(chars, 4) + '-';
            text += MakeSelectionIDSub(chars, 4) + '-';
            text += MakeSelectionIDSub(chars, 4) + '-';
            text += MakeSelectionIDSub(chars, 12);
            return text;
        };

        Bookmark.prototype.InitSyncXPathWithDOM = function () {
            var _this = this;
            this.XPathMappingReady = false;
            this.RequiredChunks = this.ChunksRequired();
            var ChunksToLoad = new Array();

            for (var I = 0; I < this.RequiredChunks.length; I++) {
                if (!this.Owner.FB3DOM.DataChunks[this.RequiredChunks[I]].loaded) {
                    ChunksToLoad.push(this.RequiredChunks[I]);
                }
            }

            // If there are missing chunks - we initiate loading for them
            if (ChunksToLoad.length) {
                this.Owner.FB3DOM.LoadChunks(ChunksToLoad, function () {
                    return _this.DoSyncXPathWithDOM();
                });
            } else {
                this.DoSyncXPathWithDOM();
            }
        };

        Bookmark.prototype.DoSyncXPathWithDOM = function () {
            var _this = this;
            for (var I = 0; I < this.RequiredChunks.length; I++) {
                if (this.Owner.FB3DOM.DataChunks[this.RequiredChunks[I]].loaded != 2) {
                    // There is at least one chunk still being loaded - we will return later
                    setTimeout(function () {
                        return _this.DoSyncXPathWithDOM();
                    }, 10);
                    return;
                }
            }

            // Ok, all chunks are here, now we need to map fb2 xpath to internal xpath
            this.Range = {
                From: this.Owner.FB3DOM.GetAddrByXPath(this.XStart),
                To: this.Owner.FB3DOM.GetAddrByXPath(this.XEnd)
            };
        };

        Bookmark.prototype.ChunksRequired = function () {
            var Result = new Array();
            Result[0] = this.XPChunk(this.XStart);
            var EndChunk = this.XPChunk(this.XEnd);
            if (EndChunk != Result[0]) {
                Result.push(EndChunk);
            }
            return Result;
        };

        Bookmark.prototype.XPChunk = function (X) {
            for (var I = 0; I < this.Owner.FB3DOM.DataChunks.length; I++) {
                if (FB3Reader.PosCompare(X, this.Owner.FB3DOM.DataChunks[I].xps) <= 0) {
                    return I;
                }
            }
        };
        return Bookmark;
    })();
    FB3Bookmarks.Bookmark = Bookmark;
})(FB3Bookmarks || (FB3Bookmarks = {}));
//# sourceMappingURL=FB3Bookmarks.js.map
