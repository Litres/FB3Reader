/// <reference path="FB3ReaderHead.ts" />
var FB3Reader;
(function (FB3Reader) {
    function IsNodePageBreaker(Node) {
        return Node.children[0] && Node.children[0].nodeName.toLowerCase() == 'h1' ? true : false;
    }

    function IsNodeUnbreakable(Node) {
        return Node.children[0] && Node.children[0].nodeName.match(/^h\d$/i) ? true : false;
    }

    function RangeClone(BaseRange) {
        return {
            From: BaseRange.From.slice(0),
            To: BaseRange.To.slice(0)
        };
    }

    var ReaderPage = (function () {
        function ReaderPage(ColumnN, FB3DOM, FBReader, Prev) {
            this.ColumnN = ColumnN;
            this.FB3DOM = FB3DOM;
            this.FBReader = FBReader;
            this.Busy = false;
            this.Reseted = false;
            if (Prev) {
                Prev.Next = this;
            }
            this.PrerenderBlocks = 4;
        }
        ReaderPage.prototype.Show = function () {
        };
        ReaderPage.prototype.Hide = function () {
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
            if (document.all) {
                MarginTop = parseInt(Element.currentStyle.marginTop, 10) + parseInt(Element.currentStyle.paddingTop, 10);
                MarginBottom = parseInt(Element.currentStyle.marginBottom, 10) + parseInt(Element.currentStyle.paddingBottom, 10);
            } else {
                MarginTop = parseInt(getComputedStyle(Element, '').getPropertyValue('margin-top')) + parseInt(getComputedStyle(Element, '').getPropertyValue('padding-top'));
                MarginBottom = parseInt(getComputedStyle(Element, '').getPropertyValue('margin-bottom')) + parseInt(getComputedStyle(Element, '').getPropertyValue('padding-bottom'));
            }
            return { Node: Element, Width: Width, Height: Height, MarginTop: MarginTop, MarginBottom: MarginBottom };
        };
        ReaderPage.prototype.BindToHTMLDoc = function (Site) {
            this.Site = Site;
            this.Element = this.FillElementData('FB3ReaderColumn' + this.ID);
            this.NotesElement = this.FillElementData('FB3ReaderNotes' + this.ID);
        };

        ReaderPage.prototype.DrawInit = function (PagesToRender) {
            var _this = this;
            if (PagesToRender.length == 0)
                return;
            if (this.Reseted) {
                this.Reseted = false;
                return;
            }
            this.Busy = true;

            this.RenderInstr = PagesToRender.shift();
            this.PagesToRender = PagesToRender;

            var Range;
            if (this.RenderInstr.Range) {
                Range = this.RenderInstr.Range;
            } else {
                if (!this.RenderInstr.Start) {
                    this.RenderInstr.Start = [0];
                }

                var FragmentEnd = this.RenderInstr.Start[0] * 1 + this.PrerenderBlocks;
                if (FragmentEnd > this.FB3DOM.TOC[this.FB3DOM.TOC.length - 1].e) {
                    FragmentEnd = this.FB3DOM.TOC[this.FB3DOM.TOC.length - 1].e;
                }
                Range = { From: this.RenderInstr.Start.slice(0), To: [FragmentEnd] };
            }

            this.FB3DOM.GetHTMLAsync(this.FBReader.HyphON, RangeClone(Range), function (PageData) {
                return _this.DrawEnd(PageData);
            });
        };

        ReaderPage.prototype.DrawEnd = function (PageData) {
            var _this = this;
            this.Busy = false;

            if (this.Reseted) {
                this.Reseted = false;
                return;
            }
            this.Element.Node.innerHTML = PageData.Body.join('');
            if (PageData.FootNotes.length) {
                this.NotesElement.Node.innerHTML = PageData.FootNotes.join('');
            }
            if (!this.RenderInstr.Range) {
                var FallOut = this.FallOut(this.Element.Height - this.Element.MarginBottom, 0);
                if (!FallOut) {
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

                if (this.RenderInstr.CacheAs !== undefined) {
                    this.FBReader.StoreCachedPage(this.RenderInstr.CacheAs, this.RenderInstr);
                }

                // Ok, we have rendered the page nice. Now we can check, wether we have created
                // a page long enough to fit the NEXT page. If so, we are going to estimate it's
                // content to create next page(s) with EXACTLY the required html - this will
                // speed up the render
                var LastChild = this.Element.Node.children[this.Element.Node.children.length - 1];
                if (LastChild) {
                    var CollectedHeight = FallOut.Height;
                    var PrevTo;
                    for (var I = 0; I < this.PagesToRender.length; I++) {
                        var TestHeight = CollectedHeight + this.Element.Height - this.Element.MarginBottom - this.Element.MarginTop;
                        if (LastChild.offsetTop + LastChild.scrollHeight > TestHeight) {
                            var NextPageFallOut = this.FallOut(TestHeight, 0);
                            if (NextPageFallOut) {
                                var NextPageRange = {};
                                NextPageRange.From = (PrevTo ? PrevTo : this.RenderInstr.Range.To).slice(0);
                                PrevTo = NextPageFallOut.FallOut.slice(0);
                                NextPageRange.To = NextPageFallOut.FallOut.slice(0);

                                //  As we host hyphen in the NEXT element(damn webkit) and a hyphen has it's width,
                                //  we always need to have one more inline - element to make sure the element without
                                //  a hyphen(and thus enormously narrow) will not be left on the page as a last element,
                                //  while it should fall down being too wide with hyphen attached Like this:
                                //  Wrong:                                            Right:
                                //  |aaa bb-|                                         |aaa bb-|
                                //  |bb cccc|                                         |bb cccc|
                                //  |d eeeee|<if page cut here - error>               |d  eee-| << this hyphen fits ok, next will not
                                //  |-ee    |<< this hyphen must be the               |eeee   | << this tail bring excess part down
                                //              6-th char, so "eeeee" would NOT fit
                                NextPageRange.To[NextPageRange.To.length - 1]++;

                                this.PagesToRender[I].Height = NextPageFallOut.Height - CollectedHeight + this.Element.MarginTop;
                                CollectedHeight = NextPageFallOut.Height;
                                if (this.PagesToRender[I].CacheAs !== undefined) {
                                    this.FBReader.StoreCachedPage(this.RenderInstr.CacheAs, NextPageRange);
                                }
                                this.PagesToRender[I].Range = NextPageRange;
                            } else {
                                break;
                            }
                        } else {
                            break;
                        }
                    }
                }
            }

            this.Element.Node.parentElement.style.height = (this.RenderInstr.Height + this.RenderInstr.NotesHeight) + 'px';
            this.Element.Node.style.height = (this.RenderInstr.Height - this.Element.MarginBottom - this.Element.MarginTop) + 'px';
            this.Element.Node.style.overflow = 'hidden';

            if (this.PagesToRender && this.PagesToRender.length) {
                if (!this.PagesToRender[0].Range && !this.PagesToRender[0].Start) {
                    this.PagesToRender[0].Start = this.RenderInstr.Range.To;
                }
                this.RenderMoreTimeout = setTimeout(function () {
                    _this.Next.DrawInit(_this.PagesToRender);
                }, 1);
            }
        };

        ReaderPage.prototype.Reset = function () {
            clearTimeout(this.RenderMoreTimeout);

            //			console.log('Reset ' + this.ID);
            this.PagesToRender = null;
            this.Reseted = true;
        };

        ReaderPage.prototype.PutPagePlace = function (Place) {
            if (Place < 0) {
                this.Element.Node.style.display = 'none';
            } else {
                this.Element.Node.style.display = 'block';
            }
        };

        ReaderPage.prototype.FallOut = function (Limit, NotesShift) {
            //		Hand mage CSS3 tabs. I thouth it would take more than this
            var Element = this.Element.Node;
            var I = 0;
            var GoodHeight = 0;
            var ChildsCount = Element.children.length;
            var ForceDenyElementBreaking = true;
            var LastOffsetParent;
            var LastOffsetShift;
            var GotTheBottom = false;
            var FootnotesAddon = 0;
            while (I < ChildsCount) {
                var Child = Element.children[I];
                var ChildBot = Child.offsetTop + Math.max(Child.scrollHeight, Child.offsetHeight);

                if (Child.nodeName.match(/a/i) && Child.className.match(/\bfootnote_attached\b/)) {
                    var NoteElement = this.Site.getElementById('f' + Child.id);
                    if (NoteElement) {
                        FootnotesAddon = NoteElement.offsetTop + NoteElement.scrollHeight + this.NotesElement.MarginTop;
                    }
                } else {
                    var FootNotes = Child.getElementsByTagName('a');
                    for (var J = FootNotes.length - 1; J >= 0; J--) {
                        if (FootNotes[J].className.match(/\bfootnote_attached\b/)) {
                            var NoteElement = this.Site.getElementById('f' + FootNotes[J].id);
                            FootnotesAddon = NoteElement.offsetTop + NoteElement.scrollHeight + this.NotesElement.MarginTop;
                            break;
                        }
                    }
                }

                var PrevPageBreaker;
                if ((ChildBot + FootnotesAddon < Limit) && !PrevPageBreaker) {
                    I++;
                    ForceDenyElementBreaking = false;
                } else {
                    GotTheBottom = true;
                    var CurShift = Child.offsetTop;
                    if (Child.innerHTML.match(/^(\u00AD|\s)/)) {
                        CurShift += Math.floor(Math.max(Child.scrollHeight, Child.offsetHeight) / 2);
                    } else {
                        var NextChild = Element.children[I + 1];
                        if (NextChild && NextChild.innerHTML.match(/^\u00AD/)) {
                            Child.innerHTML += '_';
                        }
                    }
                    var ApplyShift;
                    if (LastOffsetParent == Child.offsetParent) {
                        ApplyShift = CurShift - LastOffsetShift;
                    } else {
                        ApplyShift = CurShift;
                    }
                    LastOffsetShift = CurShift;

                    GoodHeight += ApplyShift;
                    LastOffsetParent = Child.offsetParent;
                    Child.className += ' cut_bot';
                    Element = Child;
                    ChildsCount = (!ForceDenyElementBreaking && IsNodeUnbreakable(Element)) ? 0 : Element.children.length;
                    Limit = Limit - ApplyShift;
                    I = 0;
                    if (PrevPageBreaker)
                        break;
                }
                PrevPageBreaker = !ForceDenyElementBreaking && IsNodePageBreaker(Child);
            }

            if (!GotTheBottom) {
                return null;
            }
            var Addr = Element.id.split('_');
            Addr.shift();
            return { FallOut: Addr, Height: GoodHeight, NotesHeight: FootnotesAddon };
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
            this.CurStartPos = [5, 14];
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
                    ReadPos = this.Bookmarks.CurPos.Fragment.From;
                } else {
                    ReadPos = this.CurStartPos;
                }
                this.GoTO(ReadPos);
            }
        };

        Reader.prototype.GoTO = function (NewPos) {
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
        };

        Reader.prototype.GoToOpenPosition = function (NewPos) {
            var FragmentEnd = NewPos[0] + 10;
            if (FragmentEnd > this.FB3DOM.TOC[this.FB3DOM.TOC.length - 1].e) {
                FragmentEnd = this.FB3DOM.TOC[this.FB3DOM.TOC.length - 1].e;
            }
            var Range = { From: NewPos, To: [FragmentEnd] };

            //			console.log('GoToOpenPosition ' + NewPos);
            var NewInstr = [{ Start: NewPos }];
            for (var I = 0; I < this.CacheForward * this.NColumns; I++) {
                NewInstr.push({});
            }
            this.Pages[0].DrawInit(NewInstr);
        };

        Reader.prototype.TOC = function () {
            return this.FB3DOM.TOC;
        };

        Reader.prototype.ResetCache = function () {
            this.PagesPositionsCache = new Array();
        };
        Reader.prototype.GetCachedPage = function (NewPos) {
            return undefined;
        };
        Reader.prototype.StoreCachedPage = function (Page, Range) {
            this.PagesPositionsCache[Page] = Range;
        };

        Reader.prototype.SearchForText = function (Text) {
            return null;
        };

        Reader.prototype.PrepareCanvas = function () {
            this.ResetCache();
            var InnerHTML = '<div class="FB3ReaderColumnset' + this.NColumns + '" id="FB3ReaderHostDiv" style="width:100%; overflow:hidden; height:100%">';
            this.Pages = new Array();
            for (var I = 0; I < this.CacheBackward + this.CacheForward; I++) {
                for (var J = 0; J < this.NColumns; J++) {
                    var NewPage = new ReaderPage(J, this.FB3DOM, this, this.Pages[this.Pages.length - 1]);
                    this.Pages[this.Pages.length] = NewPage;
                    InnerHTML += NewPage.GetInitHTML(I * this.NColumns + J);
                }
            }
            this.Pages[this.Pages.length - 1].Next = this.Pages[0];
            InnerHTML += '</div>';
            this.Site.Canvas.innerHTML = InnerHTML;

            for (var I = 0; I < this.Pages.length; I++) {
                this.Pages[I].BindToHTMLDoc(this.Site);
            }
        };

        Reader.prototype.AfterCanvasResize = function () {
            var _this = this;
            if (this.OnResizeTimeout) {
                clearTimeout(this.OnResizeTimeout);
            }
            this.OnResizeTimeout = setTimeout(function () {
                for (var I = 0; I < _this.Pages.length; I++) {
                    _this.Pages[I].Reset();
                }
                _this.PrepareCanvas();
                _this.GoTO(_this.CurStartPos);
                _this.OnResizeTimeout = undefined;
            }, 200);
        };
        return Reader;
    })();
    FB3Reader.Reader = Reader;
})(FB3Reader || (FB3Reader = {}));
//@ sourceMappingURL=FB3Reader.js.map
