/// <reference path="FB3ReaderHead.ts" />
/// <reference path="FB3ReaderPage.ts" />
var FB3Reader;
(function (FB3Reader) {
    //	interface IDumbCallback { () }
    // 0 on equal
    // 1 if 1 past 2 on child level like [0,1,2] is past [0,1]
    // 10 if Pos1 is PAST Pos2 on subling level like [0,1,2] is past [0,2,1]
    // -1 and -10 are the cases where Pos2 is below Pos1 respectively
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

    var Reader = (function () {
        function Reader(ArtID, EnableBackgroundPreRender, Site, FB3DOM, Bookmarks, PagesPositionsCache) {
            this.ArtID = ArtID;
            this.EnableBackgroundPreRender = EnableBackgroundPreRender;
            this.Site = Site;
            this.FB3DOM = FB3DOM;
            this.Bookmarks = Bookmarks;
            this.PagesPositionsCache = PagesPositionsCache;
            // Basic class init
            this.HyphON = true;
            this.NColumns = 2;
            this.CacheForward = 6;
            this.CacheBackward = 2;
            this.BookStyleNotes = true;
            this.BookStyleNotesTemporaryOff = false;
            this.IsIE = /MSIE|\.NET CLR/.test(navigator.userAgent);
            this.LastSavePercent = 0;
            this.CurStartPos = [737];

            this.IdleOff();
        }
        Reader.prototype.GoToExtXPath = function (XPath) {
            alert("not ready");
        };

        Reader.prototype.Init = function () {
            var _this = this;
            this.PrepareCanvas();
            this.FB3DOM.Init(this.HyphON, this.ArtID, function () {
                _this.LoadDone(1);
            });
            this.Bookmarks.FB3DOM = this.FB3DOM;
            this.Bookmarks.Reader = this;
            this.Bookmarks.Load(this.ArtID, function () {
                _this.LoadDone(2);
            });
        };

        Reader.prototype.LoadDone = function (a) {
            //			console.log('LoadDone ' + a + '/' + this.FB3DOM.Ready + ':' + this.Bookmarks.Ready);
            var ReadPos;
            if (this.FB3DOM.Ready && this.Bookmarks.Ready) {
                if (this.Bookmarks && this.Bookmarks.CurPos) {
                    ReadPos = this.Bookmarks.CurPos.Range.From.slice(0);
                } else {
                    ReadPos = this.CurStartPos.slice(0);
                }
                this.GoTO(ReadPos);
            }
        };

        Reader.prototype.GoTO = function (NewPos) {
            clearTimeout(this.MoveTimeoutID);
            this.IdleOff();

            //			console.log('GoTO ' + NewPos);
            this.CurStartPos = NewPos.slice(0); // NewPos is going to be destroyed, we need a hardcopy
            var GotoPage = this.GetCachedPage(NewPos);
            if (GotoPage != undefined) {
                this.GoTOPage(GotoPage);
            } else {
                this.GoToOpenPosition(NewPos);
            }
        };
        Reader.prototype.GoTOPage = function (Page) {
            if (this.PagesPositionsCache.LastPage() && Page > this.PagesPositionsCache.LastPage()) {
                this.Site.NotePopup('Paging beyong the file end');
                return;
            }

            // Wow, we know the page. It'll be fast. Page is in fact a column, so it belongs to it's
            // set, NColumns per one. Let's see what start column we are going to deal with
            clearTimeout(this.MoveTimeoutID);
            var RealStartPage = Math.floor(Page / this.NColumns) * this.NColumns;

            var FirstPageNToRender;
            var FirstFrameToFill;
            var WeeHaveFoundReadyPage = false;

            for (var I = 0; I < this.Pages.length / this.NColumns; I++) {
                var BasePage = I * this.NColumns;

                // Page is rendered, that's just great - we first show what we have, then render the rest, if required
                if (this.Pages[BasePage].Ready && this.Pages[BasePage].PageN == RealStartPage) {
                    this.PutBlockIntoView(BasePage);
                    WeeHaveFoundReadyPage = true;

                    // Ok, now we at least see ONE page, first one, from the right set. Let's deal with others
                    var CrawlerCurrentPage = this.Pages[BasePage];
                    for (var J = 1; J < (this.CacheForward + 1) * this.NColumns; J++) {
                        CrawlerCurrentPage = CrawlerCurrentPage.Next;
                        if (!CrawlerCurrentPage.Ready || CrawlerCurrentPage.PageN != RealStartPage + J) {
                            // Here it is - the page with the wrong content. We set up our re-render queue
                            FirstPageNToRender = RealStartPage + J;
                            FirstFrameToFill = CrawlerCurrentPage;
                            break;
                        }
                    }
                    break;
                }
            }

            this.CurStartPage = RealStartPage;
            if (WeeHaveFoundReadyPage && !FirstFrameToFill) {
                this.IdleOn(); // maybe we go to the same place several times? Anyway, quit!
                return;
            } else if (!WeeHaveFoundReadyPage) {
                FirstPageNToRender = RealStartPage; // just as if we would during the application start
                FirstFrameToFill = this.Pages[0];
                this.PutBlockIntoView(0);
            }
            this.CurStartPos = this.PagesPositionsCache.Get(Page).Range.From.slice(0);

            var CacheBroken = false;
            var NewInstr = new Array();
            var PageWeThinkAbout = FirstFrameToFill;
            for (var I = FirstPageNToRender; I < RealStartPage + (this.CacheForward + 1) * this.NColumns; I++) {
                if (this.PagesPositionsCache.LastPage() && this.PagesPositionsCache.LastPage() < I) {
                    if (I < RealStartPage + this.NColumns) {
                        PageWeThinkAbout.CleanPage(); // We need some empty pages
                    } else {
                        break;
                    }
                } else {
                    if (!CacheBroken && this.PagesPositionsCache.Get(I)) {
                        NewInstr.push(PRIClone(this.PagesPositionsCache.Get(I)));
                    } else {
                        if (!CacheBroken) {
                            CacheBroken = true;
                            NewInstr.push({ Start: this.PagesPositionsCache.Get(I - 1).Range.To.slice(0) });
                        } else {
                            NewInstr.push({});
                        }
                        NewInstr[NewInstr.length - 1].CacheAs = I;
                    }
                }
                PageWeThinkAbout = FirstFrameToFill.Next;
            }
            FirstFrameToFill.SetPending(NewInstr);
            FirstFrameToFill.DrawInit(NewInstr); // IdleOn will fire after the DrawInit chain ends
        };

        Reader.prototype.PutBlockIntoView = function (Page) {
            this.CurVisiblePage = Page;
            for (var I = 0; I < this.Pages.length; I++) {
                if (I < Page || I >= Page + this.NColumns) {
                    this.Pages[I].Hide();
                } else {
                    this.Pages[I].Show();
                }
            }
        };

        Reader.prototype.GoToOpenPosition = function (NewPos) {
            clearTimeout(this.MoveTimeoutID);
            this.CurStartPos = NewPos.slice(0);

            var NewInstr = [{ Start: NewPos }];

            var ShouldWeCachePositions = NewPos.length == 1 && NewPos[0] == 0;
            if (ShouldWeCachePositions) {
                NewInstr[0].CacheAs = 0;
                this.CurStartPage = 0;
            } else {
                this.CurStartPage = undefined; // this means we are walking out of the ladder, right over the grass - this fact affects page turning greatly
            }
            for (var I = 1; I < (this.CacheForward + 1) * this.NColumns; I++) {
                NewInstr.push({});
                if (ShouldWeCachePositions) {
                    NewInstr[I].CacheAs = I;
                }
            }
            this.PutBlockIntoView(0);
            for (var I = 1; I < this.Pages.length; I++) {
                this.Pages[I].Ready = false;
            }
            this.Pages[0].SetPending(NewInstr);
            this.Pages[0].DrawInit(NewInstr);
        };

        Reader.prototype.TOC = function () {
            var PatchedTOC = this.CloneTOCNodes(this.FB3DOM.TOC);
            this.PatchToc(PatchedTOC, this.CurStartPos, 0);
            for (var I = 0; I < this.Bookmarks.Bookmarks.length; I++) {
                this.PatchToc(PatchedTOC, this.Bookmarks.Bookmarks[I].Range.From, this.Bookmarks.Bookmarks[I].Group);
            }
            return PatchedTOC;
        };

        Reader.prototype.CloneTOCNodes = function (TOC) {
            var NewTOC = new Array();
            for (var I = 0; I < TOC.length; I++) {
                for (var P in TOC[I]) {
                    if (P == 'c') {
                        NewTOC[I].c = this.CloneTOCNodes(TOC[I].c);
                    } else {
                        NewTOC[I][P] = TOC[I][P];
                    }
                }
            }
            return NewTOC;
        };

        Reader.prototype.PatchToc = function (TOC, Pos, Group) {
            for (var I = 0; I < TOC.length; I++) {
                if (PosCompare([TOC[I].s], Pos) <= 0) {
                    if (TOC[I].c) {
                        this.PatchToc(TOC[I].c, Pos, Group);
                    } else if (TOC[I].bookmarks['g' + Group]) {
                        TOC[I].bookmarks['g' + Group]++;
                    } else {
                        TOC[I].bookmarks['g' + Group] = 1;
                    }
                    return;
                }
            }
        };

        Reader.prototype.ResetCache = function () {
            this.IdleAction = 'load_page';
            this.IdleOff();
            this.PagesPositionsCache.Reset();
        };

        Reader.prototype.GetCachedPage = function (NewPos) {
            for (var I = 0; I < this.PagesPositionsCache.Length(); I++) {
                var Pos = this.PagesPositionsCache.Get(I).Range;
                if (PosCompare(Pos.To, NewPos) >= 0) {
                    return I;
                }
            }
            return undefined;
        };

        Reader.prototype.StoreCachedPage = function (Range) {
            this.PagesPositionsCache.Set(Range.CacheAs, PRIClone(Range));
            // 			this.SaveCache(); // slow - removed for now.
        };

        Reader.prototype.SearchForText = function (Text) {
            return null;
        };

        Reader.prototype.PrepareCanvas = function () {
            this.ResetCache();
            var InnerHTML = '<div class="FB3ReaderColumnset' + this.NColumns + '" id="FB3ReaderHostDiv" style="width:100%; overflow:hidden; height:100%">';
            this.Pages = new Array();
            for (var I = 0; I < this.CacheBackward + this.CacheForward + 1; I++) {
                for (var J = 0; J < this.NColumns; J++) {
                    var NewPage = new FB3ReaderPage.ReaderPage(J, this.FB3DOM, this, this.Pages[this.Pages.length - 1]);
                    this.Pages[this.Pages.length] = NewPage;
                    InnerHTML += NewPage.GetInitHTML(I * this.NColumns + J + 1);
                }
            }
            this.Pages[this.Pages.length - 1].Next = this.Pages[0]; // Cycled canvas reuse

            this.BackgroundRenderFrame = new FB3ReaderPage.ReaderPage(0, this.FB3DOM, this, null); // Meet the background page borders detector!
            InnerHTML += this.BackgroundRenderFrame.GetInitHTML(0);

            InnerHTML += '</div>';
            this.Site.Canvas.innerHTML = InnerHTML;

            for (var I = 0; I < this.Pages.length; I++) {
                this.Pages[I].BindToHTMLDoc(this.Site);
            }

            this.BackgroundRenderFrame.BindToHTMLDoc(this.Site);
            this.BackgroundRenderFrame.PagesToRender = new Array(100);
            this.CanvasW = this.Site.Canvas.clientWidth;
            this.CanvasH = this.Site.Canvas.clientHeight;
            this.LastSavePercent = 0;
            this.LoadCache();
        };

        Reader.prototype.AfterCanvasResize = function () {
            var _this = this;
            if (this.OnResizeTimeout) {
                clearTimeout(this.OnResizeTimeout);
            }
            this.OnResizeTimeout = setTimeout(function () {
                // This was a real resise
                if (_this.CanvasW != _this.Site.Canvas.clientWidth || _this.CanvasH != _this.Site.Canvas.clientHeight) {
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
            } else {
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
                } else if (this.PagesPositionsCache.LastPage() && this.PagesPositionsCache.LastPage() < this.CurStartPage + this.NColumns) {
                    return;
                } else {
                    this.MoveTimeoutID = setTimeout(function () {
                        _this.PageForward();
                    }, 50);
                }
            } else {
                // First wee seek forward NColimns times to see if the page wee want to show is rendered. If not - we will wait untill it is
                var PageToView = this.Pages[this.CurVisiblePage];
                for (var I = 0; I < this.NColumns; I++) {
                    PageToView = PageToView.Next;
                }
                if (!PageToView.Ready) {
                    if (PageToView.Pending) {
                        this.MoveTimeoutID = setTimeout(function () {
                            _this.PageForward();
                        }, 50);
                    } else if (this.Pages[this.CurVisiblePage + this.NColumns - 1].RenderInstr.Range.To[0] == -1 || this.Pages[this.CurVisiblePage + this.NColumns].RenderInstr && this.Pages[this.CurVisiblePage + this.NColumns].RenderInstr.Range.To[0] == -1) {
                        return;
                    } else {
                        this.GoToOpenPosition(this.Pages[this.CurVisiblePage + this.NColumns - 1].RenderInstr.Range.To);
                    }
                } else {
                    this.CurStartPos = PageToView.RenderInstr.Range.From;
                    this.PutBlockIntoView(PageToView.ID - 1);
                }
            }
            return;
        };
        Reader.prototype.PageBackward = function () {
            var _this = this;
            clearTimeout(this.MoveTimeoutID);
            if (this.CurStartPage !== undefined) {
                if (this.CurStartPage > 0) {
                    this.GoTOPage(this.CurStartPage - this.NColumns);
                }
            } else {
                // we will even have to get back to the ladder (and may be even wait until the ladder is ready, too bad)
                var GotoPage = this.GetCachedPage(this.CurStartPos);
                if (GotoPage != undefined) {
                    this.GoTOPage(GotoPage); // If so - go to the ledder and never care of the rest
                } else {
                    if (this.EnableBackgroundPreRender) {
                        this.MoveTimeoutID = setTimeout(function () {
                            _this.PageBackward();
                        }, 50);
                    } else {
                        alert('Backward paging not implemented yet, sory');
                    }
                }
            }
        };

        Reader.prototype.GoToPercent = function (Percent) {
            var BlockN = Math.round(this.FB3DOM.TOC[this.FB3DOM.TOC.length - 1].e * Percent / 100);
            this.GoTO([BlockN]);
        };

        Reader.prototype.CurPosPercent = function () {
            if (!this.FB3DOM.TOC) {
                return undefined;
            }
            return 100 * this.CurStartPos[0] / this.FB3DOM.TOC[this.FB3DOM.TOC.length - 1].e;
        };

        Reader.prototype.ElementAtXY = function (X, Y) {
            var Node = this.Site.elementFromPoint(X, Y);

            if (!Node) {
                return undefined;
            }

            while (!Node.id && Node.parentElement) {
                Node = Node.parentElement;
            }

            if (!Node.id.match(/n(_\d+)+/)) {
                return undefined;
            }

            var Addr = Node.id.split('_');
            Addr.shift();
            Addr.shift();
            return Addr;
        };

        Reader.prototype.IdleGo = function (PageData) {
            var _this = this;
            if (this.IsIdle && !this.BackgroundRenderFrame.ThreadsRunning) {
                switch (this.IdleAction) {
                    case 'load_page':
                        var PageToPrerender = this.FirstUncashedPage();
                        var NewPos = PageToPrerender.Start[0] / this.FB3DOM.TOC[this.FB3DOM.TOC.length - 1].e * 100;
                        if (this.FB3DOM.TOC[this.FB3DOM.TOC.length - 1].e <= PageToPrerender.Start[0]) {
                            // Caching done - we save results and stop idle processing
                            this.PagesPositionsCache.LastPage(this.PagesPositionsCache.Length() - 1);
                            this.IdleOff();
                            this.Site.IdleThreadProgressor.Progress(this, 100);
                            this.Site.IdleThreadProgressor.HourglassOff(this);
                            var end = new Date().getTime();
                            var time = end - start;

                            //							alert('Execution time: ' + time);
                            this.Site.Alert('Tome taken: ' + time);
                            clearInterval(this.IdleTimeoutID);
                            this.SaveCache();
                            return;
                        } else {
                            this.PagesPositionsCache.LastPage(0);
                            if (NewPos - this.LastSavePercent > 3) {
                                // We only save pages position cache once per 3% because it is SLOW like hell
                                this.SaveCache();
                                this.LastSavePercent = NewPos;
                            }
                            this.Site.IdleThreadProgressor.Progress(this, NewPos);
                            this.Site.IdleThreadProgressor.Alert(this.PagesPositionsCache.Length().toFixed(0) + ' pages ready');
                        }
                        this.IdleAction = 'wait';

                        // Kind of lightweight DrawInit here, it looks like copy-paste is reasonable here
                        this.BackgroundRenderFrame.RenderInstr = PageToPrerender;

                        for (var I = 0; I < 100; I++) {
                            this.BackgroundRenderFrame.PagesToRender[I] = { CacheAs: PageToPrerender.CacheAs + I + 1 };
                        }

                        this.BackgroundRenderFrame.WholeRangeToRender = this.BackgroundRenderFrame.DefaultRangeApply(PageToPrerender);

                        this.FB3DOM.GetHTMLAsync(this.HyphON, this.BookStyleNotes, RangeClone(this.BackgroundRenderFrame.WholeRangeToRender), this.BackgroundRenderFrame.ID + '_', this.BackgroundRenderFrame.ViewPortW, this.BackgroundRenderFrame.ViewPortH, function (PageData) {
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

        Reader.prototype.SaveCache = function () {
            this.PagesPositionsCache.Save(this.BackgroundRenderFrame.ViewPortW + ':' + this.CanvasW + ':' + this.CanvasH + ':' + this.BookStyleNotes + ':' + this.Site.Key);
        };

        Reader.prototype.LoadCache = function () {
            this.PagesPositionsCache.Load(this.BackgroundRenderFrame.ViewPortW + ':' + this.CanvasW + ':' + this.CanvasH + ':' + this.BookStyleNotes + ':' + this.Site.Key);
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

            // Looks like small delay prevents garbage collector from doing it's job - so we let it breath a bit
            this.IdleTimeoutID = setInterval(function () {
                _this.IdleGo();
            }, 100);
        };

        Reader.prototype.IdleOff = function () {
            this.IsIdle = false;
        };

        Reader.prototype.Redraw = function () {
            for (var I = 0; I < this.Pages.length; I++) {
                this.Pages[I].Ready = false;
            }
            this.GoTO(this.CurStartPos.slice(0));
        };

        Reader.prototype.Reset = function () {
            for (var I = 0; I < this.Pages.length; I++) {
                this.Pages[I].Reset();
            }
            this.PrepareCanvas();
            this.GoTO(this.CurStartPos.slice(0));
        };
        return Reader;
    })();
    FB3Reader.Reader = Reader;
})(FB3Reader || (FB3Reader = {}));
//# sourceMappingURL=FB3Reader.js.map
