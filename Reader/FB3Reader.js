var FB3Reader;
(function (FB3Reader) {
    FB3Reader.SaveCacheEveryNIterations = 30;
    function PosCompare(Pos1, Pos2) {
        var Result = 0;
        for (var I = 0; I < Math.min(Pos1.length, Pos2.length); I++) {
            if (Pos1[I] != Pos2[I]) {
                Result = Pos1[I] * 1 > Pos2[I] * 1 ? 10 : -10;
                break;
            }
        }
        if (Result == 0 && Pos1.length != Pos2.length) {
            Result = Pos1.length > Pos2.length ? 1 : -1;
        }
        return Result;
    }
    FB3Reader.PosCompare = PosCompare;
    function RangeClone(BaseRange) {
        return {
            From: BaseRange.From.slice(0),
            To: BaseRange.To.slice(0)
        };
    }
    FB3Reader.RangeClone = RangeClone;
    function PRIClone(Range) {
        return {
            Range: RangeClone(Range.Range),
            CacheAs: Range.CacheAs,
            Height: Range.Height,
            NotesHeight: Range.NotesHeight
        };
    }
    FB3Reader.PRIClone = PRIClone;
    function GetElementRect(elem) {
        var Dat;
        if (elem.getBoundingClientRect) {
            Dat = getOffsetRect(elem);
        }
        else {
            Dat = getOffsetSum(elem);
        }
        Dat.right = Dat.left + elem.offsetWidth;
        Dat.bottom = Dat.top + elem.offsetHeight;
        return Dat;
    }
    function getOffsetSum(elem) {
        var top = 0, left = 0;
        while (elem) {
            top = top + parseInt(elem.offsetTop);
            left = left + parseInt(elem.offsetLeft);
            elem = elem.offsetParent;
        }
        return { top: top, left: left };
    }
    function getOffsetRect(elem) {
        var box = elem.getBoundingClientRect();
        var body = document.body;
        var docElem = document.documentElement;
        var scrollTop = window.pageYOffset || docElem.scrollTop || body.scrollTop;
        var scrollLeft = window.pageXOffset || docElem.scrollLeft || body.scrollLeft;
        var clientTop = docElem.clientTop || body.clientTop || 0;
        var clientLeft = docElem.clientLeft || body.clientLeft || 0;
        var top = box.top + scrollTop - clientTop;
        var left = box.left + scrollLeft - clientLeft;
        return { top: Math.round(top), left: Math.round(left) };
    }
    var Reader = (function () {
        function Reader(EnableBackgroundPreRender, Site, FB3DOM, Bookmarks, Version, PagesPositionsCache) {
            this.EnableBackgroundPreRender = EnableBackgroundPreRender;
            this.Site = Site;
            this.FB3DOM = FB3DOM;
            this.Bookmarks = Bookmarks;
            this.Version = Version;
            this.PagesPositionsCache = PagesPositionsCache;
            this.GoTOByProgressBar = false;
            this.RedrawState = false;
            this.Destroy = false;
            this.HyphON = true;
            this.NColumns = 2;
            this.CacheForward = 6;
            this.CacheBackward = 2;
            this.BookStyleNotes = true;
            this.BookStyleNotesTemporaryOff = false;
            this.IsIE = /MSIE|\.NET CLR/.test(navigator.userAgent);
            this.TicksFromSave = 0;
            this.LineHeight = 0;
            this.CachingDone = {};
            this.IdleOff();
        }
        Reader.prototype._CanvasReadyCallback = function () {
            this.RedrawInProgress = 0;
            if (this.RedrawAgain > 0) {
                this.RedrawAgain = 0;
                this.RedrawVisible();
                return;
            }
            if (this.CanvasReadyCallback) {
                this.CanvasReadyCallback(this.GetVisibleRange());
                if (!this.RedrawState) {
                    this.Site.AfterTurnPageDone({
                        CurPage: this.CurStartPage,
                        MaxPage: this.PagesPositionsCache.LastPage(),
                        Percent: this.CurPosPercent(),
                        Pos: this.CurStartPos,
                        TurnByProgressBar: this.GoTOByProgressBar
                    });
                }
                else {
                    this.RedrawState = false;
                }
                this.GoTOByProgressBar = false;
            }
        };
        Reader.prototype.SetStartPos = function (NewPos) {
            if (this.RedrawState) {
                this.RedrawState = false;
                return;
            }
            this.CurStartPos = NewPos.slice(0);
            this.Bookmarks.Bookmarks[0].Range = { From: NewPos.slice(0), To: NewPos.slice(0) };
            if (!this.Bookmarks.Bookmarks[0].SkipUpdateDatetime) {
                this.Bookmarks.Bookmarks[0].DateTime = moment().unix();
            }
            else {
                this.Bookmarks.Bookmarks[0].SkipUpdateDatetime = false;
            }
        };
        Reader.prototype.Init = function (StartFrom, DateTime) {
            var _this = this;
            this.FB3DOM.Init(this.HyphON, function () {
                _this.Bookmarks.FB3DOM = _this.FB3DOM;
                _this.Bookmarks.Reader = _this;
                _this.Site.HeadersLoaded(_this.FB3DOM.MetaData);
                _this.PrepareCanvas();
                _this.PutBlockIntoView(0);
                _this.Bookmarks.LoadFromCache();
                _this.Bookmarks.Bookmarks[0].Range.From = _this.Bookmarks.Bookmarks[0].Range.To = StartFrom;
                if (DateTime) {
                    _this.Bookmarks.Bookmarks[0].DateTime = DateTime;
                }
                if (_this.Bookmarks.Bookmarks.length > 1 || DateTime) {
                    _this.Bookmarks.ReLoad();
                }
                else {
                    _this.Bookmarks.Load(function () {
                        _this.Bookmarks.ApplyPosition();
                    });
                }
                if (!_this.Bookmarks.ApplyPosition()) {
                    _this.Bookmarks.Bookmarks[0].SkipUpdateDatetime = true;
                    _this.GoTO(StartFrom);
                }
            });
        };
        Reader.prototype.GoTO = function (NewPos, Force) {
            if (!NewPos || NewPos.length == 0) {
                this.Site.Alert('Bad adress targeted');
                return;
            }
            if (!Force && this.CurStartPos && PosCompare(this.CurStartPos, NewPos) == 0) {
                return;
            }
            clearTimeout(this.MoveTimeoutID);
            this.IdleOff();
            var GotoPage = this.GetCachedPage(NewPos);
            if (GotoPage != undefined) {
                this.GoTOPage(GotoPage);
            }
            else {
                this.GoToOpenPosition(NewPos);
            }
        };
        Reader.prototype.GoTOPage = function (Page) {
            if (this.PagesPositionsCache.LastPage() && Page > this.PagesPositionsCache.LastPage()) {
                this.Site.NotePopup('Paging beyong the file end');
                finishFunction();
                return;
            }
            if (this.PagesPositionsCache.LastPage() && Page == this.PagesPositionsCache.LastPage()) {
                finishFunction();
            }
            this.StopRenders();
            clearTimeout(this.MoveTimeoutID);
            var RealStartPage = Math.floor(Page / this.NColumns) * this.NColumns;
            var FirstPageNToRender;
            var FirstFrameToFill;
            var WeeHaveFoundReadyPage = false;
            var CallbackFired = false;
            this.CurStartPage = RealStartPage;
            this.SetStartPos(this.PagesPositionsCache.Get(Page).Range.From);
            for (var I = 0; I < this.Pages.length / this.NColumns; I++) {
                var BasePage = I * this.NColumns;
                if (this.Pages[BasePage].Ready && this.Pages[BasePage].PageN == RealStartPage) {
                    this.PutBlockIntoView(BasePage);
                    WeeHaveFoundReadyPage = true;
                    var CrawlerCurrentPage = this.Pages[BasePage];
                    for (var J = 1; J < (this.CacheForward + 1) * this.NColumns; J++) {
                        if (CrawlerCurrentPage.ID == BasePage + this.NColumns) {
                            this._CanvasReadyCallback();
                            CallbackFired = true;
                        }
                        CrawlerCurrentPage = CrawlerCurrentPage.Next;
                        if (!CrawlerCurrentPage.Ready || CrawlerCurrentPage.PageN != RealStartPage + J) {
                            FirstPageNToRender = RealStartPage + J;
                            FirstFrameToFill = CrawlerCurrentPage;
                            break;
                        }
                    }
                    break;
                }
            }
            if (WeeHaveFoundReadyPage && !FirstFrameToFill) {
                if (!CallbackFired) {
                    this._CanvasReadyCallback();
                }
                this.IdleOn();
                return;
            }
            else if (!WeeHaveFoundReadyPage) {
                FirstPageNToRender = RealStartPage;
                FirstFrameToFill = this.Pages[this.CurVisiblePage];
                this.PutBlockIntoView(this.CurVisiblePage);
            }
            var CacheBroken = false;
            var NewInstr = new Array();
            var PageWeThinkAbout = FirstFrameToFill;
            for (var I = FirstPageNToRender; I < RealStartPage + (this.CacheForward + 1) * this.NColumns; I++) {
                if (this.PagesPositionsCache.LastPage() && this.PagesPositionsCache.LastPage() < I) {
                    if (I < RealStartPage + this.NColumns) {
                        PageWeThinkAbout.CleanPage();
                    }
                    else {
                        break;
                    }
                }
                else {
                    if (!CacheBroken && this.PagesPositionsCache.Get(I)) {
                        NewInstr.push(PRIClone(this.PagesPositionsCache.Get(I)));
                    }
                    else {
                        if (!CacheBroken) {
                            CacheBroken = true;
                            NewInstr.push({ Start: this.PagesPositionsCache.Get(I - 1).Range.To.slice(0) });
                        }
                        else {
                            NewInstr.push({});
                        }
                        NewInstr[NewInstr.length - 1].CacheAs = I;
                    }
                }
                PageWeThinkAbout = FirstFrameToFill.Next;
            }
            FirstFrameToFill.SetPending(NewInstr);
            FirstFrameToFill.DrawInit(NewInstr);
        };
        Reader.prototype.PutBlockIntoView = function (Page) {
            this.CurVisiblePage = Page;
            for (var I = 0; I < this.Pages.length; I++) {
                if (I < Page || I >= Page + this.NColumns) {
                    this.Pages[I].Hide();
                }
                else {
                    this.Pages[I].Show();
                }
            }
        };
        Reader.prototype.GoToOpenPosition = function (NewPos) {
            clearTimeout(this.MoveTimeoutID);
            if (NewPos[0] > this.FB3DOM.TOC[this.FB3DOM.TOC.length - 1].e) {
                NewPos = [this.FB3DOM.TOC.length - 1];
            }
            var NewInstr = [{ Start: NewPos }];
            var ShouldWeCachePositions = NewPos.length == 1 && NewPos[0] == 0;
            if (ShouldWeCachePositions) {
                NewInstr[0].CacheAs = 0;
                this.CurStartPage = 0;
            }
            else {
                this.CurStartPage = undefined;
            }
            this.SetStartPos(NewPos);
            this.StopRenders();
            for (var I = 1; I < (this.CacheForward + 1) * this.NColumns; I++) {
                NewInstr.push({});
                if (ShouldWeCachePositions) {
                    NewInstr[I].CacheAs = I;
                }
            }
            for (var I = 0; I < this.Pages.length; I++) {
                this.Pages[I].Ready = false;
            }
            if (!this.CurVisiblePage) {
                this.PutBlockIntoView(0);
            }
            this.Pages[this.CurVisiblePage].SetPending(NewInstr);
            this.Pages[this.CurVisiblePage].DrawInit(NewInstr);
        };
        Reader.prototype.TOC = function () {
            var PatchedTOC = this.CloneTOCNodes(this.FB3DOM.TOC);
            var CurrentRange = { From: this.CurStartPos, To: this.CurStartPos };
            this.PatchToc(PatchedTOC, CurrentRange, 0);
            for (var I = 0; I < this.Bookmarks.Bookmarks.length; I++) {
                this.PatchToc(PatchedTOC, this.Bookmarks.Bookmarks[I].Range, this.Bookmarks.Bookmarks[I].Group);
            }
            return PatchedTOC;
        };
        Reader.prototype.HasFB3Fragment = function () {
            var FullTOC = this.FB3DOM.GetFullTOC();
            return typeof FullTOC['fb3-fragment'] === 'object';
        };
        Reader.prototype.GetFB3Fragment = function () {
            var FullTOC = this.FB3DOM.GetFullTOC();
            return FullTOC['fb3-fragment'];
        };
        Reader.prototype.CloneTOCNodes = function (TOC) {
            var NewTOC = new Array();
            for (var I = 0; I < TOC.length; I++) {
                NewTOC[I] = {};
                for (var P in TOC[I]) {
                    if (P == 'c') {
                        NewTOC[I].c = this.CloneTOCNodes(TOC[I].c);
                    }
                    else {
                        NewTOC[I][P] = TOC[I][P];
                    }
                }
            }
            return NewTOC;
        };
        Reader.prototype.PatchToc = function (TOC, Range, Group) {
            for (var I = 0; I < TOC.length; I++) {
                if (!TOC[I].t || TOC[I].t == '') {
                    continue;
                }
                if (TOC[I].c && this.PatchToc(TOC[I].c, Range, Group)) {
                    return true;
                }
                else {
                    var StartCmp = PosCompare(Range.From, [TOC[I].s]);
                    var EndComp = PosCompare(Range.To, [TOC[I].e]);
                    if (StartCmp >= 0 && EndComp <= 1) {
                        TOC[I] = this.PatchTocRow(TOC[I], Group);
                        return true;
                    }
                }
            }
            return false;
        };
        Reader.prototype.PatchTocRow = function (TOC, Group) {
            if (!TOC.bookmarks) {
                TOC.bookmarks = {};
            }
            if (TOC.bookmarks['g' + Group]) {
                TOC.bookmarks['g' + Group]++;
            }
            else {
                TOC.bookmarks['g' + Group] = 1;
            }
            return TOC;
        };
        Reader.prototype.ResetCache = function () {
            this.IdleAction = 'load_page';
            this.IdleOff();
            this.PagesPositionsCache.Reset();
        };
        Reader.prototype.GetCachedPage = function (NewPos) {
            for (var I = this.PagesPositionsCache.Length() - 1; I >= 0; I--) {
                var Pos = this.PagesPositionsCache.Get(I).Range;
                if (PosCompare(Pos.To, NewPos) >= -1
                    && PosCompare(Pos.From, NewPos) <= 0) {
                    return I;
                }
            }
            return undefined;
        };
        Reader.prototype.StoreCachedPage = function (Range) {
            this.PagesPositionsCache.Set(Range.CacheAs, PRIClone(Range));
        };
        Reader.prototype.SearchForText = function (Text) { return null; };
        Reader.prototype.PrepareCanvas = function () {
            this.ResetCache();
            var InnerHTML = '<div class="FB3ReaderColumnset' + this.NColumns + '" id="FB3ReaderHostDiv" style="width:100%; overflow:hidden; height:100%;">';
            this.Pages = new Array();
            for (var I = 0; I < this.CacheBackward + this.CacheForward + 1; I++) {
                for (var J = 0; J < this.NColumns; J++) {
                    var NewPage = new FB3ReaderPage.ReaderPage(J, this.FB3DOM, this, this.Pages[this.Pages.length - 1]);
                    this.Pages[this.Pages.length] = NewPage;
                    InnerHTML += NewPage.GetInitHTML(I * this.NColumns + J + 1);
                }
            }
            this.Pages[this.Pages.length - 1].Next = this.Pages[0];
            this.BackgroundRenderFrame = new FB3ReaderPage.ReaderPage(0, this.FB3DOM, this, null);
            InnerHTML += this.BackgroundRenderFrame.GetInitHTML(0);
            InnerHTML += '</div>';
            this.Site.Canvas.innerHTML = InnerHTML;
            for (var I = 0; I < this.Pages.length; I++) {
                this.Pages[I].BindToHTMLDoc(this.Site);
            }
            this.BackgroundRenderFrame.BindToHTMLDoc(this.Site);
            this.BackgroundRenderFrame.PagesToRender = new Array(100);
            this.BackgroundRenderFrame.ViewPortH = this.Pages[0].ViewPortH;
            this.BackgroundRenderFrame.ViewPortW = this.Pages[0].ViewPortW;
            this.CanvasW = this.Site.Canvas.clientWidth;
            this.CanvasH = this.Site.Canvas.clientHeight;
            this.TicksFromSave = 0;
            this.LineHeight = this.BackgroundRenderFrame.GetLineHeight();
            this.LoadCache();
        };
        Reader.prototype.AfterCanvasResize = function () {
            var _this = this;
            if (this.OnResizeTimeout) {
                clearTimeout(this.OnResizeTimeout);
            }
            this.OnResizeTimeout = setTimeout(function () {
                if (_this.CanvasW != _this.Site.Canvas.clientWidth ||
                    _this.CanvasH != _this.Site.Canvas.clientHeight) {
                    _this.Reset();
                    _this.OnResizeTimeout = undefined;
                }
            }, 200);
        };
        Reader.prototype.FirstUncashedPage = function () {
            var FirstUncached;
            if (this.PagesPositionsCache.Length()) {
                FirstUncached = {
                    Start: this.PagesPositionsCache.Get(this.PagesPositionsCache.Length() - 1).Range.To.slice(0),
                    CacheAs: this.PagesPositionsCache.Length()
                };
                FB3ReaderPage.To2From(FirstUncached.Start);
            }
            else {
                FirstUncached = {
                    Start: [0],
                    CacheAs: 0
                };
            }
            return FirstUncached;
        };
        Reader.prototype.PageForward = function () {
            var _this = this;
            clearTimeout(this.MoveTimeoutID);
            if (this.CurStartPage !== undefined) {
                if (this.CurStartPage + this.NColumns < this.PagesPositionsCache.Length()) {
                    this.GoTOPage(this.CurStartPage + this.NColumns);
                }
                else if (this.PagesPositionsCache.LastPage() && this.PagesPositionsCache.LastPage() < this.CurStartPage + this.NColumns) {
                    return;
                }
                else {
                    this.MoveTimeoutID = setTimeout(function () { _this.PageForward(); }, 50);
                }
            }
            else {
                var PageToView = this.Pages[this.CurVisiblePage];
                for (var I = 0; I < this.NColumns; I++) {
                    PageToView = PageToView.Next;
                }
                if (!PageToView.Ready) {
                    if (PageToView.Pending
                        || !this.Pages[this.CurVisiblePage + this.NColumns - 1].RenderInstr
                        || !this.Pages[this.CurVisiblePage + this.NColumns - 1].RenderInstr.Range
                        || !this.Pages[this.CurVisiblePage + this.NColumns - 1].RenderInstr.Range.To
                        || !this.Pages[this.CurVisiblePage + this.NColumns - 1].RenderInstr.Range.To.length) {
                        this.MoveTimeoutID = setTimeout(function () { _this.PageForward(); }, 50);
                    }
                    else if (this.Pages[this.CurVisiblePage + this.NColumns - 1].RenderInstr.Range.To[0] == -1
                        || this.Pages[this.CurVisiblePage + this.NColumns]
                            && this.Pages[this.CurVisiblePage + this.NColumns].RenderInstr
                            && this.Pages[this.CurVisiblePage + this.NColumns].RenderInstr.Range.To[0] == -1) {
                        finishFunction();
                        return;
                    }
                    else {
                        var From = this.Pages[this.CurVisiblePage + this.NColumns - 1].RenderInstr.Range.To;
                        FB3ReaderPage.To2From(From);
                        var PageN = this.PagesPositionsCache.CheckIfKnown(From);
                        if (PageN) {
                            this.GoTOPage(PageN);
                        }
                        else {
                            this.GoToOpenPosition(From);
                        }
                    }
                }
                else {
                    var PageN = this.PagesPositionsCache.CheckIfKnown(PageToView.RenderInstr.Range.From);
                    if (PageN) {
                        this.GoTOPage(PageN);
                    }
                    else {
                        this.SetStartPos(PageToView.RenderInstr.Range.From);
                        this.PutBlockIntoView(PageToView.ID - 1);
                        this._CanvasReadyCallback();
                    }
                }
            }
        };
        Reader.prototype.PageBackward = function () {
            clearTimeout(this.MoveTimeoutID);
            if (this.CurStartPage !== undefined) {
                if (this.CurStartPage > 0) {
                    this.GoTOPage(this.CurStartPage - this.NColumns);
                }
            }
            else {
                var GotoPage = this.GetCachedPage(this.CurStartPos);
                if (GotoPage != undefined) {
                    this.GoTOPage(GotoPage);
                }
                else {
                    var ParaPerPage = 4;
                    if (this.PagesPositionsCache.Length()) {
                        ParaPerPage = Math.round(this.PagesPositionsCache.Get(this.PagesPositionsCache.Length() - 1).Range.To[0] / this.PagesPositionsCache.Length());
                        if (ParaPerPage < 1) {
                            ParaPerPage = 1;
                        }
                    }
                    var TravelBack = this.CurStartPos[0] - ParaPerPage * this.NColumns;
                    if (TravelBack < 0) {
                        TravelBack = 0;
                    }
                    this.GoTO([TravelBack]);
                }
            }
        };
        Reader.prototype.GoToPercent = function (Percent, ProgressBar) {
            if (ProgressBar) {
                this.GoTOByProgressBar = true;
            }
            if (this.IsFullyInCache()) {
                var totalPages = this.PagesPositionsCache.Length();
                var newPage = Math.round(totalPages * Percent / 100);
                if (newPage < 0) {
                    newPage = 0;
                }
                else if (newPage >= totalPages) {
                    newPage = totalPages - 1;
                }
                this.GoTOPage(newPage);
            }
            else {
                var BlockN = Math.round(this.FB3DOM.TOC[this.FB3DOM.TOC.length - 1].e * Percent / 100);
                this.GoTO([BlockN]);
            }
        };
        Reader.prototype.GoToXPath = function (XP) {
            var _this = this;
            var TargetChunk = this.FB3DOM.XPChunk(XP);
            if (!this.XPToJump) {
                this.XPToJump = XP;
                if (!this.FB3DOM.DataChunks[TargetChunk].loaded) {
                    this.FB3DOM.LoadChunks([TargetChunk], function () { return _this.GoToXPathFinal(); });
                }
                else {
                    this.GoToXPathFinal();
                }
            }
        };
        Reader.prototype.GoToXPathFinal = function () {
            var XP = this.XPToJump;
            this.XPToJump = undefined;
            this.GoTO(this.FB3DOM.GetAddrByXPath(XP));
        };
        Reader.prototype.CurPosPercent = function () {
            if (!this.FB3DOM.TOC) {
                return undefined;
            }
            var Percent;
            if (!(this.CurStartPage === undefined) && this.IsFullyInCache()) {
                Percent = this.CurStartPage / this.PagesPositionsCache.LastPage();
            }
            else {
                Percent = this.CurStartPos[0] / this.FB3DOM.TOC[this.FB3DOM.TOC.length - 1].e;
            }
            return Percent * 100;
        };
        Reader.prototype.ElementAtXY = function (X, Y) {
            var Node = this.Site.elementFromPoint(X, Y);
            var MisteryPointChanger = 3;
            if (!Node) {
                return undefined;
            }
            if (!Node.id.match(/n(_\d+)+/)) {
                return undefined;
            }
            if (!Node.nodeName.match(/span|img/i)) {
                var ElRect = GetElementRect(Node);
                var MayShift = Node.scrollWidth;
                var NewX = X + MisteryPointChanger;
                while (NewX < ElRect.right && this.CheckElementAtXY(Node)) {
                    NewX = NewX + MisteryPointChanger;
                    Node = this.Site.elementFromPoint(NewX, Y);
                }
                NewX = X - MisteryPointChanger;
                while (NewX > ElRect.left && this.CheckElementAtXY(Node)) {
                    NewX = NewX - MisteryPointChanger;
                    Node = this.Site.elementFromPoint(NewX, Y);
                }
                var NewY = Y + MisteryPointChanger;
                while (NewY < ElRect.bottom && this.CheckElementAtXY(Node)) {
                    NewY = NewY + MisteryPointChanger;
                    Node = this.Site.elementFromPoint(X, NewY);
                }
                NewY = Y - MisteryPointChanger;
                while (NewY > ElRect.top && this.CheckElementAtXY(Node)) {
                    NewY = NewY - MisteryPointChanger;
                    Node = this.Site.elementFromPoint(X, NewY);
                }
            }
            if (this.CheckElementAtXY(Node)) {
                return undefined;
            }
            var Addr = Node.id.split('_');
            Addr.shift();
            Addr.shift();
            FB3ReaderPage.NumericArray(Addr);
            return Addr;
        };
        Reader.prototype.CheckElementAtXY = function (Node) {
            return !Node || !Node.nodeName.match(/span|img/i) || !Node.id.match(/n(_\d+)+/);
        };
        Reader.prototype.GetElementXY = function (Node) {
            var Elem;
            for (var J = this.CurVisiblePage + this.NColumns; J >= this.CurVisiblePage; J--) {
                Elem = this.Site.getElementById('n_' + (J + 1) + '_' + Node.XPID);
                if (Elem) {
                    break;
                }
            }
            if (!Elem) {
                return undefined;
            }
            var ElemDim = Elem.getBoundingClientRect();
            var Dimensions = {
                Start: {
                    X: ElemDim.left.toFixed(0),
                    Y: '0'
                },
                End: {
                    X: '0',
                    Y: '0'
                },
                LineHeight: '0'
            };
            if (Elem.className.match('skip_childs') != null) {
                var ChildDim = Elem.querySelector('span').getBoundingClientRect();
                Dimensions.LineHeight = ChildDim.height.toFixed(0);
                Dimensions.Start.Y = ChildDim.top.toFixed(0);
                Dimensions.End.X = (ChildDim.left + ChildDim.width).toFixed(0);
                Dimensions.End.Y = Dimensions.Start.Y;
            }
            else {
                Dimensions.LineHeight = ElemDim.height.toFixed(0);
                Dimensions.Start.Y = ElemDim.top.toFixed(0);
                Dimensions.End.X = (ElemDim.left + ElemDim.width).toFixed(0);
                Dimensions.End.Y = Dimensions.Start.Y;
            }
            return Dimensions;
        };
        Reader.prototype.GetElementXYByPosition = function (Position) {
            var ResponcibleNode = this.FB3DOM.GetElementByAddr(Position);
            return this.GetElementXY(ResponcibleNode);
        };
        Reader.prototype.IdleGo = function (PageData) {
            var _this = this;
            if (this.IsIdle && !this.BackgroundRenderFrame.ThreadsRunning) {
                switch (this.IdleAction) {
                    case 'load_page':
                        var PageToPrerender = this.FirstUncashedPage();
                        var NewPos = PageToPrerender.Start[0] / this.FB3DOM.TOC[this.FB3DOM.TOC.length - 1].e * 100;
                        if (this.IsFullyInCache()) {
                            this.PagesPositionsCache.LastPage(this.PagesPositionsCache.Length() - 1);
                            this.IdleOff();
                            this.Site.IdleThreadProgressor.Progress(this, 100);
                            this.Site.IdleThreadProgressor.HourglassOff(this);
                            var end = new Date().getTime();
                            var time = end - this.StartTime;
                            this.Site.Alert('Tome taken: ' + time);
                            clearInterval(this.IdleTimeoutID);
                            this.SaveCache();
                            this.Site.BookCacheDone({
                                CurPage: this.CurStartPage,
                                MaxPage: this.PagesPositionsCache.LastPage()
                            });
                            this.CachingDone[this.FullKey()] = true;
                            return;
                        }
                        else {
                            this.PagesPositionsCache.LastPage(0);
                            if (this.TicksFromSave > FB3Reader.SaveCacheEveryNIterations) {
                                this.SaveCache();
                                this.TicksFromSave = 0;
                            }
                            else {
                                this.TicksFromSave++;
                            }
                            this.Site.IdleThreadProgressor.Progress(this, NewPos);
                            this.Site.IdleThreadProgressor.Alert(this.PagesPositionsCache.Length().toFixed(0) + ' pages ready');
                        }
                        this.IdleAction = 'wait';
                        this.BackgroundRenderFrame.RenderInstr = PageToPrerender;
                        for (var I = 0; I < 100; I++) {
                            this.BackgroundRenderFrame.PagesToRender[I] = { CacheAs: PageToPrerender.CacheAs + I + 1 };
                        }
                        this.BackgroundRenderFrame.WholeRangeToRender = this.BackgroundRenderFrame.DefaultRangeApply(PageToPrerender);
                        this.FB3DOM.GetHTMLAsync(this.HyphON, this.BookStyleNotes, this.BackgroundRenderFrame.WholeRangeToRender, this.BackgroundRenderFrame.ID + '_', this.BackgroundRenderFrame.ViewPortW, this.BackgroundRenderFrame.ViewPortH, function (PageData) {
                            _this.IdleAction = 'fill_page';
                            _this.IdleGo(PageData);
                        });
                        break;
                    case 'fill_page':
                        this.PagesPositionsCache.LastPage(0);
                        if (PageData) {
                            this.BackgroundRenderFrame.DrawEnd(PageData);
                        }
                        this.IdleAction = 'load_page';
                        break;
                    default:
                }
            }
        };
        Reader.prototype.IsFullyInCache = function () {
            var pageToPrerender = this.FirstUncashedPage();
            return this.FB3DOM.TOC[this.FB3DOM.TOC.length - 1].e <= pageToPrerender.Start[0];
        };
        Reader.prototype.SaveCache = function () {
            if (!this.CachingDone[this.FullKey()]) {
                this.PagesPositionsCache.Save(this.FullKey());
            }
        };
        Reader.prototype.LoadCache = function () {
            this.PagesPositionsCache.Load(this.FullKey());
        };
        Reader.prototype.FullKey = function () {
            return this.FB3DOM.MetaData.UUID + ':' +
                this.BackgroundRenderFrame.ViewPortW + ':' +
                this.CanvasW + ':' +
                this.CanvasH + ':' +
                this.Version + ':' +
                this.BookStyleNotes + ':' +
                this.HyphON + ':' +
                this.Site.Key;
        };
        Reader.prototype.IdleOn = function () {
            var _this = this;
            if (!this.EnableBackgroundPreRender) {
                return;
            }
            clearInterval(this.IdleTimeoutID);
            this.IsIdle = true;
            this.Site.IdleThreadProgressor.HourglassOn(this);
            this.IdleGo();
            this.IdleTimeoutID = setInterval(function () { _this.IdleGo(); }, 100);
        };
        Reader.prototype.IdleOff = function () {
            this.IsIdle = false;
        };
        Reader.prototype.Redraw = function () {
            this.RedrawState = true;
            for (var I = 0; I < this.Pages.length; I++) {
                this.Pages[I].Ready = false;
            }
            this.GoTO(this.CurStartPos.slice(0), true);
        };
        Reader.prototype.RedrawVisible = function () {
            if (this.RedrawInProgress > 0) {
                this.RedrawAgain = 1;
                return;
            }
            this.RedrawInProgress = 1;
            this.RedrawState = true;
            var NewInstr = new Array();
            for (var I = this.CurVisiblePage; I < this.CurVisiblePage + this.NColumns; I++) {
                if (this.Pages[I].RenderInstr) {
                    NewInstr.push(this.Pages[I].RenderInstr);
                    this.Pages[I].Ready = false;
                }
            }
            this.Pages[this.CurVisiblePage].SetPending(NewInstr);
            this.Pages[this.CurVisiblePage].DrawInit(NewInstr);
        };
        Reader.prototype.StopRenders = function () {
            for (var I = 0; I < this.Pages.length; I++) {
                this.Pages[I].Reset();
            }
        };
        Reader.prototype.Reset = function () {
            this.FB3DOM.Reset();
            this.StopRenders();
            this.BackgroundRenderFrame.Reset();
            this.PrepareCanvas();
            this.CurVisiblePage = 0;
            this.GoTO(this.CurStartPos.slice(0), true);
        };
        Reader.prototype.GetVisibleRange = function () {
            if (!this.Pages[this.CurVisiblePage + this.NColumns - 1].Ready) {
                return undefined;
            }
            var Range = RangeClone(this.Pages[this.CurVisiblePage].RenderInstr.Range);
            Range = this.PatchRangeTo(Range);
            if (this.NColumns > 1) {
                Range.To = this.Pages[this.CurVisiblePage + this.NColumns - 1].RenderInstr.Range.To.slice(0);
            }
            return Range;
        };
        Reader.prototype.PatchRangeTo = function (Range) {
            if (Range.From[0] == Range.To[0] && Range.To.length == 1 && Range.From.length > 1) {
                Range.To.push(this.FB3DOM.Childs[Range.To[0]].Childs.length);
            }
            return Range;
        };
        return Reader;
    }());
    FB3Reader.Reader = Reader;
})(FB3Reader || (FB3Reader = {}));
//# sourceMappingURL=FB3Reader.js.map