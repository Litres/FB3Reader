var FB3PPCache;
(function (FB3PPCache) {
    FB3PPCache.MaxCacheRecords = 15;
    var SkipCache = false;
    var LocalStorageName = 'FB3Reader1.0';
    var IndexedDBStoreName = "FBReaderStore";
    var PPCache = (function () {
        function PPCache(Driver) {
            if (Driver === void 0) { Driver = FB3Storage.LOCAL_STORAGE; }
            this.Encrypt = true;
            this.IsReady = false;
            if (Driver === FB3Storage.LOCAL_STORAGE) {
                this.Driver = new FB3Storage.LocalStorageDriver(this, FB3PPCache.MaxCacheRecords);
                this.StorageName = LocalStorageName;
            }
            else if (Driver === FB3Storage.INDEXED_DB) {
                this.Driver = new FB3Storage.IndexedDBDriver(this);
                this.StorageName = IndexedDBStoreName;
            }
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
            this.IsReady = this.Driver.IsLocal;
        };
        PPCache.prototype.Length = function () {
            return this.PagesPositionsCache.length;
        };
        PPCache.prototype.Save = function (Key) {
            var _this = this;
            if (SkipCache) {
                return;
            }
            if (FB3Storage.CheckStorageAvail() !== FB3Storage.NO_STORAGE) {
                if (!this.CacheMarkupsList) {
                    this.LoadOrFillEmptyData(function () {
                        _this.SaveData(Key, _this.CacheMarkupsList);
                    });
                }
                else {
                    this.SaveData(Key, this.CacheMarkupsList);
                }
            }
        };
        PPCache.prototype.Load = function (Key) {
            var _this = this;
            if (SkipCache) {
                this.IsReady = true;
                return;
            }
            if (FB3Storage.CheckStorageAvail() !== FB3Storage.NO_STORAGE) {
                if (!this.CacheMarkupsList) {
                    this.LoadOrFillEmptyData(function (CacheMarkupsList) {
                        _this.Driver.Find(_this.StorageName, Key, function (CacheMarkupList) {
                            if (CacheMarkupList) {
                                _this.PagesPositionsCache = CacheMarkupList.Cache;
                                _this.MarginsCache = CacheMarkupList.MarginsCache;
                                _this.LastPageN = CacheMarkupList.LastPage;
                            }
                            _this.IsReady = true;
                        });
                    });
                }
            }
        };
        PPCache.prototype.LoadDataAsync = function (ArtID) { };
        PPCache.prototype.LoadOrFillEmptyData = function (Callback) {
            var _this = this;
            if (Callback === void 0) { Callback = function (CacheMarkupsList) { }; }
            this.LoadData(function (cacheData) {
                var DataInitDone = false;
                if (cacheData) {
                    try {
                        _this.CacheMarkupsList = cacheData;
                        DataInitDone = true;
                    }
                    catch (e) { }
                }
                if (!DataInitDone) {
                    _this.CacheMarkupsList = [];
                }
                Callback(_this.CacheMarkupsList);
            });
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
        PPCache.prototype.LoadData = function (Callback) {
            if (Callback === void 0) { Callback = function (compressedCacheData) { }; }
            return this.Driver.LoadData(this.StorageName, Callback);
        };
        PPCache.prototype.SaveData = function (Key, Data, Callback) {
            if (Callback === void 0) { Callback = function () { }; }
            this.Driver.SaveData(this.StorageName, Key, {
                Time: new Date,
                Key: Key,
                Cache: this.PagesPositionsCache,
                LastPage: this.LastPageN,
                MarginsCache: this.MarginsCache
            }, Data, Callback);
        };
        return PPCache;
    }());
    FB3PPCache.PPCache = PPCache;
})(FB3PPCache || (FB3PPCache = {}));
//# sourceMappingURL=PPCache.js.map