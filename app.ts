/// <reference path="Site/FB3ReaderSite.ts" />
/// <reference path="Reader/FB3Reader.ts" />
/// <reference path="DOM/FB3DOM.ts" />
/// <reference path="DataProvider/FB3AjaxDataProvider.ts" />
/// <reference path="Bookmarks/FB3Bookmarks.ts" />
/// <reference path="PagesPositionsCache/PPCache.ts" />
/// <reference path="Site/LocalBookmarks.ts" />

var AFB3Reader: FB3Reader.IFBReader;
var AFB3PPCache: FB3PPCache.IFB3PPCache;
var BookmarksProcessor: FB3Bookmarks.IBookmarks;
var start: number;
var LocalArtID = 11668997;
var Temp = 0;
var LitresLocalBookmarks = new LocalBookmarks.LocalBookmarksClass(LocalArtID.toString());
var aldebaran_or4 = false;

window.onload = () => {
	document.getElementById('reader').addEventListener('touchstart', TapStart, false);
	document.getElementById('reader').addEventListener('touchmove', TapMove, false);
	document.getElementById('reader').addEventListener('touchend', TapEnd, false);

	var Version = '1.2';
	var UUID = '43e7a504-33d4-4f37-b715-410342955f1f';
	var SID = GetSID();
	var Canvas = document.getElementById('reader');
	var AReaderSite = new FB3ReaderSite.ExampleSite(Canvas);
	var DataProvider = new FB3DataProvider.AJAXDataProvider(GetBaseURL(), ArtID2URL);
	AFB3PPCache = new FB3PPCache.PPCache();
	var AReaderDOM = new FB3DOM.DOM(AReaderSite, AReaderSite.Progressor, DataProvider, AFB3PPCache);
	BookmarksProcessor = new FB3Bookmarks.LitResBookmarksProcessor(
		AReaderDOM,
		SID,
		LitresLocalBookmarks.GetCurrentArtBookmarks()
	);
	BookmarksProcessor.FB3DOM.Bookmarks.push(BookmarksProcessor);
	AFB3Reader = new FB3Reader.Reader(true, AReaderSite, AReaderDOM, BookmarksProcessor, Version, AFB3PPCache);
	AFB3Reader.HyphON = !(/Android [12]\./i.test(navigator.userAgent)); // Android 2.* is unable to work with soft hyphens properly
	PrepareCSS();
	AFB3Reader.CanvasReadyCallback = function () {
		document.getElementById('REnderEnd').innerHTML = (Temp++).toString();
	}
	AFB3Reader.Init([4417]);
	// AFB3Reader.Init(LitresLocalBookmarks.GetCurrentPosition()); // start from localBookmarks
	window.addEventListener('resize', () => AFB3Reader.AfterCanvasResize());
//	ShowPosition();
	start = new Date().getTime();
	AFB3Reader.StartTime = start;
};

function ArtID2URL(Chunk?: string): string {
	var OutURL = 'DataProvider/AjaxExample/' + LocalArtID+'.';
	if (Chunk == null) {
		OutURL += 'toc.js';
	} else if (Chunk.match(/\./)) {
		OutURL += Chunk;
	} else {
		OutURL += FB3DataProvider.zeroPad(Chunk,3) + '.js';
	}
	return OutURL;
}

function GetSID(): string {
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

function GetBaseURL(): string {
	var URL = decodeURIComponent(window.location.href);
	var BaseURL = URL.match(/\bbaseurl=([0-9\/a-z\.]+)/i);
	if (BaseURL == null || !BaseURL.length) {
		return 'null';
	}
	return BaseURL[1];
}

var MarkupProgress: string;
var NativeNote: FB3Bookmarks.IBookmark;
var RoundedNote: FB3Bookmarks.IBookmark;
var DialogShown: boolean;

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

var StartElPos: FB3ReaderAbstractClasses.IPosition;
function InitNote(NoteType: string) {
	if (NoteType == 'note') {
		MarkupProgress = 'selectstart';
		NativeNote.Group = 3;
	} else {
		RoundedNote = undefined;
		UpdateRange(StartElPos, StartElPos);
		NativeNote = NativeNote.RoundClone(true);
		NativeNote.Group = 1;
		(<HTMLInputElement> document.getElementById('wholepara')).disabled = true;
		(<HTMLInputElement> document.getElementById('wholepara')).checked = true;
		AFB3Reader.Redraw();
		ShowDialog(NativeNote);
	}
	HideMenu();
}

var Coords: any = false;
function MouseMove(Evt: MouseEvent) {
	if (NativeNote && NativeNote.Group == 3 && !MenuShown && !DialogShown) {
		var X = Evt.clientX;
		var Y = Evt.clientY;
		// hack for touch-based devices
		if (!isRelativeToViewport()) X += window.pageXOffset, Y += window.pageYOffset;
		var CurrCoords = { X: X, Y: Y };
		if (Coords) {
			CurrCoords = Coords;
		}
		Coords = false;
		var CurrentElPos: FB3ReaderAbstractClasses.IPosition = AFB3Reader.ElementAtXY(CurrCoords.X, CurrCoords.Y);
		if (CurrentElPos && CurrentElPos.length && StartElPos && StartElPos.length) {
			if (FB3Reader.PosCompare(CurrentElPos, StartElPos) < 0) {
				UpdateRange(CurrentElPos, StartElPos);
			} else {
				UpdateRange(StartElPos, CurrentElPos);
			}
			// logic - remove old one, create new, add new
			var NewNote: FB3Bookmarks.IBookmark = NativeNote.RoundClone(false);
			NewNote.TemporaryState = 1;
			NativeNote.Detach();
			NativeNote = NewNote;
			BookmarksProcessor.AddBookmark(NativeNote);
			AFB3Reader.RedrawVisible();
		}
	}
}

function UpdateRange(StartPos: FB3ReaderAbstractClasses.IPosition, EndPos: FB3ReaderAbstractClasses.IPosition) {
	NativeNote.Range.From = StartPos;
	NativeNote.Range.To = EndPos;
}

function FinishNote():void {
	NativeNote.Detach();
	HideMenu();
	ShowDialog(NativeNote);
}

function CancelNote(NoDestroy: boolean) {
	if (!NoDestroy) {
		NativeNote.Detach();
	}
	MarkupProgress = undefined;
	NativeNote = undefined;
	HideMenu();
	AFB3Reader.Redraw();
}

var MenuShown: string;
function MakeNewNote() {
	if (NativeNote) {
		NativeNote.Detach();
	}
	if (!NativeNote) {
		NativeNote = new FB3Bookmarks.Bookmark(BookmarksProcessor);
	}
	NativeNote.TemporaryState = 1;
}
function ShowMenu(e: MouseEvent) {
	HideDialog();
	MakeNewNote();
	var X = e.clientX;
	var Y = e.clientY;
	// hack for touch-based devices
	if (!isRelativeToViewport()) X += window.pageXOffset, Y += window.pageYOffset;
	Coords = { X: X, Y: Y };

	StartElPos = AFB3Reader.ElementAtXY(Coords.X, Coords.Y);

	if (MarkupProgress == 'selectstart') {
		MenuShown = 'SelectEnd';
//		if (!NativeNote.ExtendToXY(X, Y, false)) {
//			return undefined;
//		}
	} else {
		MenuShown = 'SelectStart';
//		if (!NativeNote.InitFromXY(X, Y, false)) {
//			NativeNote = undefined;
//			return undefined;
//		}
	}

	var posx = X + (3 + window.pageXOffset) + 'px'; //Left Position of Mouse Pointer
	var posy = Y + (3 + window.pageYOffset) + 'px'; //Top Position of Mouse Pointer
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

var DialogBookmark: FB3Bookmarks.IBookmark;
function ShowDialog(Bookmark: FB3Bookmarks.IBookmark) {
	DialogBookmark = Bookmark;
	BookmarksProcessor.AddBookmark(DialogBookmark);
	document.getElementById('FromXPath').innerHTML = '/' + DialogBookmark.XStart.join('/');
	document.getElementById('ToXPath').innerHTML = '/' + DialogBookmark.XEnd.join('/');
	(<HTMLInputElement> document.getElementById('notetitle')).value = DialogBookmark.Title;
	(<HTMLInputElement> document.getElementById('notedescr')).value = DialogBookmark.RawText;
	(<HTMLSelectElement> document.getElementById('notetype')).value = DialogBookmark.Group.toString();
	(<HTMLSelectElement> document.getElementById('notedescr')).disabled = DialogBookmark.Group == 1 ? true : false;
	document.getElementById('sellwhole').style.display = Bookmark.ID?'none':'block';
	document.getElementById('notedialog').style.display = 'block';
	DialogShown = true;
}

function RoundNoteUp() {
	DialogBookmark.Detach();
	if ((<HTMLInputElement> document.getElementById('wholepara')).checked) {
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
	(<HTMLInputElement> document.getElementById('wholepara')).checked = false;
	(<HTMLInputElement> document.getElementById('wholepara')).disabled = false;
	DialogShown = false;
}

function ShowPosition() {
	document.getElementById('CurPos').innerHTML = AFB3Reader.CurStartPos.join('/');
	document.getElementById('CurPosPercent').innerHTML = AFB3Reader.CurPosPercent()?AFB3Reader.CurPosPercent().toFixed(2):'?';
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
	AFB3Reader.GoToPercent(parseFloat((<HTMLInputElement>document.getElementById('gotopercent')).value));
	ShowPosition();
}

function ShowTOC() {
	document.getElementById('tocdiv').innerHTML = Toc2Div(AFB3Reader.TOC());
	document.getElementById('tocdiv').style.display = "block";
}


function Toc2Div(TOCS: FB3DOM.ITOC[]): string {
	var Out = '';
	for (var J = 0; J < TOCS.length; J++) {
		var TOC = TOCS[J];
		Out += '<div class="tocitm">';
		if (TOC.bookmarks && TOC.bookmarks.g0) {
			Out += '>';
		}
		if (TOC.t) {
			Out += '<a href = "javascript:GoToc(' + TOC.s + ')" > '
			+ TOC.t + '</a>';
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

function GoToc(S: number): void {
	AFB3Reader.GoTO([S]);
	CloseBookmarksList();
}

function Bookmark2Div(Bookmark: FB3Bookmarks.IBookmark): string {
	return '<div class="bookmarkdiv"><div style="float:right"><a href="javascript:DropBookmark('
		+ Bookmark.N + ')">[X]</a></div><a href="javascript:ShowBookmark('
		+ Bookmark.N + ')">'
		+ Bookmark.Title + '</a></div>';
}

function ShowBookmark(N: number): void {
	AFB3Reader.GoTO(AFB3Reader.Bookmarks.Bookmarks[N].Range.From);
}

function ManageBookmarks(): void {
	document.getElementById('bookmarksmandiv').style.display = "block";
	var Bookmarks = '';
	for (var J = 1; J < AFB3Reader.Bookmarks.Bookmarks.length; J++) {
		Bookmarks += Bookmark2Div(AFB3Reader.Bookmarks.Bookmarks[J]);
	}
	document.getElementById('bookmarkslist').innerHTML = Bookmarks;

}

function CloseBookmarksList(): void {
	document.getElementById('tocdiv').style.display = "none";
	document.getElementById('bookmarksmandiv').style.display = "none";
}

function DropBookmark(I: number): void {
	AFB3Reader.Bookmarks.Bookmarks[I].Detach();
	ManageBookmarks();
	AFB3Reader.Redraw();
}

function Save() {
	console.log('save button clicked');
	LitresLocalBookmarks.StoreBookmarks(BookmarksProcessor.MakeStoreXML());
	BookmarksProcessor.Store();
}
function Load() {
	console.log('load button clicked');
	BookmarksProcessor.ReLoad();
}

function RefreshVisible() {
	AFB3Reader.RedrawVisible();
}

function ClearCache() {
	if (FB3PPCache.CheckStorageAvail()) {
		localStorage.clear();
	}
	RefreshVisible();
}

function PrepareCSS() {
	var Columns = parseInt((<HTMLSelectElement> document.getElementById('columns')).value);
	var Spacing = (<HTMLSelectElement> document.getElementById('spacing')).value;
	var FontFace = (<HTMLSelectElement> document.getElementById('fontface')).value;

	var FontSize = (<HTMLSelectElement> document.getElementById('fontsize')).value;
	var Colors = (<HTMLSelectElement> document.getElementById('Colors')).value.split('/');

	// Colors does not mater for page size, AFB3Reader.NColumns already used internally
	AFB3Reader.Site.Key = Spacing + ':' + FontFace + ':' + FontSize;

	AFB3Reader.NColumns = Columns;
	changecss('#FB3ReaderHostDiv', 'line-height', Spacing);
	changecss('#FB3ReaderHostDiv', 'font-family', FontFace);
	changecss('#FB3ReaderHostDiv', 'font-size', FontSize + 'px');
	changecss('#FB3ReaderHostDiv','background-color',Colors[0]);
	changecss('#FB3ReaderHostDiv','color',Colors[1]);
}

function ApplyStyle() {
	PrepareCSS();
	AFB3Reader.Reset();
}

// https://github.com/moll/js-element-from-point/blob/master/index.js
var relativeToViewport
function isRelativeToViewport() {
	if (relativeToViewport != null) return relativeToViewport

  var x = window.pageXOffset ? window.pageXOffset + window.innerWidth - 1 : 0
  var y = window.pageYOffset ? window.pageYOffset + window.innerHeight - 1 : 0
  if (!x && !y) return true

  // Test with a point larger than the viewport. If it returns an element,
  // then that means elementFromPoint takes page coordinates.
  return relativeToViewport = !document.elementFromPoint(x, y)
}

function GoXPath(NewPos: FB3ReaderAbstractClasses.IPosition): void {
	AFB3Reader.GoTO(NewPos);
}

function changecss(theClass:string, element:string, value:string) {
	//Last Updated on July 4, 2011
	//documentation for this script at
	//http://www.shawnolson.net/a/503/altering-css-class-attributes-with-javascript.html
	var cssRules;
	var doc = <any> document;

	for (var S = 0; S < doc.styleSheets.length; S++) {
		try {
			doc.styleSheets[S].insertRule(theClass + ' { ' + element + ': ' + value + '; }', doc.styleSheets[S][cssRules].length);
		} catch (err) {
			try {
				doc.styleSheets[S].addRule(theClass, element + ': ' + value + ';');
			} catch (err) {
				try {
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
				} catch (err) { }
			}
		}
	}
}

//метод для поиска элемента по координатам, если указана глубина, то возвращает количество элементов указанное в этом параметре, если нет, то возвращает все
function getListElementFromPoint(x:number,y:number,depth?:number):Array<HTMLElement> {
	var ele = document.elementFromPoint(x,y);
	if(ele.id.indexOf("wrapper") > -1 || ele.nodeName.toLowerCase() == "area" || ele.id.indexOf("empty") > -1) {
		if(document.all && !window.atob) {
			var filter = Array.prototype.filter,
			result = AFB3Reader.Site.Canvas.querySelectorAll('span, div, a, p, img'),
			elements = <any>[];
			if(!depth || depth > 1) {
				elements = filter.call( result, function( node ) {
				var pos = node.getBoundingClientRect();
					if(x > pos.left && x < pos.right && y > pos.top && y < pos.bottom) {
					return node
					}
					return null
				});


			} else {
				var sieve = Array.prototype.some;
				sieve.call(AFB3Reader.Site.Canvas.querySelectorAll('span, img'), function( node ) {
					var pos = node.getBoundingClientRect();
					if (x > pos.left && x < pos.right && y > pos.top && y < pos.bottom) {
						elements.push(node);
						return true;
					}
					return false;
				});
			}

			elements.reverse()

			return elements;
		}

		var elements = <any>[], previousPointerEvents = [], current, i, d;
		        // get all elements via elementFromPoint, and remove them from hit-testing in order
		while ((current = document.elementFromPoint(x,y)) && elements.indexOf(current)===-1 && current != null) {

	            // push the element and its current style
			elements.push(current);
			previousPointerEvents.push({
	                value: current.style.getPropertyValue('pointer-events'),
	                priority: current.style.getPropertyPriority('pointer-events')
	            });

	            // add "pointer-events: none", to get to the underlying element
			current.style.setProperty('pointer-events', 'none', 'important');
			if(depth && depth > 0 && elements.length > (depth + 1)) {
				break;
			}



		}

	        // restore the previous pointer-events values
		for(i = previousPointerEvents.length; d=previousPointerEvents[--i]; ) {
			elements[i].style.setProperty('pointer-events', d.value?d.value:'', d.priority);
		}

	        // return our results
	    if(elements.length == 0) {
	    	return null;
	    }
	    elements.shift();
	    elements.shift();
		return elements;

	}

}

