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
    var BookmarksProcessor = new FB3Bookmarks.LitResBookmarksProcessor();
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

//Тык
//	Если тык на закладку
//		ищем элемент и блок - элемент
//		Открываем диалог с точкой
//	Если тык на заметку
//		ищем элемент и блок - элемент
//		запоминаем найденное
//		ждем тыка "конец заметки
//	Если тык "конец заметки"
//		ищем элемент и блок - элемент
//		Открываем диалог с диапазоном
var MarkupProgress = {};

function InitNote(NoteType) {
    if (NoteType == 'note') {
        MarkupProgress.state = 'selectstart';
    } else {
        MarkupProgress.state = undefined;
        ShowDialog(true);
    }
    HideMenu();
}

function CancelNote() {
    MarkupProgress.state = undefined;
    HideMenu();
}

var MenuShown;
function ShowMenu(control, e) {
    HideDialog();
    if (MarkupProgress.state == 'selectstart') {
        MenuShown = 'SelectEnd';
    } else {
        MenuShown = 'SelectStart';
    }
    MarkupProgress.start = { x: e.clientX + window.pageXOffset, y: e.clientY + window.pageYOffset };
    var posx = MarkupProgress.start.x + 3 + 'px';
    var posy = MarkupProgress.start.y + 3 + 'px';
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

function HideAll() {
    HideMenu();
    HideDialog();
}

function ShowDialog(Bookmark) {
    document.getElementById('notedialog').style.display = 'block';
}

function HideDialog() {
    document.getElementById('notedialog').style.display = 'none';
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
