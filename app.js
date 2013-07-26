/// <reference path="Site/FB3ReaderSite.ts" />
/// <reference path="Reader/FB3Reader.ts" />
/// <reference path="DOM/FB3DOM.ts" />
/// <reference path="DataProvider/FB3AjaxDataProvider.ts" />
/// <reference path="Bookmarks/FB3Bookmarks.ts" />
var AFB3Reader;
window.onload = function () {
    var ArtID = '120421';
    var Canvas = document.getElementById('reader');
    var AReaderSite = new FB3ReaderSite.ExampleSite(Canvas);
    var DataProvider = new FB3DataProvider.AJAXDataProvider();
    var AReaderDOM = new FB3DOM.DOM(AReaderSite.Alert, AReaderSite.Progressor, DataProvider);
    var BookmarksProcessor = new FB3Bookmarks.LitResBookmarksProcessor(AReaderDOM);
    BookmarksProcessor.Load(ArtID);
    AFB3Reader = new FB3Reader.Reader(ArtID, AReaderSite, AReaderDOM, BookmarksProcessor);
    AFB3Reader.NColumns = 2;
    AFB3Reader.HyphON = true;
    AFB3Reader.Init();
    window.addEventListener('resize', function () {
        return AFB3Reader.AfterCanvasResize();
    });
};
//@ sourceMappingURL=app.js.map
