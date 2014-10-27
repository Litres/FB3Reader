/// <reference path="PPCacheHead.ts" />
/// <reference path="../plugins/lz-string.d.ts" />
var FB3PPCache;
(function (FB3PPCache) {
    FB3PPCache.MaxCacheRecords = 15;
    var SkipCache = false;

    var PPCache = (function () {
        function PPCache() {
            this.Reset();
        }
        PPCache.prototype.Get = function (I) {
            return this.PagesPositionsCache[I];
        };
        PPCache.prototype.Set = function (I, Instr) {
            this.PagesPositionsCache[I] = Instr;
        };

        PPCache.prototype.Reset = function () {
            this.CacheMarkupsList = null;
            this.PagesPositionsCache = new Array();
            this.MarginsCache = {};
        };

        PPCache.prototype.Length = function () {
            return this.PagesPositionsCache.length;
        };

        PPCache.prototype.Save = function (Key) {
            if (SkipCache) {
                return;
            }

            // We are going to save no more than 50 cache entries
            // We reuse slots on write request based on access time
            if (typeof (Storage) !== "undefined" && localStorage && JSON) {
                // localStorage support required
                if (!this.CacheMarkupsList) {
                    this.LoadOrFillEmptyData();
                }
                var RowToFillID;
                var OldestIDTime;
                for (var I = 0; I < this.CacheMarkupsList.length; I++) {
                    if (this.CacheMarkupsList[I].Key == Key) {
                        this.CacheMarkupsList.splice(I, 1);
                    }
                }
                if (this.CacheMarkupsList.length >= FB3PPCache.MaxCacheRecords) {
                    this.CacheMarkupsList.shift();
                }
                this.CacheMarkupsList.push({
                    Time: new Date,
                    Key: Key,
                    Cache: this.PagesPositionsCache,
                    LastPage: this.LastPageN,
                    MarginsCache: this.MarginsCache
                });

                // Keep in mind - next line is really, really slow
                var uncompressdCacheData = JSON.stringify(this.CacheMarkupsList);
                localStorage['FB3Reader1.0'] = LZString.compressToUTF16(uncompressdCacheData);
            }
        };

        PPCache.prototype.Load = function (Key) {
            if (SkipCache) {
                return;
            }
            if (typeof (Storage) !== "undefined" && localStorage && JSON) {
                if (!this.CacheMarkupsList) {
                    this.LoadOrFillEmptyData();
                }
                for (var I = 0; I < this.CacheMarkupsList.length; I++) {
                    if (this.CacheMarkupsList[I].Key == Key) {
                        this.PagesPositionsCache = this.CacheMarkupsList[I].Cache;
                        this.MarginsCache = this.CacheMarkupsList[I].MarginsCache;
                        this.LastPageN = this.CacheMarkupsList[I].LastPage;
                        break;
                    }
                }
            }
        };

        PPCache.prototype.LoadOrFillEmptyData = function () {
            var compressedCacheData = localStorage['FB3Reader1.0'];
            var DataInitDone = false;
            if (compressedCacheData) {
                try  {
                    var cacheData = LZString.decompressFromUTF16(compressedCacheData);
                    this.CacheMarkupsList = JSON.parse(cacheData);
                    DataInitDone = true;
                } catch (e) {
                }
            }
            if (!DataInitDone) {
                this.CacheMarkupsList = new Array();
            }
        };

        PPCache.prototype.LastPage = function (LastPageN) {
            if (LastPageN == undefined) {
                return this.LastPageN;
            } else {
                this.LastPageN = LastPageN;
            }
        };
        PPCache.prototype.SetMargin = function (XP, Margin) {
            this.MarginsCache[XP] = Margin;
        };

        PPCache.prototype.GetMargin = function (XP) {
            return this.MarginsCache[XP];
        };
        return PPCache;
    })();
    FB3PPCache.PPCache = PPCache;
})(FB3PPCache || (FB3PPCache = {}));
//# sourceMappingURL=PPCache.js.map
