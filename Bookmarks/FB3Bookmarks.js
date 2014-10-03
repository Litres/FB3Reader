/// <reference path="FB3BookmarksHead.ts" />
/// <reference path="../plugins/moment.d.ts" />
var FB3Bookmarks;
(function (FB3Bookmarks) {
    var LitResBookmarksProcessor = (function () {
        function LitResBookmarksProcessor(FB3DOM, LitresSID, LitresLocalXML) {
            this.FB3DOM = FB3DOM;
            this.Ready = false;

            // this.FB3DOM.Bookmarks.push(this);
            this.ClassPrefix = 'my_';
            this.Bookmarks = new Array();
            this.DeletedBookmarks = {};
            this.AddBookmark(new Bookmark(this));
            this.WaitForData = true;
            if (window.ActiveXObject) {
                this.XMLHttp = new window.ActiveXObject("Microsoft.XMLHTTP");
            } else {
                this.XMLHttp = new XMLHttpRequest();
            }
            this.Host = '/'; // TODO: replace
            this.SID = LitresSID;
            this.SaveAuto = false;
            this.LocalXML = LitresLocalXML;
        }
        LitResBookmarksProcessor.prototype.AddBookmark = function (Bookmark) {
            Bookmark.N = this.Bookmarks.length;
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

        LitResBookmarksProcessor.prototype.LoadFromCache = function (Callback) {
            this.LoadEndCallback = Callback;
            if (this.LocalXML) {
                var XML = this.MakeXMLFromString(this.LocalXML);
                this.LocalXML = null;
                this.AfterTransferFromServerComplete(XML);
                this.ReLoad();
            } else {
                this.Load(Callback);
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
        };

        LitResBookmarksProcessor.prototype.AfterTransferFromServerComplete = function (XML) {
            var _this = this;
            this.ParseXML(XML);
            this.WaitedToRemapBookmarks = 0;
            for (var I = 0; I < this.Bookmarks.length; I++) {
                if (!this.Bookmarks[I].XPathMappingReady) {
                    this.Bookmarks[I].RemapWithDOM(function () {
                        return _this.OnChildBookmarkSync();
                    });
                    this.WaitedToRemapBookmarks++;
                }
            }
            if (!this.WaitedToRemapBookmarks) {
                this.WaitForData = false;
                this.LoadEndCallback(this);
            }
        };

        LitResBookmarksProcessor.prototype.OnChildBookmarkSync = function () {
            this.WaitedToRemapBookmarks--;
            if (!this.WaitedToRemapBookmarks) {
                this.WaitForData = false;
                this.LoadEndCallback(this);
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
                for (var j = 0; j < Rows.length; j++) {
                    var NewBookmark = new Bookmark(this);
                    NewBookmark.ParseXML(Rows[j]);
                    if (NewBookmark.Group == 0) {
                        this.Bookmarks[0] = NewBookmark;
                    } else {
                        this.AddBookmark(NewBookmark);
                    }
                }
            } else {
                // console.log('we dont have any selections on server');
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
            this.Reader.GoTO(this.Bookmarks[0].Range.From.slice(0));
            return true;
        };

        LitResBookmarksProcessor.prototype.ReLoad = function (SaveAutoState) {
            var _this = this;
            var TemporaryNotes = new LitResBookmarksProcessor(this.FB3DOM, this.SID);
            TemporaryNotes.Reader = this.Reader;
            TemporaryNotes.Bookmarks[0].Group = -1;
            this.SaveAuto = SaveAutoState;
            TemporaryNotes.SaveAuto = this.SaveAuto;
            TemporaryNotes.Load(function (Bookmarks) {
                return _this.ReLoadComplete(Bookmarks);
            });
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
                    if (this.DeletedBookmarks[TemporaryNotes.Bookmarks[j].ID])
                        continue;
                    for (var i = 1; i < this.Bookmarks.length; i++) {
                        if (this.Bookmarks[i].ID == TemporaryNotes.Bookmarks[j].ID) {
                            if (this.Bookmarks[i].DateTime < TemporaryNotes.Bookmarks[j].DateTime) {
                                this.Bookmarks[i].Detach();
                            } else {
                                Found = 1;
                            }
                            break;
                        } else if (TemporaryNotes.Bookmarks[j].DateTime < this.LoadDateTime) {
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
            if (!TemporaryNotes.Bookmarks[0].NotSavedYet && this.Bookmarks[0].DateTime < TemporaryNotes.Bookmarks[0].DateTime) {
                // Newer position from server
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
        };

        LitResBookmarksProcessor.prototype.MakeLoadURL = function () {
            var URL = this.Host + 'pages/catalit_load_bookmarks/?uuid=' + this.Reader.ArtID + (this.SaveAuto ? '&set_lock=1' : '') + '&sid=' + this.SID + '&r=' + Math.random();
            return URL;
        };
        LitResBookmarksProcessor.prototype.MakeStoreURL = function () {
            return this.Host + 'pages/catalit_store_bookmarks/';
        };
        LitResBookmarksProcessor.prototype.MakeStoreData = function (XML) {
            var Data = 'uuid=' + this.FB3DOM.MetaData.UUID + '&data=' + encodeURIComponent(XML) + '&lock_id=' + encodeURIComponent(this.LockID) + '&sid=' + this.SID + '&r=' + Math.random();
            return Data;
        };

        LitResBookmarksProcessor.prototype.MakeStoreXML = function () {
            var XML = '<FictionBookMarkup xmlns="http://www.gribuser.ru/xml/fictionbook/2.0/markup" ' + 'xmlns:fb="http://www.gribuser.ru/xml/fictionbook/2.0" lock-id="' + this.LockID + '">';
            if (this.Bookmarks.length) {
                this.Bookmarks[0].XStart = this.FB3DOM.GetXPathFromPos(this.Bookmarks[0].Range.From);
                this.Bookmarks[0].XEnd = this.Bookmarks[0].XStart.slice(0);
                XML += this.Bookmarks[0].PublicXML();
                for (var j = 1; j < this.Bookmarks.length; j++) {
                    if (this.Bookmarks[j].TemporaryState)
                        continue;
                    XML += this.Bookmarks[j].PublicXML();
                }
            }
            XML += '</FictionBookMarkup>';
            return XML;
        };

        LitResBookmarksProcessor.prototype.SendNotesRequest = function (URL, Type, Data) {
            var _this = this;
            var Data = Data || null;
            this.XMLHttp.onreadystatechange = function () {
                return _this.XMLHTTPResponse();
            };
            this.XMLHttp.open(Type, URL, true);
            this.XMLHttp.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
            this.XMLHttp.send(Data);
        };
        LitResBookmarksProcessor.prototype.XMLHTTPResponse = function () {
            if (this.XMLHttp.readyState == 4 && this.XMLHttp.status == 200) {
                this.XMLHTTPResponseCallback(this.XMLHttp.responseXML);
            }
            // TODO: add error handler
        };

        LitResBookmarksProcessor.prototype.GetBookmarksInRange = function (Range) {
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

                    //					console.log('xps ' + this.Bookmarks[j].Range.From.join('_') + ' ' + Range.From.join('_') + ' ' + xps);
                    //					console.log('xpe ' + this.Bookmarks[j].Range.To.join('_') + ' ' + Range.To.join('_') + ' ' + xpe);
                    //					console.log('xps_e ' + this.Bookmarks[j].Range.From.join('_') + ' ' + Range.To.join('_') + ' ' + xps_e);
                    //					console.log('xpe_s ' + this.Bookmarks[j].Range.To.join('_') + ' ' + Range.From.join('_') + ' ' + xpe_s);
                    if ((xps >= 0 && xpe <= 0) || (xps >= 0 && xps_e <= 0) || (xpe_s >= 0 && xpe <= 0) || (xps < 0 && xpe > 0)) {
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
            this.ID = this.MakeSelectionID();
            this.Group = 0;
            this.Class = 'default';
            this.Range = { From: [0], To: [0] };
            this.XStart = [0];
            this.XEnd = [0];
            this.XPathMappingReady = true;
            this.N = -1;
            this.DateTime = moment().unix();
            this.NotSavedYet = 1;
            this.TemporaryState = 0;
        }
        Bookmark.prototype.InitFromXY = function (X, Y) {
            return this.InitFromPosition(this.Owner.Reader.ElementAtXY(X, Y));
        };

        Bookmark.prototype.InitFromXPath = function (XPath) {
            return this.InitFromPosition(this.Owner.FB3DOM.GetAddrByXPath(XPath));
        };

        Bookmark.prototype.InitFromRange = function (Range) {
            var Element = this.Owner.FB3DOM.GetElementByAddr(Range.From);
            return this.InitFromPosition(Element.Position());
        };

        Bookmark.prototype.InitFromPosition = function (Position) {
            if (Position) {
                this.Range.From = Position.slice(0);
                this.Range.To = Position;
                this.GetDataFromText();
                return true;
            } else {
                return undefined;
            }
        };

        Bookmark.prototype.ExtendToXY = function (X, Y) {
            var BaseTo = this.Owner.Reader.ElementAtXY(X, Y);
            if (BaseTo && BaseTo.length > 1) {
                this.Range.To = BaseTo;
                this.GetDataFromText();
                return true;
            } else {
                return undefined;
            }
        };

        Bookmark.prototype.RoundClone = function (ToBlock) {
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
        };

        Bookmark.prototype.Detach = function () {
            this.Owner.DropBookmark(this);
            // this.Owner.Store();
        };

        Bookmark.prototype.RoundToWordLVLDn = function (Adress) {
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
        };
        Bookmark.prototype.RoundToWordLVLUp = function (Adress) {
            var Block = this.Owner.FB3DOM.GetElementByAddr(Adress);
            if (Block.IsBlock()) {
                return;
            }
            var PosInBlock = Adress[Adress.length - 1];
            while (Block.Parent && (!Block.TagName || !Block.IsBlock())) {
                Block = Block.Parent;
                PosInBlock = Adress[Adress.length - 1];
                Adress.pop();
            }
            if (PosInBlock < Block.Childs.length - 2) {
                PosInBlock++;
            }
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
            } else {
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
            var InnerHTML = PageData.Body.join('').replace(/<(?!\/?p\b|\/?strong\b|\/?em\b)[^>]*>/, '');

            // Then we extract plain text
            this.Title = InnerHTML.replace(/<[^>]+>|\u00AD/gi, '').substr(0, 50).replace(/\s+\S*$/, '');
            this.RawText = InnerHTML.replace(/(\s\n\r)+/gi, ' ');
            this.RawText = this.RawText.replace(/<(\/)?strong[^>]*>/gi, '[$1b]');
            this.RawText = this.RawText.replace(/<(\/)?em[^>]*>/gi, '[$1i]');
            this.RawText = this.RawText.replace(/<\/p>/gi, '\n');
            this.RawText = this.RawText.replace(/<\/?[^>]+>|\u00AD/gi, '');
            this.RawText = this.RawText.replace(/^\s+|\s+$/gi, '');
            this.Note = this.Raw2FB2(this.RawText);

            // todo - should fill this.Extract with something equal|close to raw fb2 fragment
            this.XStart = this.Owner.FB3DOM.GetXPathFromPos(this.Range.From.slice(0));
            this.XEnd = this.Owner.FB3DOM.GetXPathFromPos(this.Range.To.slice(0));
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
                setTimeout(function () {
                    return _this.InitSyncXPathWithDOM();
                }, 10);
                return;
            }
            this.RequiredChunks = this.ChunksRequired();
            var ChunksToLoad = new Array();

            for (var I = 0; I < this.RequiredChunks.length; I++) {
                if (!this.Owner.FB3DOM.DataChunks[this.RequiredChunks[I]].loaded) {
                    ChunksToLoad.push(this.RequiredChunks[I]);
                }
            }

            // If there are missing chunks - we initiate loading for them
            if (ChunksToLoad.length) {
                this.Owner.FB3DOM.LoadChunks(ChunksToLoad, function () {
                    return _this.DoSyncXPathWithDOM();
                });
            } else {
                this.DoSyncXPathWithDOM();
            }
        };

        Bookmark.prototype.DoSyncXPathWithDOM = function () {
            var _this = this;
            for (var I = 0; I < this.RequiredChunks.length; I++) {
                if (this.Owner.FB3DOM.DataChunks[this.RequiredChunks[I]].loaded != 2) {
                    // There is at least one chunk still being loaded - we will return later
                    setTimeout(function () {
                        return _this.DoSyncXPathWithDOM();
                    }, 10);
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
            return '<Selection group="' + this.Group + '" ' + (this.Class ? 'class="' + this.Class + '" ' : '') + (this.Title ? 'title="' + this.Title + '" ' : '') + 'id="' + this.ID + '" ' + 'selection="fb2#xpointer(' + this.MakeSelection() + ')" ' + 'art-id="' + this.Owner.FB3DOM.MetaData.UUID + '" ' + 'last-update="' + moment().format("YYYY-MM-DDTHH:mm:ssZ") + '" ' + this.GetPercent() + '>' + this.GetNote() + this.Extract() + '</Selection>';
        };

        Bookmark.prototype.ParseXML = function (XML) {
            this.Group = parseInt(XML.getAttribute('group'));
            this.Class = XML.getAttribute('class');
            this.Title = XML.getAttribute('title');
            this.ID = XML.getAttribute('id').toLowerCase();
            this.MakeXPath(XML.getAttribute('selection'));
            this.DateTime = moment(XML.getAttribute('last-update'), "YYYY-MM-DDTHH:mm:ssZ").unix();
            if (XML.querySelector('Note')) {
                var tmpNote = XML.querySelector('Note');
                var NoteHTML = '';
                if (tmpNote.innerHTML) {
                    NoteHTML = tmpNote.innerHTML;
                } else {
                    NoteHTML = this.parseXMLNote(tmpNote);
                }

                // this.Note = NoteHTML.replace(/<p\s[^>]+>/g, '<p>');
                this.Note = NoteHTML.replace(/(<[^>]*)\bfb:/g, '$1');
            }
            this.NotSavedYet = 0;
            this.XPathMappingReady = false;

            // TODO: fill and check
            if (XML.querySelector('Extract')) {
                this.RawText = XML.querySelector('Extract').getAttribute('selection-text');
            }
            // this.Range; // will be filled in ReMapping
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
                } else {
                    res += child.childNodes[0].nodeValue;
                }
                res += "</" + child.tagName + ">";
            }
            return res;
        };

        Bookmark.prototype.GetNote = function () {
            if (!this.Note)
                return '';
            return '<Note>' + this.Note.replace(/(<\/?)/g, '$1fb:').replace(/(<[^>]*\/?)fb:p/g, '$1p') + '</Note>';
        };
        Bookmark.prototype.GetPercent = function () {
            if (this.Group != 0)
                return '';
            return 'percent="' + Math.round(this.Owner.Reader.CurPosPercent()) + '"';
        };
        Bookmark.prototype.Extract = function () {
            return '<Extract ' + this.GetRawText() + 'original-location="fb2#xpointer(' + this.MakeExtractSelection() + ')">' + this.ExtractNode() + '</Extract>';
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
            } else {
                this.XEnd = MakeXPathSub(p[1]);
            }
        };
        return Bookmark;
    })();
    FB3Bookmarks.Bookmark = Bookmark;
})(FB3Bookmarks || (FB3Bookmarks = {}));
//# sourceMappingURL=FB3Bookmarks.js.map
