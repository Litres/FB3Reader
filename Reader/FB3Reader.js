/// <reference path="FB3ReaderHead.ts" />
var FB3Reader;
(function (FB3Reader) {
    function IsNodePageBreaker(Node) {
        return Node.childNodes[0].nodeName.toLowerCase() == 'h1' ? true : false;
    }
    function IsNodeUnbreakable(Node) {
        return Node.childNodes[0].nodeName.match(/^h\d$/i) ? true : false;
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
            this.PrerenderBlocks = 1;
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
            this.FB3DOM.GetHTMLAsync(this.FBReader.HyphON, Range, function (HTML) {
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
                this.RenderInstr.Range = {
                    From: this.RenderInstr.Start,
                    To: this.FallOut()
                };
                if (!this.RenderInstr.Range.To) {
                    // Ups, our page is incomplete - have to retry filling it. Take more data now
                    this.PrerenderBlocks *= 2;
                    this.RenderInstr.Range = null;
                    this.DrawInit([
                        this.RenderInstr
                    ].concat(this.PagesToRender.slice(0)));
                    return;
                }
                if (this.RenderInstr.CacheAs !== undefined) {
                    this.FBReader.StoreCachedPage(this.RenderInstr.CacheAs, this.RenderInstr.Range);
                }
            }
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
        ReaderPage.prototype.FallOut = function (FakeLimit) {
            //		CSS3 tabs - DIY
            var Element = this.Element;
            var Limit = this.Height;
            var I = 0;
            var GoodHeight = 0;
            var ChildsCount = Element.children.length;
            var ForceDenyElementBreaking = true;
            var LastOffsetParent;
            var LastOffsetShift;
            var GotTheBottom = false;
            while(I < ChildsCount) {
                var Child = Element.children[I];
                var ChildBot = Child.offsetTop + Child.scrollHeight;
                var PrevPageBreaker;
                if (ChildBot < Limit && !PrevPageBreaker) {
                    I++;
                    ForceDenyElementBreaking = false;
                } else {
                    GotTheBottom = true;
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
            if (!FakeLimit) {
                this.Element.parentElement.style.height = (GoodHeight - 1) + 'px';
            }
            var Addr = Element.id.split('_');
            Addr.shift();
            return Addr;
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
            //			this.CurStartPos = [5, 14];
            this.CurStartPos = [
                0
            ];
            // Environment research & canvas preparation
            this.PrepareCanvas();
        }
        Reader.prototype.Init = function () {
            var _this = this;
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
            this.Pages[0].DrawInit([
                {
                    Start: NewPos
                }, 
                {}
            ]);
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
            for(var I = 0; I < (this.CacheBackward + this.CacheForward + 1); I++) {
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
