/// <reference path="Site/FB3ReaderSite.ts" />
/// <reference path="Reader/FB3Reader.ts" />
/// <reference path="DOM/FB3DOM.ts" />
/// <reference path="DataProvider/FB3AjaxDataProvider.ts" />
/// <reference path="Bookmarks/FB3Bookmarks.ts" />
/// <reference path="PagesPositionsCache/PPCache.ts" />
var AFB3Reader;
var AFB3PPCache;
var BookmarksProcessor;
var start;

window.onload = function () {
    document.getElementById('reader').addEventListener('touchstart', TapStart, false);
    document.getElementById('reader').addEventListener('touchmove', TapMove, false);
    document.getElementById('reader').addEventListener('touchend', TapEnd, false);

    //	var ArtID = '178297';
    var ArtID = '120421';
    var SID = GetSID();
    var Canvas = document.getElementById('reader');
    var AReaderSite = new FB3ReaderSite.ExampleSite(Canvas);
    var DataProvider = new FB3DataProvider.AJAXDataProvider();
    var AReaderDOM = new FB3DOM.DOM(AReaderSite.Alert, AReaderSite.Progressor, DataProvider);
    BookmarksProcessor = new FB3Bookmarks.LitResBookmarksProcessor(AReaderDOM, SID);
    AFB3PPCache = new FB3PPCache.PPCache();
    AFB3Reader = new FB3Reader.Reader(ArtID, true, AReaderSite, AReaderDOM, BookmarksProcessor, AFB3PPCache);
    AFB3Reader.NColumns = 1;
    AFB3Reader.HyphON = !(/Android [12]\./i.test(navigator.userAgent)); // Android 2.* is unable to work with soft hyphens properly
    AFB3Reader.Init();
    window.addEventListener('resize', function () {
        return AFB3Reader.AfterCanvasResize();
    });

    //	ShowPosition();
    start = new Date().getTime();
};

function GetSID() {
    var URL = window.location.href;
    var SID = URL.match(/\bsid=([0-9a-zA-Z]+)\b/);
    if (SID == null || !SID.length) {
        var Cookies = document.cookie.match(/(?:(?:^|.*;\s*)SID\s*\=\s*([^;]*).*$)|^.*$/);
        if (!Cookies.length) {
            return 'null';
        }
        return Cookies[1];
    } else {
        return SID[1];
    }
}

var MarkupProgress;
var NativeNote;
var RoundedNote;
var DialogShown;

var TouchMoving = false;
var TouchData;
function TapStart(e) {
    //	e.preventDefault();
    TouchMoving = false;
    TouchData = e.touches[0];
}
function TapMove(e) {
    //	e.preventDefault();
    TouchMoving = true;
}
function TapEnd(e) {
    e.preventDefault();
    if (!TouchMoving) {
        if (TouchData.pageX * 1 < screen.width * 0.4) {
            Pagebackward();
        } else if (TouchData.pageX * 1 > screen.width * 0.6) {
            PageForward();
        }
        return false;
    }
}

function MouseMove(Evt) {
    if (NativeNote && !MenuShown && NativeNote.Group == 3 && !DialogShown) {
        var newNote = NativeNote.RoundClone(false);
        if (!newNote.ExtendToXY(Evt.clientX, Evt.clientY)) {
            return undefined;
        } else {
            NativeNote.Detach();
            NativeNote = newNote;
            BookmarksProcessor.AddBookmark(NativeNote);
            AFB3Reader.Redraw();
        }
    }
}

function InitNote(NoteType) {
    if (NoteType == 'note') {
        MarkupProgress = 'selectstart';
        NativeNote.Group = 3;
    } else {
        RoundedNote = undefined;
        NativeNote = NativeNote.RoundClone(true);
        NativeNote.Group = 1;
        document.getElementById('wholepara').disabled = true;
        document.getElementById('wholepara').checked = true;
        AFB3Reader.Redraw();
        ShowDialog(NativeNote);
    }
    HideMenu();
}

function FinishNote() {
    NativeNote.Detach();
    HideMenu();
    NativeNote.Group = 3;
    ShowDialog(NativeNote);
}

function CancelNote(NoDestroy) {
    if (!NoDestroy) {
        NativeNote.Detach();
    }
    MarkupProgress = undefined;
    NativeNote = undefined;
    HideMenu();
    AFB3Reader.Redraw();
}

var MenuShown;
function ShowMenu(e) {
    if (NativeNote) {
        NativeNote.Detach();
    }
    HideDialog();
    if (!NativeNote) {
        NativeNote = new FB3Bookmarks.Bookmark(BookmarksProcessor);
    }
    var X = e.clientX;
    var Y = e.clientY;
    if (MarkupProgress == 'selectstart') {
        MenuShown = 'SelectEnd';
        if (!NativeNote.ExtendToXY(X, Y)) {
            return undefined;
        } else {
            NativeNote = NativeNote.RoundClone(false);
        }
    } else {
        MenuShown = 'SelectStart';
        if (!NativeNote.InitFromXY(X, Y)) {
            NativeNote = undefined;
            return undefined;
        } else {
            NativeNote = NativeNote.RoundClone(false);
        }
    }

    var posx = X + (3 + window.pageXOffset) + 'px';
    var posy = Y + (3 + window.pageYOffset) + 'px';
    document.getElementById(MenuShown).style.position = 'absolute';
    document.getElementById(MenuShown).style.display = 'inline';
    document.getElementById(MenuShown).style.left = posx;
    document.getElementById(MenuShown).style.top = posy;
    return true;
}
function HideMenu() {
    if (MenuShown) {
        document.getElementById(MenuShown).style.display = 'none';
        MenuShown = undefined;
    }
}

function FinishAll() {
    CancelNote(true);
    HideDialog();
}

function DestroyBookmark() {
    NativeNote.Detach();
    DialogBookmark.Detach();
    FinishAll();
    AFB3Reader.Redraw();
}

function HideAll() {
    HideMenu();
    HideDialog();
}

var DialogBookmark;
function ShowDialog(Bookmark) {
    DialogBookmark = Bookmark;
    BookmarksProcessor.AddBookmark(DialogBookmark);
    document.getElementById('FromXPath').innerHTML = '/' + DialogBookmark.XStart.join('/');
    document.getElementById('ToXPath').innerHTML = '/' + DialogBookmark.XEnd.join('/');
    document.getElementById('notetitle').value = DialogBookmark.Title;
    document.getElementById('notedescr').value = DialogBookmark.RawText;
    document.getElementById('notetype').value = DialogBookmark.Group.toString();
    document.getElementById('notedescr').disabled = DialogBookmark.Group == 1 ? true : false;
    document.getElementById('sellwhole').style.display = Bookmark.ID ? 'none' : 'block';
    document.getElementById('notedialog').style.display = 'block';
    DialogShown = true;
}

function RoundNoteUp() {
    DialogBookmark.Detach();
    if (document.getElementById('wholepara').checked) {
        if (!RoundedNote) {
            RoundedNote = DialogBookmark.RoundClone(true);
        }
        ShowDialog(RoundedNote);
    } else {
        ShowDialog(NativeNote);
    }
    AFB3Reader.Redraw();
}

function HideDialog() {
    document.getElementById('notedialog').style.display = 'none';
    document.getElementById('wholepara').checked = false;
    document.getElementById('wholepara').disabled = false;
    DialogShown = false;
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
    AFB3Reader.GoToPercent(parseFloat(document.getElementById('gotopercent').value));
    ShowPosition();
}

function ShowTOC() {
    document.getElementById('tocdiv').innerHTML = Toc2Div(AFB3Reader.TOC());
    document.getElementById('tocdiv').style.display = "block";
}

function Toc2Div(TOCS) {
    var Out = '';
    for (var J = 0; J < TOCS.length; J++) {
        var TOC = TOCS[J];
        Out += '<div class="tocitm">';
        if (TOC.bookmarks && TOC.bookmarks.g0) {
            Out += '►';
        }
        if (TOC.t) {
            Out += '<a href = "javascript:GoToc(' + TOC.s + ')" > ' + TOC.t + '</a>';
        }
        if (TOC.c) {
            for (var I = 0; I < TOC.c.length; I++) {
                Out += Toc2Div([TOC.c[I]]);
            }
        }
        Out += '</div>';
    }
    return Out;
}

function GoToc(S) {
    AFB3Reader.GoTO([S]);
    CloseBookmarksList();
}

function Bookmark2Div(Bookmark) {
    return '<div class="bookmarkdiv"><div style="float:right"><a href="javascript:DropBookmark(' + Bookmark.N + ')">[X]</a></div><a href="javascript:ShowBookmark(' + Bookmark.N + ')">' + Bookmark.Title + '</a></div>';
}

function ShowBookmark(N) {
    AFB3Reader.GoTO(AFB3Reader.Bookmarks.Bookmarks[N].Range.From);
}

function ManageBookmarks() {
    document.getElementById('bookmarksmandiv').style.display = "block";
    var Bookmarks = '';
    for (var J = 1; J < AFB3Reader.Bookmarks.Bookmarks.length; J++) {
        Bookmarks += Bookmark2Div(AFB3Reader.Bookmarks.Bookmarks[J]);
    }
    document.getElementById('bookmarkslist').innerHTML = Bookmarks;
}

function CloseBookmarksList() {
    document.getElementById('tocdiv').style.display = "none";
    document.getElementById('bookmarksmandiv').style.display = "none";
}

function DropBookmark(I) {
    AFB3Reader.Bookmarks.Bookmarks[I].Detach();
    ManageBookmarks();
}

function Save() {
    console.log('save button clicked');
    BookmarksProcessor.Store();
}
function Load() {
    console.log('load button clicked');
    BookmarksProcessor.ReLoad();
}
//# sourceMappingURL=app.js.map
