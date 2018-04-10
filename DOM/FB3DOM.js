var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var FB3DOM;
(function (FB3DOM_1) {
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
                    this.FB3DOM.DataProvider.Request(this.FB3DOM.ChunkUrl(this.WaitedBlocks[I]), function (Data, CustomData) { return _this.FB3DOM.OnChunkLoaded(Data, CustomData); }, this.FB3DOM.Progressor, { ChunkN: this.WaitedBlocks[I] });
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
                if (this.OnGetDone) {
                    var PageData = new PageContainer();
                    var AllBookmarks = new Array();
                    this.FB3DOM.GetHTML(this.HyphOn, this.BookStyleNotes, this.Range, this.IDPrefix, this.ViewPortW, this.ViewPortH, PageData);
                    this.OnGetDone(PageData);
                }
                else if (this.OnLoadDone) {
                    this.OnLoadDone();
                }
                return true;
            }
            else {
                return false;
            }
        };
        AsyncLoadConsumer.prototype.Reset = function () {
            this.OnLoadDone = null;
            this.OnGetDone = null;
        };
        return AsyncLoadConsumer;
    }());
    ;
    var PageContainer = (function () {
        function PageContainer() {
            this.Body = new Array();
            this.FootNotes = new Array();
            this.BodyXML = new Array();
        }
        return PageContainer;
    }());
    FB3DOM_1.PageContainer = PageContainer;
    var DOM = (function (_super) {
        __extends(DOM, _super);
        function DOM(Site, Progressor, DataProvider, PagesPositionsCache) {
            var _this = _super.call(this, null, null, null, 0) || this;
            _this.Site = Site;
            _this.Progressor = Progressor;
            _this.DataProvider = DataProvider;
            _this.PagesPositionsCache = PagesPositionsCache;
            _this.ActiveRequests = [];
            _this.Ready = false;
            _this.XPID = '';
            _this.XPath = new Array();
            _this.Bookmarks = new Array();
            return _this;
        }
        DOM.prototype.Reset = function () {
            for (var I = 0; I < this.ActiveRequests.length; I++) {
                this.ActiveRequests[I].Reset();
            }
        };
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
            Data = Data.length ? Data[0] : Data;
            this.FullTOC = Data;
            this.TOC = Data.Body;
            this.DataChunks = Data.Parts;
            this.MetaData = Data.Meta;
            this.Ready = true;
            this.OnDoneFunc(this);
        };
        DOM.prototype.GetFullTOC = function () {
            return this.FullTOC;
        };
        DOM.prototype.Init = function (HyphOn, OnDone) {
            var _this = this;
            this.HyphOn = HyphOn;
            this.OnDoneFunc = OnDone;
            this.Childs = new Array();
            this.Progressor.HourglassOn(this, true, 'Loading meta...');
            this.DataProvider.Request(this.DataProvider.ArtID2URL(), function (Data) { return _this.AfterHeaderLoaded(Data); }, this.Progressor);
            this.Progressor.HourglassOff(this);
        };
        DOM.prototype.GetHTMLAsync = function (HyphOn, BookStyleNotes, Range, IDPrefix, ViewPortW, ViewPortH, Callback) {
            var MissingChunks = this.CheckRangeLoaded(Range.From[0], Range.To[0]);
            if (MissingChunks.length == 0) {
                var PageData = new PageContainer();
                this.GetHTML(HyphOn, BookStyleNotes, Range, IDPrefix, ViewPortW, ViewPortH, PageData);
                Callback(PageData);
            }
            else {
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
            return this.DataProvider.ArtID2URL(Chunk);
        };
        DOM.prototype.GetElementByAddr = function (Position) {
            var ResponcibleNode = this;
            Position = Position.slice(0);
            while (Position.length && ResponcibleNode.Childs && ResponcibleNode.Childs[Position[0]]) {
                ResponcibleNode = ResponcibleNode.Childs[Position.shift()];
            }
            return ResponcibleNode;
        };
        DOM.prototype.GetAddrByXPath = function (XPath) {
            var Node = this;
            var I = 0;
            while (I < Node.Childs.length) {
                if (Node.Childs[I] && Node.Childs[I].XPath) {
                    var PC = FB3DOM_1.XPathCompare(XPath, Node.Childs[I].XPath);
                    if (PC == -10
                        || PC == 0
                        || PC == 1 && (!Node.Childs[I].Childs || !Node.Childs[I].Childs.length)) {
                        return Node.Childs[I].Position();
                    }
                    else if (PC == 1) {
                        Node = Node.Childs[I];
                        I = 0;
                        continue;
                    }
                }
                I++;
            }
            if (Node.Parent) {
                return Node.Position();
            }
            else {
                return [0];
            }
        };
        DOM.prototype.GetXPathFromPos = function (Position, End) {
            var Element = this.GetElementByAddr(Position);
            if (Element) {
                var XPath = Element.XPath.slice(0);
                if (End && Element.text && XPath[XPath.length - 1].match && XPath[XPath.length - 1].match(/^\.\d+$/)) {
                    var EndChar = XPath[XPath.length - 1].replace('.', '') * 1
                        + Element.text.replace(/\u00AD|&shy;|\s$/g, '').length - 1;
                    XPath[XPath.length - 1] = '.' + EndChar;
                }
                return XPath;
            }
            else {
                return undefined;
            }
        };
        DOM.prototype.GetHTML = function (HyphOn, BookStyleNotes, Range, IDPrefix, ViewPortW, ViewPortH, PageData) {
            if (Range.From.length == 1 && this.Childs[Range.From[0]] && this.Childs[Range.From[0]].TagName == 'empty-line') {
                Range.From[0]++;
            }
            var FullBookmarksList = new Array;
            for (var I = 0; I < this.Bookmarks.length; I++) {
                FullBookmarksList = FullBookmarksList.concat(this.Bookmarks[I].Bookmarks);
            }
            _super.prototype.GetHTML.call(this, HyphOn, BookStyleNotes, Range, IDPrefix, ViewPortW, ViewPortH, PageData, FullBookmarksList);
        };
        DOM.prototype.GetXML = function (Range, PageData) {
            _super.prototype.GetXML.call(this, Range, PageData);
        };
        DOM.prototype.OnChunkLoaded = function (Data, CustomData) {
            var LoadedChunk = CustomData.ChunkN;
            var Shift = this.DataChunks[LoadedChunk].s;
            for (var I = 0; I < Data.length; I++) {
                this.Childs[I + Shift] = FB3DOM_1.TagClassFactory(Data[I], this, I + Shift, 0, 0, false, this);
            }
            this.DataChunks[LoadedChunk].loaded = 2;
            var I = 0;
            while (I < this.ActiveRequests.length) {
                if (this.ActiveRequests[I].BlockLoaded(LoadedChunk)) {
                    this.ActiveRequests.splice(I, 1);
                }
                else {
                    I++;
                }
            }
        };
        DOM.prototype.CheckRangeLoaded = function (From, To) {
            var ChunksMissing = [];
            for (var I = 0; I < this.DataChunks.length; I++) {
                if ((From <= this.DataChunks[I].s && To >= this.DataChunks[I].s
                    ||
                        From <= this.DataChunks[I].e && To >= this.DataChunks[I].e
                    ||
                        From >= this.DataChunks[I].s && To <= this.DataChunks[I].e)
                    && this.DataChunks[I].loaded != 2) {
                    ChunksMissing.push(I);
                }
            }
            return ChunksMissing;
        };
        DOM.prototype.XPChunk = function (X) {
            for (var I = 0; I < this.DataChunks.length; I++) {
                var xps = FB3DOM_1.XPathCompare(X, this.DataChunks[I].xps);
                var xpe = FB3DOM_1.XPathCompare(X, this.DataChunks[I].xpe);
                if (!xps || !xpe || xps > 0 && xpe < 10) {
                    return I;
                }
            }
            return undefined;
        };
        return DOM;
    }(FB3DOM_1.FB3Tag));
    FB3DOM_1.DOM = DOM;
})(FB3DOM || (FB3DOM = {}));
//# sourceMappingURL=FB3DOM.js.map