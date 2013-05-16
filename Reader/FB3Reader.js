/// <reference path="FB3ReaderHead.ts" />
var FB3Reader;
(function (FB3Reader) {
    var Reader = (function () {
        function Reader(ArtID, Site, FB3DOM, Bookmarks) {
            this.ArtID = ArtID;
            this.Site = Site;
            this.FB3DOM = FB3DOM;
            this.Bookmarks = Bookmarks;
            this.HyphON = true;
        }
        Reader.prototype.Init = function () {
            var _this = this;
            this.FB3DOM.Init(this.HyphON, this.ArtID, function () {
                _this.LoadDone();
            });
            this.Bookmarks.Load(this.ArtID, function () {
                _this.LoadDone();
            });
        };
        Reader.prototype.LoadDone = function () {
            var _this = this;
            if (this.FB3DOM.Ready && this.Bookmarks.Ready) {
                var Range = {
                    From: [
                        0, 
                        0, 
                        2
                    ],
                    To: [
                        4, 
                        5
                    ]
                };
                this.FB3DOM.GetHTMLAsync(true, Range, function (HTML) {
                    return _this.TestDOM(HTML);
                });
            }
        };
        Reader.prototype.TestDOM = function (HTML) {
            this.Site.Canvas.innerHTML = HTML;
        };
        Reader.prototype.GoTO = function (NewPos) {
        };
        Reader.prototype.TOC = function () {
            return this.FB3DOM.TOC;
        };
        Reader.prototype.ResetCache = function () {
        };
        Reader.prototype.GetCachedPage = function (NewPos) {
            return 0;
        };
        Reader.prototype.SearchForText = function (Text) {
            return null;
        };
        return Reader;
    })();
    FB3Reader.Reader = Reader;    
})(FB3Reader || (FB3Reader = {}));
//@ sourceMappingURL=FB3Reader.js.map
