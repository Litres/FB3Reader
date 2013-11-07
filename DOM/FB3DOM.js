/// <reference path="FB3DOMHead.ts" />
/// <reference path="FB3DOMBlock.ts" />
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var FB3DOM;
(function (FB3DOM) {
    var AsyncLoadConsumer = (function () {
        function AsyncLoadConsumer(FB3DOM, WaitedBlocks, HyphOn, Range, IDPrefix, ViewPortW, ViewPortH, OnDone) {
            this.FB3DOM = FB3DOM;
            this.WaitedBlocks = WaitedBlocks;
            this.HyphOn = HyphOn;
            this.Range = Range;
            this.IDPrefix = IDPrefix;
            this.ViewPortW = ViewPortW;
            this.ViewPortH = ViewPortH;
            this.OnDone = OnDone;
        }
        AsyncLoadConsumer.prototype.BlockLoaded = function (N) {
            if (this.ImDone)
                return false;
            for (var I = 0; I < this.WaitedBlocks.length; I++) {
                if (this.WaitedBlocks[I] == N)
                    this.WaitedBlocks.splice(I, 1);
            }
            if (!this.WaitedBlocks.length) {
                var PageData = new PageContainer();
                var HTML = this.FB3DOM.GetHTML(this.HyphOn, this.Range, this.IDPrefix, this.ViewPortW, this.ViewPortH, PageData);
                this.OnDone(PageData);
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
    FB3DOM.PageContainer = PageContainer;

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
        DOM.prototype.GetHTMLAsync = function (HyphOn, Range, IDPrefix, ViewPortW, ViewPortH, Callback) {
            var _this = this;
            var MissingChunks = this.CheckRangeLoaded(Range.From[0], Range.To[0]);
            if (MissingChunks.length == 0) {
                var PageData = new PageContainer();
                this.GetHTML(HyphOn, Range, IDPrefix, ViewPortW, ViewPortH, PageData);
                Callback(PageData);
            } else {
                this.ActiveRequests.push(new AsyncLoadConsumer(this, MissingChunks, HyphOn, Range, IDPrefix, ViewPortW, ViewPortH, Callback));
                for (var I = 0; I < MissingChunks.length; I++) {
                    if (!this.DataChunks[MissingChunks[I]].loaded) {
                        var AjRequest = this.DataProvider.Request(this.ChunkUrl(MissingChunks[I]), function (Data, CustomData) {
                            return _this.OnChunkLoaded(Data, CustomData);
                        }, this.Progressor, { ChunkN: MissingChunks[I] });
                        this.DataChunks[MissingChunks[I]].loaded = 1;
                    }
                }
            }
        };

        DOM.prototype.ChunkUrl = function (N) {
            return this.ArtID2URL(N);
        };

        DOM.prototype.ArtID2URL = function (Chunk) {
            return this.DataProvider.ArtID2URL(this.ArtID, Chunk.toString());
        };

        DOM.prototype.OnChunkLoaded = function (Data, CustomData) {
            var LoadedChunk = CustomData.ChunkN;
            var Shift = this.DataChunks[LoadedChunk].s;
            for (var I = 0; I < Data.length; I++) {
                this.Childs[I + Shift] = new FB3DOM.FB3Tag(Data[I], this, I + Shift);
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
    })(FB3DOM.FB3Tag);
    FB3DOM.DOM = DOM;
})(FB3DOM || (FB3DOM = {}));
//# sourceMappingURL=FB3DOM.js.map
