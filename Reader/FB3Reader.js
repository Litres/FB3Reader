/// <reference path="FB3ReaderHead.ts" />
var FB3Reader;
(function (FB3Reader) {
    var Reader = (function () {
        function Reader(Site, FB3DOM) {
            this.Site = Site;
            this.FB3DOM = FB3DOM;
            var _this = this;
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
            FB3DOM.GetHTMLAsync(true, Range, function (HTML) {
                return _this.TestDOM(HTML);
            });
        }
        Reader.prototype.TestDOM = function (HTML) {
            this.Site.Canvas.innerHTML = HTML;
        };
        Reader.prototype.GoTO = function (Bloc) {
        };
        Reader.prototype.TOC = function () {
            return this.FB3DOM.TOC;
        };
        return Reader;
    })();
    FB3Reader.Reader = Reader;    
})(FB3Reader || (FB3Reader = {}));
//@ sourceMappingURL=FB3Reader.js.map
