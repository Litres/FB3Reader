/// <reference path="FB3BookmarksHead.ts" />
/// <reference path="../plugins/moment.d.ts" />
var FB3Bookmarks;
(function (FB3Bookmarks) {
    var LitResBookmarksProcessor = (function () {
        function LitResBookmarksProcessor(FB3DOM, LitresSID) {
            this.FB3DOM = FB3DOM;
            this.Ready = false;
            this.FB3DOM.Bookmarks.push(this);
            this.ClassPrefix = 'my_';
            this.Bookmarks = new Array();
            this.AddBookmark(new Bookmark(this));
            this.WaitForData = true;
            if (window.ActiveXObject) {
                this.XMLHttp = new window.ActiveXObject("Microsoft.XMLHTTP");
            } else {
                this.XMLHttp = new XMLHttpRequest();
            }
            this.Host = 'http://robot.litres.ru/'; // TODO: raplace
            this.SID = LitresSID;
            this.SaveAuto = false;
        }
        LitResBookmarksProcessor.prototype.AddBookmark = function (Bookmark) {
            Bookmark.N = this.Bookmarks.length;
            this.Bookmarks.push(Bookmark);
        };
        LitResBookmarksProcessor.prototype.DropBookmark = function (Bookmark) {
            for (var I = 0; I < this.Bookmarks.length; I++) {
                this.Bookmarks[I].N = I;
                if (this.Bookmarks[I] == Bookmark) {
                    this.Bookmarks.splice(I, 1);
                }
            }
        };

        LitResBookmarksProcessor.prototype.Load = function (Callback) {
            this.LoadEndCallback = Callback;
            this.WaitForData = true;
            var URL = this.MakeLoadURL();
            this.XMLHTTPResponseCallback = this.AfterTransferFromServerComplete;
            this.SendNotesRequest(URL, 'GET');
            // todo some data transfer init stuff here, set AfterTransferFromServerComplete to run at the end
            // for now we just fire it as it is, should fire after XML loaded
            // setTimeout(()=>this.AfterTransferFromServerComplete(),200);
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
            if (XML.documentElement.getAttribute('lock-id')) {
                this.LockID = XML.documentElement.getAttribute('lock-id');
            }
            if (Rows.length) {
                var CurPosBookmark = new Bookmark(this);
                this.AddBookmark(CurPosBookmark);

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
            var XML = this.MakeStoreXML();
            var Data = this.MakeStoreData(XML);
            var URL = this.MakeStoreURL();
            this.XMLHTTPResponseCallback = function () {
            };
            this.SendNotesRequest(URL, 'POST', Data);
        };

        LitResBookmarksProcessor.prototype.ApplyPosition = function () {
            // If DOM.TOC not ready yet, we can't expand XPath for any way - we wait while Reader.LoadDone fire this
            if (!this.FB3DOM.Ready || this.WaitForData) {
                return;
            }
            this.Ready = true;
            this.Reader.GoTO(this.Bookmarks[0].Range.From.slice(0));
        };

        LitResBookmarksProcessor.prototype.ReLoad = function (SaveAutoState) {
            var _this = this;
            var TemporaryNotes = new LitResBookmarksProcessor(this.FB3DOM, this.SID);
            TemporaryNotes.Reader = this.Reader;
            this.SaveAuto = SaveAutoState;
            TemporaryNotes.SaveAuto = this.SaveAuto;
            TemporaryNotes.Load(function (Bookmarks) {
                return _this.ReLoadComplete(Bookmarks);
            });
        };
        LitResBookmarksProcessor.prototype.ReLoadComplete = function (TemporaryNotes) {
            // todo merge data from TemporaryNotes to this, then dispose of temporary LitResBookmarksProcessor
            // than check if new "current position" is newer, if so - goto it
            // and finally
            var CurPosUpdate = 0;
            if (this.Bookmarks.length) {
                var Found;
                for (var i = 0; i < this.Bookmarks.length; i++) {
                    for (var j = 0; j < TemporaryNotes.Bookmarks.length; j++) {
                        if (this.Bookmarks[i].ID == TemporaryNotes.Bookmarks[j].ID) {
                            Found = 1;
                            break;
                        }
                    }
                    if (!Found && !this.Bookmarks[i].NotSavedYet) {
                        this.Bookmarks[i].Detach();
                    }
                }
                Found = 0;
                for (var j = 0; j < TemporaryNotes.Bookmarks.length; j++) {
                    Found = 0;
                    for (var i = 0; i < this.Bookmarks.length; i++) {
                        if (this.Bookmarks[i].ID == TemporaryNotes.Bookmarks[j].ID) {
                            if (this.Bookmarks[i].DateTime < TemporaryNotes.Bookmarks[j].DateTime) {
                                this.Bookmarks[i].Detach();
                            } else {
                                Found = 1;
                            }
                            break;
                        }
                    }
                    if (!Found) {
                        this.AddBookmark(TemporaryNotes.Bookmarks[j]);
                    }
                }
            } else {
                this.Bookmarks = TemporaryNotes.Bookmarks;
            }
            if (CurPosUpdate) {
                this.ApplyPosition();
            } else {
                this.Reader.Redraw();
            }
            if (this.SaveAuto) {
                this.LockID = TemporaryNotes.LockID;
                this.StoreBookmarks();
            }
        };

        LitResBookmarksProcessor.prototype.MakeLoadURL = function () {
            var URL = this.Host + 'pages/catalit_load_bookmarks/?art=' + this.Reader.ArtID + (this.SaveAuto ? '&set_lock=1' : '') + '&sid=' + this.SID + '&r=' + Math.random();
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
            this.Bookmarks[0].XStart = this.FB3DOM.GetXPathFromPos(this.Bookmarks[0].Range.From);
            this.Bookmarks[0].XEnd = this.Bookmarks[0].XStart;
            for (var j = 0; j < this.Bookmarks.length; j++) {
                XML += this.Bookmarks[j].PublicXML();
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
        }
        Bookmark.prototype.InitFromXY = function (X, Y) {
            var BaseFrom = this.Owner.Reader.ElementAtXY(X, Y);
            if (BaseFrom) {
                this.Range.From = BaseFrom.slice(0);
                this.Range.To = BaseFrom;
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
            var Block = this.Owner.FB3DOM.GetElementByAddr(Adress.slice(0));
            var PosInBlock = Adress[Adress.length - 1];
            while (Block.Parent && (!Block.TagName || !Block.TagName.match(FB3DOM.BlockLVLRegexp))) {
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
            var Block = this.Owner.FB3DOM.GetElementByAddr(Adress.slice(0));
            var PosInBlock = Adress[Adress.length - 1];
            while (Block.Parent && (!Block.TagName || !Block.TagName.match(FB3DOM.BlockLVLRegexp))) {
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
            var Block = this.Owner.FB3DOM.GetElementByAddr(Adress.slice(0));
            while (Block.Parent && (!Block.TagName || !Block.TagName.match(FB3DOM.BlockLVLRegexp))) {
                Block = Block.Parent;
                Adress.pop();
            }
        };
        Bookmark.prototype.RoundToBlockLVLDn = function (Adress) {
            this.RoundToBlockLVLUp(Adress);
            var Block = this.Owner.FB3DOM.GetElementByAddr(Adress.slice(0));
            if (Block.TagName && Block.TagName.match(FB3DOM.BlockLVLRegexp)) {
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
            this.Owner.FB3DOM.GetHTML(this.Owner.Reader.HyphON, this.Owner.Reader.BookStyleNotes, FB3Reader.RangeClone(this.Range), '', 100, 100, PageData);

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
            RawText = RawText.replace(/\[(\/)?b[^>]*\]/, '<$1strong>');
            RawText = RawText.replace(/\[(\/)?i[^>]*\]/, '<$1emphasis>');
            RawText = '<p>' + RawText.replace(/\n/, '</p><p>') + '</p>';
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
            var text = '', chars = 'ABCDEFabcdef0123456789';
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
            Result[0] = this.XPChunk(this.XStart);
            var EndChunk = this.XPChunk(this.XEnd);
            if (EndChunk != Result[0]) {
                Result.push(EndChunk);
            }
            return Result;
        };

        Bookmark.prototype.XPChunk = function (X) {
            for (var I = 0; I < this.Owner.FB3DOM.DataChunks.length; I++) {
                if (FB3Reader.PosCompare(X, this.Owner.FB3DOM.DataChunks[I].xps) <= 0) {
                    return I;
                }
            }
        };

        Bookmark.prototype.PublicXML = function () {
            return '<Selection group="' + this.Group + '" ' + (this.Class ? 'class="' + this.Class + '" ' : '') + (this.Title ? 'title="' + this.Title + '" ' : '') + 'id="' + this.ID + '" ' + 'selection="fb2#xpointer(' + this.MakeSelection() + ')" ' + 'art-id="' + this.Owner.FB3DOM.MetaData.UUID + '" ' + 'last-update="' + moment().format("YYYY-MM-DDTHH:mm:ssZ") + '">' + this.Extract() + this.GetNote() + '</Selection>';
        };

        Bookmark.prototype.ParseXML = function (XML) {
            this.Group = parseInt(XML.getAttribute('group'));
            this.Class = XML.getAttribute('class');
            this.Title = XML.getAttribute('title');
            this.ID = XML.getAttribute('id');
            this.MakeXPath(XML.getAttribute('selection'));
            this.DateTime = moment(XML.getAttribute('last-update'), "YYYY-MM-DDTHH:mm:ssZ").unix();
            if (XML.querySelector('Note')) {
                this.Note = XML.querySelector('Note').textContent;
            }
            this.NotSavedYet = 0;
            this.XPathMappingReady = false;
            // TODO: fill and check
            //			this.RawText = '';
            //			this.Range;
        };

        Bookmark.prototype.GetNote = function () {
            if (!this.Note)
                return '';
            return '<Note>' + this.Note + '</Note>';
        };

        Bookmark.prototype.Extract = function () {
            return '<Extract original-location="fb2#xpointer(' + this.MakeExtractSelection() + ')">' + this.ExtractNode() + '</Extract>';
        };
        Bookmark.prototype.ExtractNode = function () {
            // TODO: fill with code
            return '<p>or 4 test text</p>';
        };
        Bookmark.prototype.MakeExtractSelection = function () {
            var Start = this.MakePointer(this.XStart);
            return '/1/2/' + Start + '';
        };

        Bookmark.prototype.MakeSelection = function () {
            var Start = this.MakePointer(this.XStart);
            if (FB3Reader.PosCompare(this.XStart, this.XEnd) == 0)
                return 'point(/1/2/' + Start + ')';
            return 'point(/1/2/' + Start + ')/range-to(point(/1/2/' + this.MakePointer(this.XEnd) + '))';
        };

        Bookmark.prototype.MakePointer = function (X) {
            var last = X.pop() + '';
            return X.join('/') + ((/^\./).test(last) ? '' : '/') + last;
        };

        Bookmark.prototype.MakeXPath = function (X) {
            var p = X.match(/\/1\/2\/(.[^\)]*)/g);
            var MakeXPathSub = function (str) {
                return str.replace('/1/2/', '').replace('.', '/.').split('/');
            };
            this.XStart = MakeXPathSub(p[0]);
            if (p.length == 1) {
                this.XEnd = this.XStart;
            } else {
                this.XEnd = MakeXPathSub(p[1]);
            }
        };
        return Bookmark;
    })();
    FB3Bookmarks.Bookmark = Bookmark;
})(FB3Bookmarks || (FB3Bookmarks = {}));
//# sourceMappingURL=FB3Bookmarks.js.map
