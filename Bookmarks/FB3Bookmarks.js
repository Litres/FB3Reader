/// <reference path="FB3BookmarksHead.ts" />
/// <reference path="../plugins/moment.d.ts" />
var FB3Bookmarks;
(function (FB3Bookmarks) {
    FB3Bookmarks.ActiveXXMLHttp = true;
    var LitResBookmarksProcessor = (function () {
        function LitResBookmarksProcessor(FB3DOM, ArtID, LitresSID, LitresLocalXML) {
            this.FB3DOM = FB3DOM;
            this.ArtID = ArtID;
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
            this.Host = 'http://www.litres.ru/';
            //			this.aldebaran = true;
            //// local testing part end
            if (document.all && !window.atob && window.XDomainRequest && this.aldebaran) {
                // IE8-IE9 cant do cross-domain ajax properly (IE7 i think cant do it at all)
                // this workaround send empty clean request, no params, no session, no cookies
                // answer must be text/plain
                this.XMLHttp = new window.XDomainRequest(); // IE9 =< fix
                this.xhrIE9 = true;
            }
            else if (window.ActiveXObject && FB3Bookmarks.ActiveXXMLHttp) {
                this.XMLHttp = new window.ActiveXObject("Microsoft.XMLHTTP");
            }
            else {
                this.XMLHttp = new XMLHttpRequest();
            }
            this.SID = LitresSID;
            this.SaveAuto = false;
            this.LocalXML = LitresLocalXML;
        }
        LitResBookmarksProcessor.prototype.AddBookmark = function (Bookmark) {
            Bookmark.N = this.Bookmarks.length;
            Bookmark.Owner = this;
            this.Bookmarks.push(Bookmark);
        };
        LitResBookmarksProcessor.prototype.DropBookmark = function (Bookmark) {
            for (var I = 0; I < this.Bookmarks.length; I++) {
                this.Bookmarks[I].N = I;
                if (this.Bookmarks[I].ID == Bookmark.ID) {
                    this.DeletedBookmarks[this.Bookmarks[I].ID] = true;
                    this.Bookmarks.splice(I, 1);
                    I--;
                }
            }
        };
        LitResBookmarksProcessor.prototype.ReNumberBookmarks = function () {
            for (var I = 0; I < this.Bookmarks.length; I++) {
                this.Bookmarks[I].N = I;
            }
        };
        LitResBookmarksProcessor.prototype.LoadFromCache = function () {
            if (this.LocalXML) {
                var XML = this.MakeXMLFromString(this.LocalXML);
                this.LocalXML = null;
                this.AfterTransferFromServerComplete(XML);
            }
        };
        LitResBookmarksProcessor.prototype.Load = function (Callback) {
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
        };
        LitResBookmarksProcessor.prototype.MakeXMLFromString = function (XMLString) {
            var parseXml;
            if (window.DOMParser) {
                parseXml = function (xmlStr) {
                    return (new window.DOMParser()).parseFromString(xmlStr, "text/xml");
                };
            }
            else if (typeof window.ActiveXObject != "undefined" && new window.ActiveXObject("Microsoft.XMLDOM")) {
                parseXml = function (xmlStr) {
                    var xmlDoc = new window.ActiveXObject("Microsoft.XMLDOM");
                    xmlDoc.async = "false";
                    xmlDoc.loadXML(xmlStr);
                    return xmlDoc;
                };
            }
            else {
                parseXml = function () {
                    return null;
                };
            }
            return parseXml(XMLString);
        };
        LitResBookmarksProcessor.prototype.AfterTransferFromServerComplete = function (XML) {
            var _this = this;
            this.ParseXML(XML);
            this.WaitedToRemapBookmarks = 0;
            for (var I = 0; I < this.Bookmarks.length; I++) {
                if (!this.Bookmarks[I].XPathMappingReady) {
                    this.Bookmarks[I].RemapWithDOM(function () { return _this.OnChildBookmarkSync(); });
                    this.WaitedToRemapBookmarks++;
                }
            }
            this.CheckWaitedSync();
        };
        LitResBookmarksProcessor.prototype.OnChildBookmarkSync = function () {
            this.WaitedToRemapBookmarks--;
            this.CheckWaitedSync();
        };
        LitResBookmarksProcessor.prototype.CheckWaitedSync = function () {
            if (!this.WaitedToRemapBookmarks) {
                this.WaitForData = false;
                if (this.LoadEndCallback) {
                    this.LoadEndCallback(this);
                }
                if (this.ReadyCallback) {
                    this.ReadyCallback();
                }
            }
        };
        LitResBookmarksProcessor.prototype.ParseXML = function (XML) {
            // todo some xml-parsing upon data receive here to make pretty JS-bookmarks from ugly XML
            var Rows = XML.querySelectorAll('Selection');
            this.LoadDateTime = moment().unix();
            if (XML.documentElement.getAttribute('lock-id')) {
                this.LockID = XML.documentElement.getAttribute('lock-id');
            }
            if (Rows.length) {
                // console.log('we have selection');
                for (var j = 0; j < Rows.length; j++) {
                    var NewBookmark = new Bookmark(this);
                    NewBookmark.ParseXML(Rows[j]);
                    if (NewBookmark.Group == 0) {
                        this.Bookmarks[0] = NewBookmark;
                    }
                    else {
                        this.AddBookmark(NewBookmark);
                    }
                }
            }
            else {
            }
        };
        LitResBookmarksProcessor.prototype.Store = function () {
            this.ReLoad(true);
        };
        LitResBookmarksProcessor.prototype.StoreBookmarks = function () {
            var _this = this;
            var XML = this.MakeStoreXML();
            if (this.Reader.Site.BeforeBookmarksAction()) {
                var Data = this.MakeStoreData(XML);
                var URL = this.MakeStoreURL();
                this.XMLHTTPResponseCallback = function () {
                    _this.Reader.Site.AfterStoreBookmarks();
                };
                this.SendNotesRequest(URL, 'POST', Data);
            }
        };
        LitResBookmarksProcessor.prototype.ApplyPosition = function () {
            // If DOM.TOC not ready yet, we can't expand XPath for any way - we wait while Reader.LoadDone fire this
            if (!this.FB3DOM.Ready || this.WaitForData) {
                return false;
            }
            this.Ready = true;
            this.Bookmarks[0].SkipUpdateDatetime = true; // skip update current pos time after localBookmakrs load
            this.Reader.GoTO(this.Bookmarks[0].Range.From.slice(0));
            return true;
        };
        LitResBookmarksProcessor.prototype.ReLoad = function (SaveAutoState) {
            var _this = this;
            var TemporaryNotes = new LitResBookmarksProcessor(this.FB3DOM, this.SID);
            TemporaryNotes.Host = this.Host;
            TemporaryNotes.Reader = this.Reader;
            // TemporaryNotes.ReadyCallback = this.ReadyCallback;
            TemporaryNotes.aldebaran = this.aldebaran;
            TemporaryNotes.Bookmarks[0].Group = -1;
            this.SaveAuto = SaveAutoState;
            TemporaryNotes.SaveAuto = this.SaveAuto;
            TemporaryNotes.Load(function (Bookmarks) { return _this.ReLoadComplete(Bookmarks); });
        };
        LitResBookmarksProcessor.prototype.ReLoadComplete = function (TemporaryNotes) {
            // merge data from TemporaryNotes to this, then dispose of temporary LitResBookmarksProcessor
            // than check if new "current position" is newer, if so - goto it
            // keep in mind this.Bookmarks[0] is always here and is the current position,
            // so we skip it on merge
            var AnyUpdates = false;
            this.Reader.Site.CanStoreBookmark = false; // TODO fix in future
            if (this.Bookmarks.length) {
                var Found;
                for (var i = 1; i < this.Bookmarks.length; i++) {
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
                for (var j = 1; j < TemporaryNotes.Bookmarks.length; j++) {
                    Found = 0;
                    if (this.DeletedBookmarks[TemporaryNotes.Bookmarks[j].ID]) {
                        continue;
                    }
                    for (var i = 1; i < this.Bookmarks.length; i++) {
                        if (this.Bookmarks[i].ID == TemporaryNotes.Bookmarks[j].ID) {
                            // we have new bookmark with same ID
                            if (this.Bookmarks[i].DateTime < TemporaryNotes.Bookmarks[j].DateTime) {
                                this.Bookmarks[i].Detach();
                            }
                            else {
                                // if not new, skip
                                Found = 1;
                            }
                            break;
                        }
                        else if (this.SaveAuto && TemporaryNotes.Bookmarks[j].DateTime < this.LoadDateTime) {
                            Found = 1;
                        }
                    }
                    if (!Found && TemporaryNotes.Bookmarks[j].Group >= 0) {
                        AnyUpdates = true;
                        this.AddBookmark(TemporaryNotes.Bookmarks[j]);
                    }
                }
            }
            else {
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
                this.Reader.GoTO(TemporaryNotes.Bookmarks[0].Range.From);
                if (AnyUpdates &&
                    FB3Reader.PosCompare(this.Bookmarks[0].Range.From, TemporaryNotes.Bookmarks[0].Range.From) == 0) {
                    this.Reader.Redraw();
                }
            }
            else if (AnyUpdates) {
                // Updated bookmarks data from server - we should redraw the page in case there are new notes
                this.Reader.Redraw();
            }
            if (this.SaveAuto) {
                this.LockID = TemporaryNotes.LockID;
                this.LoadDateTime = TemporaryNotes.LoadDateTime;
                this.StoreBookmarks();
            }
        };
        LitResBookmarksProcessor.prototype.MakeLoadURL = function () {
            var URL = this.Host + 'pages/catalit_load_bookmarks/?uuid=' + this.ArtID +
                (this.SaveAuto ? '&set_lock=1' : '') + '&sid=' + this.SID + '&r=' + Math.random();
            return URL;
        };
        LitResBookmarksProcessor.prototype.MakeStoreURL = function () {
            return this.Host + 'pages/catalit_store_bookmarks/';
        };
        LitResBookmarksProcessor.prototype.MakeStoreData = function (XML) {
            var Data = 'uuid=' + this.FB3DOM.MetaData.UUID + '&data=' + encodeURIComponent(XML) +
                '&lock_id=' + encodeURIComponent(this.LockID) + '&sid=' + this.SID + '&r=' + Math.random();
            return Data;
        };
        LitResBookmarksProcessor.prototype.MakeStoreXML = function () {
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
        };
        LitResBookmarksProcessor.prototype.MakeStoreXMLAsync = function (Callback) {
            var _this = this;
            if (this.Bookmarks.length) {
                for (var j = 0; j < this.Bookmarks.length; j++) {
                    if (this.Bookmarks[j].TemporaryState) {
                        continue;
                    }
                    if (!this.Bookmarks[j].XPathMappingReady) {
                        clearTimeout(this.MakeStoreXMLAsyncTimeout);
                        this.MakeStoreXMLAsyncTimeout = setTimeout(function () { return _this.MakeStoreXMLAsync(Callback); }, 10);
                        return;
                    }
                }
                return Callback(this.MakeStoreXML());
            }
            else {
                return undefined;
            }
        };
        LitResBookmarksProcessor.prototype.SendNotesRequest = function (URL, Type, Data) {
            var _this = this;
            var Data = Data || null;
            if (this.xhrIE9) {
                this.XMLHttp.onload = function () { return _this.XMLHTTPIE9Response(); };
            }
            else {
                this.XMLHttp.onreadystatechange = function () { return _this.XMLHTTPResponse(); };
            }
            this.XMLHttp.open(Type, URL, true);
            if (!this.xhrIE9) {
                this.XMLHttp.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
            }
            this.XMLHttp.send(Data);
        };
        LitResBookmarksProcessor.prototype.XMLHTTPResponse = function () {
            if (this.XMLHttp.readyState == 4 && this.XMLHttp.status == 200) {
                var xml = this.MakeXMLFromString(this.XMLHttp.responseText);
                this.XMLHTTPResponseCallback(xml);
            }
            // TODO: add error handler
        };
        LitResBookmarksProcessor.prototype.XMLHTTPIE9Response = function () {
            if (this.XMLHttp.responseText && this.XMLHttp.responseText != '') {
                var xml = this.MakeXMLFromString(this.XMLHttp.responseText);
                this.XMLHTTPResponseCallback(xml);
            }
            // TODO: add error handler
        };
        LitResBookmarksProcessor.prototype.GetBookmarksInRange = function (Type, Range) {
            var Range = Range || this.Reader.GetVisibleRange();
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
                    if ((BStart2RStart >= 0 && BStart2REnd <= 0) ||
                        (BEnd2RStart >= 0 && BEnd2REnd <= 0) ||
                        (BStart2RStart < 0 && BEnd2REnd > 0) // {[]} Bookmark covers the whole range
                    ) {
                        NotesInRange.push(this.Bookmarks[j]);
                    }
                }
            }
            return NotesInRange;
        };
        return LitResBookmarksProcessor;
    })();
    FB3Bookmarks.LitResBookmarksProcessor = LitResBookmarksProcessor;
    var Bookmark = (function () {
        function Bookmark(Owner) {
            this.Owner = Owner;
            this.NotePreviewLimit = 140;
            this.TitleLenLimit = 100;
            this.ClassLenLimit = 30;
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
        Bookmark.prototype.RoundClone = function (ToBlock) {
            var Clone = new Bookmark(this.Owner);
            Clone.Range = FB3Reader.RangeClone(this.Range);
            if (ToBlock) {
                this.RoundToBlockLVLUp(Clone.Range.From);
                this.RoundToBlockLVLDn(Clone.Range.To);
            }
            else {
                this.RoundToWordLVLUp(Clone.Range.From);
                this.RoundToWordLVLDn(Clone.Range.To);
            }
            Clone.GetDataFromText();
            Clone.Group = this.Group;
            Clone.Class = this.Class;
            return Clone;
        };
        Bookmark.prototype.Detach = function () {
            this.Owner.DropBookmark(this);
            // this.Owner.Store();
        };
        Bookmark.prototype.RoundToWordLVLDn = function (Adress) {
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
        };
        Bookmark.prototype.RoundToWordLVLUp = function (Adress) {
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
            while (PosInBlock > 0 && !Block.Childs[PosInBlock - 1].Childs && !Block.Childs[PosInBlock - 1].text.match(/\s$/)) {
                PosInBlock--;
            }
            Adress.push(PosInBlock);
        };
        Bookmark.prototype.RoundToBlockLVLUp = function (Adress) {
            var Block = this.Owner.FB3DOM.GetElementByAddr(Adress);
            while (Block.Parent && (!Block.TagName || !Block.IsBlock())) {
                Block = Block.Parent;
                Adress.pop();
            }
        };
        Bookmark.prototype.RoundToBlockLVLDn = function (Adress) {
            this.RoundToBlockLVLUp(Adress);
            var Block = this.Owner.FB3DOM.GetElementByAddr(Adress);
            if (Block.TagName && Block.IsBlock()) {
                return;
            }
            if (Block.Parent.Childs.length > Block.ID + 1) {
                Adress[Adress.length - 1]++;
            }
            else {
                Adress.push(Block.Childs.length);
            }
        };
        Bookmark.prototype.ClassName = function () {
            return this.Owner.ClassPrefix + 'selec_' + this.Group + '_' + this.Class + ' ' + this.Owner.ClassPrefix + 'selectid_' + this.N;
        };
        Bookmark.prototype.GetDataFromText = function () {
            var PageData = new FB3DOM.PageContainer();
            this.Owner.FB3DOM.GetHTML(this.Owner.Reader.HyphON, this.Owner.Reader.BookStyleNotes, this.Range, '', 100, 100, PageData);
            // We first remove unknown characters
            var InnerHTML = PageData.Body.join('');
            InnerHTML = InnerHTML.replace(/<a (class="footnote|[^>]+data-href=").+?<\/a>/gi, ''); // remove all note links
            InnerHTML = InnerHTML.replace(/<(?!\/?p\b|\/?strong\b|\/?em\b)[^>]*>/, '');
            // Then we extract plain text
            this.Title = this.prepareTitle(InnerHTML.replace(/<[^>]+>|\u00AD/gi, '')).replace(/\s+\S*$/, '');
            this.RawText = InnerHTML.replace(/(\s\n\r)+/gi, ' ');
            this.RawText = this.RawText.replace(/<\/div>/gi, '</div> '); // stupid workaround
            this.RawText = this.RawText.replace(/<(\/)?strong[^>]*>/gi, '[$1b]');
            this.RawText = this.RawText.replace(/<(\/)?em[^>]*>/gi, '[$1i]');
            this.RawText = this.RawText.replace(/<\/p>/gi, '\n');
            this.RawText = this.RawText.replace(/<\/?[^>]+>|\u00AD/gi, '');
            this.RawText = this.RawText.replace(/^\s+|\s+$/gi, '');
            this.Note[0] = this.Raw2FB2(this.RawText);
            if (this.RawText == "" && InnerHTML.match(/img/i)) {
                // if someone have bookmark with img only
                this.Note[0] = "<p>" + this.Owner.Reader.Site.ViewText.Print('BOOKMARK_IMAGE_PREVIEW_TEXT') + "</p>";
            }
            // todo - should fill this.Extract with something equal|close to raw fb2 fragment
            this.XStart = this.Owner.FB3DOM.GetXPathFromPos(this.Range.From.slice(0));
            this.XEnd = this.Owner.FB3DOM.GetXPathFromPos(this.Range.To.slice(0), true);
        };
        Bookmark.prototype.Raw2FB2 = function (RawText) {
            RawText = RawText.replace(/\[(\/)?b[^\]]*\]/gi, '<$1strong>');
            RawText = RawText.replace(/\[(\/)?i[^\]]*\]/gi, '<$1emphasis>');
            RawText = '<p>' + RawText.replace(/\n/gi, '</p><p>') + '</p>';
            return RawText;
        };
        Bookmark.prototype.MakeSelectionID = function () {
            var MakeSelectionIDSub = function (chars, len) {
                var text = '';
                for (var i = 0; i < len; i++) {
                    text += chars.charAt(Math.floor(Math.random() * chars.length));
                }
                return text;
            };
            var text = '', chars = 'abcdef0123456789';
            text += MakeSelectionIDSub(chars, 8) + '-';
            text += MakeSelectionIDSub(chars, 4) + '-';
            text += MakeSelectionIDSub(chars, 4) + '-';
            text += MakeSelectionIDSub(chars, 4) + '-';
            text += MakeSelectionIDSub(chars, 12);
            return text;
        };
        Bookmark.prototype.RemapWithDOM = function (Callback) {
            this.AfterRemapCallback = Callback;
            this.InitSyncXPathWithDOM();
        };
        Bookmark.prototype.InitSyncXPathWithDOM = function () {
            var _this = this;
            this.XPathMappingReady = false;
            if (!this.Owner.FB3DOM.DataChunks) {
                clearTimeout(this.InitSyncXPathWithDOMTimeout);
                this.InitSyncXPathWithDOMTimeout = setTimeout(function () { return _this.InitSyncXPathWithDOM(); }, 10);
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
                this.Owner.FB3DOM.LoadChunks(ChunksToLoad, function () { return _this.DoSyncXPathWithDOM(); });
            }
            else {
                this.DoSyncXPathWithDOM();
            }
        };
        Bookmark.prototype.DoSyncXPathWithDOM = function () {
            var _this = this;
            for (var I = 0; I < this.RequiredChunks.length; I++) {
                if (this.Owner.FB3DOM.DataChunks[this.RequiredChunks[I]].loaded != 2) {
                    // There is at least one chunk still being loaded - we will return later
                    clearTimeout(this.DoSyncXPathWithDOMTimeout);
                    this.DoSyncXPathWithDOMTimeout = setTimeout(function () { return _this.DoSyncXPathWithDOM(); }, 10);
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
        };
        Bookmark.prototype.ChunksRequired = function () {
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
        };
        Bookmark.prototype.PublicXML = function () {
            return '<Selection group="' + this.Group + '" ' +
                (this.Class ? 'class="' + this.prepareClass(this.Class) + '" ' : '') +
                (this.Title ? 'title="' + this.prepareTitle(this.Title) + '" ' : '') +
                'id="' + this.ID + '" ' +
                'selection="fb2#xpointer(' + this.MakeSelection() + ')" ' +
                'art-id="' + this.Owner.FB3DOM.MetaData.UUID + '" ' +
                'last-update="' + moment.unix(this.DateTime).format("YYYY-MM-DDTHH:mm:ssZ") + '"' +
                this.MakePercent() + '>' +
                this.GetNote() + this.GetExtract() +
                '</Selection>';
        };
        Bookmark.prototype.ParseXML = function (XML) {
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
                }
                else {
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
                }
                else {
                    ExtractHTML = this.parseXMLNote(tmpExtract);
                }
                this.Extract = ExtractHTML;
            }
            // this.Range; // will be filled in ReMapping
        };
        Bookmark.prototype.parseTitle = function () {
            if (this.Title == '' || this.Title == null) {
                // if Title empty, set new title group
                if (this.Group == 1) {
                    this.Title = this.Owner.Reader.Site.ViewText.Print('BOOKMARK_EMPTY_TYPE_1_TEXT');
                }
                else if (this.Group == 3 || this.Group == 5) {
                    this.Title = this.Owner.Reader.Site.ViewText.Print('BOOKMARK_EMPTY_TYPE_3_TEXT');
                }
            }
            else {
                //  this.Title = this.prepareTitle(this.Title);
                this.Title = this.Title; // i believe server data!
            }
        };
        Bookmark.prototype.prepareTitle = function (str) {
            return this.prepareAnything(str, this.TitleLenLimit);
        };
        Bookmark.prototype.prepareClass = function (str) {
            if (str.length < 1) {
                return 'default';
            }
            return this.prepareAnything(str, this.ClassLenLimit);
        };
        Bookmark.prototype.prepareAnything = function (str, len) {
            return str.substr(0, len);
        };
        Bookmark.prototype.MakePercent = function () {
            if (this.Group != 0)
                return '';
            var percent = Math.round(this.Owner.Reader.CurPosPercent());
            if (percent > 100) {
                percent = 100;
            }
            else if (percent < 0) {
                percent = 0;
            }
            return ' percent="' + percent + '"';
        };
        Bookmark.prototype.parseXMLNote = function (el) {
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
                }
                else {
                    if (child.childNodes.length) {
                        res += child.childNodes[0].nodeValue;
                    }
                    else {
                        res += "";
                    }
                }
                res += "</" + child.tagName + ">";
            }
            return res;
        };
        Bookmark.prototype.GetNote = function () {
            var out = '';
            if (this.Note[0] != '') {
                out += '<Note><p>' + this.MakePreviewFromNote() + '</p></Note>';
            }
            if (this.Note[1] != '') {
                out += '<Note>' + this.Note[1] + '</Note>';
            }
            return out;
        };
        Bookmark.prototype.MakePreviewFromNote = function () {
            if (this.Note[0] == '') {
                return '';
            }
            var tmpDiv = document.createElement('div');
            tmpDiv.innerHTML = this.Note[0];
            var text = this.PreparePreviewText(tmpDiv.querySelectorAll('p'));
            text = text.length > this.NotePreviewLimit ? text.substring(0, this.NotePreviewLimit) + '…' : text;
            tmpDiv = undefined;
            return text;
        };
        Bookmark.prototype.PreparePreviewText = function (obj) {
            var text = '';
            for (var j = 0; j < obj.length; j++) {
                var tmp = obj[j].innerText || obj[j].textContent;
                text += tmp;
                if (j != obj.length - 1) {
                    text += ' ';
                }
            }
            return text;
        };
        Bookmark.prototype.GetExtract = function () {
            return this.Extract;
            return '<Extract ' +
                this.GetRawText() +
                'original-location="fb2#xpointer(' + this.MakeExtractSelection() + ')">' +
                this.ExtractNode() + '</Extract>';
        };
        Bookmark.prototype.ExtractNode = function () {
            // TODO: fill with code
            return '<p>or4</p>';
        };
        Bookmark.prototype.GetRawText = function () {
            if (!this.RawText)
                return '';
            return 'selection-text="' + this.RawText + '" ';
        };
        Bookmark.prototype.MakeExtractSelection = function () {
            var Start = this.MakePointer(this.XStart);
            return '/1/' + Start.replace(/\.\d+$/, '') + '';
        };
        Bookmark.prototype.MakeSelection = function () {
            var Start = this.MakePointer(this.XStart);
            if (FB3DOM.XPathCompare(this.XStart, this.XEnd) == 0)
                return 'point(/1/' + Start + ')';
            return 'point(/1/' + Start + ')/range-to(point(/1/' + this.MakePointer(this.XEnd) + '))';
        };
        Bookmark.prototype.MakePointer = function (X) {
            X = X.slice(0);
            var last = X.pop() + '';
            return X.join('/') + ((/^\./).test(last) ? '' : '/') + last + ((/^\./).test(last) ? '' : '.0');
        };
        Bookmark.prototype.MakeXPath = function (X) {
            var p = X.match(/\/1\/(.[^\)]*)/g);
            var MakeXPathSub = function (str) {
                return str.replace(/^\/1\//, '').replace(/\.0$/, '').replace('.', '/.').split('/');
            };
            this.XStart = MakeXPathSub(p[0]);
            if (p.length == 1) {
                this.XEnd = this.XStart.slice(0);
            }
            else {
                this.XEnd = MakeXPathSub(p[1]);
            }
        };
        return Bookmark;
    })();
    FB3Bookmarks.Bookmark = Bookmark;
})(FB3Bookmarks || (FB3Bookmarks = {}));
//# sourceMappingURL=FB3Bookmarks.js.map