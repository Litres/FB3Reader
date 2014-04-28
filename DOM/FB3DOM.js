/// <reference path="FB3DOMHead.ts" />
/// <reference path="FB3DOMBlock.ts" />
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var FB3DOM;
(function (_FB3DOM) {
    var AsyncLoadConsumer = (function () {
        function AsyncLoadConsumer(FB3DOM, WaitedBlocks, OnGetDone, OnLoadDone, HyphOn, BookStyleNotes, Range, IDPrefix, ViewPortW, ViewPortH) {
            var _this = this;
            this.FB3DOM = FB3DOM;
            this.WaitedBlocks = WaitedBlocks;
            this.OnGetDone = OnGetDone;
            this.OnLoadDone = OnLoadDone;
            this.HyphOn = HyphOn;
            this.BookStyleNotes = BookStyleNotes;
            this.Range = Range;
            this.IDPrefix = IDPrefix;
            this.ViewPortW = ViewPortW;
            this.ViewPortH = ViewPortH;
            for (var I = 0; I < this.WaitedBlocks.length; I++) {
                if (!this.FB3DOM.DataChunks[this.WaitedBlocks[I]].loaded) {
                    this.FB3DOM.DataProvider.Request(this.FB3DOM.ChunkUrl(this.WaitedBlocks[I]), function (Data, CustomData) {
                        return _this.FB3DOM.OnChunkLoaded(Data, CustomData);
                    }, this.FB3DOM.Progressor, { ChunkN: this.WaitedBlocks[I] });
                    this.FB3DOM.DataChunks[this.WaitedBlocks[I]].loaded = 1;
                }
            }
        }
        AsyncLoadConsumer.prototype.BlockLoaded = function (N) {
            if (this.ImDone)
                return false;
            var I = this.WaitedBlocks.indexOf(N);
            if (I != -1) {
                this.WaitedBlocks.splice(I, 1);
            }
            for (var I = 0; I < this.WaitedBlocks.length; I++) {
                if (this.WaitedBlocks[I] == N)
                    this.WaitedBlocks.splice(I, 1);
            }
            if (!this.WaitedBlocks.length) {
                var PageData = new PageContainer();
                var AllBookmarks = new Array();
                var HTML = this.FB3DOM.GetHTML(this.HyphOn, this.BookStyleNotes, this.Range, this.IDPrefix, this.ViewPortW, this.ViewPortH, PageData);
                if (this.OnGetDone) {
                    this.OnGetDone(PageData);
                } else {
                    this.OnLoadDone();
                }
                return true;
            } else {
                return false;
            }
        };
        return AsyncLoadConsumer;
    })();

    ;

    var PageContainer = (function () {
        function PageContainer() {
            this.Body = new Array();
            this.FootNotes = new Array();
        }
        return PageContainer;
    })();
    _FB3DOM.PageContainer = PageContainer;

    var DOM = (function (_super) {
        __extends(DOM, _super);
        function DOM(Alert, Progressor, DataProvider) {
            _super.call(this, null, null, 0);
            this.Alert = Alert;
            this.Progressor = Progressor;
            this.DataProvider = DataProvider;
            this.ActiveRequests = [];
            this.Ready = false;
            this.XPID = '';
            this.XPath = new Array();
            this.Bookmarks = new Array();
        }
        DOM.prototype.GetCloseTag = function (Range) {
            return '';
        };
        DOM.prototype.GetInitTag = function (Range) {
            return [];
        };

        DOM.prototype.CheckAndPullRequiredBlocks = function (Range) {
            return [1];
        };

        DOM.prototype.AfterHeaderLoaded = function (Data) {
            this.TOC = Data.Body;
            this.DataChunks = Data.Parts;
            this.MetaData = Data.Meta;
            this.Ready = true;
            this.OnDoneFunc(this);
        };

        // Wondering why I make Init public? Because you can't inherite private methods, darling!
        DOM.prototype.Init = function (HyphOn, ArtID, OnDone) {
            var _this = this;
            this.HyphOn = HyphOn;
            this.OnDoneFunc = OnDone;
            this.ArtID = ArtID;
            this.Childs = new Array();
            this.Progressor.HourglassOn(this, true, 'Loading meta...');
            this.DataProvider.Request(this.DataProvider.ArtID2URL(ArtID), function (Data) {
                return _this.AfterHeaderLoaded(Data);
            }, this.Progressor);
            this.Progressor.HourglassOff(this);
        };
        DOM.prototype.GetHTMLAsync = function (HyphOn, BookStyleNotes, Range, IDPrefix, ViewPortW, ViewPortH, Callback) {
            var MissingChunks = this.CheckRangeLoaded(Range.From[0], Range.To[0]);
            if (MissingChunks.length == 0) {
                var PageData = new PageContainer();
                this.GetHTML(HyphOn, BookStyleNotes, Range, IDPrefix, ViewPortW, ViewPortH, PageData);
                Callback(PageData);
            } else {
                this.ActiveRequests.push(new AsyncLoadConsumer(this, MissingChunks, Callback, undefined, HyphOn, BookStyleNotes, Range, IDPrefix, ViewPortW, ViewPortH));
            }
        };

        DOM.prototype.LoadChunks = function (MissingChunks, Callback) {
            this.ActiveRequests.push(new AsyncLoadConsumer(this, MissingChunks, undefined, Callback));
        };

        DOM.prototype.ChunkUrl = function (N) {
            return this.ArtID2URL(N.toString());
        };

        DOM.prototype.ArtID2URL = function (Chunk) {
            return this.DataProvider.ArtID2URL(this.ArtID, Chunk);
        };

        DOM.prototype.GetElementByAddr = function (Position) {
            var ResponcibleNode = this;
            while (Position.length && ResponcibleNode.Childs) {
                ResponcibleNode = ResponcibleNode.Childs[Position.shift()];
            }
            return ResponcibleNode;
        };
        DOM.prototype.GetAddrByXPath = function (XPath) {
            var Node = this;
            var I = 0;
            while (I < Node.Childs.length) {
                if (Node.Childs[I].XPath) {
                    var PC = FB3Reader.PosCompare(XPath, Node.Childs[I].XPath);
                    if (PC == 10 || PC == 0) {
                        // This node is the exact xpath or the xpath points a bit above, be assume this is it
                        return Node.Childs[I].Position();
                    } else if (PC == 1) {
                        Node = Node.Childs[I];
                        I = 0;
                        continue;
                    }
                }
                I++;
            }
        };

        DOM.prototype.GetXPathFromPos = function (Position) {
            var Element = this.GetElementByAddr(Position);
            if (Element) {
                return Element.XPath;
            } else {
                return undefined;
            }
        };

        DOM.prototype.GetHTML = function (HyphOn, BookStyleNotes, Range, IDPrefix, ViewPortW, ViewPortH, PageData) {
            var FullBookmarksList = new Array;
            for (var I = 0; I < this.Bookmarks.length; I++) {
                FullBookmarksList = FullBookmarksList.concat(this.Bookmarks[I].Bookmarks);
            }
            _super.prototype.GetHTML.call(this, HyphOn, BookStyleNotes, Range, IDPrefix, ViewPortW, ViewPortH, PageData, FullBookmarksList);
        };

        DOM.prototype.OnChunkLoaded = function (Data, CustomData) {
            var LoadedChunk = CustomData.ChunkN;
            var Shift = this.DataChunks[LoadedChunk].s;
            for (var I = 0; I < Data.length; I++) {
                this.Childs[I + Shift] = new _FB3DOM.FB3Tag(Data[I], this, I + Shift);
            }
            this.DataChunks[LoadedChunk].loaded = 2;

            var I = 0;
            while (I < this.ActiveRequests.length) {
                if (this.ActiveRequests[I].BlockLoaded(LoadedChunk)) {
                    this.ActiveRequests.splice(I, 1);
                } else {
                    I++;
                }
            }
        };

        DOM.prototype.CheckRangeLoaded = function (From, To) {
            var ChunksMissing = [];
            for (var I = 0; I < this.DataChunks.length; I++) {
                if ((From <= this.DataChunks[I].s && To >= this.DataChunks[I].s || From <= this.DataChunks[I].e && To >= this.DataChunks[I].e || From >= this.DataChunks[I].s && To <= this.DataChunks[I].e) && this.DataChunks[I].loaded != 2) {
                    ChunksMissing.push(I);
                }
            }
            return ChunksMissing;
        };
        return DOM;
    })(_FB3DOM.FB3Tag);
    _FB3DOM.DOM = DOM;
})(FB3DOM || (FB3DOM = {}));
//# sourceMappingURL=FB3DOM.js.map
