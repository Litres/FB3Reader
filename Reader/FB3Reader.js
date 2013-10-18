/// <reference path="FB3ReaderHead.ts" />
var FB3Reader;
(function (FB3Reader) {
    function PageBreakBefore(Node) {
        return Node.nodeName.toLowerCase().match(/^h[1-3]/) ? true : false;
    }
    function PageBreakAfter(Node) {
        return false;
    }

    function IsNodeUnbreakable(Node) {
        if (Node.nodeName.match(/^(h\d|a)$/i)) {
            return true;
        }

        if (Node.className.match(/\btag_nobr\b/)) {
            return true;
        }

        var Chld1 = Node.children[0];
        if (Chld1) {
            if (Chld1.nodeName.match(/^h\d$/i)) {
                return true;
            }
        }
        return false;
    }
    function PosCompare(Pos1, Pos2) {
        var Result = 0;
        for (var I = 0; I < Math.min(Pos1.length, Pos2.length); I++) {
            if (Pos1[I] != Pos2[I]) {
                Result = Pos1[I] * 1 > Pos2[I] * 1 ? 1 : -1;
                break;
            }
        }

        if (Result == 0 && Pos1.length != Pos2.length) {
            Result = Pos1.length > Pos2.length ? 1 : -1;
        }

        return Result;
    }

    function RangeClone(BaseRange) {
        return {
            From: BaseRange.From.slice(0),
            To: BaseRange.To.slice(0)
        };
    }

    function PRIClone(Range) {
        return {
            Range: RangeClone(Range.Range),
            CacheAs: Range.CacheAs,
            Height: Range.Height,
            NotesHeight: Range.NotesHeight
        };
    }

    function HardcoreParseInt(Input) {
        Input.replace(/\D/g, '');
        if (Input == '')
            Input = '0';
        return parseInt(Input);
    }

    var ReaderPage = (function () {
        function ReaderPage(ColumnN, FB3DOM, FBReader, Prev) {
            this.ColumnN = ColumnN;
            this.FB3DOM = FB3DOM;
            this.FBReader = FBReader;
            this.Reseted = false;
            if (Prev) {
                Prev.Next = this;
            }
            this.PrerenderBlocks = 10;
            this.Ready = false;
            this.Pending = false;
        }
        ReaderPage.prototype.Show = function () {
            if (!this.Visible) {
                this.ParentElement.style.top = '0';
                this.Visible = true;
            }
        };

        ReaderPage.prototype.Hide = function () {
            if (this.Visible) {
                this.ParentElement.style.top = '100000px';
                this.Visible = false;
            }
        };

        ReaderPage.prototype.GetInitHTML = function (ID) {
            this.ID = ID;
            return '<div class="FB2readerCell' + this.ColumnN + 'of' + this.FBReader.NColumns + ' FB2readerPage"><div class="FBReaderContentDiv" id="FB3ReaderColumn' + this.ID + '">...</div><div class="FBReaderNotesDiv" id="FB3ReaderNotes' + this.ID + '">...</div></div>';
        };

        ReaderPage.prototype.FillElementData = function (ID) {
            var Element = this.Site.getElementById(ID);
            var Width = Element.offsetWidth;
            var Height = Element.parentElement.offsetHeight;
            var MarginTop;
            var MarginBottom;
            var MarginLeft;
            var MarginRight;
            if (document.all) {
                MarginTop = HardcoreParseInt(Element.currentStyle.marginTop) + HardcoreParseInt(Element.currentStyle.paddingTop);
                MarginBottom = HardcoreParseInt(Element.currentStyle.marginBottom) + HardcoreParseInt(Element.currentStyle.paddingBottom);
                MarginLeft = HardcoreParseInt(Element.currentStyle.marginTop) + HardcoreParseInt(Element.currentStyle.paddingLeft);
                MarginRight = HardcoreParseInt(Element.currentStyle.marginRight) + HardcoreParseInt(Element.currentStyle.paddingRight);
            } else {
                MarginTop = parseInt(getComputedStyle(Element, '').getPropertyValue('margin-top')) + parseInt(getComputedStyle(Element, '').getPropertyValue('padding-top'));
                MarginBottom = parseInt(getComputedStyle(Element, '').getPropertyValue('margin-bottom')) + parseInt(getComputedStyle(Element, '').getPropertyValue('padding-bottom'));
                MarginLeft = parseInt(getComputedStyle(Element, '').getPropertyValue('margin-left')) + parseInt(getComputedStyle(Element, '').getPropertyValue('padding-left'));
                MarginRight = parseInt(getComputedStyle(Element, '').getPropertyValue('margin-right')) + parseInt(getComputedStyle(Element, '').getPropertyValue('padding-right'));
            }
            return {
                Node: Element,
                Width: Width,
                Height: Height,
                MarginTop: MarginTop,
                MarginBottom: MarginBottom,
                MarginLeft: MarginLeft,
                MarginRight: MarginRight
            };
        };
        ReaderPage.prototype.BindToHTMLDoc = function (Site) {
            this.Site = Site;
            this.Element = this.FillElementData('FB3ReaderColumn' + this.ID);
            this.NotesElement = this.FillElementData('FB3ReaderNotes' + this.ID);
            this.ParentElement = this.Element.Node.parentElement;
            this.Visible = false;
            this.Width = Math.floor(this.Site.Canvas.scrollWidth / this.FBReader.NColumns);
            this.ViewPortH = this.ParentElement.scrollHeight - this.Element.MarginTop - this.Element.MarginBottom;
            this.ViewPortW = this.Element.Width - this.Element.MarginLeft - this.Element.MarginRight;
            this.ParentElement.style.width = this.Width + 'px';
            this.ParentElement.style.position = 'absolute';
            this.ParentElement.style.left = (this.Width * this.ColumnN) + 'px';
            this.ParentElement.style.top = '-100000px';
        };

        ReaderPage.prototype.SetPending = function (PagesToRender) {
            var PageToPend = this;
            for (var I = 0; I < PagesToRender.length; I++) {
                PageToPend.Pending = true;
                PageToPend = PageToPend.Next;
            }
        };

        ReaderPage.prototype.DrawInit = function (PagesToRender) {
            var _this = this;
            if (PagesToRender.length == 0)
                return;
            if (this.Reseted) {
                this.Reseted = false;
                return;
            }
            this.Ready = false;
            this.Pending = true;

            this.RenderInstr = PagesToRender.shift();
            this.PagesToRender = PagesToRender;

            var Range;
            if (this.RenderInstr.Range) {
                Range = {
                    From: this.RenderInstr.Range.From.slice(0),
                    To: this.RenderInstr.Range.To.slice(0)
                };

                if (Range.To[Range.To.length - 1]) {
                    Range.To[Range.To.length - 1]++;
                } else {
                    //while (Addr.length && Addr[Addr.length - 1] == 0) {
                    //	Addr.pop();
                    //	Addr[Addr.length - 1]--;
                    //}
                }
            } else {
                if (!this.RenderInstr.Start) {
                    this.RenderInstr.Start = [0];
                }

                Range = this.DefaultRangeApply(this.RenderInstr);
            }

            this.FB3DOM.GetHTMLAsync(this.FBReader.HyphON, RangeClone(Range), this.ID + '_', this.ViewPortW, this.ViewPortH, function (PageData) {
                return _this.DrawEnd(PageData);
            });
        };

        // Take a poind and add PrerenderBlocks of blocks to it
        ReaderPage.prototype.DefaultRangeApply = function (RenderInstr) {
            var FragmentEnd = RenderInstr.Start[0] * 1 + this.PrerenderBlocks;
            if (FragmentEnd > this.FB3DOM.TOC[this.FB3DOM.TOC.length - 1].e) {
                FragmentEnd = this.FB3DOM.TOC[this.FB3DOM.TOC.length - 1].e;
            }
            return { From: RenderInstr.Start.slice(0), To: [FragmentEnd] };
        };

        ReaderPage.prototype.DrawEnd = function (PageData) {
            var _this = this;
            if (this.Reseted) {
                this.Reseted = false;
                return;
            }
            this.Element.Node.innerHTML = PageData.Body.join('');
            if (PageData.FootNotes.length) {
                this.NotesElement.Node.innerHTML = PageData.FootNotes.join('');
                this.NotesElement.Node.style.display = 'block';
            }

            if (!this.RenderInstr.Range) {
                var FallOut = this.FallOut(this.Element.Height - this.Element.MarginTop - this.Element.MarginBottom, 0);

                if (!FallOut.EndReached && this.FB3DOM.TOC[this.FB3DOM.TOC.length - 1].e > FallOut.FallOut[0]) {
                    // Ups, our page is incomplete - have to retry filling it. Take more data now
                    this.PrerenderBlocks *= 2;
                    this.RenderInstr.Range = null;
                    this.DrawInit([this.RenderInstr].concat(this.PagesToRender));
                    return;
                }
                this.RenderInstr.Range = {
                    From: this.RenderInstr.Start.splice(0),
                    To: FallOut.FallOut
                };
                this.RenderInstr.Height = FallOut.Height;
                this.RenderInstr.NotesHeight = FallOut.NotesHeight;

                this.PageN = this.RenderInstr.CacheAs;
                if (this.PageN !== undefined) {
                    this.FBReader.StoreCachedPage(this.RenderInstr);
                }

                // Ok, we have rendered the page nice. Now we can check, wether we have created
                // a page long enough to fit the NEXT page. If so, we are going to estimate it's
                // content to create next page(s) with EXACTLY the required html - this will
                // speed up the render
                var LastChild = this.Element.Node.children[this.Element.Node.children.length - 1];
                if (LastChild) {
                    var CollectedHeight = FallOut.Height;
                    var CollectedNotesHeight = FallOut.NotesHeight;
                    var PrevTo;
                    for (var I = 0; I < this.PagesToRender.length; I++) {
                        var TestHeight = CollectedHeight + this.Element.Height - this.Element.MarginTop - this.Element.MarginBottom;
                        if (LastChild.offsetTop + LastChild.scrollHeight > TestHeight) {
                            FallOut = this.FallOut(TestHeight, CollectedNotesHeight, FallOut.FalloutElementN);
                            if (FallOut.EndReached) {
                                var NextPageRange = {};
                                NextPageRange.From = (PrevTo ? PrevTo : this.RenderInstr.Range.To).slice(0);
                                PrevTo = FallOut.FallOut.slice(0);
                                NextPageRange.To = FallOut.FallOut.slice(0);

                                this.PagesToRender[I].Height = FallOut.Height - CollectedHeight + this.Element.MarginTop;
                                this.PagesToRender[I].NotesHeight = FallOut.NotesHeight;
                                CollectedHeight = FallOut.Height;
                                CollectedNotesHeight += FallOut.NotesHeight;
                                this.PagesToRender[I].Range = NextPageRange;
                                if (this.PagesToRender[I].CacheAs !== undefined) {
                                    this.FBReader.StoreCachedPage(this.PagesToRender[I]);
                                }
                            } else {
                                break;
                            }
                        } else {
                            break;
                        }
                    }
                }
            } else {
                this.PageN = this.RenderInstr.CacheAs;
            }

            //			this.ParentElement.style.height = (this.RenderInstr.Height + this.RenderInstr.NotesHeight + this.NotesElement.MarginTop) + 'px';
            this.Element.Node.style.height = (this.RenderInstr.Height - this.Element.MarginBottom - this.Element.MarginTop) + 'px';
            if (this.RenderInstr.NotesHeight) {
                this.NotesElement.Node.style.height = (this.RenderInstr.NotesHeight) + 'px';
                this.NotesElement.Node.style.top = (this.Element.Height - this.Element.MarginTop - this.RenderInstr.NotesHeight - this.NotesElement.MarginBottom) + 'px';
            } else {
                this.NotesElement.Node.style.display = 'none';
            }
            this.Element.Node.style.overflow = 'hidden';

            this.Ready = true;
            this.Pending = false;

            if (this.PagesToRender && this.PagesToRender.length && this.Next) {
                if (!this.PagesToRender[0].Range && !this.PagesToRender[0].Start) {
                    this.PagesToRender[0].Start = this.RenderInstr.Range.To;
                }
                this.RenderMoreTimeout = setTimeout(function () {
                    _this.Next.DrawInit(_this.PagesToRender);
                }, 50);
            } else if (this.Next) {
                this.FBReader.IdleOn();
            }
        };

        ReaderPage.prototype.Reset = function () {
            clearTimeout(this.RenderMoreTimeout);

            //			console.log('Reset ' + this.ID);
            this.PagesToRender = null;
            this.Reseted = true;
            this.Pending = false;
        };

        ReaderPage.prototype.PutPagePlace = function (Place) {
            if (Place < 0) {
                this.Element.Node.style.display = 'none';
            } else {
                this.Element.Node.style.display = 'block';
            }
        };

        ReaderPage.prototype.FallOut = function (Limit, NotesShift, SkipUntill) {
            //		Hand mage CSS3 tabs. I thouth it would take more than this
            var Element = this.Element.Node;
            var I = SkipUntill > 0 ? SkipUntill : 0;
            var GoodHeight = 0;
            var ChildsCount = Element.children.length;
            var ForceDenyElementBreaking = true;
            var LastOffsetParent;
            var LastOffsetShift;
            var EndReached = false;
            var FootnotesAddonCollected = 0;

            // To shift notes to the next page we may have to eliminale last line as a whole - so we keep track of it
            var LastLineBreakerParent;
            var LastLineBreakerPos;
            var LastFullLinePosition = 0;

            var PrevPageBreaker = false;
            var NoMoreFootnotesHere = false;
            var FalloutElementN = -1;
            while (I < ChildsCount) {
                var FootnotesAddon = 0;
                var Child = Element.children[I];
                PrevPageBreaker = PrevPageBreaker || !ForceDenyElementBreaking && PageBreakBefore(Child);
                var SH = Child.scrollHeight;
                var OH = Child.offsetHeight;
                var ChildBot = Child.offsetTop + Math.max(SH, OH);

                if (SH != OH) {
                    // While calculating browser's widths&heights you can find that 1+1+3. We "round" it up
                    // if things look suspisiously
                    ChildBot++;
                }

                if (!NoMoreFootnotesHere) {
                    if (Child.nodeName.match(/a/i) && Child.className.match(/\bfootnote_attached\b/)) {
                        var NoteElement = this.Site.getElementById('f' + Child.id);
                        if (NoteElement) {
                            FootnotesAddon = NoteElement.offsetTop + NoteElement.scrollHeight;
                        }
                    } else {
                        var FootNotes = Child.getElementsByTagName('a');
                        for (var J = FootNotes.length - 1; J >= 0; J--) {
                            if (FootNotes[J].className.match(/\bfootnote_attached\b/)) {
                                var NoteElement = this.Site.getElementById('f' + FootNotes[J].id);
                                FootnotesAddon = NoteElement.offsetTop + NoteElement.scrollHeight;
                                break;
                            }
                        }
                    }
                }
                if (FootnotesAddon) {
                    FootnotesAddon += this.NotesElement.MarginTop - NotesShift;
                }

                var FootnotesHeightNow = FootnotesAddon ? FootnotesAddon : FootnotesAddonCollected;
                if ((ChildBot + FootnotesHeightNow < Limit) && !PrevPageBreaker) {
                    ForceDenyElementBreaking = false;
                    if (FootnotesAddon) {
                        FootnotesAddonCollected = FootnotesAddon;
                    }
                    ;
                    if (Math.abs(LastFullLinePosition - ChildBot) > 1) {
                        LastLineBreakerParent = Element;
                        LastLineBreakerPos = I;
                        LastFullLinePosition = ChildBot;
                    }
                    I++;
                } else {
                    EndReached = true;
                    if (FalloutElementN == -1) {
                        FalloutElementN = I;
                    }
                    if (!FootnotesAddon) {
                        NoMoreFootnotesHere = true;
                    }
                    var CurShift = Child.offsetTop;
                    if (Child.innerHTML.match(/^(\u00AD|\s)/)) {
                        CurShift += Math.floor(Math.max(SH, OH) / 2);
                    }

                    //	var NextChild = <HTMLElement> Element.children[I + 1];
                    //if (NextChild && NextChild.innerHTML.match(/^\u00AD/)) {
                    //	Child.innerHTML += '_';
                    //}
                    //}
                    var OffsetParent = Child.offsetParent;
                    var ApplyShift;
                    if (LastOffsetParent == OffsetParent) {
                        ApplyShift = CurShift - LastOffsetShift;
                    } else {
                        ApplyShift = CurShift;
                    }
                    LastOffsetShift = CurShift;

                    GoodHeight += ApplyShift;
                    LastOffsetParent = OffsetParent;
                    Element = Child;
                    ChildsCount = (!ForceDenyElementBreaking && IsNodeUnbreakable(Element)) ? 0 : Element.children.length;
                    if (!PrevPageBreaker && ChildsCount == 0 && FootnotesAddon > FootnotesAddonCollected) {
                        // So, it looks like we do not fit because of the footnote, not the falling out text itself.
                        // Let's force page break on the previous line end - kind of time machine
                        I = LastLineBreakerPos;
                        Element = LastLineBreakerParent;
                        PrevPageBreaker = true;
                        ChildsCount = Element.children.length;
                        continue;
                    }
                    Limit = Limit - ApplyShift;
                    I = 0;
                    if (PrevPageBreaker)
                        break;
                }
                //if (PrevPageBreaker) {
                //	Child.className += ' cut_bot';
                //}
            }

            var Addr;
            if (EndReached) {
                Addr = Element.id.split('_');
            } else {
                Addr = Child.id.split('_');
            }

            Addr.shift();
            Addr.shift();
            return {
                FallOut: Addr,
                Height: GoodHeight,
                NotesHeight: FootnotesAddonCollected ? FootnotesAddonCollected - this.NotesElement.MarginTop : 0,
                FalloutElementN: FalloutElementN,
                EndReached: EndReached
            };
        };
        return ReaderPage;
    })();

    var Reader = (function () {
        function Reader(ArtID, Site, FB3DOM, Bookmarks) {
            this.ArtID = ArtID;
            this.Site = Site;
            this.FB3DOM = FB3DOM;
            this.Bookmarks = Bookmarks;
            // Basic class init
            this.HyphON = true;
            this.NColumns = 2;
            this.CacheForward = 6;
            this.CacheBackward = 2;
            this.PagesPositionsCache = new Array();
            this.CurStartPos = [495, 0];

            //			this.CurStartPos = [1];
            this.IdleOff();
        }
        Reader.prototype.Init = function () {
            var _this = this;
            this.PrepareCanvas();
            this.FB3DOM.Init(this.HyphON, this.ArtID, function () {
                _this.LoadDone(1);
            });
            this.Bookmarks.Load(this.ArtID, function () {
                _this.LoadDone(2);
            });
        };

        Reader.prototype.LoadDone = function (a) {
            //			console.log('LoadDone ' + a + '/' + this.FB3DOM.Ready + ':' + this.Bookmarks.Ready);
            var ReadPos;
            if (this.FB3DOM.Ready && this.Bookmarks.Ready) {
                if (this.Bookmarks && this.Bookmarks.CurPos) {
                    ReadPos = this.Bookmarks.CurPos.Fragment.From.slice(0);
                } else {
                    ReadPos = this.CurStartPos.slice(0);
                }
                this.GoTO(ReadPos);
            }
        };

        Reader.prototype.GoTO = function (NewPos) {
            this.IdleOff();

            //			console.log('GoTO ' + NewPos);
            this.CurStartPos = NewPos.slice(0);
            var GotoPage = this.GetCachedPage(NewPos);
            if (GotoPage != undefined) {
                this.GoTOPage(GotoPage);
            } else {
                this.GoToOpenPosition(NewPos);
            }
        };
        Reader.prototype.GoTOPage = function (Page) {
            // Wow, we know the page. It'll be fast. Page is in fact a column, so it belongs to it's
            // set, NColumns per one. Let's see what start column we are going to deal with
            var RealStartPage = Math.floor(Page / this.NColumns) * this.NColumns;

            var FirstPageNToRender;
            var FirstFrameToFill;
            var WeeHaveFoundReadyPage = false;

            for (var I = 0; I < this.Pages.length / this.NColumns; I++) {
                var BasePage = I * this.NColumns;

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
                this.IdleOn();
                return;
            } else if (!WeeHaveFoundReadyPage) {
                FirstPageNToRender = RealStartPage;
                FirstFrameToFill = this.Pages[0];
                this.PutBlockIntoView(0);
            }
            this.CurStartPos = this.PagesPositionsCache[Page].Range.From.slice(0);

            var CacheBroken = false;
            var NewInstr = new Array();
            for (var I = FirstPageNToRender; I < RealStartPage + (this.CacheForward + 1) * this.NColumns; I++) {
                if (!CacheBroken && this.PagesPositionsCache[I]) {
                    NewInstr.push(PRIClone(this.PagesPositionsCache[I]));
                } else {
                    if (!CacheBroken) {
                        CacheBroken = true;
                        NewInstr.push({ Start: this.PagesPositionsCache[I - 1].Range.To.slice(0) });
                    } else {
                        NewInstr.push({});
                    }
                    NewInstr[NewInstr.length - 1].CacheAs = I;
                }
            }
            FirstFrameToFill.SetPending(NewInstr);
            FirstFrameToFill.DrawInit(NewInstr);
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
            this.CurStartPos = NewPos.slice(0);
            var FragmentEnd = NewPos[0] + 10;
            if (FragmentEnd > this.FB3DOM.TOC[this.FB3DOM.TOC.length - 1].e) {
                FragmentEnd = this.FB3DOM.TOC[this.FB3DOM.TOC.length - 1].e;
            }
            var Range = { From: NewPos, To: [FragmentEnd] };

            //			console.log('GoToOpenPosition ' + NewPos);
            var NewInstr = [{ Start: NewPos }];

            var ShouldWeCachePositions = NewPos.length == 1 && NewPos[0] == 0;
            if (ShouldWeCachePositions) {
                NewInstr[0].CacheAs = 0;
                this.CurStartPage = 0;
            } else {
                this.CurStartPage = undefined;
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
            return this.FB3DOM.TOC;
        };

        Reader.prototype.ResetCache = function () {
            this.IdleAction = 'load_page';
            this.IdleOff();
            this.PagesPositionsCache = new Array();
        };

        Reader.prototype.GetCachedPage = function (NewPos) {
            for (var I = 0; I < this.PagesPositionsCache.length; I++) {
                if (PosCompare(this.PagesPositionsCache[I].Range.To, NewPos) > 0) {
                    return I;
                }
            }
            return undefined;
        };

        Reader.prototype.StoreCachedPage = function (Range) {
            this.PagesPositionsCache[Range.CacheAs] = PRIClone(Range);
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
                    var NewPage = new ReaderPage(J, this.FB3DOM, this, this.Pages[this.Pages.length - 1]);
                    this.Pages[this.Pages.length] = NewPage;
                    InnerHTML += NewPage.GetInitHTML(I * this.NColumns + J + 1);
                }
            }
            this.Pages[this.Pages.length - 1].Next = this.Pages[0];

            this.BackgroundRenderFrame = new ReaderPage(0, this.FB3DOM, this, null);
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
        };

        Reader.prototype.AfterCanvasResize = function () {
            var _this = this;
            if (this.OnResizeTimeout) {
                clearTimeout(this.OnResizeTimeout);
            }
            this.OnResizeTimeout = setTimeout(function () {
                if (_this.CanvasW != _this.Site.Canvas.clientWidth || _this.CanvasH != _this.Site.Canvas.clientHeight) {
                    for (var I = 0; I < _this.Pages.length; I++) {
                        _this.Pages[I].Reset();
                    }
                    _this.PrepareCanvas();
                    _this.GoTO(_this.CurStartPos.slice(0));
                    _this.OnResizeTimeout = undefined;
                }
            }, 200);
        };

        Reader.prototype.FirstUncashedPage = function () {
            var FirstUncached;
            if (this.PagesPositionsCache.length) {
                FirstUncached = {
                    Start: this.PagesPositionsCache[this.PagesPositionsCache.length - 1].Range.To.slice(0),
                    CacheAs: this.PagesPositionsCache.length
                };
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
                if (this.CurStartPage + this.NColumns < this.PagesPositionsCache.length) {
                    this.GoTOPage(this.CurStartPage + this.NColumns);
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
                    } else {
                        this.GoToOpenPosition(this.Pages[this.CurVisiblePage + this.NColumns - 1].RenderInstr.Range.To);
                    }
                } else {
                    this.CurStartPos = PageToView.RenderInstr.Range.From;
                    this.PutBlockIntoView(PageToView.ID - 1);
                }
            }
            return false;
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
                    this.GoTOPage(GotoPage);
                } else {
                    this.MoveTimeoutID = setTimeout(function () {
                        _this.PageBackward();
                    }, 50);
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

        Reader.prototype.IdleGo = function (PageData) {
            var _this = this;
            if (this.IsIdle) {
                switch (this.IdleAction) {
                    case 'load_page':
                        var PageToPrerender = this.FirstUncashedPage();
                        if (this.FB3DOM.TOC[this.FB3DOM.TOC.length - 1].e <= PageToPrerender.Start[0]) {
                            //							alert('Cache done ' + this.PagesPositionsCache.length + ' items calced');
                            this.LastPage = this.PagesPositionsCache.length - 1;
                            this.IdleOff();
                            this.Site.IdleThreadProgressor.Progress(this, 100);
                            this.Site.IdleThreadProgressor.HourglassOff(this);
                            return;
                        } else {
                            this.LastPage = undefined;
                            this.Site.IdleThreadProgressor.Progress(this, PageToPrerender.Start[0] / this.FB3DOM.TOC[this.FB3DOM.TOC.length - 1].e * 100);
                        }
                        this.IdleAction = 'wait';

                        // Kind of lightweight DrawInit here, it looks like copy-paste is reasonable here
                        this.BackgroundRenderFrame.RenderInstr = PageToPrerender;

                        for (var I = 0; I < 100; I++) {
                            this.BackgroundRenderFrame.PagesToRender[I] = { CacheAs: PageToPrerender.CacheAs + I + 1 };
                        }

                        var Range;
                        Range = this.BackgroundRenderFrame.DefaultRangeApply(PageToPrerender);

                        this.FB3DOM.GetHTMLAsync(this.HyphON, RangeClone(Range), this.BackgroundRenderFrame.ID + '_', this.BackgroundRenderFrame.ViewPortW, this.BackgroundRenderFrame.ViewPortH, function (PageData) {
                            _this.IdleAction = 'fill_page';
                            _this.IdleGo(PageData);
                        });
                        break;
                    case 'fill_page':
                        this.LastPage = undefined;
                        if (PageData) {
                            this.BackgroundRenderFrame.DrawEnd(PageData);
                        }
                        this.IdleAction = 'load_page';
                        break;
                    default:
                }
            }
        };
        Reader.prototype.IdleOn = function () {
            var _this = this;
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
        return Reader;
    })();
    FB3Reader.Reader = Reader;
})(FB3Reader || (FB3Reader = {}));
//# sourceMappingURL=FB3Reader.js.map
