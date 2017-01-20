/// <reference path="FB3ReaderSite.ts" />
/// <reference path="../Reader/FB3Reader.ts" />
/// <reference path="../DOM/FB3DOM.ts" />
/// <reference path="../DataProvider/FB3AjaxDataProvider.ts" />
/// <reference path="../Bookmarks/FB3Bookmarks.ts" />
/// <reference path="../PagesPositionsCache/PPCache.ts" />
/// <reference path="Settings.ts" />
/// <reference path="UrlParser.ts" />
/// <reference path="LocalBookmarks.ts" />
/// <reference path="BarClass.ts" />
/// <reference path="History.ts" />
/// <reference path="FullScreen.ts" />
/// <reference path="../../view/ts/SocialSharing.ts" />
/// <reference path="../../view/ts/BookmarksWindow.ts" />
/// <reference path="../../view/ts/HelpWindow.ts" />
/// <reference path="../../view/ts/ContentsWindow.ts" />
/// <reference path="../../view/ts/ContextMenu.ts" />
/// <reference path="../../view/ts/Selection.ts" />
/// <reference path="../../view/ts/Events.ts" />

//localStorage.clear();

//alert(navigator.userAgent);

//window.onerror = (e, url, line) => {
//	alert(e + ', ' + url + ', ' + line);
//};

module TopMenu {
	export interface ITopMenu {
		RemoveActive();
	}

	export class TopMenuClass implements ITopMenu {
		private CurrentButton: HTMLElement;
		private ActiveClass: string;
		constructor (private Owner: EventsModule.IEventActions) {
			this.AddHandlers();
			this.CurrentButton = undefined;
			this.ActiveClass = 'active';
		}
		private AddHandlers() {
			for (var j = 0; j < this.Owner.WindowsCarry.WindowsStack.length; j++) {
				var WinObj = this.Owner.WindowsCarry.WindowsStack[j];
				if (!WinObj.button.length) {
					continue;
				}
				for (var i = 0; i < WinObj.button.length; i++) {
					var _class = '.top-menu li span.' + WinObj.button[i];
					document.querySelector(_class).parentNode
						.addEventListener('click', (e) => this.ButtonClick(e), false);
				}
			}
		}
		private ButtonClick(e) {
			this.Owner.RemoveSelection(); // if we have any temporary notes, this will delete them
			var e = this.Owner.GetEvent(e);
			var ClickedButton = <HTMLElement> (e.target || e.srcElement);
			ClickedButton = this.Owner.GetElement(ClickedButton, 'li');
			if (hasClass(<HTMLElement> ClickedButton, this.ActiveClass)) {
				this.Owner.WindowsCarry.HideAllWindows(); // we clicked already opened window, just hide them all
				return;
			}
			if ((this.CurrentButton && hasClass(<HTMLElement> this.CurrentButton, this.ActiveClass)) ||
				this.Owner.ZoomObj.ShowState) {
					this.Owner.WindowsCarry.HideAllWindows(); // we have opened window or zoomIn, close all
			}
			this.CurrentButton = ClickedButton;
			addClass(<HTMLElement> this.CurrentButton, this.ActiveClass);
			this.Owner.WindowsCarry.GetWindow(this.GetIconClass(this.CurrentButton)).obj.ButtonHandler(e);
		}
		public RemoveActive() {
			if (this.CurrentButton) {
				removeClass(<HTMLElement> this.CurrentButton, this.ActiveClass);
				this.CurrentButton = undefined;
			}
		}
		private GetIconClass(Obj: HTMLElement): string {
			return (<HTMLElement> Obj.querySelector('span')).className;
		}
	}
}

var pda: EventsModule.IPDAstate = {
	state: false,
	platform: '',
	form: 'phone', // phone|tablet. default we have phone
	version: '0',
	browser: '',
	orientation: 0,
	portrait: true,
	top_hidden: false,
	pixelRatio: 1,
	currentHeight: 0
};

var win = window,
	doc = document,
	readerBox = (<HTMLElement> doc.querySelector('#reader')),
	footerBox = (<HTMLElement> doc.querySelector('#footer')),
	dotMouseClick = false;
var AppVersion = '1.1.41';

var aldebaran_or4: boolean = false; // stupid ugly workaround
if (window.location.href.match(/aldebaran|or_alt/i)) {
	aldebaran_or4 = true;
}
var AFB3Reader: FB3Reader.IFBReader;
var AFB3PPCache: FB3PPCache.IFB3PPCache;
var BookmarksProcessor: FB3Bookmarks.IBookmarks;
var start: number = 0;
var LitresURLParser = new URLparser.URLparserClass();
var LitresLocalBookmarks = new LocalBookmarks.LocalBookmarksClass(LitresURLParser.ArtID);
var LitresHistory; // need proper interface
var LitresFullScreen: FullScreenSupport.IFullScreenClass;

var EventsSupport: EventsModule.IEventActions = new EventsModule.EventActions(readerBox, footerBox);
var MouseObj: EventsModule.IMouseClickClass;

var TopMenuObj: TopMenu.ITopMenu;
var ContextObj: ContextMenu.IContextMenuClass;

var LitresBookmarksWindow: Bookmarks.IBookmarksWindow;
var LitresHelpWindow: Help.IHelpWindow;
var LitresContentsWindow: Contents.IContentsWindow;
var LitresSettingsWindow; // dummy class, need refactoring

var FacebookSharing: SocialSharing.ISocialSharingClass;
var TwitterSharing: SocialSharing.ISocialSharingClass;
var VkontakteSharing: SocialSharing.ISocialSharingClass;

var progressBar;
var fontsizeBar;
var themeBar;
var readerMarginBar;
var lineHeightBar;

var ResizeSupport = new EventsModule.ResizeClass(EventsSupport);

function addClass(obj: HTMLElement, _class: string) {
	var list = [];
	if (obj.getAttribute('class')) {
		list = obj.getAttribute('class').split(' ');
	}
	if (!list || list.length == 0) {
		return obj.setAttribute('class', _class);
	}
	for (var j = 0; j < list.length; j++) {
		if (list[j] == _class) {
			return;
		}
	}
	list.push(_class);
	obj.setAttribute('class', list.join(' '));
}
function removeClass(obj: HTMLElement, _class: string) {
	var list = [];
	if (obj.getAttribute('class')) {
		list = obj.getAttribute('class').split(' ');
	}
	if (!list || list.length == 0) {
		return;
	}
	for (var j = 0; j < list.length; j++) {
		if (list[j] == _class) {
			list.splice(j, 1);
			break;
		}
	}
	obj.setAttribute('class', list.join(' '));
}
function hasClass(obj: HTMLElement, _class: string) {
	var list = [];
	if (obj.getAttribute('class')) {
		list = obj.getAttribute('class').split(' ');
	}
	if (!list || list.length == 0) {
		return false;
	}
	for (var j = 0; j < list.length; j++) {
		if (list[j] == _class) {
			return true;
		}
	}
	return false;
}
function changeCSS(theClass: string, element: string, value: string, add?: string) {
	//Last Updated on July 4, 2011
	//documentation for this script at
	//http://www.shawnolson.net/a/503/altering-css-class-attributes-with-javascript.html
	var cssRules;
	var doc = <any> document;
	var add = add || '';
	for (var s = 0; s < doc.styleSheets.length; s++) {
		try {
			doc.styleSheets[s].insertRule(theClass + ' { ' + element + ': ' + value + '' + add + '; }',
				doc.styleSheets[s][cssRules].length);
		} catch (err) {
			try {
				doc.styleSheets[s].addRule(theClass, element + ': ' + value + '' + add + ';');
			} catch (err) {
				try {
					if (doc.styleSheets[s]['rules']) {
						cssRules = 'rules';
					} else if (doc.styleSheets[s]['cssRules']) {
						cssRules = 'cssRules';
					} else {
						//no rules found... browser unknown
					}

					for (var r = 0; r < doc.styleSheets[s][cssRules].length; r++) {
						if (doc.styleSheets[s][cssRules][r].selectorText == theClass) {
							if (doc.styleSheets[s][cssRules][r].style[element]) {
								doc.styleSheets[s][cssRules][r].style[element] = value + '' + add;
								break;
							}
						}
					}
				} catch (err) { }
			}
		}
	}
}

var relativeToViewport;
function isRelativeToViewport() {
	// https://github.com/moll/js-element-from-point/blob/master/index.js
	if (relativeToViewport != null) {
		return relativeToViewport;
	}

	var x = window.pageXOffset ? window.pageXOffset + window.innerWidth - 1 : 0;
	var y = window.pageYOffset ? window.pageYOffset + window.innerHeight - 1 : 0;
	if (!x && !y) {
		return true;
	}

	// Test with a point larger than the viewport. If it returns an element,
	// then that means elementFromPoint takes page coordinates.
	return relativeToViewport = !document.elementFromPoint(x, y);
}

/* left top flag */
var NativeNote: FB3Bookmarks.IBookmark;
var addBookmarkTouch = false; // webkit hack
var addBookmark = (<HTMLElement> doc.querySelector('#add-bookmark'));
addBookmark.addEventListener('touchstart', function () {
	// webkit browsers fire touch events at first
	addBookmarkTouch = true;
}, false);
addBookmark.addEventListener('click', BookmarkIconAction, false);
addBookmark.addEventListener('mouseenter', ToggleBookmarkIcon, false);
addBookmark.addEventListener('mouseleave', ToggleBookmarkIcon, false);
function ToggleBookmarkIcon(event) {
	if (MouseObj.CheckFirefoxTouchEvent(event) || MouseObj.CheckIETouchEvent(event) || addBookmarkTouch) {
		return;
	}
	var target = <HTMLElement> (event.target || event.srcElement);
	if (hasClass(target, 'hover')) {
		removeClass(target, 'hover');
	} else {
		addClass(target, 'hover');
	}
}
function BookmarkIconAction() {
	InitBookmark(this);
}
function InitBookmark(target?) {
	if (!EventsSupport.CheckDoubleClick()) {
		EventsSupport.SetPreventDoubleCheck();
		if (target && hasClass(target, 'clicked')) {
			var BookmarksToDelete = LitresReaderSite.GetBookmarksOnPage();
			for (var j = 0; j < BookmarksToDelete.length; j++) {
				for (var i = 0; i < BookmarksProcessor.Bookmarks.length; i++) {
					if (BookmarksToDelete[j].ID == BookmarksProcessor.Bookmarks[i].ID) {
						BookmarksProcessor.Bookmarks[i].Detach();
						break;
					}
				}
			}
			removeClass(addBookmark, 'clicked');
			ShowBookmarkTooltip('deleted');
		} else {
			if (NativeNote) {
				NativeNote.Detach();
			}
			if (!NativeNote) {
				NativeNote = new FB3Bookmarks.Bookmark(BookmarksProcessor);
			}
			var ObjectPos: FB3ReaderAbstractClasses.IPosition;
			// need fix for
			// LitresLocalBookmarks.GetCurrentPosition()
			// [71, 126]
			if (target) {
				var NoteRange = AFB3Reader.GetVisibleRange();
				if (!NoteRange) {
					NoteRange = BookmarksProcessor.Bookmarks[0].Range;
				} else if (NoteRange.From.length > 1 && NoteRange.From[0] != NoteRange.To[0]) {
					var NextEl = AFB3Reader.FB3DOM.GetElementByAddr([1 + NoteRange.From[0]]);
					if (NextEl && NextEl.TagName != 'title') {
						NoteRange.From = [1 + NoteRange.From[0]];
					}
					NoteRange.To = NoteRange.From;
				}
				ObjectPos = AFB3Reader.FB3DOM.GetElementByAddr(NoteRange.From).Position();
			} else {
				ObjectPos = AFB3Reader.ElementAtXY(ContextObj.Position.X, ContextObj.Position.Y);
			}
			if (!ObjectPos || ObjectPos.length < 1) {
				NativeNote = undefined;
				return undefined;
			}
			NativeNote.Range.From = ObjectPos.slice(0);
			NativeNote.Range.To = ObjectPos;
			NativeNote = NativeNote.RoundClone(true);
			if (target) {
				NativeNote = NoteCheckTag(NativeNote);
			}
			NativeNote.Group = 1;
			NativeNote.Title = EventsSupport.GetTitleFromTOC(NativeNote.Range).substr(0, 100);
			if (!NativeNote.Title) {
				NativeNote.Title = 'Закладка';
			}
			BookmarksProcessor.AddBookmark(NativeNote);
			NativeNote = undefined;
			addClass(addBookmark, 'clicked');
			ShowBookmarkTooltip('created');
		}
		AFB3Reader.Redraw();
		AFB3Reader.Site.StoreBookmarksHandler(200);
	}
	if (target) {
		target.blur();
	}
}
function NoteCheckTag(Note): FB3Bookmarks.IBookmark {
	var pos = Note.Range.From[0];
	while (Note.Owner.FB3DOM.Childs[pos].TagName == 'empty-line') {
		pos++;
		if (Note.Owner.FB3DOM.Childs[pos]) {
			Note.Range.From = pos.slice(0);
			Note.Range.To = pos;
		} else {
			break;
		}
	}
	return Note;
}
var HideBookmarkTooltipTimer = 0;
function ShowBookmarkTooltip(type: string) {
	ClearBookmarkTooltip();
	var Obj = <HTMLElement> document.querySelector('#bookmarkStatus');
	addClass(Obj, 'bookmark-' + type);
	EventsSupport.ZoomObj.ZoomAnything(Obj, Obj.offsetWidth, Obj.offsetHeight);
	HideBookmarkTooltip(type);
}
function ClearBookmarkTooltip() {
	clearTimeout(HideBookmarkTooltipTimer);
	var Obj = <HTMLElement> document.querySelector('#bookmarkStatus');
	Obj.className = 'tooltip bookmark-tooltips';
}
function HideBookmarkTooltip(type) {
	clearTimeout(HideBookmarkTooltipTimer);
	HideBookmarkTooltipTimer = setTimeout(() => {
		ClearBookmarkTooltip();
	}, 1000);
}

module LitresReaderSite {
	export function CheckBookmarksOnPage(Range: FB3DOM.IRange): boolean {
		if (BookmarksProcessor.GetBookmarksInRange(1, Range).length) {
			return true;
		} else {
			return false;
		}
	}
	export function GetBookmarksOnPage(): FB3Bookmarks.IBookmark[] {
		return BookmarksProcessor.GetBookmarksInRange(1);
	}
	export function HidePagerBox(): void {
		(<HTMLElement> footerBox.querySelector('.pager-box')).style.visibility = 'hidden';
		(<HTMLElement> footerBox.querySelector('#pager-max-box')).style.display = 'none';
	}
	export function HistoryAfterUpdate(): void { }
	export function HistoryAfterLast(): void { }
	export function PatchLitresLink(link): string {
		if (LitresURLParser.Lfrom) {
			link += (/\?/.test(link) ? '&' : '?') +
				'lfrom=' + LitresURLParser.Lfrom;
		}
		return link;
	}
	export class LitresSite extends FB3ReaderSite.ExampleSite {
		constructor (canvas) {
			super(canvas);
			this.Canvas = canvas;
			this.IdleThreadProgressor = new LitresCacheProgress(<HTMLElement> doc.querySelector('.cache'));
		}
		public StoreBookmarkTimer: number = 0;
		private NeedStoreBookmark: boolean; // after Maratory save bookmarks
		public HeadersLoaded(Meta: FB3DOM.IMetaData) {
			var Author = Meta.Authors[0].First + ' ' + Meta.Authors[0].Last;
			var Title = Meta.Title;
			doc.title = Author + ' - ' + Title;
			(<HTMLElement> footerBox.querySelector('#author')).innerHTML = Title;
			if (LitresURLParser.Iframe) {
				var BookName = <HTMLElement> doc.querySelector('#bookName');
				BookName.innerHTML = '&laquo;' + Title + '&raquo;';
				BookName.setAttribute('href', LitresReaderSite.PatchLitresLink('/' + LitresURLParser.ArtID));
				(<HTMLElement> doc.querySelector('#bookAuthor')).innerHTML = Author;
			}
			setTimeout(() => {
				this.CanStoreBookmark = true;
				if (this.NeedStoreBookmark)
					this.StoreBookmarksHandler(2000);
				this.NeedStoreBookmark = false;
			}, 8000);
		}
		public AfterTurnPageDone(Data: FB3ReaderSite.ITurnPageData) {
			if (Data.TurnByProgressBar) {
				EventsSupport.ChapterObj.ShowWindow(BookmarksProcessor.Bookmarks[0].Range);
			}
			this.UpdateCurPage(Data);
//			console.log('from core ' + Data.Percent);
			progressBar.setValue(Data.Percent);
			LitresLocalBookmarks.SetCurrentPosition(Data.Pos);
			LitresLocalBookmarks.SetCurrentDateTime(BookmarksProcessor.Bookmarks[0].DateTime);
			if (pda.state && getSetting('pda_fullscreen') && pda.top_hidden) {
				LitresFullScreen.showHiddenElements();
			}
			this.StoreBookmarksHandler();
//			this.SetScrollableNote();
		}
		public BookCacheDone(Data: FB3ReaderSite.ITurnPageData) {
			this.UpdateCurPage(Data);
		}
		private UpdateCurPage(Data: FB3ReaderSite.ITurnPageData) {
			if (Data.CurPage === undefined) {
				LitresReaderSite.HidePagerBox();
				return;
			}
			var maxPage: number = Data.MaxPage ? parseInt(Data.MaxPage.toFixed(0)) : 0;
			var CurPage: number = (Data.CurPage + 1) >= maxPage && maxPage ? maxPage : (Data.CurPage + 1);
			(<HTMLElement> footerBox.querySelector('#pager-current')).innerHTML = CurPage.toString();
			(<HTMLElement> footerBox.querySelector('.pager-box')).style.visibility = 'visible';
			if (maxPage) {
				(<HTMLElement> footerBox.querySelector('#pager-max')).innerHTML = maxPage.toString();
				(<HTMLElement> footerBox.querySelector('#pager-max-box')).style.display = 'inline';
			}
		}
		public StoreBookmarksHandler(timer: number = 10000) {
			BookmarksProcessor.MakeStoreXMLAsync((XML) => {
				if (XML) LitresLocalBookmarks.StoreBookmarks(XML);
			});
			if (!this.CanStoreBookmark) {
				this.NeedStoreBookmark = true;
				return;
			}
			if (this.StoreBookmarkTimer) {
				clearTimeout(this.StoreBookmarkTimer);
			}
			this.StoreBookmarkTimer = setTimeout(() => {
				BookmarksProcessor.Store();
			}, timer);
		}
		public BeforeBookmarksAction(): boolean {
			if (LitresURLParser.User) return true;
			return false;
		}
		public AfterStoreBookmarks(): void {
			this.CanStoreBookmark = true;
		}
		public ZoomImg(obj): void {
			EventsSupport.ZoomObj.ZoomIMG(
				obj.getAttribute('data-path'),
				obj.getAttribute('data-w'),
				obj.getAttribute('data-h')
			);
		}
		public ZoomHTML(HTML: FB3DOM.InnerHTML): void {
			EventsSupport.ZoomObj.ZoomHTML(HTML);
		}
		public HistoryHandler(Pos: FB3DOM.IXPath): void {
			LitresHistory.push(Pos);
		}
//		public PatchNoteNode(Node: HTMLElement): HTMLElement {
//			addClass(Node, 'scrollableNote');
//			return Node;
//		}
		private SetScrollableNote() {
			var Reader = AFB3Reader;
			for (var I = Reader.CurVisiblePage; I < Reader.CurVisiblePage + Reader.NColumns; I++) {
				var items = (<any> Reader).Pages[I].ParentElement.querySelectorAll('.scrollableNote');
				for (var J = 0; J < items.length; J++) {
					var scroll = new scrollbar(items[J], {});
				}
			}
		}
		public showTrialEnd(ID: string): string {
			if (LitresURLParser.PartID == 458582) {
				return '';
			}
			var text = 'Вы прочитали ознакомительный отрывок. ' +
				'Если книга вам понравилась, вы можете купить полную версию книги и продолжить чтение.';
			var buttonText = 'Купить и читать книгу';
			if (LitresURLParser.FreeBook) {
				text = 'Вы прочитали ознакомительный отрывок. Если книга вам понравилась, ' +
					'вы можете взять полную версию книги и продолжить чтение.';
				buttonText = 'Взять себе';
			} else if (LitresURLParser.Biblio) {
				text = 'Вы прочитали ознакомительный отрывок. Если книга вам понравилась, ' +
					'вы можете запросить у библиотекаря полную версию книги и продолжить чтение.';
                buttonText = 'Запросить у библиотекаря';
            } else if (LitresURLParser.RequestUser) {
                text = 'Вы запросили книгу в библиотеке.' +
                    'Ожидайте решение библиотекаря.';
                buttonText = 'Отменить запрос';
            } else if (LitresURLParser.SelfBiblio) {
                text = 'Вы прочитали ознакомительный отрывок. Если книга вам понравилась, ' +
                    'вы можете взять полную версию книги и продолжить чтение.';
                buttonText = 'Взять в библиотеке';
            } else if (LitresURLParser.Librarian) {
                text = 'Вы прочитали ознакомительный отрывок и можете выдать книгу читателю.';
                buttonText = 'Выдать книгу читателю';
            }
			return '<hr class="tag_empty-line" id="' + ID + '_0"/>' +
				'<div id="' + ID + '_1">' +
					'<p id="' + ID + '_1_0">' + text + '</p>' +
					'<hr class="tag_empty-line" id="' + ID + '_1_1"/>' +
					'<a id="' + ID + '_1_2" href="" class="litreslink noload trial-button">' + buttonText + '</a>' +
				'</div>';
		}
		public addTrialHandlers(): void {
			var TrialButton = <HTMLElement> document.querySelector('.trial-button');
			if (TrialButton) {
				var trial_url = 'https://www.litres.ru/' + LitresURLParser.ArtID;
				TrialButton.setAttribute('href', LitresReaderSite.PatchLitresLink(trial_url));
				if (LitresURLParser.Iframe) {
					TrialButton.setAttribute('target', '_blank');
				} else {
					TrialButton.addEventListener('click', () => {
						if (LitresFullScreen.fullScreen) {
							LitresFullScreen.ButtonHandler();
						}
					}, false);
					LitRes.Widget.Start(); // omg this workaround
				}
			}
		}
	}
	class LitresCacheProgress implements FB3ReaderSite.ILoadProgress {
		public Progresses: any;
		// dummy class for progressbar only
		constructor (private Obj: HTMLElement) {
			this.Progresses = {};
		}
		public Progress(Owner: any, Progress: number): void {
			this.Progresses[Owner] = Progress;
			var N = 0;
			var OverallProgress = 0;
			for (var ProgressInst in this.Progresses) {
				N++;
				OverallProgress = this.Progresses[ProgressInst];
			}
			OverallProgress = OverallProgress / N;
			OverallProgress = <any> OverallProgress.toFixed(1);
			// console.log(OverallProgress);
			if (OverallProgress >= 100) {
				this.Obj.style.display = 'none';
			} else {
				this.Obj.style.display = 'block';
			}
			this.Obj.style.width = OverallProgress + '%';
		}
		public HourglassOn(Owner: any, LockUI?: boolean, Message?: string): void {}
		public HourglassOff(Owner: any): void {}
		public Alert(Message: string): void {}
		public Tick(Owner: any): void {
			if (!this.Progresses[Owner]) {
				this.Progresses[Owner] = 1;
			} else if (this.Progresses[Owner] < 99) {
				this.Progresses[Owner] += 1;
			}
			this.Progress(Owner, this.Progresses[Owner]);
		}
	}
}

function initEngine(Callback?) {
	var Canvas = document.getElementById('reader');
	var AReaderSite = new LitresReaderSite.LitresSite(Canvas);
	AFB3PPCache = new FB3PPCache.PPCache();
	var DataProvider = new FB3DataProvider.AJAXDataProvider(LitresURLParser.BaseURL, LitresURLParser.ArtID2URL);
	var AReaderDOM = new FB3DOM.DOM(AReaderSite,
		AReaderSite.Progressor,
		DataProvider,
		AFB3PPCache);
	BookmarksProcessor = new FB3Bookmarks.LitResBookmarksProcessor(
		AReaderDOM,
		LitresURLParser.UUID,
		LitresURLParser.SID,
		LitresLocalBookmarks.GetCurrentArtBookmarks());
	BookmarksProcessor.aldebaran = aldebaran_or4;
	BookmarksProcessor.FB3DOM.Bookmarks.push(BookmarksProcessor);
	BookmarksProcessor.ReadyCallback = function (): void {
		var Range = AFB3Reader.GetVisibleRange();
		AFB3Reader.CanvasReadyCallback(Range);
		BookmarksProcessor.ReadyCallback = undefined;
	};
	AFB3Reader = new FB3Reader.Reader(LitresURLParser.UUID,
		true,
		AReaderSite,
		AReaderDOM,
		BookmarksProcessor,
		AppVersion,
		AFB3PPCache);
	EventsSupport.Reader = AFB3Reader;
	EventsSupport.Bookmarks = BookmarksProcessor;
	AFB3Reader.CanvasReadyCallback = function (Range) {
		if (LitresReaderSite.CheckBookmarksOnPage(Range)) {
			addClass(addBookmark, 'clicked');
		} else {
			removeClass(addBookmark, 'clicked');
		}
	};
	LitresHistory = new WebHistory.HistoryClass(AFB3Reader);
	if (Callback) Callback();
	if (AFB3Reader.HyphON) { // Android 2.* is unable to work with soft hyphens properly
		AFB3Reader.HyphON = !(/Android [12]\./i.test(navigator.userAgent));
	}
	AFB3Reader.Init(LitresLocalBookmarks.GetCurrentPosition(), LitresLocalBookmarks.GetCurrentDateTime());
	window.addEventListener('resize', () => AFB3Reader.AfterCanvasResize());

	// social and windows
	FacebookSharing = new SocialSharing.FacebookSharing(
		LitresURLParser.ArtID,
		EventsSupport,
		LitresURLParser.FileID,
		<HTMLElement> doc.querySelector('#facebook .share-button')
	);
	TwitterSharing = new SocialSharing.TwitterSharing(
		LitresURLParser.ArtID,
		EventsSupport,
		LitresURLParser.FileID,
		false
	);
	VkontakteSharing = new SocialSharing.VkontakteSharing(
		LitresURLParser.ArtID,
		EventsSupport,
		LitresURLParser.FileID,
		false
	);
	LitresBookmarksWindow = new Bookmarks.BookmarksWindow(
		<HTMLElement> doc.querySelector('#bookmarks'),
		EventsSupport
	);
	LitresHelpWindow = new Help.HelpWindow(
		<HTMLElement> doc.querySelector('#tip'),
		EventsSupport
	);
	LitresContentsWindow = new Contents.ContentsWindow(
		<HTMLElement> doc.querySelector('#contents'),
		EventsSupport
	);
	LitresSettingsWindow = new Settings.SettingsWindow(
		<HTMLElement> doc.querySelector('#settings'),
		EventsSupport
	);
	TopMenuObj = new TopMenu.TopMenuClass(EventsSupport);

	if (LitresURLParser.Modal) {
		var CloseButton = <HTMLElement> document.querySelector('.menu-close').parentNode;
		CloseButton.removeAttribute('style');
		CloseButton.addEventListener('click', () => {
			if (LitresFullScreen.fullScreen) {
				LitresFullScreen.ButtonHandler();
			}
			AFB3Reader.Destroy = true;
			(<any> window.parent).CloseReadFrame();
		}, false);
		(<HTMLElement> document.querySelector('#author')).style.display = 'none';
		(<HTMLElement> document.querySelector('.pager-box')).style.textAlign = 'center';
	}
	start = new Date().getTime();
}
var LitRes = LitRes || {};
function setTrialLink() {
	var buyButton = (<HTMLElement> doc.querySelector('#buy-book'));
	if (LitresURLParser.PartID == 723763) {
		updateTrialButton(buyButton, 'Купить', 'Купите книгу и читайте полную версию.');
	} else if (LitresURLParser.FreeBook) {
		updateTrialButton(buyButton, 'Взять себе', 'Возьмите книгу и читайте полную версию.');
	} else if (LitresURLParser.Librarian) {
        updateTrialButton(buyButton, 'Выдать книгу читателю', '');
    } else if (LitresURLParser.Biblio) {
        updateTrialButton(buyButton, 'Запросить', 'Запросите книгу в библиотеке и читайте полную версию.');
    } else if (LitresURLParser.RequestUser) {
        updateTrialButton(buyButton, 'Отменить', 'Вы запросили книгу в библиотеке. Ожидайте решение библиотекаря.');
    } else if (LitresURLParser.SelfBiblio) {
        updateTrialButton(buyButton, 'Взять себе', 'Возьмите книгу и читайте полную версию.');
    } 
	if (LitresURLParser.Iframe) {
		buyButton.setAttribute('target', '_blank');
	}
	var trial_url = 'https://www.litres.ru/' + LitresURLParser.ArtID;
	buyButton.setAttribute('href', LitresReaderSite.PatchLitresLink(trial_url));
}
function updateTrialButton(button: HTMLElement, value: string, text: string) {
	if (button.textContent) {
        button.textContent = value;        
		button.previousElementSibling.textContent = text;
	} else {
		button.innerHTML = value; // for IE 8 and below
		(<HTMLElement> button.previousElementSibling).innerHTML = text;
    }
    if (LitresURLParser.RequestUser) {
        var buyBoxTxt = (<HTMLElement>doc.querySelector('.buy-box-txt'));
        buyBoxTxt.textContent = '';
        buyBoxTxt.style.marginLeft = '0';
    }
}
function startView(): void {
	document.onselectstart = function () { return false; }
	if (LitresURLParser.Modal) {
		addClass(document.body, 'modal');
		window.focus();
	}
	if (LitresURLParser.PartID != 458582) {
		if (!aldebaran_or4 && !LitresURLParser.Modal) {
			var obj = doc.querySelector('.logo');
			obj.setAttribute('href', LitresReaderSite.PatchLitresLink('/' + LitresURLParser.ArtID));
			if (LitresURLParser.Iframe) {
				obj.setAttribute('target', '_blank');
				addClass(<HTMLElement> doc.querySelector('#partnerLine'), 'active');
			}
		}
		if (LitresURLParser.Trial) {
			if (!aldebaran_or4 && !LitresURLParser.Modal && !LitresURLParser.Iframe) {
				(<HTMLElement> doc.querySelector('.buy-box')).style.display = 'block';
				changeCSS('#settings', 'top', '-34px');
			}
			if (LitresURLParser.Iframe) {
				var obj = doc.querySelector('#partnersBuy');
				obj.setAttribute('href', LitresReaderSite.PatchLitresLink('/' + LitresURLParser.ArtID));
			} else {
				LitRes.Setup = { or4: true };
				if (LitresURLParser.PartID == 723763) {
					LitRes.Setup.width = '712px';
					LitRes.Setup.height = '650px';
				}
				if (LitresURLParser.Lfrom) {
					LitRes.Setup.lfrom = LitresURLParser.Lfrom;
				}

				(function () {
					var s = document.createElement('script');
					s.type = 'text/javascript';
					s.async = true;
					s.src = '//www.litres.ru/static/new/widget/js/widget.js?r=' + AppVersion;
					var x = document.getElementsByTagName('script')[0];
					x.parentNode.insertBefore(s, x);
				})();
			}
			setTrialLink();

		}
	} else {
		(<HTMLElement> doc.querySelector('.top-box')).style.display = 'none';
	}
	if (win.devicePixelRatio) {
		pda.pixelRatio = win.devicePixelRatio;
	}
	checkPDAstate();

	EventsSupport.PDA = pda;

	MouseObj = new EventsModule.MouseClickClass(EventsSupport);
	if (LitresURLParser.PartID != 458582) {
		EventsSupport.SelectionObj = new SelectionModule.SelectionClass(
			(e) => MouseObj.OnClickHandler(e, 'click'),
			EventsSupport
		);
	}

	checkFonts();
	loadSettings();
	if (LitresURLParser.PartID == 458582 && !pda.state) {
		// useless workaround
		EventsSupport.ReaderBox.addEventListener('mouseup', (e) => MouseObj.OnClickHandler(e, 'click'), false);
		setSetting(1, 'enableClick');
		MouseObj.RemoveHandlers();
	}
	checkOperaPrestoClick();
	applySettings();
	calcHeight();
	if (pda.state) {
		FB3PPCache.MaxCacheRecords = 5;		// Локалсторадж маленький и работает медленно, ограничим свои аппетиты
		FB3ReaderPage.PrerenderBlocks = 3;	// Для построения страницы сколько блоков нам пригодится? Страница маленькая, хватит 3-х
		LitresFullScreen = new FullScreenSupport.PDAFullScreenClass(
			(state: boolean) => {
				// TODO: little ugly code
				var obj = <HTMLElement> doc.body;
				if (state) {
					if (!LitresURLParser.Trial) {
						addClass(obj, 'pda-top-hidden');
					}
					addClass(obj, 'pda-top-absolute');
				} else {
					if (!LitresURLParser.Trial) {
						removeClass(obj, 'pda-top-hidden');
					}
					removeClass(obj, 'pda-top-absolute');
				}
				setSetting(state, 'pda_fullscreen');
				calcHeight(true);
			},
			(state: boolean) => {
				pda.top_hidden = state;
			},
			EventsSupport
		);
		if (getSetting('pda_fullscreen')) {
			LitresFullScreen.ButtonHandler();
		}
		if (LitresURLParser.Trial) {
			changeCSS('#settings', 'top', '0px');
		}
	} else {
		LitresFullScreen = new FullScreenSupport.FullScreenClass(
			() => TopMenuObj.RemoveActive(),
			footerBox,
			EventsSupport
		);
	}

	progressBar = new BarClassRe.BarClass(
		'progress',
		'#footer .progressbar',
		pda.state,
		(val, type) => {
			// console.log(type);
			// console.log('to core ' + val);
			if (type == 'action_move' || type == 'action_start') {
				EventsSupport.ChapterObj.ClearWindow();
			}
			if (type != 'action_end_doc') {
				AFB3Reader.GoToPercent(val, true);
			}
			if (type == 'action_end' || type == 'action_click' || type == 'action_end_doc') {
				EventsSupport.ChapterObj.HideWindowTimer();
			}
		}
	);
	// progressBar.setValue(50);
	fontsizeBar = new BarClassRe.BarClass(
		'setting',
		'#fontsize-box .progressbar',
		pda.state,
		changeFontSizeHandler,
		false,
		fontSizeArray,
		getSetting('fontSize')
	);
	themeBar = new BarClassRe.BarClass(
		'setting',
		'#theme-box .progressbar',
		pda.state,
		changeThemeHandler,
		false,
		[1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
		getSetting('theme')
	);
	readerMarginBar = new BarClassRe.BarClass(
		'setting',
		'#reader-margin .progressbar',
		pda.state,
		changeReaderMarginHandler,
		false,
		marginList,
		getSetting('readerMargin'),
		true,
		true
	);
	lineHeightBar = new BarClassRe.BarClass(
		'setting',
		'#line-height .progressbar',
		pda.state,
		changeLineHeightHandler,
		false,
		lineHeightList,
		getSetting('lineHeight'),
		true,
		true
	);

	initEngine(beforeInitApplySetting);

	ContextObj = new ContextMenu.ContextMenuClass(EventsSupport);
	EventsSupport.AddNavArrows();

	if (!aldebaran_or4 && pda.platform == '') {
		var MouseWheelSupport = new EventsModule.MouseWheelClass(EventsSupport);
	}
	var KeydownSupport = new EventsModule.KeydownClass(EventsSupport);
	setSettingsEvents();
}
startView();