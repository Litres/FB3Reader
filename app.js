/// <reference path="Site/FB3ReaderSite.ts" />
/// <reference path="Reader/FB3Reader.ts" />
/// <reference path="DOM/FB3DOM.ts" />
/// <reference path="DataProvider/FB3AjaxDataProvider.ts" />
/// <reference path="Bookmarks/FB3Bookmarks.ts" />
/// <reference path="PagesPositionsCache/PPCache.ts" />
var AFB3Reader;
var AFB3PPCache;

window.onload = function () {
    var ArtID = '120421';
    var Canvas = document.getElementById('reader');
    var AReaderSite = new FB3ReaderSite.ExampleSite(Canvas);
    var DataProvider = new FB3DataProvider.AJAXDataProvider();
    var AReaderDOM = new FB3DOM.DOM(AReaderSite.Alert, AReaderSite.Progressor, DataProvider);
    var BookmarksProcessor = new FB3Bookmarks.LitResBookmarksProcessor(AReaderDOM);
    BookmarksProcessor.Load(ArtID);
    AFB3PPCache = new FB3PPCache.PPCache();
    AFB3Reader = new FB3Reader.Reader(ArtID, true, AReaderSite, AReaderDOM, BookmarksProcessor, AFB3PPCache);
    AFB3Reader.NColumns = 3;
    AFB3Reader.HyphON = true;
    AFB3Reader.Init();
    window.addEventListener('resize', function () {
        return AFB3Reader.AfterCanvasResize();
    });
    ShowPosition();
};

function InitNote(ExactWord, InitOnly, NoteType) {
    if (InitOnly) {
        MarkupProgress.state = 'selectstart';
    } else {
        MarkupProgress.state = undefined;
    }
    HideMenu();
}

function CancelNote() {
    MarkupProgress.state = undefined;
    HideMenu();
}

var MenuShown;
var MarkupProgress = {};
function ShowMenu(control, e) {
    if (MarkupProgress.state == 'selectstart') {
        MenuShown = 'SelectEnd';
    } else {
        MenuShown = 'SelectStart';
    }
    MarkupProgress.x = e.clientX + window.pageXOffset;
    MarkupProgress.y = e.clientY + window.pageYOffset;
    var posx = e.clientX + window.pageXOffset + 3 + 'px';
    var posy = e.clientY + window.pageYOffset + 3 + 'px';
    document.getElementById(MenuShown).style.position = 'absolute';
    document.getElementById(MenuShown).style.display = 'inline';
    document.getElementById(MenuShown).style.left = posx;
    document.getElementById(MenuShown).style.top = posy;
}
function HideMenu() {
    if (MenuShown) {
        document.getElementById(MenuShown).style.display = 'none';
        MenuShown = undefined;
    }
}

function ShowPosition() {
    document.getElementById('CurPos').innerHTML = AFB3Reader.CurStartPos.join('/');
    document.getElementById('CurPosPercent').innerHTML = AFB3Reader.CurPosPercent() ? AFB3Reader.CurPosPercent().toFixed(2) : '?';
    document.getElementById('CurPosPage').innerHTML = AFB3Reader.CurStartPage ? (AFB3Reader.CurStartPage.toFixed(0) + '/' + (AFB3PPCache.LastPage() ? AFB3PPCache.LastPage().toFixed(0) : '?')) : '?';
}
function PageForward() {
    AFB3Reader.PageForward();
    ShowPosition();
}

function Pagebackward() {
    AFB3Reader.PageBackward();
    ShowPosition();
}

function GoToPercent() {
    AFB3Reader.GoToPercent(parseFloat((document.getElementById('gotopercent')).value));
    ShowPosition();
}
//# sourceMappingURL=app.js.map
