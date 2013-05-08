/// <reference path="Site/FB3ReaderSite.ts" />
/// <reference path="Reader/FB3Reader.ts" />
/// <reference path="DOM/FB3DOM.ts" />
/// <reference path="DataProvider/FB3AjaxDataProvider.ts" />
window.onload = function () {
    var Canvas = document.getElementById('reader');
    var AReaderSite = new FB3ReaderSite.ExampleSite(Canvas);
    var DataProvider = new FB3DataProvider.AJAXDataProvider();
    var AReaderDOM = new FB3DOM.DOM(AReaderSite.Alert, AReaderSite.Progressor, DataProvider);
    var AFB3Reader;
    AReaderDOM.Init(true, '/DataProvider/AjaxExample/120421.toc.js', function (FB3DOM) {
        AFB3Reader = new FB3Reader.Reader(AReaderSite, FB3DOM);
    });
};
//@ sourceMappingURL=app.js.map
