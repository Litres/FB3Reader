import {FB3Reader} from "../Reader/FB3Reader";
import {
	IBookmark,
	IBookmarks,
	IBookmarksReadyCallback,
	IBookmarkSyncCallback,
	InnerFB2,
	INote
} from "./FB3Bookmarks.head";
import {IFBReader} from "../Reader/FB3Reader.head";
import {IFB3DOM, IRange, IXPath} from "../DOM/FB3DOM.head";
import {FB3DOMBlock} from "../DOM/FB3DOMBlock";
import {IPosition} from "../FB3ReaderHeaders";
import {CatalitWeb} from '../../plugins/catalit-web/CatalitWeb/CatalitWeb';
import {getUnixTime, fromUnixTime, parse, format} from "date-fns"

export module FB3Bookmarks {

	export var ActiveXXMLHttp: boolean = true;

	interface iWindow extends Window {
		ActiveXObject: any;
		DOMParser: any;
		XDomainRequest: any;
	}
	declare var window: iWindow;

	interface ICatalitResponse extends CatalitWeb.IServerResponseObject {
		success: boolean,
		time: string,
		lock_id?: string;
		notes?: INote[];
	}

	interface IXMLHTTPResponseCallback { (Data: XMLDocument): void; }

	class Catalit extends CatalitWeb.CatalitWebApp {
		private static instance: Catalit;

		private artID: string;
		private lockID: string;

		private notesRequestID: string = 'r_my_fb3_notes';
		private notesRequestMethod: string = 'r_my_fb3_notes_incremental';

		private lockNotesRequestID: string = 'w_set_bookmark_lock';
		private lockNotesRequestMethod: string = 'w_set_bookmark_lock';

		private replaceNotesRequestID: string = 'w_replace_my_fb3_notes';
		private replaceNotesRequestMethod: string = 'w_replace_my_fb3_notes';

		private deleteNotesRequestID: string = 'w_drop_my_fb3_notes';
		private deleteNotesRequestMethod: string = 'w_drop_my_fb3_notes';

		private makeNotePublicRequestID: string = 'w_quote_make_public';
		private makeNotePublicRequestMethod: string = 'w_quote_make_public';

		private deletedNotes: INote[] = [];
		private syncedNotes: {[id: string]: INote} = {};	// this dictionary represents notes that are already on server

		private constructor(SID: string, websiteDomain: string) {
			super(SID, websiteDomain);
		}

		public static getInstance(SID: string, websiteDomain: string): Catalit {
			if (!Catalit.instance) {
				Catalit.instance = new Catalit(SID, websiteDomain);
			}

			return Catalit.instance;
		}

		private addNotesRequest(): void {
			this.addNewRequest({
				func: this.notesRequestMethod,
				id: this.notesRequestID,
				param: {
					art: this.artID
				}
			});
		}

		private addLockNotesRequest(): void {
			this.addNewRequest({
				func: this.lockNotesRequestMethod,
				id: this.lockNotesRequestID,
				param: {
					art: this.artID
				}
			});
		}

		private addReplaceNotesRequest(notes: INote[]): void {
			this.addNewRequest({
				func: this.replaceNotesRequestMethod,
				id: this.replaceNotesRequestID,
				param: {
					art: this.artID,
					my_notes: notes,
					lock_id: this.lockID
				}
			});
		}

		private addDeletedNotesRequest(notes: INote[]): void {
			this.addNewRequest({
				func: this.deleteNotesRequestMethod,
				id: this.deleteNotesRequestID,
				param: {
					notes: notes.map((note: INote) => note.id),
					lock_id: this.lockID
				}
			});
		}

		private addMakeNotePublicRequest(noteID: string): void {
			this.addNewRequest({
				func: this.makeNotePublicRequestID,
				id: this.makeNotePublicRequestMethod,
				param: {
					id: noteID
				}
			});
		}

		public addDeletedNote(note: INote): void {
			this.deletedNotes.push(note);
		}

		public clearDeletedNotes(): void {
			this.deletedNotes = [];
		}

		private onGetNotes(successCallback: Function, failureCallback: Function, result: ICatalitResponse): boolean {
			let preparedResult = {
				success: false,
				notes: [],
				lock_id: ''
			};

			try {
				let lockResultBody = result[this.lockNotesRequestID],
					notesResultBody = result[this.notesRequestID];

				preparedResult.lock_id = lockResultBody.lock_id;
				preparedResult.notes = notesResultBody.my_notes;

				this.setLockID(preparedResult.lock_id);

				if (result.success) {
					preparedResult.success = true;
					// we got notes from server - these are for sure synced
					this.clearSyncedNotes();
					this.mergeSyncedNotes(preparedResult.notes);
					successCallback(preparedResult);
					return true;
				}

				failureCallback(preparedResult);
				return false;
			} catch (e) {
				failureCallback(preparedResult);
				console.warn(e.message);
				return false;
			}
		}

		private clearSyncedNotes() {
			this.syncedNotes = {};
		}

		private mergeSyncedNotes(notes: INote[]) {
			for (let note of notes) {
				this.syncedNotes[note.id] = Object.assign({}, note);
			}
		}
		private deleteSyncedNotes(notes: INote[]) {
			for (let note of notes) {
				delete this.syncedNotes[note.id];
			}
		}

		/**
		 * Check for synced notes and detect those new notes or notes with different percent attribute
		 * @param notes
		 */
		private detectChangedNotes(notes: INote[]) {
			const result: INote[] = [];
			for (let note of notes) {
				const syncedNote = this.syncedNotes[note.id];
				if (!syncedNote) {
					result.push(note);
					continue;
				}

				if (Number(syncedNote.percent) !== Number(note.percent)) {
					result.push(note);
				}
			}

			return result;
		}

		private onReplaceNotes(successCallback: Function, failureCallback: Function, result: ICatalitResponse): boolean {
			let preparedResult = {
				success: false
			};

			try {
				let lockResultBody = result[this.lockNotesRequestID],
					replaceNotesResultBody = result[this.replaceNotesRequestID];

				if (result.success) {
					preparedResult.success = true;
					successCallback(preparedResult);
					return true;
				}

				failureCallback(preparedResult);
				return false;
			} catch (e) {
				failureCallback(preparedResult);
				console.warn(e.message);
				return false;
			}
		}

		private onMakeNotePublic(successCallback: Function, failureCallback: Function, result: ICatalitResponse): boolean {
			try {
				let resultBody = result[this.makeNotePublicRequestID];

				if (resultBody.success) {
					successCallback();
					return true;
				}
                failureCallback(resultBody);
				return false;
			} catch (e) {
				failureCallback();
				return false;
			}
		}

		public getNotes(successCallback: (result) => void, failureCallback: (result) => void): void {
			this.clearRequestsArray();
			this.addLockNotesRequest();
			this.addNotesRequest();
			this.requestAPI(this.onGetNotes.bind(this, successCallback, failureCallback));
		}

		public replaceNotes(notesToReplace: INote[], successCallback: (result) => void, failureCallback: (result) => void): void {
			notesToReplace = this.detectChangedNotes(notesToReplace);		// take only changed notes
			this.clearRequestsArray();
			if (notesToReplace.length > 0) {
				this.addReplaceNotesRequest(notesToReplace);
			}
			const notesToDelete = this.deletedNotes;
			if (notesToDelete.length > 0) {
				this.addDeletedNotesRequest(notesToDelete);
				this.clearDeletedNotes();
			}
			this.requestAPI(this.onReplaceNotes.bind(this, result => {
				// after successful replace, update sync notes dictionary
				this.mergeSyncedNotes(notesToReplace);
				this.deleteSyncedNotes(notesToDelete);
				successCallback(result);
			}, failureCallback));

		}

		public makeNotePublic(noteID: string, successCallback: Function, failureCallback: Function): void {
			this.clearRequestsArray();
			this.addMakeNotePublicRequest(noteID);
			this.requestAPI(this.onMakeNotePublic.bind(this, successCallback, failureCallback));
		}

		public setLockID(lockID): string {
			return this.lockID = lockID;
		}

		public setArtID(artID): string {
			return this.artID = artID;
		}
	}

	export class LitResBookmarksProcessor implements IBookmarks {
		public Host: string;
		public Ready: boolean;
		public Reader: IFBReader;
		public Bookmarks: IBookmark[];
		public ClassPrefix: string;
		public LockID: string;
		public LoadDateTime: number;
		public ReadyCallback: IBookmarkSyncCallback;
		private DeletedBookmarks;
		private LoadEndCallback: IBookmarksReadyCallback;
		private TemporaryNotes: IBookmarks;
		private WaitedToRemapBookmarks: number;
		private WaitForData: boolean;
		private XMLHttp: any;
		private SID: string;
		private ArtID: string;
		private Callback: any;
		private SaveAuto: boolean; // save state after ReLoad
		private XMLHTTPResponseCallback: IXMLHTTPResponseCallback;
		private LocalXML: string;
		private xhrIE9: boolean;
		private MakeStoreXMLAsyncTimeout: number;
		private Catalit: Catalit;
		private ScrollToXpath: string;
		public UseCatalit2: boolean;
		public aldebaran: boolean; // stupid hack
		constructor(public FB3DOM: IFB3DOM, LitresSID?: string, ArtID?: string, LitresLocalXML?: string, UseCatalit2: boolean = false, ScrollToXpath?: string) {
			if (LitresSID) {
				this.SID = LitresSID;
			}
			if (ArtID) {
				this.ArtID = ArtID;
			}
			this.xhrIE9 = false;
			this.Ready = false;
			// this.FB3DOM.Bookmarks.push(this);
			this.ClassPrefix = 'my_';
			this.Bookmarks = new Array();
			this.DeletedBookmarks = {};
			this.AddBookmark(new Bookmark(this));
			this.Bookmarks[0].DateTime = 0; // Newly created curpos bookmark is older than any real one
			this.WaitForData = false;
			this.Host = '/';
			//// local testing part start
			//this.SID = "528k8b3l3rex5o4j5z522590dt0q3dac";
			//this.Host = 'https://www.litres.ru/';
			//this.aldebaran = true;
			//// local testing part end
			if (document.all && !window.atob && (<any> window).XDomainRequest && this.aldebaran) {
				// IE8-IE9 cant do cross-domain ajax properly (IE7 i think cant do it at all)
				// this workaround send empty clean request, no params, no session, no cookies
				// answer must be text/plain
				this.XMLHttp = new window.XDomainRequest(); // IE9 =< fix
				this.xhrIE9 = true;
			} else if (window.ActiveXObject && ActiveXXMLHttp) {
				this.XMLHttp = new window.ActiveXObject("Microsoft.XMLHTTP");
			} else {
				this.XMLHttp = new XMLHttpRequest();
			}
			this.SaveAuto = false;
			this.LocalXML = LitresLocalXML;
			if (UseCatalit2) {
				this.UseCatalit2 = true;
				this.Catalit = Catalit.getInstance(this.SID, window.location.host);
				this.Catalit.setArtID(this.ArtID);
			}

			if (ScrollToXpath) {
				this.ScrollToXpath = ScrollToXpath;
			}
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
			if (this.UseCatalit2) {
				this.Catalit.getNotes(this.OnGetNotesSuccess.bind(this), () => {});
			} else {
				this.XMLHTTPResponseCallback = this.AfterTransferFromServerComplete;
				this.SendNotesRequest(URL, 'GET');
			}
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

		private OnGetNotesSuccess(Result: ICatalitResponse): void {
			let Notes: INote[] = Result.notes;
			this.LoadDateTime = getUnixTime(new Date());

			if (Result.lock_id) {
				this.LockID = Result.lock_id;
			}

			if (Notes) {
                for (var j = 0; j < Notes.length; j++) {
					let Note: INote = Notes[j];
                    let NewBookmark: Bookmark = new Bookmark(this);
                    NewBookmark.ParseObject(Note);

                    if (NewBookmark.Group == 0) {
                        this.Bookmarks[0] = NewBookmark;
                    } else {
                        this.AddBookmark(NewBookmark);
                    }
                }
			}

			this.WaitedToRemapBookmarks = 0;
			for (var I = 0; I < this.Bookmarks.length; I++) {
				if (!this.Bookmarks[I].XPathMappingReady) {
					this.Bookmarks[I].RemapWithDOM(() => this.OnChildBookmarkSync());
					this.WaitedToRemapBookmarks++;
				}
			}
			this.CheckWaitedSync();
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
			this.CheckWaitedSync();
		}

		private OnChildBookmarkSync() {
			this.WaitedToRemapBookmarks--;
			this.CheckWaitedSync();
		}

		private CheckWaitedSync() {
			if (!this.WaitedToRemapBookmarks) {
				this.WaitForData = false;
				if (this.LoadEndCallback) {
					this.LoadEndCallback(this);
				}
				if (this.ReadyCallback) {
					this.ReadyCallback();
				}

				// [139028] Научить читалку «быстрому переходу» на позицию из URL
				let ForcedXpathPos: string = this.GetForcedXpathPosition();
				if (ForcedXpathPos) {
					this.Reader.GoToXPath(this.Bookmarks[0].MakeXPathSub(ForcedXpathPos));
				}
			}
		}

		private ParseXML(XML: XMLDocument) {
			// todo some xml-parsing upon data receive here to make pretty JS-bookmarks from ugly XML
			var Rows = XML.querySelectorAll('Selection');
			this.LoadDateTime = getUnixTime(new Date());
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
			if (this.UseCatalit2) {
				if (this.Reader.Site.BeforeBookmarksAction()) {
					this.Catalit.replaceNotes(this.MakeStoreObject(), this.OnReplaceNotesSuccess.bind(this), this.OnReplaceNotesFailure.bind(this));
				}
			} else {
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
		}

		private OnReplaceNotesSuccess() {
			this.Reader.Site.AfterStoreBookmarks();
		}

        private OnReplaceNotesFailure() {
            this.Reader.Site.AfterStoreBookmarksFailure();
        }

		private MakeStoreObject() {
			var result = [];
			for (var j = 0; j < this.Bookmarks.length; j++) {
				if (!this.Bookmarks[j].TemporaryState) {
					result.push(this.Bookmarks[j].PublicObject())
				}
			}

			return result;
		}

		public MakeBookmarkPublic(Bookmark: IBookmark, callback: Function = () => {}, failureCallback: Function = () => {}): void {
			if (this.UseCatalit2) {
				this.Catalit.makeNotePublic(Bookmark.ID, () => {
					callback()
				}, (resultObject) => {failureCallback(resultObject);});
			} else {
                failureCallback();
			}
		}

		public CreateBookmarkFromTemporary(Group: string, Bookmark: IBookmark, Title: string, callback?: Function, failureCallback?: Function): IBookmark {
			var NewNote;
			var titles = { 1: 'Закладка', 3: 'Заметка', 5: 'Заметка' };
			switch (Group) {
				case "1":
					NewNote = Bookmark.RoundClone(true);
					NewNote.Group = 1; // set selection Group, because default selection Group = 3
					break;
				case "3":
				case "5":
					NewNote = Bookmark.RoundClone(false);
					NewNote.Note[1] = Bookmark.Note[1]; // if we have any user comment, just copy
					break;
			}
			if (Bookmark.TemporaryState) {
				Bookmark.Detach();
			}
			Bookmark = undefined;
			NewNote.Title = Title;
			if (!NewNote.Title) {
				NewNote.Title = titles[Group];
			}
			this.AddBookmark(NewNote);
			if (Group == "1") {
				this.Reader.Redraw();
			} else {
				this.Reader.RedrawVisible();
			}
			this.Reader.Site.StoreBookmarksHandler(200, callback, failureCallback);
			return NewNote;
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
			var TemporaryNotes = new LitResBookmarksProcessor(this.FB3DOM, this.SID, this.ArtID, undefined, this.UseCatalit2, this.ScrollToXpath);
			TemporaryNotes.Host = this.Host;
			TemporaryNotes.Reader = this.Reader;
			// TemporaryNotes.ReadyCallback = this.ReadyCallback;
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
			//console.log("RELOAD BOOKMARK")
			var AnyUpdates = false;
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
						if (this.UseCatalit2) {
							this.Catalit.addDeletedNote(TemporaryNotes.Bookmarks[j].PublicObject());
						}
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
			if (this.ReadyCallback) {
				this.ReadyCallback();
			}
			if (!this.Bookmarks[0].NotSavedYet && this.Bookmarks[0].DateTime < TemporaryNotes.Bookmarks[0].DateTime) {
				// Newer position from server
				this.Bookmarks[0].SkipUpdateDatetime = true;
				this.OnBookmarksSync(TemporaryNotes, this);
				// this.Reader.GoTO(TemporaryNotes.Bookmarks[0].Range.From);
				if (AnyUpdates &&
					FB3Reader.PosCompare(this.Bookmarks[0].Range.From, TemporaryNotes.Bookmarks[0].Range.From) == 0) {
						this.Reader.Redraw();
				}
			} else if (AnyUpdates) {
				// Updated bookmarks data from server - we should redraw the page in case there are new notes
				this.Reader.Redraw();
			}
			if (this.SaveAuto) {
				this.LockID = TemporaryNotes.LockID;
				this.LoadDateTime = TemporaryNotes.LoadDateTime;
				if (this.UseCatalit2) {
					this.Catalit.setLockID(this.LockID);
				}
				this.StoreBookmarks();
			}
		}

		private MakeLoadURL(): string {
			var URL = this.Host + 'pages/catalit_load_bookmarks/?uuid=' + this.FB3DOM.MetaData.UUID +
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
				// TODO: check if this 2 lines needed
				this.Bookmarks[0].XStart = this.FB3DOM.GetXPathFromPos(this.Bookmarks[0].Range.From);
				this.Bookmarks[0].XEnd = this.Bookmarks[0].XStart.slice(0);
				XML += this.Bookmarks[0].PublicXML();
				for (var j = 1; j < this.Bookmarks.length; j++) {
					if (this.Bookmarks[j].TemporaryState) {
						continue;
					}
					XML += this.Bookmarks[j].PublicXML();
				}
			}
			XML += '</FictionBookMarkup>';
			return XML;
		}

		public MakeStoreXMLAsync(Callback): string {
			if (this.Bookmarks.length) {
				for (var j = 0; j < this.Bookmarks.length; j++) {
					if (this.Bookmarks[j].TemporaryState) {
						continue;
					}
					if (!this.Bookmarks[j].XPathMappingReady) {
						clearTimeout(this.MakeStoreXMLAsyncTimeout);
						this.MakeStoreXMLAsyncTimeout = window.setTimeout(() => this.MakeStoreXMLAsync(Callback), 10);
						return;
					}
				}
				return Callback(this.MakeStoreXML());
			} else {
				return undefined;
			}
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
				var xml = this.MakeXMLFromString(this.XMLHttp.responseText);
				this.XMLHTTPResponseCallback(xml);
			}
			// TODO: add error handler
		}
		private XMLHTTPIE9Response(): void {
			if (this.XMLHttp.responseText && this.XMLHttp.responseText != '') {
				var xml = this.MakeXMLFromString(this.XMLHttp.responseText);
				this.XMLHTTPResponseCallback(xml);
			}
			// TODO: add error handler
		}

		public GetBookmarksInRange(Type?: number, Range?: IRange): IBookmark[] {
			var Range: IRange = Range || this.Reader.GetVisibleRange();
			if (this.Bookmarks.length <= 1 || !Range) {
				return [];
			}
			var NotesInRange = [];
			for (var j = 1; j < this.Bookmarks.length; j++) {
				if (Type === undefined || this.Bookmarks[j].Group == Type) {
					var BRangeTo = this.Bookmarks[j].Range.To;
					if (this.Bookmarks[j].Group == 1 && this.Bookmarks[j].XPathMappingReady) {
						// we need this workaround to fix bookmark end point Range
						// we cant check [}] without this
						// dont think this is best fix
						BRangeTo.push(this.Reader.FB3DOM.Childs[this.Bookmarks[j].Range.To[0]].Childs.length);
					}
					var BStart2RStart = FB3Reader.PosCompare(this.Bookmarks[j].Range.From, Range.From);
					var BEnd2REnd = FB3Reader.PosCompare(BRangeTo, Range.To);
					var BStart2REnd = FB3Reader.PosCompare(this.Bookmarks[j].Range.From, Range.To);
					var BEnd2RStart = FB3Reader.PosCompare(BRangeTo, Range.From);
					if (
						(BStart2RStart >= 0 && BStart2REnd <= 0) || // [{]  Bookmark start in range
						(BEnd2RStart >= 0 && BEnd2REnd <= 0) ||		// [}]  Bookmark end in range
						(BStart2RStart < 0 && BEnd2REnd > 0)		// {[]} Bookmark covers the whole range
						) {
							NotesInRange.push(this.Bookmarks[j]);
					}
				}
			}
			return NotesInRange;
		}

		private OnBookmarksSync(ActualBookmarks: IBookmarks, PrevBookmarks: IBookmarks): void {
			this.Reader.Site.OnBookmarksSync(ActualBookmarks, PrevBookmarks);
		}

		public GetForcedXpathPosition(): string | null {
			if (this.ScrollToXpath) {
				return this.ScrollToXpath;
			}
			return null;
		}
	}

	export class Bookmark implements IBookmark {
		public ID: string;
		public Range: IRange;
		public XStart: IXPath;
		public XEnd: IXPath;
		public Group: number;
		public Class: string;
		public Title: string;
		public Note: InnerFB2[];
		public RawText: string;
		public ExtractNodeText: string = "";
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
		private InitSyncXPathWithDOMTimeout: number;
		private DoSyncXPathWithDOMTimeout: number;
		private TitleLenLimit: number = 100;
		private ClassLenLimit: number = 30;
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
			this.DateTime = getUnixTime(new Date());
			this.NotSavedYet = 1;
			this.TemporaryState = 0;
			this.SkipUpdateDatetime = false;
			this.Extract = '';
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

		private RoundToWordLVLDn(Adress: IPosition) {
			var Block = this.Owner.FB3DOM.GetElementByAddr(Adress);
			var PosInBlock = Adress[Adress.length - 1];
			while (Block.Parent && !Block.TagName) {
				Block = Block.Parent;
				PosInBlock = Adress[Adress.length - 1];
				Adress.pop();
			}
			while (PosInBlock < Block.Childs.length - 1 && !Block.Childs[PosInBlock].Childs && !Block.Childs[PosInBlock].text.match(/\s$/)) {
				PosInBlock++;
			}
			Adress.push(PosInBlock);
		}
		private RoundToWordLVLUp(Adress: IPosition) {
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
			if (PosInBlock && PosInBlock > Block.Childs.length - 2)
				PosInBlock = Block.Childs.length - 2;
			while (PosInBlock > 0 && !Block.Childs[PosInBlock-1].Childs && !Block.Childs[PosInBlock-1].text.match(/\s$/)) {
				PosInBlock--;
			}
			Adress.push(PosInBlock);
		}

		private RoundToBlockLVLUp(Adress: IPosition) {
			var Block = this.Owner.FB3DOM.GetElementByAddr(Adress);
			while (Block.Parent && (!Block.TagName || !Block.IsBlock())) {
				Block = Block.Parent;
				Adress.pop();
			}
		}
		private RoundToBlockLVLDn(Adress: IPosition) {
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

		private CleanExtractNode(Text: string): string {
			var CleanText;
			// For xsd check to comply, tags should be like: <subtitle><fb:emphasis>большого формата</fb:emphasis></subtitle>
			// As workaround, now just simple clean up text from any tags at all
			CleanText = Text.replace(/<[^>]+>/gi, ' ');
			CleanText = '<p>' + CleanText + '</p>';
			return CleanText;
		}

		private GetDataFromText() {
			var PageData = new FB3DOMBlock.PageContainer();
			this.Owner.FB3DOM.GetXML( this.Range, PageData);
			this.Owner.FB3DOM.GetHTML(this.Owner.Reader.HyphON, this.Owner.Reader.BookStyleNotes, this.Range, '', 100, 100, PageData);
			//this.ExtractNodeText = PageData.BodyXML.join('');
			this.ExtractNodeText = this.CleanExtractNode(PageData.BodyXML.join(''));
			// We first remove unknown characters
			var InnerHTML = PageData.Body.join('');
			InnerHTML = InnerHTML.replace(/<a (class="footnote|[^>]+data-href=").+?<\/a>/gi, ''); // remove all note links
			InnerHTML = InnerHTML.replace(/<(?!\/?p\b|\/?strong\b|\/?em\b|\/?h\d\b)[^>]*>/, '');
			// Then we extract plain text
			this.Title = this.prepareTitle(InnerHTML.replace(/<[^>]+>|\u00AD/gi, '')).replace(/\s+\S*$/, '');
			this.RawText = InnerHTML.replace(/(\s\n\r)+/gi, ' ');
			this.RawText = this.RawText.replace(/<\/div>/gi, '</div> '); // stupid workaround
			this.RawText = this.RawText.replace(/<\/h\d>/gi, '\n');
			this.RawText = this.RawText.replace(/<\/p>/gi, '\n');
			this.RawText = this.RawText.replace(/<(\/)?strong[^>]*>/gi, '[$1b]');
			this.RawText = this.RawText.replace(/<(\/)?em[^>]*>/gi, '[$1i]');
			this.RawText = this.RawText.replace(/<[^>]+>|\u00AD/gi, '');
			this.RawText = this.RawText.replace(/^\s+|\s+$/gi, '');
			this.RawText = this.RawText.replace(/'|"/g, '');

			this.Note[0] = this.Raw2FB2(this.RawText);

			this.RawText = this.RawText.replace(/\[\/?[i,b]\]/gi, '');

			if (this.RawText == "" && InnerHTML.match(/img/i)) {
				// if someone have bookmark with img only
				this.Note[0] = "<p>" + this.Owner.Reader.Site.ViewText.Print('BOOKMARK_IMAGE_PREVIEW_TEXT') + "</p>";
			}
			// todo - should fill this.Extract with something equal|close to raw fb2 fragment
			this.XStart = this.Owner.FB3DOM.GetXPathFromPos(this.Range.From.slice(0));
			this.XEnd = this.Owner.FB3DOM.GetXPathFromPos(this.Range.To.slice(0), true);
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
				clearTimeout(this.InitSyncXPathWithDOMTimeout);
				this.InitSyncXPathWithDOMTimeout = window.setTimeout(() => this.InitSyncXPathWithDOM(), 10);
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
					clearTimeout(this.DoSyncXPathWithDOMTimeout);
					this.DoSyncXPathWithDOMTimeout = window.setTimeout(() => this.DoSyncXPathWithDOM(), 10);
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
				(this.Class ? 'class="' + this.prepareClass(this.Class) + '" ' : '') +
				(this.Title ? 'title="' + this.prepareTitle(this.Title) + '" ' : '') +
				'id="' + this.ID + '" ' +
				'selection="fb2#xpointer(' + this.MakeSelection() + ')" ' +
				'art-id="' + this.Owner.FB3DOM.MetaData.UUID + '" ' +
				'last-update="' + format(fromUnixTime(this.DateTime), "yyyy-MM-dd'T'HH:mm:ssXXX") + '"' +
				' percent="' + this.MakePercent() + '">' +
				this.GetNote() + this.GetExtract() +
			'</Selection>';
		}

		public PublicObject(): INote {
			return {
				id: this.ID,
				group: this.Group,
				last_update: format(fromUnixTime(this.DateTime), "yyyy-MM-dd'T'HH:mm:ssXXX"),
				percent: this.MakePercent(),
				xpath_start: '/' + this.MakePointer(this.XStart),
				xpath_end: '/' + this.MakePointer(this.XEnd),
				class: this.Class ? this.prepareClass(this.Class) : '',
				title: this.Title ? this.prepareTitle(this.Title) : '',
				selection_text: '<p>' + this.MakePreviewFromNote() + '</p>',
				note: this.Note[1] ? this.Note[1] : '',
				is_public: 1
			};
		}

		public ParseXML(XML: any): void { // TODO: fix, need correct type
			this.Group = parseInt(XML.getAttribute('group'));
			this.Class = XML.getAttribute('class');
			this.Title = XML.getAttribute('title');
			this.parseTitle();
			this.ID = XML.getAttribute('id').toLowerCase();
			this.MakeXPath(XML.getAttribute('selection'));
			this.DateTime = getUnixTime(parse(XML.getAttribute('last-update'), "yyyy-MM-dd'T'HH:mm:ssXXX", new Date()));
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

		public ParseObject(Note: INote): void {
			this.Group = Note.group;
			this.Class = 'default';
			this.Title = Note.title;
			this.parseTitle();
			this.ID = Note.id.toLowerCase();
			this.XStart = this.MakeXPathSub(Note.xpath_start);
			this.XEnd = Note.xpath_end ? this.MakeXPathSub(Note.xpath_end) : this.XStart;
			this.DateTime = getUnixTime(parse(Note.last_update, "yyyy-MM-dd'T'HH:mm:ssXXX", new Date()));
			this.Note[0] = Note.selection_text || '';
			this.Note[1] = Note.note || '';
			this.NotSavedYet = 0;
			this.XPathMappingReady = false;
		}

		private parseTitle(): void {
			if (this.Title == '' || this.Title == null) {
				// if Title empty, set new title group
				if (this.Group == 1) {
					this.Title = this.Owner.Reader.Site.ViewText.Print('BOOKMARK_EMPTY_TYPE_1_TEXT');
				} else if (this.Group == 3 || this.Group == 5) {
					this.Title = this.Owner.Reader.Site.ViewText.Print('BOOKMARK_EMPTY_TYPE_3_TEXT');
				}
			} else {
				//  this.Title = this.prepareTitle(this.Title);
				this.Title = this.Title; // i believe server data!
				//this.Title = this.Title.replace(/<|>/gi, '');
			}
		}

		private prepareTitle(str: string): string {
			return this.prepareAnything(str, this.TitleLenLimit);
		}
		private prepareClass(str: string): string {
			if (str.length < 1) {
				return 'default';
			}
			return this.prepareAnything(str, this.ClassLenLimit);
		}
		private prepareAnything(str: string, len: number): string {
			str = str.replace(/<|>/gi, '');
			return str.substr(0, len);
		}
		private MakePercent(): number {
			if (this.Group != 0) return 0;
			var percent = Math.round(this.Owner.Reader.CurPosPercent());
			if (percent > 100) {
				percent = 100;
			} else if (percent < 0) {
				percent = 0;
			}
			return percent;
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
					if (child.childNodes.length) {
						res += child.childNodes[0].nodeValue;
					} else {
						res += "";
					}
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
		private GetExtract(): string {
			//return this.Extract;
			return '<Extract ' +
				this.GetRawText() +
				'original-location="fb2#xpointer(' + this.MakeExtractSelection() + ')">' +
				this.ExtractNode() + '</Extract>';
		}
		private ExtractNode(): string {
			return  this.ExtractNodeText;
		}
		private GetRawText(): string {
			if (!this.RawText) return '';
			return 'selection-text="' + this.RawText + '" ';
		}
		private MakeExtractSelection(): string {
			var Start: string = this.MakePointer(this.XStart);
			return '/' + Start.replace(/\.\d+$/, '') + '';
		}

		private MakeSelection(): string {
			var Start: string = this.MakePointer(this.XStart);
			if (FB3DOMBlock.XPathCompare(this.XStart, this.XEnd) == 0) {
				return 'point(/' + Start + ')';
			}
			return 'point(/' + Start + ')/range-to(point(/' + this.MakePointer(this.XEnd) + '))';
		}

		private MakePointer(X: IXPath): string {
			X = X.slice(0);
			var last = X.pop() + '';
			return X.join('/') + ((/^\./).test(last) ? '' : '/') + last + ((/^\./).test(last) ? '' : '.0');
		}

		private MakeXPath(X: string): void {
			var p = X.match(/(\/\d+|\.\d+)+/g);
			this.XStart = this.MakeXPathSub(p[0]);
			if (p.length == 1) {
				this.XEnd = this.XStart.slice(0);
			} else {
				this.XEnd = this.MakeXPathSub(p[1]);
			}
		}

		public MakeXPathSub(str: string): IXPath {
			return str.replace(/^\//, '').replace(/\.0$/, '').replace('.', '/.').split('/');
		}
	}
}
