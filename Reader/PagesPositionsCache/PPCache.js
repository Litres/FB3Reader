/// <reference path="PPCacheHead.ts" />
var FB3PPCache;
(function (FB3PPCache) {
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
        };

        PPCache.prototype.Length = function () {
            return this.PagesPositionsCache.length;
        };

        PPCache.prototype.Save = function (Key) {
            if (typeof (Storage) !== "undefined" && localStorage && JSON) {
                if (!this.CacheMarkupsList) {
                    this.CacheMarkupsList = JSON.parse(localStorage['FB3Reader1.0']);
                }
                var RowToFillID;
                var OldestIDTime;
                for (var I = 0; I < this.CacheMarkupsList.length; I++) {
                    if (this.CacheMarkupsList[I].Key == Key) {
                        this.CacheMarkupsList.splice(I, 1);
                    }
                }
                if (this.CacheMarkupsList.length >= 50) {
                    this.CacheMarkupsList.shift();
                }
                this.CacheMarkupsList.push({
                    Time: new Date(),
                    Key: Key,
                    Cache: this.PagesPositionsCache
                });
                localStorage['FB3Reader1.0'] = JSON.stringify(this.CacheMarkupsList);
            }
        };

        PPCache.prototype.Load = function (Key) {
            if (typeof (Storage) !== "undefined" && localStorage && JSON) {
                if (!this.CacheMarkupsList) {
                    this.CacheMarkupsList = JSON.parse(localStorage['FB3Reader1.0']);
                }
                for (var I = 0; I < this.CacheMarkupsList.length; I++) {
                    if (this.CacheMarkupsList[I].Key == Key) {
                        this.PagesPositionsCache = this.CacheMarkupsList[I].Cache;
                    }
                }
            }
        };
        return PPCache;
    })();
})(FB3PPCache || (FB3PPCache = {}));
//# sourceMappingURL=PPCache.js.map
