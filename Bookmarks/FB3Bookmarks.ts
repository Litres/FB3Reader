/// <reference path="FB3BookmarksHead.ts" />
/// <reference path="../plugins/moment.d.ts" />

module FB3Bookmarks {

  interface iWindow extends Window {
		ActiveXObject: any;
		DOMParser: any;
	}
  declare var window: iWindow;

	interface IXMLHTTPResponseCallback { (Data: XMLDocument): void; }

	export class LitResBookmarksProcessor implements IBookmarks {
		public Ready: boolean;
		public Reader: FB3Reader.IFBReader;
		public Bookmarks: IBookmark[];
		public ClassPrefix: string;
		public LockID: string;
		public LoadDateTime: number;
		private DeletedBookmarks;
		private LoadEndCallback: IBookmarksReadyCallback;
		private TemporaryNotes: IBookmarks;
		private WaitedToRemapBookmarks: number;
		private WaitForData: boolean;
		private XMLHttp: any;
		private Host: string;
		private SID: string;
		private Callback: any;
		private SaveAuto: boolean; // save state after ReLoad
		private XMLHTTPResponseCallback: IXMLHTTPResponseCallback;
		private LocalXML: string;
		private xhrIE9: boolean;
		public aldebaran: boolean; // stupid hack
		constructor(public FB3DOM: FB3DOM.IFB3DOM, LitresSID?: string, LitresLocalXML?: string) {
			this.xhrIE9 = false;
			this.Ready = false;
			// this.FB3DOM.Bookmarks.push(this);
			this.ClassPrefix = 'my_';
			this.Bookmarks = new Array();
			this.DeletedBookmarks = {};
			this.AddBookmark(new Bookmark(this));
			this.WaitForData = false;
			if (document.all && !window.atob && (<any> window).XDomainRequest && this.aldebaran) {
				this.XMLHttp = new XDomainRequest(); // IE9 =< fix
				this.xhrIE9 = true;
			} else if (window.ActiveXObject) {
				this.XMLHttp = new window.ActiveXObject("Microsoft.XMLHTTP");
			} else {
				this.XMLHttp = new XMLHttpRequest();
			}
			this.Host = '/';
			this.Host = 'http://www.litres.ru/'; // TODO: replace
			this.SID = LitresSID;
			this.SaveAuto = false;
			this.LocalXML = LitresLocalXML;
		}

		public AddBookmark(Bookmark: IBookmark): void {
			Bookmark.N = this.Bookmarks.length;
			Bookmark.Owner = this;
			this.Bookmarks.push(Bookmark);
		}
		public DropBookmark(Bookmark: IBookmark): void {
			for (var I = 0; I < this.Bookmarks.length; I++) {
				this.Bookmarks[I].N = I;
				if (this.Bookmarks[I].ID == Bookmark.ID) {
					this.DeletedBookmarks[this.Bookmarks[I].ID] = true;
					this.Bookmarks.splice(I, 1);
					I--;
				}
			}
		}
		private ReNumberBookmarks(): void {
			for (var I = 0; I < this.Bookmarks.length; I++) {
				this.Bookmarks[I].N = I;
			}
		}

		public LoadFromCache() {
			if (this.LocalXML) {
				var XML = this.MakeXMLFromString(this.LocalXML);
				this.LocalXML = null;
				this.AfterTransferFromServerComplete(XML);
			}
		}

		public Load(Callback?: IBookmarksReadyCallback) {
			if (!this.Reader.Site.BeforeBookmarksAction())
				return;
			this.LoadEndCallback = Callback;
			this.WaitForData = true;
			var URL = this.MakeLoadURL();
			this.XMLHTTPResponseCallback = this.AfterTransferFromServerComplete;
			this.SendNotesRequest(URL, 'GET');
			// todo some data transfer init stuff here, set AfterTransferFromServerComplete to run at the end
			// for now we just fire it as it is, should fire after XML loaded
			// setTimeout(()=>this.AfterTransferFromServerComplete(),200);
		}

		private MakeXMLFromString(XMLString: string): XMLDocument {
			var parseXml;
			if (window.DOMParser) {
				parseXml = function (xmlStr) {
					return ( new window.DOMParser() ).parseFromString(xmlStr, "text/xml");
				};
			} else if (typeof window.ActiveXObject != "undefined" && new window.ActiveXObject("Microsoft.XMLDOM")) {
				parseXml = function (xmlStr) {
					var xmlDoc = new window.ActiveXObject("Microsoft.XMLDOM");
					xmlDoc.async = "false";
					xmlDoc.loadXML(xmlStr);
					return xmlDoc;
				};
			} else {
				parseXml = function () {
					return null;
				};
			}
			return parseXml(XMLString);
		}

		private AfterTransferFromServerComplete(XML: XMLDocument) {
			this.ParseXML(XML);
			this.WaitedToRemapBookmarks = 0;
			for (var I = 0; I < this.Bookmarks.length; I++) {
				if (!this.Bookmarks[I].XPathMappingReady) {
					this.Bookmarks[I].RemapWithDOM(() => this.OnChildBookmarkSync());
					this.WaitedToRemapBookmarks++;
				}
			}
			if (!this.WaitedToRemapBookmarks) {
				this.WaitForData = false;
				if (this.LoadEndCallback) {
					this.LoadEndCallback(this);
				}
			}
		}

		private OnChildBookmarkSync() {
			this.WaitedToRemapBookmarks--;
			if (!this.WaitedToRemapBookmarks) {
				this.WaitForData = false;
				if (this.LoadEndCallback) {
					this.LoadEndCallback(this);
				}
			}
		}

		private ParseXML(XML: XMLDocument) {
			// todo some xml-parsing upon data receive here to make pretty JS-bookmarks from ugly XML
			var Rows;
			if (typeof XML.querySelectorAll === 'undefined') {
				Rows = XML.getElementsByTagName('Selection');
			} else {
				Rows = XML.querySelectorAll('Selection');
			}
			this.LoadDateTime = moment().unix();
			if (XML.documentElement.getAttribute('lock-id')) {
				this.LockID = XML.documentElement.getAttribute('lock-id');
			}
			if (Rows.length) {
				// console.log('we have selection');
				for (var j = 0; j < Rows.length; j++) {
					var NewBookmark = new Bookmark(this);
					NewBookmark.ParseXML(Rows[j]);
					if (NewBookmark.Group == 0) { // TODO: skip for temporary Obj
						this.Bookmarks[0] = NewBookmark;
					} else {
						this.AddBookmark(NewBookmark);
					}
				}
			} else {
				// console.log('we dont have any selections on server');
			}
		}

		public Store(): void { // TODO: fill it
			this.ReLoad(true);
		}

		private StoreBookmarks(): void {
			var XML = this.MakeStoreXML();
			if (this.Reader.Site.BeforeBookmarksAction()) {
				var Data = this.MakeStoreData(XML);
				var URL = this.MakeStoreURL();
				this.XMLHTTPResponseCallback = () => {
					this.Reader.Site.AfterStoreBookmarks();
				};
				this.SendNotesRequest(URL, 'POST', Data);
			}
		}

		public ApplyPosition(): boolean {
			// If DOM.TOC not ready yet, we can't expand XPath for any way - we wait while Reader.LoadDone fire this
			if (!this.FB3DOM.Ready || this.WaitForData) {
				return false;
			}
			this.Ready = true;
			this.Bookmarks[0].SkipUpdateDatetime = true; // skip update current pos time after localBookmakrs load
			this.Reader.GoTO(this.Bookmarks[0].Range.From.slice(0));
			return true;
		}

		public ReLoad(SaveAutoState?: boolean) {
			var TemporaryNotes = new LitResBookmarksProcessor(this.FB3DOM, this.SID);
			TemporaryNotes.Reader = this.Reader;
			TemporaryNotes.aldebaran = this.aldebaran;
			TemporaryNotes.Bookmarks[0].Group = -1;
			this.SaveAuto = SaveAutoState;
			TemporaryNotes.SaveAuto = this.SaveAuto;
			TemporaryNotes.Load((Bookmarks: IBookmarks) => this.ReLoadComplete(Bookmarks));
		}
		private ReLoadComplete(TemporaryNotes: IBookmarks): void {
			// merge data from TemporaryNotes to this, then dispose of temporary LitResBookmarksProcessor
			// than check if new "current position" is newer, if so - goto it
			// keep in mind this.Bookmarks[0] is always here and is the current position,
			// so we skip it on merge
			var AnyUpdates = false;
			this.Reader.Site.CanStoreBookmark = false; // TODO fix in future
			if (this.Bookmarks.length) {
				var Found;
				for (var i = 1; i < this.Bookmarks.length; i++) { // delete old local bookmarks
					for (var j = 1; j < TemporaryNotes.Bookmarks.length; j++) {
						if (this.Bookmarks[i].ID == TemporaryNotes.Bookmarks[j].ID) {
							Found = 1;
							break;
						}
					}
					if (!Found && !this.Bookmarks[i].NotSavedYet) {
						this.Bookmarks[i].Detach();
						AnyUpdates = true;
					}
				}
				Found = 0;
				for (var j = 1; j < TemporaryNotes.Bookmarks.length; j++) { // check new bookmarks
					Found = 0;
					if (this.DeletedBookmarks[TemporaryNotes.Bookmarks[j].ID]) { // skip deleted
						continue;
					}
					for (var i = 1; i < this.Bookmarks.length; i++) {
						if (this.Bookmarks[i].ID == TemporaryNotes.Bookmarks[j].ID) {
							// we have new bookmark with same ID
							if (this.Bookmarks[i].DateTime < TemporaryNotes.Bookmarks[j].DateTime) {
								this.Bookmarks[i].Detach();
							} else {
								// if not new, skip
								Found = 1;
							}
							break;
						} else if (this.SaveAuto && TemporaryNotes.Bookmarks[j].DateTime < this.LoadDateTime) {
							Found = 1;
						}
					}
					if (!Found && TemporaryNotes.Bookmarks[j].Group >= 0) {
						AnyUpdates = true;
						this.AddBookmark(TemporaryNotes.Bookmarks[j]);
					}
				}
			} else {
				this.Bookmarks = TemporaryNotes.Bookmarks;
				if (this.Bookmarks.length) {
					AnyUpdates = true;
				}
			}
			if (!this.Bookmarks[0].NotSavedYet && this.Bookmarks[0].DateTime < TemporaryNotes.Bookmarks[0].DateTime) {
					// Newer position from server
					this.Bookmarks[0].SkipUpdateDatetime = true;
					this.Reader.GoTO(TemporaryNotes.Bookmarks[0].Range.From);
			} else if (AnyUpdates) {
				// Updated bookmarks data from server - we should redraw the page in case there are new notes
				this.Reader.Redraw();
			}
			if (this.SaveAuto) {
				this.LockID = TemporaryNotes.LockID;
				this.LoadDateTime = TemporaryNotes.LoadDateTime;
				this.StoreBookmarks();
			}
		}

		private MakeLoadURL(): string {
			var URL = this.Host + 'pages/catalit_load_bookmarks/?uuid=' + this.Reader.ArtID +
				(this.SaveAuto ? '&set_lock=1' : '') + '&sid=' + this.SID + '&r=' + Math.random();
			return URL;
		}
		private MakeStoreURL(): string {
			return this.Host + 'pages/catalit_store_bookmarks/';
		}
		private MakeStoreData(XML: string): string {
			var Data = 'uuid=' + this.FB3DOM.MetaData.UUID + '&data=' + encodeURIComponent(XML) +
				'&lock_id=' + encodeURIComponent(this.LockID) + '&sid=' + this.SID + '&r=' + Math.random();
			return Data;
		}

		public MakeStoreXML(): string {
			var XML = '<FictionBookMarkup xmlns="http://www.gribuser.ru/xml/fictionbook/2.0/markup" ' +
				'xmlns:fb="http://www.gribuser.ru/xml/fictionbook/2.0" lock-id="' + this.LockID + '">';
			if (this.Bookmarks.length) {
				this.Bookmarks[0].XStart = this.FB3DOM.GetXPathFromPos(this.Bookmarks[0].Range.From);
				this.Bookmarks[0].XEnd = this.Bookmarks[0].XStart.slice(0);
				XML += this.Bookmarks[0].PublicXML();
				for (var j = 1; j < this.Bookmarks.length; j++) {
					if (this.Bookmarks[j].TemporaryState) continue;
					XML += this.Bookmarks[j].PublicXML();
				}
			}
			XML += '</FictionBookMarkup>';
			return XML;
		}

		private SendNotesRequest(URL: string, Type: string, Data?: string): void {
			var Data = Data || null;
			if (this.xhrIE9) {
				this.XMLHttp.onload = () => this.XMLHTTPIE9Response();
			} else {
			this.XMLHttp.onreadystatechange = () => this.XMLHTTPResponse();
			}
			this.XMLHttp.open(Type, URL, true);
			if (!this.xhrIE9) {
			this.XMLHttp.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
			}
			this.XMLHttp.send(Data);
		}
		private XMLHTTPResponse(): void {
			if (this.XMLHttp.readyState == 4 && this.XMLHttp.status == 200) {
				this.XMLHTTPResponseCallback(this.XMLHttp.responseXML);
			}
			// TODO: add error handler
		}
		private XMLHTTPIE9Response(): void {
			if (this.XMLHttp.responseText && this.XMLHttp.responseText != '') {
				var parser = new DOMParser();
				var xml = parser.parseFromString(this.XMLHttp.responseText, 'text/xml');
				this.XMLHTTPResponseCallback(xml);
			}
			// TODO: add error handler
		}

		public GetBookmarksInRange(Range?: FB3DOM.IRange): IBookmark[] {
			var Range = Range || this.Reader.GetVisibleRange();
			if (this.Bookmarks.length <= 1 || !Range) {
				return [];
			}
			var NotesInRange = [];
			for (var j = 1; j < this.Bookmarks.length; j++) {
				if (this.Bookmarks[j].Group == 1) {
					var xps = FB3Reader.PosCompare(this.Bookmarks[j].Range.From, Range.From);
					var xpe = FB3Reader.PosCompare(this.Bookmarks[j].Range.To, Range.To);
					var xps_e = FB3Reader.PosCompare(this.Bookmarks[j].Range.From, Range.To);
					var xpe_s = FB3Reader.PosCompare(this.Bookmarks[j].Range.To, Range.From);
					// TODO: fix variants
//					console.log(this.Bookmarks[j]);
//					console.log('xps ' + this.Bookmarks[j].Range.From.join('_') + ' ' + Range.From.join('_') + ' ' + xps);
//					console.log('xpe ' + this.Bookmarks[j].Range.To.join('_') + ' ' + Range.To.join('_') + ' ' + xpe);
//					console.log('xps_e ' + this.Bookmarks[j].Range.From.join('_') + ' ' + Range.To.join('_') + ' ' + xps_e);
//					console.log('xpe_s ' + this.Bookmarks[j].Range.To.join('_') + ' ' + Range.From.join('_') + ' ' + xpe_s);
					if (
							(xps >= 0 && xpe <= 0) || // in page range
							(xps >= 0 && xps_e <= 0) || // start point in range
							(xpe_s >= 0 && xpe <= 0) || // end point in range
							(xps < 0 && xpe > 0)
						) {
							NotesInRange.push(this.Bookmarks[j]);
					}
				}
			}
			return NotesInRange;
		}
	}

	export class Bookmark implements IBookmark {
		public ID: string;
		public Range: FB3DOM.IRange;
		public XStart: FB3DOM.IXPath;
		public XEnd: FB3DOM.IXPath;
		public Group: number;
		public Class: string;
		public Title: string;
		public Note: InnerFB2[];
		public RawText: string;
		public XPathMappingReady: boolean;
		public N: number;
		public DateTime: number;
		public NotSavedYet: number;
		public TemporaryState: number;
		public SkipUpdateDatetime: boolean;
		private RequiredChunks: number[];
		private AfterRemapCallback: IBookmarkSyncCallback;
		private NotePreviewLimit: number = 140;
		private Extract;
		constructor(public Owner: IBookmarks) {
			this.ID = this.MakeSelectionID();
			this.Group = 0;
			this.Class = 'default';
			this.Range = { From: [0], To: [0] };
			this.Note = ['', ''];
			this.XStart = [0];
			this.XEnd = [0];
			this.XPathMappingReady = true;
			this.N = -1;
			this.DateTime = moment().unix();
			this.NotSavedYet = 1;
			this.TemporaryState = 0;
			this.SkipUpdateDatetime = false;
			this.Extract = '';
		}

		public InitFromXY(X: number, Y: number, AllowBlock: boolean): boolean {
			var StartAddr = this.Owner.Reader.ElementAtXY(X, Y);
			if (StartAddr) {

				var NewElement = this.Owner.FB3DOM.GetElementByAddr(StartAddr);
				if (NewElement.IsBlock()) {
					return false;
				} else {
					return this.InitFromPosition(StartAddr);
				}
			}
		}

		public InitFromXPath(XPath: FB3DOM.IXPath): boolean {
			return this.InitFromPosition(this.Owner.FB3DOM.GetAddrByXPath(XPath));
		}

		public InitFromRange(Range: FB3DOM.IRange): boolean {
			var Element = this.Owner.FB3DOM.GetElementByAddr(Range.From);
			return this.InitFromPosition(Element.Position());
		}

		public InitFromPosition(Position: FB3Reader.IPosition): boolean {
			if (Position) {
				this.Range.From = Position.slice(0);
				this.Range.To = Position;
				this.GetDataFromText();
				return true;
			} else {
				return undefined;
			}
		}

		public ExtendToXY(X: number, Y: number, AllowBlock: boolean): boolean {
			var BaseTo = this.Owner.Reader.ElementAtXY(X, Y);

			if (!BaseTo || BaseTo.length < 1) return false;

			// To catch gap between lines we may go up to the nearest non-block element
			if (!AllowBlock) {
				var Trials = 0;
				var Element = this.Owner.FB3DOM.GetElementByAddr(BaseTo);
				while (Trials < 10 && Element.IsBlock()){ // 30px should be enough
					Y = Y - 3; // We believe 3px is nice, no need to jump 1px cause no elements are so small
					var NewBaseTo = this.Owner.Reader.ElementAtXY(X, Y);
					Trials++;
					if (NewBaseTo && NewBaseTo.length > 1) {
						var NewElement = this.Owner.FB3DOM.GetElementByAddr(NewBaseTo);
						if (!NewElement.IsBlock()) {
							BaseTo = NewBaseTo;
							Element = NewElement;
						}
					}
				}
			}

			this.Range.To = BaseTo;
			this.GetDataFromText();
			return true;
		}

		public RoundClone(ToBlock: boolean): IBookmark {
			var Clone = new Bookmark(this.Owner);

			Clone.Range = FB3Reader.RangeClone(this.Range);

			if (ToBlock) {
				this.RoundToBlockLVLUp(Clone.Range.From);
				this.RoundToBlockLVLDn(Clone.Range.To);
			} else {
				this.RoundToWordLVLUp(Clone.Range.From);
				this.RoundToWordLVLDn(Clone.Range.To);
			}

			Clone.GetDataFromText();
			Clone.Group = this.Group;
			Clone.Class = this.Class;

			return Clone;
		}

		public Detach() {
			this.Owner.DropBookmark(this);
			// this.Owner.Store();
		}

		private RoundToWordLVLDn(Adress: FB3Reader.IPosition) {
			var Block = this.Owner.FB3DOM.GetElementByAddr(Adress);
			var PosInBlock = Adress[Adress.length - 1];
			while (Block.Parent && (!Block.TagName || !Block.IsBlock())) {
				Block = Block.Parent;
				PosInBlock = Adress[Adress.length - 1];
				Adress.pop();
			}
			while (PosInBlock < Block.Childs.length - 1 && !Block.Childs[PosInBlock].Childs && !Block.Childs[PosInBlock].text.match(/\s$/)) {
				PosInBlock++;
			}
			Adress.push(PosInBlock);
		}
		private RoundToWordLVLUp(Adress: FB3Reader.IPosition) {
			var Block = this.Owner.FB3DOM.GetElementByAddr(Adress);
			if (Block.IsBlock()) {
				return;
			}
			var PosInBlock = Adress[Adress.length - 1];
			while (Block.Parent && !Block.TagName && !Block.IsBlock()) {
				Block = Block.Parent;
				PosInBlock = Adress[Adress.length - 1];
				Adress.pop();
			}
			//if (PosInBlock < Block.Childs.length - 2) {
			//	PosInBlock++;
			//}
			if (PosInBlock > Block.Childs.length - 2)
				PosInBlock = Block.Childs.length - 2;
			while (PosInBlock > 0 && !Block.Childs[PosInBlock-1].Childs && !Block.Childs[PosInBlock-1].text.match(/\s$/)) {
				PosInBlock--;
			}
			Adress.push(PosInBlock);
		}

		private RoundToBlockLVLUp(Adress: FB3Reader.IPosition) {
			var Block = this.Owner.FB3DOM.GetElementByAddr(Adress);
			while (Block.Parent && (!Block.TagName || !Block.IsBlock())) {
				Block = Block.Parent;
				Adress.pop();
			}
		}
		private RoundToBlockLVLDn(Adress: FB3Reader.IPosition) {
			this.RoundToBlockLVLUp(Adress);
			var Block = this.Owner.FB3DOM.GetElementByAddr(Adress);
			if (Block.TagName && Block.IsBlock()) {
				return;
			}
			if (Block.Parent.Childs.length > Block.ID + 1) {
				Adress[Adress.length - 1]++;
			} else {
				Adress.push(Block.Childs.length);
			}
		}

		public ClassName(): string {
			return this.Owner.ClassPrefix + 'selec_' + this.Group + '_' + this.Class + ' ' + this.Owner.ClassPrefix + 'selectid_' + this.N;
		}

		private GetDataFromText() {
			var PageData = new FB3DOM.PageContainer();
			this.Owner.FB3DOM.GetHTML(this.Owner.Reader.HyphON, this.Owner.Reader.BookStyleNotes, this.Range, '', 100, 100, PageData);
			// We first remove unknown characters
			var InnerHTML = PageData.Body.join('').replace(/<(?!\/?p\b|\/?strong\b|\/?em\b)[^>]*>/, '');
			// Then we extract plain text
			this.Title = InnerHTML.replace(/<[^>]+>|\u00AD/gi, '').substr(0, 50).replace(/\s+\S*$/, '');
			this.RawText = InnerHTML.replace(/(\s\n\r)+/gi, ' ');
			this.RawText = this.RawText.replace(/<(\/)?strong[^>]*>/gi, '[$1b]');
			this.RawText = this.RawText.replace(/<(\/)?em[^>]*>/gi, '[$1i]');
			this.RawText = this.RawText.replace(/<\/p>/gi, '\n');
			// this.RawText = this.RawText.replace(/<a class="footnote[^>]+>/gi, '');
			// TODO: skip footnotes
			this.RawText = this.RawText.replace(/<\/?[^>]+>|\u00AD/gi, '');
			this.RawText = this.RawText.replace(/^\s+|\s+$/gi, '');
			this.Note[0] = this.Raw2FB2(this.RawText);
			// todo - should fill this.Extract with something equal|close to raw fb2 fragment
			this.XStart = this.Owner.FB3DOM.GetXPathFromPos(this.Range.From.slice(0));
			this.XEnd = this.Owner.FB3DOM.GetXPathFromPos(this.Range.To.slice(0));
		}

		private Raw2FB2(RawText: string): string {
			RawText = RawText.replace(/\[(\/)?b[^\]]*\]/gi, '<$1strong>');
			RawText = RawText.replace(/\[(\/)?i[^\]]*\]/gi, '<$1emphasis>');
			RawText = '<p>' + RawText.replace(/\n/gi, '</p><p>') + '</p>';
			return RawText;
		}
		private MakeSelectionID(): string {
			var MakeSelectionIDSub = function (chars, len) {
				var text = '';
				for (var i = 0; i < len; i++) { text += chars.charAt(Math.floor(Math.random() * chars.length)); }
				return text;
			}
			var text = '',
				chars = 'abcdef0123456789';
			text += MakeSelectionIDSub(chars, 8) + '-';
			text += MakeSelectionIDSub(chars, 4) + '-';
			text += MakeSelectionIDSub(chars, 4) + '-';
			text += MakeSelectionIDSub(chars, 4) + '-';
			text += MakeSelectionIDSub(chars, 12);
			return text;
		}

		public RemapWithDOM(Callback: IBookmarkSyncCallback): void {
			this.AfterRemapCallback = Callback;
			this.InitSyncXPathWithDOM();
		}

		private InitSyncXPathWithDOM(): void {
			this.XPathMappingReady = false;
			if (!this.Owner.FB3DOM.DataChunks) { // No info on chunks yet, keep waiting
				setTimeout(() => this.InitSyncXPathWithDOM(), 10);
				return;
			}
			this.RequiredChunks = this.ChunksRequired();
			var ChunksToLoad = new Array();

			// First we check, if some of required chunks are not set to be loaded yet
			for (var I = 0; I < this.RequiredChunks.length; I++) {
				if (!this.Owner.FB3DOM.DataChunks[this.RequiredChunks[I]].loaded) {
					ChunksToLoad.push(this.RequiredChunks[I]);
				}
			}
			// If there are missing chunks - we initiate loading for them
			if (ChunksToLoad.length) {
				this.Owner.FB3DOM.LoadChunks(ChunksToLoad, () => this.DoSyncXPathWithDOM());
			} else {
				this.DoSyncXPathWithDOM();
			}
		}

		private DoSyncXPathWithDOM(): void {
			for (var I = 0; I < this.RequiredChunks.length; I++) {
				if (this.Owner.FB3DOM.DataChunks[this.RequiredChunks[I]].loaded != 2) {
					// There is at least one chunk still being loaded - we will return later
					setTimeout(() => this.DoSyncXPathWithDOM(), 10);
					return;
				}
			}

			// Ok, all chunks are here, now we need to map fb2 xpath to internal xpath
			this.Range = {
				From: this.Owner.FB3DOM.GetAddrByXPath(this.XStart),
				To: this.Owner.FB3DOM.GetAddrByXPath(this.XEnd)
			};
			this.XPathMappingReady = true;
			if (this.AfterRemapCallback) {
				this.AfterRemapCallback();
				this.AfterRemapCallback = undefined;
			}
		}

		private ChunksRequired(): number[]{
			var Result = new Array();
			var StartChunk = this.Owner.FB3DOM.XPChunk(this.XStart);
			var EndChunk = this.Owner.FB3DOM.XPChunk(this.XEnd);
			if (StartChunk === undefined) {
				StartChunk = EndChunk;
			}
			if (StartChunk !== undefined) {
				Result[0] = StartChunk;
				if (EndChunk != Result[0]) {
					Result.push(EndChunk);
				}
			}
			return Result;
		}

		public PublicXML(): string {
			return '<Selection group="' + this.Group + '" ' +
				(this.Class ? 'class="' + this.Class + '" ' : '') +
				(this.Title ? 'title="' + this.Title + '" ' : '') +
				'id="' + this.ID + '" ' +
				'selection="fb2#xpointer(' + this.MakeSelection() + ')" ' +
				'art-id="' + this.Owner.FB3DOM.MetaData.UUID + '" ' +
				'last-update="' + moment.unix(this.DateTime).format("YYYY-MM-DDTHH:mm:ssZ") + '"' +
				this.GetPercent() + '>' +
				this.GetNote() + this.GetExtract() +
			'</Selection>';
		}

		public ParseXML(XML: any): void { // TODO: fix, need correct type
			this.Group = parseInt(XML.getAttribute('group'));
			this.Class = XML.getAttribute('class');
			this.Title = XML.getAttribute('title');
			this.parseTitle();
			this.ID = XML.getAttribute('id').toLowerCase();
			this.MakeXPath(XML.getAttribute('selection'));
			this.DateTime = moment(XML.getAttribute('last-update'), "YYYY-MM-DDTHH:mm:ssZ").unix();
			var tmpNotes = XML.querySelectorAll('Note');
			for (var j = 0; j < tmpNotes.length; j++) {
				var tmpNote = tmpNotes[j];
				var NoteHTML = '';
				if (tmpNote.innerHTML) {
					NoteHTML = tmpNote.innerHTML;
				} else {
					NoteHTML = this.parseXMLNote(tmpNote);
				}
				// this.Note = NoteHTML.replace(/<p\s[^>]+>/g, '<p>');
				this.Note[j] = NoteHTML
					.replace(/<(\/)?[fb:]+/ig, '<$1')
					.replace(/(\sxmlns(:fb)?.[^>]+)/ig, '')
					.replace(/<p\/>/ig, '<p></p>');
				if (this.Note[j] == '<p>') {
					this.Note[j] = '<p></p>';
				}
			}
			this.NotSavedYet = 0;
			this.XPathMappingReady = false;
			// TODO: fill and check
			if (XML.querySelector('Extract')) {
				var tmpExtract = XML.querySelector('Extract');
				var ExtractHTML = '';
				if (tmpExtract.innerHTML) {
					ExtractHTML = tmpExtract.innerHTML;
				} else {
					ExtractHTML = this.parseXMLNote(tmpExtract);
				}
				this.Extract = ExtractHTML;
				// this.RawText = XML.querySelector('Extract').getAttribute('selection-text');
			}
			// this.Range; // will be filled in ReMapping
		}

		private parseTitle(): void {
			if (this.Title == '' || this.Title == null) {
				if (this.Group == 1) this.Title = 'Закладка';
				else if (this.Group == 3 || this.Group == 5) this.Title = 'Заметка';
			}
		}

		private parseXMLNote(el) {
			var res = '';
			for (var i = 0; i < el.childNodes.length; i++) {
				var child = el.childNodes[i];
				res += "<" + child.tagName;
				if (child.attributes) {
					for (var k = 0; k < child.attributes.length; k++) {
						var attr = child.attributes[k];
						res += " " + attr.name + "='" + attr.value + "'";
					}
				}
				res += ">";
				if (child.childNodes.length && child.childNodes[0].nodeName != '#text') {
					res += this.parseXMLNote(child);
				} else {
					res += child.childNodes[0].nodeValue;
				}
				res += "</" + child.tagName + ">";
			}
			return res;
		}

		private GetNote(): string {
			var out = '';
			if (this.Note[0] != '') {
				out += '<Note><p>' + this.MakePreviewFromNote() + '</p></Note>';
			}
			if (this.Note[1] != '') {
				out += '<Note>' + this.Note[1] + '</Note>';
			}
			return out;
		}
		public MakePreviewFromNote(): string {
			if (this.Note[0] == '') {
				return '';
			}
			var tmpDiv = document.createElement('div');
			tmpDiv.innerHTML = <string> this.Note[0];
			var text = this.PreparePreviewText(tmpDiv.querySelectorAll('p'));
			text = text.length > this.NotePreviewLimit ? text.substring(0, this.NotePreviewLimit) + '…' : text;
			tmpDiv = undefined;
			return text;
		}
		private PreparePreviewText(obj): string {
			var text = '';
			for (var j = 0; j < obj.length; j++) {
				var tmp = (<HTMLElement> obj[j]).innerText || obj[j].textContent;
				text += tmp;
				if (j != obj.length - 1) {
					text += ' ';
				}
			}
			return text;
		}
		private GetPercent(): string {
			if (this.Group != 0) return '';
			return ' percent="' + Math.round(this.Owner.Reader.CurPosPercent()) + '"';
		}
		private GetExtract(): string {
			return this.Extract;
			return '<Extract ' +
				this.GetRawText() +
				'original-location="fb2#xpointer(' + this.MakeExtractSelection() + ')">' +
				this.ExtractNode() + '</Extract>';
		}
		private ExtractNode(): string {
			// TODO: fill with code
			return '<p>or4</p>';
		}
		private GetRawText(): string {
			if (!this.RawText) return '';
			return 'selection-text="' + this.RawText + '" ';
		}
		private MakeExtractSelection(): string {
			var Start: string = this.MakePointer(this.XStart);
			return '/1/' + Start.replace(/\.\d+$/, '') + '';
		}

		private MakeSelection(): string {
			var Start: string = this.MakePointer(this.XStart);
			if (FB3DOM.XPathCompare(this.XStart, this.XEnd) == 0)
				return 'point(/1/' + Start + ')';
			return 'point(/1/' + Start + ')/range-to(point(/1/' + this.MakePointer(this.XEnd) + '))';
		}

		private MakePointer(X: FB3DOM.IXPath): string {
			X = X.slice(0);
			var last = X.pop() + '';
			return X.join('/') + ((/^\./).test(last) ? '' : '/') + last + ((/^\./).test(last) ? '' : '.0');
		}

		private MakeXPath(X: string): void {
			var p = X.match(/\/1\/(.[^\)]*)/g);
			var MakeXPathSub = function (str) {
				return str.replace(/^\/1\//, '').replace(/\.0$/, '').replace('.', '/.').split('/');
			}
			this.XStart = MakeXPathSub(p[0]);
			if (p.length == 1) {
				this.XEnd = this.XStart.slice(0);
			} else {
				this.XEnd = MakeXPathSub(p[1]);
			}
		}

	}
}