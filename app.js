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
var LocalArtID = 120421;

window.onload = function () {
    document.getElementById('reader').addEventListener('touchstart', TapStart, false);
    document.getElementById('reader').addEventListener('touchmove', TapMove, false);
    document.getElementById('reader').addEventListener('touchend', TapEnd, false);

    //	var ArtID = '178297';
    var UUID = '65830123-26b8-4b07-8098-c18229e5026e';
    var SID = GetSID();
    var Canvas = document.getElementById('reader');
    var AReaderSite = new FB3ReaderSite.ExampleSite(Canvas);
    var DataProvider = new FB3DataProvider.AJAXDataProvider(GetBaseURL(), ArtID2URL);
    var AReaderDOM = new FB3DOM.DOM(AReaderSite.Alert, AReaderSite.Progressor, DataProvider);
    BookmarksProcessor = new FB3Bookmarks.LitResBookmarksProcessor(AReaderDOM, SID);
    AFB3PPCache = new FB3PPCache.PPCache();
    AFB3Reader = new FB3Reader.Reader(UUID, true, AReaderSite, AReaderDOM, BookmarksProcessor, AFB3PPCache);
    AFB3Reader.HyphON = !(/Android [12]\./i.test(navigator.userAgent)); // Android 2.* is unable to work with soft hyphens properly
    PrepareCSS();
    AFB3Reader.Init([0]);
    window.addEventListener('resize', function () {
        return AFB3Reader.AfterCanvasResize();
    });

    //	ShowPosition();
    start = new Date().getTime();
};

function ArtID2URL(ArtID, Chunk) {
    var OutURL = '/DataProvider/AjaxExample/' + LocalArtID + '.';
    if (Chunk == null) {
        OutURL += 'toc.js';
    } else if (Chunk.match(/\./)) {
        OutURL += Chunk;
    } else {
        OutURL += this.zeroPad(Chunk, 3) + '.js?rand=' + Math.random();
    }
    return OutURL;
}

function GetSID() {
    var URL = decodeURIComponent(window.location.href);
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

function GetBaseURL() {
    var URL = decodeURIComponent(window.location.href);
    var BaseURL = URL.match(/\bbaseurl=([0-9\/a-z\.]+)/i);
    if (BaseURL == null || !BaseURL.length) {
        return 'null';
    }
    return BaseURL[1];
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
        var X = Evt.clientX;
        var Y = Evt.clientY;

        // hack for touch-based devices
        if (!isRelativeToViewport())
            X += window.pageXOffset, Y += window.pageYOffset;

        if (!newNote.ExtendToXY(X, Y)) {
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

    // hack for touch-based devices
    if (!isRelativeToViewport())
        X += window.pageXOffset, Y += window.pageYOffset;

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

function PrepareCSS() {
    var Columns = parseInt(document.getElementById('columns').value);
    var Spacing = document.getElementById('spacing').value;
    var FontFace = document.getElementById('fontface').value;

    var FontSize = document.getElementById('fontsize').value;
    var Colors = document.getElementById('Colors').value.split('/');

    // Colors does not mater for page size, AFB3Reader.NColumns already used internally
    AFB3Reader.Site.Key = Spacing + ':' + FontFace + ':' + FontSize;

    AFB3Reader.NColumns = Columns;
    changecss('#FB3ReaderHostDiv', 'line-height', Spacing);
    changecss('#FB3ReaderHostDiv', 'font-family', FontFace);
    changecss('#FB3ReaderHostDiv', 'font-size', FontSize + 'px');
    changecss('#FB3ReaderHostDiv', 'background-color', Colors[0]);
    changecss('#FB3ReaderHostDiv', 'color', Colors[1]);
}

function ApplyStyle() {
    PrepareCSS();
    AFB3Reader.Reset();
}

// https://github.com/moll/js-element-from-point/blob/master/index.js
var relativeToViewport;
function isRelativeToViewport() {
    if (relativeToViewport != null)
        return relativeToViewport;

    var x = window.pageXOffset ? window.pageXOffset + window.innerWidth - 1 : 0;
    var y = window.pageYOffset ? window.pageYOffset + window.innerHeight - 1 : 0;
    if (!x && !y)
        return true;

    // Test with a point larger than the viewport. If it returns an element,
    // then that means elementFromPoint takes page coordinates.
    return relativeToViewport = !document.elementFromPoint(x, y);
}

function changecss(theClass, element, value) {
    //Last Updated on July 4, 2011
    //documentation for this script at
    //http://www.shawnolson.net/a/503/altering-css-class-attributes-with-javascript.html
    var cssRules;
    var doc = document;

    for (var S = 0; S < doc.styleSheets.length; S++) {
        try  {
            doc.styleSheets[S].insertRule(theClass + ' { ' + element + ': ' + value + '; }', doc.styleSheets[S][cssRules].length);
        } catch (err) {
            try  {
                doc.styleSheets[S].addRule(theClass, element + ': ' + value + ';');
            } catch (err) {
                try  {
                    if (doc.styleSheets[S]['rules']) {
                        cssRules = 'rules';
                    } else if (doc.styleSheets[S]['cssRules']) {
                        cssRules = 'cssRules';
                    } else {
                        //no rules found... browser unknown
                    }

                    for (var R = 0; R < doc.styleSheets[S][cssRules].length; R++) {
                        if (doc.styleSheets[S][cssRules][R].selectorText == theClass) {
                            if (doc.styleSheets[S][cssRules][R].style[element]) {
                                doc.styleSheets[S][cssRules][R].style[element] = value;
                                break;
                            }
                        }
                    }
                } catch (err) {
                }
            }
        }
    }
}
//# sourceMappingURL=app.js.map
