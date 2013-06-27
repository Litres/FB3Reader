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
            this.PrerenderBlocks = 10;
        }
        ReaderPage.prototype.Show = function () {
        };
        ReaderPage.prototype.Hide = function () {
        };
        ReaderPage.prototype.GetInitHTML = function (ID) {
            this.ID = ID;
            return '<div class="FB2readerCell' + this.ColumnN + 'of' + this.FBReader.NColumns + ' FB2readerPage"><div class="FBReaderContentDiv" id="FB3ReaderColumn' + this.ID + '">...</div></div>';
        };
        ReaderPage.prototype.BindToHTMLDoc = function (Site) {
            this.Element = Site.getElementById('FB3ReaderColumn' + this.ID);
            this.Width = this.Element.offsetWidth;
            this.Height = this.Element.parentElement.offsetHeight;
            if (document.all) {
                this.MarginTop = parseInt(this.Element.currentStyle.marginTop, 10) + parseInt(this.Element.currentStyle.paddingTop, 10);
                this.MarginBottom = parseInt(this.Element.currentStyle.marginBottom, 10) + parseInt(this.Element.currentStyle.paddingBottom, 10);
            } else {
                this.MarginTop = parseInt(getComputedStyle(this.Element, '').getPropertyValue('margin-top')) + parseInt(getComputedStyle(this.Element, '').getPropertyValue('padding-top'));
                this.MarginBottom = parseInt(getComputedStyle(this.Element, '').getPropertyValue('margin-bottom')) + parseInt(getComputedStyle(this.Element, '').getPropertyValue('padding-bottom'));
            }
        };
        ReaderPage.prototype.DrawInit = function (PagesToRender) {
            var _this = this;
            if (PagesToRender.length == 0) {
                return;
            }
            this.Busy = true;
            this.Reseted = false;
            this.RenderInstr = PagesToRender.shift();
            this.PagesToRender = PagesToRender;
            var Range;
            if (this.RenderInstr.Range) {
                Range = this.RenderInstr.Range;
            } else {
                if (!this.RenderInstr.Start) {
                    this.RenderInstr.Start = [
                        0
                    ];
                }
                var FragmentEnd = this.RenderInstr.Start[0] * 1 + this.PrerenderBlocks;
                if (FragmentEnd > this.FB3DOM.TOC[this.FB3DOM.TOC.length - 1].e) {
                    FragmentEnd = this.FB3DOM.TOC[this.FB3DOM.TOC.length - 1].e;
                }
                Range = {
                    From: this.RenderInstr.Start.slice(0),
                    To: [
                        FragmentEnd
                    ]
                };
            }
            this.FB3DOM.GetHTMLAsync(this.FBReader.HyphON, RangeClone(Range), function (HTML) {
                return _this.DrawEnd(HTML);
            });
        };
        ReaderPage.prototype.DrawEnd = function (HTML) {
            var _this = this;
            this.Busy = false;
            if (this.Reseted) {
                this.Reseted = false;
                return;
            }
            this.Element.innerHTML = HTML;
            if (!this.RenderInstr.Range) {
                var FallOut = this.FallOut(this.Height - this.MarginBottom);
                if (!FallOut) {
                    // Ups, our page is incomplete - have to retry filling it. Take more data now
                    this.PrerenderBlocks *= 2;
                    this.RenderInstr.Range = null;
                    this.DrawInit([
                        this.RenderInstr
                    ].concat(this.PagesToRender));
                    return;
                }
                this.RenderInstr.Range = {
                    From: this.RenderInstr.Start.splice(0),
                    To: FallOut.FallOut
                };
                this.RenderInstr.Height = FallOut.Height;
                if (this.RenderInstr.CacheAs !== undefined) {
                    this.FBReader.StoreCachedPage(this.RenderInstr.CacheAs, this.RenderInstr);
                }
                // Ok, we have rendered the page nice. Now we can check, wether we have created
                // a page long enough to fin the NEXT page. If so, we are going to estimate it's
                // content to create next page(s) with EXACTLY the required html - this will
                // speed up the render
                var LastChild = this.Element.children[this.Element.children.length - 1];
                if (LastChild) {
                    var CollectedHeight = FallOut.Height;
                    for(var I = 0; I < this.PagesToRender.length; I++) {
                        var TestHeight = CollectedHeight + this.Height - this.MarginBottom - this.MarginTop;
                        if (LastChild.offsetTop + LastChild.scrollHeight > TestHeight) {
                            var NextPageFallOut = this.FallOut(TestHeight);
                            if (NextPageFallOut) {
                                var NextPageRange = {
                                    From: (I == 0 ? this.RenderInstr.Range.To : this.PagesToRender[I - 1].Range.To).splice(0),
                                    To: NextPageFallOut.FallOut
                                };
                                this.PagesToRender[I].Height = NextPageFallOut.Height - CollectedHeight + this.MarginTop;
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
            this.Element.parentElement.style.height = this.RenderInstr.Height + 'px';
            if (this.PagesToRender && this.PagesToRender.length) {
                if (!this.PagesToRender[0].Range && !this.PagesToRender[0].Start) {
                    this.PagesToRender[0].Start = this.RenderInstr.Range.To;
                }
                setTimeout(function () {
                    _this.Next.DrawInit(_this.PagesToRender);
                }, 1);
            }
        };
        ReaderPage.prototype.Reset = function () {
            this.PagesToRender = null;
            if (this.Busy) {
                this.Reseted = true;
            }
        };
        ReaderPage.prototype.PutPagePlace = function (Place) {
            if (Place < 0) {
                this.Element.style.display = 'none';
            } else {
                this.Element.style.display = 'block';
            }
        };
        ReaderPage.prototype.FallOut = function (Limit) {
            //		Hand mage CSS3 tabs. I thouth it would take more than this
            var Element = this.Element;
            var I = 0;
            var GoodHeight = 0;
            var ChildsCount = Element.children.length;
            var ForceDenyElementBreaking = true;
            var LastOffsetParent;
            var LastOffsetShift;
            var GotTheBottom = false;
            var NormHeight = 100500;
            while(I < ChildsCount) {
                var Child = Element.children[I];
                var ElHeight = Math.max(Child.scrollHeight, Child.offsetHeight);
                var ChildBot = Child.offsetTop + ElHeight;
                var PrevPageBreaker;
                if ((ChildBot < Limit) && !PrevPageBreaker) {
                    I++;
                    ForceDenyElementBreaking = false;
                    NormHeight = ElHeight;
                } else {
                    GotTheBottom = true;
                    var InnerHTML = Child.innerHTML;
                    if (InnerHTML.match(/^[^<]*\u00AD[^<]*$/) && ElHeight > NormHeight) {
                        // Hack to work with hyphens - as long as webkit can't make hyphens on the end
                        // of the Element, we will have to manage this ourselves :(
                        var Parts = InnerHTML.split(/\u00AD/);
                        InnerHTML = '';
                        for(var I = 0; I < Parts.length; I++) {
                            var Addon = '';
                            if (InnerHTML) {
                                Addon = '\u00AD';
                            }
                            Addon += Parts[I];
                            Child.innerHTML = InnerHTML + Addon + ' ';
                            if (Child.offsetTop + Math.max(Child.scrollHeight, Child.offsetHeight) >= Limit) {
                                Child.innerHTML = '<span id="' + Child.id + '_' + InnerHTML.length + '">' + InnerHTML + '- </span><span id="' + Child.id + '_' + (InnerHTML.length + 1) + '">' + Parts.slice(I).join('') + '</span>';
                                break;
                            }
                            InnerHTML += Addon;
                        }
                    }
                    var CurShift = Child.offsetTop;
                    var ApplyShift;
                    if (LastOffsetParent == Child.offsetParent) {
                        ApplyShift = CurShift - LastOffsetShift;
                    } else {
                        ApplyShift = CurShift;
                    }
                    LastOffsetShift = CurShift;
                    GoodHeight += ApplyShift;
                    LastOffsetParent = Child.offsetParent;
                    //Child.className += ' cut_bot';
                    //var Sibling = Element.children[I - 1];
                    Element = Child;
                    ChildsCount = (!ForceDenyElementBreaking && IsNodeUnbreakable(Element)) ? 0 : Element.children.length;
                    Limit = Limit - ApplyShift;
                    I = 0;
                    if (PrevPageBreaker) {
                        break;
                    }
                }
                PrevPageBreaker = !ForceDenyElementBreaking && IsNodePageBreaker(Child);
            }
            if (!GotTheBottom) {
                return null;
            }
            var Addr = Element.id.split('_');
            Addr.shift();
            return {
                FallOut: Addr,
                Height: GoodHeight
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
            this.CurStartPos = [
                5, 
                14
            ];
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
            var Range = {
                From: NewPos,
                To: [
                    FragmentEnd
                ]
            };
            //			console.log('GoToOpenPosition ' + NewPos);
            var NewInstr = [
                {
                    Start: NewPos
                }
            ];
            for(var I = 0; I < this.CacheForward * this.NColumns; I++) {
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
            for(var I = 0; I < this.CacheBackward + this.CacheForward; I++) {
                for(var J = 0; J < this.NColumns; J++) {
                    var NewPage = new ReaderPage(J, this.FB3DOM, this, this.Pages[this.Pages.length - 1]);
                    this.Pages[this.Pages.length] = NewPage;
                    InnerHTML += NewPage.GetInitHTML(I * this.NColumns + J);
                }
            }
            this.Pages[this.Pages.length - 1].Next = this.Pages[0];
            InnerHTML += '</div>';
            this.Site.Canvas.innerHTML = InnerHTML;
            for(var I = 0; I < this.Pages.length; I++) {
                this.Pages[I].BindToHTMLDoc(this.Site);
            }
        };
        Reader.prototype.AfterCanvasResize = function () {
            var _this = this;
            if (this.OnResizeTimeout) {
                clearTimeout(this.OnResizeTimeout);
            }
            this.OnResizeTimeout = setTimeout(function () {
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
