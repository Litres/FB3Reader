/// <reference path="FB3BookmarksHead.ts" />
var FB3Bookmarks;
(function (FB3Bookmarks) {
    var LitResBookmarksProcessor = (function () {
        function LitResBookmarksProcessor(FB3DOM) {
            this.FB3DOM = FB3DOM;
            this.Ready = false;
        }
        LitResBookmarksProcessor.prototype.Load = function (ArtID, Callback) {
        };
        LitResBookmarksProcessor.prototype.Store = function () {
        };
        return LitResBookmarksProcessor;
    })();
    FB3Bookmarks.LitResBookmarksProcessor = LitResBookmarksProcessor;    
})(FB3Bookmarks || (FB3Bookmarks = {}));
//@ sourceMappingURL=FB3Bookmarks.js.map
