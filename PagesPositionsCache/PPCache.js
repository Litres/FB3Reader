/// <reference path="PPCacheHead.ts" />
/// <reference path="../plugins/lz-string.d.ts" />
var FB3PPCache;
(function (FB3PPCache) {
    function CheckStorageAvail() {
        if (FB3PPCache.LocalStorage !== undefined) {
            return FB3PPCache.LocalStorage;
        }
        try {
            window.localStorage['working'] = 'true';
            FB3PPCache.LocalStorage = true;
            window.localStorage.removeItem('working');
        }
        catch (e) {
            FB3PPCache.LocalStorage = false;
        }
        return FB3PPCache.LocalStorage;
    }
    FB3PPCache.CheckStorageAvail = CheckStorageAvail;
    FB3PPCache.MaxCacheRecords = 15;
    FB3PPCache.LocalStorage; // global for window.localStorage check
    var SkipCache = false; // For debug purposes
    var PPCache = (function () {
        function PPCache() {
            this.Encrypt = true;
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
            if (FB3PPCache.CheckStorageAvail()) {
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
                this.SaveData(this.EncodeData(uncompressdCacheData));
            } //  else { no luck, no store - recreate from scratch } 
        };
        PPCache.prototype.Load = function (Key) {
            if (SkipCache) {
                return;
            }
            if (FB3PPCache.CheckStorageAvail()) {
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
        PPCache.prototype.LoadDataAsync = function (ArtID) { };
        PPCache.prototype.LoadOrFillEmptyData = function () {
            var compressedCacheData = this.LoadData();
            var DataInitDone = false;
            if (compressedCacheData) {
                try {
                    var cacheData = this.DecodeData(compressedCacheData);
                    this.CacheMarkupsList = JSON.parse(cacheData);
                    DataInitDone = true;
                }
                catch (e) { }
            }
            if (!DataInitDone) {
                this.CacheMarkupsList = new Array();
            }
        };
        PPCache.prototype.LastPage = function (LastPageN) {
            if (LastPageN == undefined) {
                return this.LastPageN;
            }
            else {
                this.LastPageN = LastPageN;
            }
        };
        PPCache.prototype.SetMargin = function (XP, Margin) {
            this.MarginsCache[XP] = Margin;
        };
        PPCache.prototype.GetMargin = function (XP) {
            return this.MarginsCache[XP];
        };
        PPCache.prototype.CheckIfKnown = function (From) {
            for (var I = 1; I < this.PagesPositionsCache.length; I++) {
                if (FB3Reader.PosCompare(this.PagesPositionsCache[I].Range.From, From) === 0) {
                    return I;
                }
            }
            return undefined;
        };
        PPCache.prototype.DecodeData = function (Data) {
            if (this.Encrypt) {
                return LZString.decompressFromUTF16(Data);
            }
            else {
                return Data;
            }
        };
        PPCache.prototype.EncodeData = function (Data) {
            if (this.Encrypt) {
                return LZString.compressToUTF16(Data);
            }
            else {
                return Data;
            }
        };
        PPCache.prototype.LoadData = function () {
            return localStorage['FB3Reader1.0'];
        };
        PPCache.prototype.SaveData = function (Data) {
            localStorage['FB3Reader1.0'] = Data;
        };
        return PPCache;
    })();
    FB3PPCache.PPCache = PPCache;
})(FB3PPCache || (FB3PPCache = {}));
//# sourceMappingURL=PPCache.js.map