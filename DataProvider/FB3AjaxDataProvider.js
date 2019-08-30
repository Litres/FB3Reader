var FB3DataProvider;
(function (FB3DataProvider) {
    function zeroPad(num, places) {
        var zero = places - num.toString().length + 1;
        return Array(+(zero > 0 && zero)).join("0") + num;
    }
    FB3DataProvider.zeroPad = zeroPad;
    var AJAXDataProvider = (function () {
        function AJAXDataProvider(LitresURL, ArtID2URL, TextCacheManager) {
            this.LitresURL = LitresURL;
            this.ArtID2URL = ArtID2URL;
            this.TextCacheManager = TextCacheManager;
            this.BaseURL = LitresURL;
            this.CurrentRequestID = 0;
            this.ActiveRequests = {};
        }
        AJAXDataProvider.prototype.Request = function (URL, Callback, Progressor, CustomData, IgnoreCache) {
            var _this = this;
            if (IgnoreCache === void 0) { IgnoreCache = false; }
            if (this.TextCacheManager && !IgnoreCache) {
                this.TextCacheManager.Use(function () {
                    _this.TextCacheManager.LoadChunkData(FB3TextCache.TextCacheManager.GetStorageKey(_this.BaseURL), URL, function (data, customData) {
                        if (data) {
                            Callback(data, customData);
                        }
                        else {
                            _this.InitRequest(URL, Callback, Progressor, CustomData);
                        }
                    });
                }, function () {
                    _this.InitRequest(URL, Callback, Progressor, CustomData);
                });
                return;
            }
            if (IgnoreCache === true) {
                URL = FB3TextCache.TextCacheManager.NoCacheURL(URL);
            }
            this.InitRequest(URL, Callback, Progressor, CustomData);
        };
        AJAXDataProvider.prototype.InitRequest = function (URL, Callback, Progressor, CustomData) {
            var _this = this;
            this.CurrentRequestID++;
            this.ActiveRequests['req' + this.CurrentRequestID] = Callback;
            new AjaxLoader(URL, function (ID, URL, Data, CustomData) { return _this.CallbackWrap(ID, URL, Data, CustomData); }, function (ID, URL) { return _this.FailureCallbackWrap(ID, URL, Callback); }, Progressor, this.CurrentRequestID, CustomData, this.json_redirected);
        };
        AJAXDataProvider.prototype.CallbackWrap = function (ID, URL, Data, CustomData) {
            var _this = this;
            if (this.TextCacheManager) {
                this.TextCacheManager.Use(function () {
                    _this.TextCacheManager.SaveChunkData(FB3TextCache.TextCacheManager.GetStorageKey(_this.BaseURL), URL, Data, CustomData, function () {
                        _this.ProcessCallback(Data, CustomData);
                    });
                }, function () {
                    _this.ProcessCallback(Data, CustomData);
                });
                return;
            }
            this.ProcessCallback(Data, CustomData);
        };
        AJAXDataProvider.prototype.ProcessCallback = function (Data, CustomData) {
            var Func = this.ActiveRequests['req' + this.CurrentRequestID];
            if (Func) {
                this.ActiveRequests['req' + this.CurrentRequestID](Data, CustomData);
            }
        };
        AJAXDataProvider.prototype.FailureCallbackWrap = function (ID, URL, Callback) {
            var _this = this;
            if (this.TextCacheManager) {
                this.TextCacheManager.Use(function () {
                    _this.TextCacheManager.LoadChunkData(FB3TextCache.TextCacheManager.GetStorageKey(_this.BaseURL), URL, function (data, customData) {
                        if (data) {
                            Callback(data, customData);
                        }
                    });
                });
            }
        };
        AJAXDataProvider.prototype.Reset = function () {
            this.ActiveRequests = {};
        };
        return AJAXDataProvider;
    }());
    FB3DataProvider.AJAXDataProvider = AJAXDataProvider;
    var AjaxLoader = (function () {
        function AjaxLoader(URL, Callback, FailureCallback, Progressor, ID, CustomData, json_redirected) {
            var _this = this;
            this.URL = URL;
            this.Callback = Callback;
            this.FailureCallback = FailureCallback;
            this.Progressor = Progressor;
            this.ID = ID;
            this.CustomData = CustomData;
            this.json_redirected = json_redirected;
            this.xhrIE9 = false;
            this.Progressor.HourglassOn(this, false, 'Loading ' + this.URL);
            this.Req = this.HttpRequest();
            try {
                this.Req.addEventListener("progress", function (e) { return _this.onUpdateProgress(e); }, false);
                this.Req.addEventListener("error", function (e) { return _this.onTransferFailed(e); }, false);
                this.Req.addEventListener("abort", function (e) { return _this.onTransferAborted(e); }, false);
            }
            catch (e) {
                this.Req.onprogress = function () { };
                this.Req.onerror = function (e) { return _this.onTransferFailed(e); };
                this.Req.ontimeout = function (e) { return _this.onTransferAborted(e); };
            }
            this.Req.open('GET', this.URL, true);
            if (this.xhrIE9) {
                this.Req.timeout = 0;
                this.Req.onload = function () { return _this.onTransferIE9Complete(); };
                setTimeout(function () { return _this.Req.send(null); }, '200');
            }
            else {
                this.Req.onreadystatechange = function () { return _this.onTransferComplete(); };
                this.Req.send(null);
            }
        }
        AjaxLoader.prototype.onTransferComplete = function () {
            if (this.Req.readyState != 4) {
                this.Progressor.Tick(this);
            }
            else {
                this.Progressor.HourglassOff(this);
                if (this.Req.status == 200) {
                    this.ParseData(this.Req.responseText);
                }
                else {
                    this.FailureCallback(this.ID, this.URL);
                    this.Progressor.Alert('Failed to load "' + this.URL + '", server returned error "' + this.Req.status + '"');
                }
            }
        };
        AjaxLoader.prototype.onTransferIE9Complete = function () {
            if (this.Req.responseText && this.Req.responseText != '') {
                this.ParseData(this.Req.responseText);
            }
            else {
                this.Progressor.Alert('Failed to load "' + this.URL + '", server returned error "NO STATUS FOR IE9"');
            }
        };
        AjaxLoader.prototype.ParseData = function (Result) {
            var _this = this;
            var Data = this.parseJSON(Result);
            var URL = this.FindRedirectInJSON(Data);
            if (URL) {
                new AjaxLoader(URL, function (ID, _, Data, CustomData) { return _this.Callback(ID, _this.URL, Data, CustomData); }, this.FailureCallback, this.Progressor, this.ID, this.CustomData);
            }
            else {
                this.Callback(this.ID, this.URL, Data, this.CustomData);
            }
        };
        AjaxLoader.prototype.onUpdateProgress = function (e) {
            this.Progressor.Progress(this, e.loaded / e.total * 100);
        };
        AjaxLoader.prototype.onTransferFailed = function (e) {
            this.Progressor.HourglassOff(this);
            this.Progressor.Alert('Failed to load "' + this.URL + '"');
            this.FailureCallback(this.ID, this.URL, e);
        };
        AjaxLoader.prototype.onTransferAborted = function (e) {
            this.Progressor.HourglassOff(this);
            this.Progressor.Alert('Failed to load "' + this.URL + '" (interrupted)');
            this.FailureCallback(this.ID, this.URL, e);
        };
        AjaxLoader.prototype.HttpRequest = function () {
            var ref = null;
            if (document.all && !window.atob && window.XDomainRequest && this.json_redirected) {
                ref = new window.XDomainRequest();
                this.xhrIE9 = true;
            }
            else if (window.XMLHttpRequest) {
                ref = new XMLHttpRequest();
            }
            else if (window.ActiveXObject) {
                ref = new ActiveXObject("MSXML2.XMLHTTP.3.0");
            }
            return ref;
        };
        AjaxLoader.prototype.FindRedirectInJSON = function (data) {
            if (data && data.url) {
                return data.url;
            }
            return undefined;
        };
        AjaxLoader.prototype.parseJSON = function (data) {
            data = data.replace(/^\n/, '');
            if (data === undefined || data == '') {
                return null;
            }
            var Data = (new Function("return " + data))();
            return Data;
        };
        return AjaxLoader;
    }());
})(FB3DataProvider || (FB3DataProvider = {}));
var AjaxDataProvider;
(function (AjaxDataProvider) {
    var AjaxLoader = (function () {
        function AjaxLoader(Config) {
            this.Method = "GET";
            if (Config.Method) {
                this.Method = Config.Method;
            }
            if (Config.Data) {
                this.Data = Config.Data;
            }
            this.URL = Config.URL;
            this.ResponseType = Config.ResponseType;
            this.SuccessCallback = Config.SuccessCallback;
            this.FailureCallback = Config.FailureCallback;
        }
        AjaxLoader.prototype.PerformRequest = function () {
            var _this = this;
            var xhr = new XMLHttpRequest();
            xhr.responseType = this.ResponseType;
            xhr.open(this.Method, this.URL);
            if (!this.Data) {
                xhr.send();
            }
            else {
                xhr.send(this.Data);
            }
            xhr.onload = function (evt) {
                if (xhr.status == 200) {
                    _this.SuccessCallback(xhr.response);
                }
                else {
                    _this.FailureCallback();
                }
            };
            xhr.onerror = function (evt) {
                _this.FailureCallback();
            };
            xhr.ontimeout = function (evt) {
                _this.FailureCallback();
            };
        };
        return AjaxLoader;
    }());
    AjaxDataProvider.AjaxLoader = AjaxLoader;
})(AjaxDataProvider || (AjaxDataProvider = {}));
//# sourceMappingURL=FB3AjaxDataProvider.js.map