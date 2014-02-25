/// <reference path="FB3ReaderHead.ts" />
/// <reference path="FB3Reader.ts" />
var FB3ReaderPage;
(function (FB3ReaderPage) {
    function HardcoreParseInt(Input) {
        Input.replace(/\D/g, '');
        if (Input == '')
            Input = '0';
        return parseInt(Input);
    }

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

    var ReaderPage = (function () {
        function ReaderPage(ColumnN, FB3DOM, FBReader, Prev) {
            this.ColumnN = ColumnN;
            this.FB3DOM = FB3DOM;
            this.FBReader = FBReader;
            this.Reseted = false;
            if (Prev) {
                Prev.Next = this;
            }
            this.PrerenderBlocks = 4;
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

            this.FB3DOM.GetHTMLAsync(this.FBReader.HyphON, this.FBReader.BookStyleNotes, FB3Reader.RangeClone(Range), this.ID + '_', this.ViewPortW, this.ViewPortH, function (PageData) {
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

        ReaderPage.prototype.CleanPage = function () {
            this.NotesElement.Node.innerHTML = this.Element.Node.innerHTML = '';
            this.PageN = undefined;
            this.Ready = true;
            this.Pending = false;
        };

        ReaderPage.prototype.DrawEnd = function (PageData) {
            var _this = this;
            if (this.Reseted) {
                this.Reseted = false;
                return;
            }
            this.Element.Node.innerHTML = PageData.Body.join('');
            if (PageData.FootNotes.length && this.FBReader.BookStyleNotes) {
                this.NotesElement.Node.innerHTML = PageData.FootNotes.join('');
                this.NotesElement.Node.style.display = 'block';
            }

            if (!this.RenderInstr.Range) {
                var FallOut = this.FallOut(this.Element.Height - this.Element.MarginBottom, 0);

                if (FB3Reader.PosCompare(FallOut.FallOut, this.RenderInstr.Start) == 0) {
                    if (this.FBReader.BookStyleNotes && PageData.FootNotes.length) {
                        this.FBReader.BookStyleNotes = false;
                        this.FBReader.BookStyleNotesTemporaryOff = true;
                        this.RenderInstr.Range = null;
                        this.NotesElement.Node.innerHTML = '';
                        this.DrawInit([this.RenderInstr].concat(this.PagesToRender));
                        return;
                    } else {
                        // That's it - no way to recover. We die now, later we will make some fix here
                        this.FBReader.Site.Alert('We can not fit the text into the page!');
                        this.RenderInstr.Start = [this.RenderInstr.Start[0] * 1 + 1];
                        this.RenderInstr.Range = null;
                        if (this.FBReader.BookStyleNotesTemporaryOff) {
                            this.FBReader.BookStyleNotes = true;
                            this.FBReader.BookStyleNotesTemporaryOff = false;
                        }
                        this.DrawInit([this.RenderInstr].concat(this.PagesToRender));
                        return;
                    }
                }

                var PageCorrupt = false;
                if (this.FBReader.BookStyleNotesTemporaryOff) {
                    this.FBReader.BookStyleNotes = true;
                    this.FBReader.BookStyleNotesTemporaryOff = false;
                    PageCorrupt = true;
                }

                if (!FallOut.EndReached) {
                    if (this.FB3DOM.TOC[this.FB3DOM.TOC.length - 1].e > FallOut.FallOut[0]) {
                        // Ups, our page is incomplete - have to retry filling it. Take more data now
                        //var BasePrerender = this.PrerenderBlocks;
                        this.PrerenderBlocks += 2;
                        this.RenderInstr.Range = null;
                        this.DrawInit([this.RenderInstr].concat(this.PagesToRender));

                        //this.PrerenderBlocks = BasePrerender;
                        return;
                    } else if (this.Next) {
                        var NP = this;
                        for (var I = 0; I < this.PagesToRender.length; I++) {
                            NP = NP.Next;
                            NP.CleanPage();
                            NP.Ready = false;
                            NP.RenderInstr.Range = { From: [-1], To: [-1] };
                        }
                    }
                    this.PagesToRender = [];
                    this.RenderInstr.Range = {
                        From: this.RenderInstr.Start.splice(0),
                        To: FallOut.FallOut
                    };
                    this.RenderInstr.Range.To[0]++;
                } else {
                    this.RenderInstr.Range = {
                        From: this.RenderInstr.Start.splice(0),
                        To: FallOut.FallOut
                    };
                }
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
                if (FallOut.EndReached && LastChild && !PageCorrupt) {
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

        //public Redraw() {
        //	if (!this.Ready || !this.RenderInstr) {
        //		return
        //	}
        //	this.DrawInit([FB3Reader.PRIClone(this.RenderInstr)]);
        //}
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
                if (Child.style.position.match(/absolute/i)) {
                    I++;
                    continue;
                }
                PrevPageBreaker = PrevPageBreaker || !ForceDenyElementBreaking && PageBreakBefore(Child);
                var SH = Child.scrollHeight;
                var OH = Child.offsetHeight;
                var ChildBot = Child.offsetTop + Math.max(SH, OH);

                if (SH != OH) {
                    // While calculating browser's widths&heights you can find that 1+1+3. We "round" it up
                    // if things look suspisiously
                    ChildBot++;
                }

                if (!NoMoreFootnotesHere && this.FBReader.BookStyleNotes) {
                    if (Child.nodeName.match(/a/i) && Child.className.match(/\bfootnote_attached\b/)) {
                        var NoteElement = this.Site.getElementById('f' + Child.id);
                        if (NoteElement) {
                            FootnotesAddon = NoteElement.offsetTop + NoteElement.offsetHeight;
                        }
                    } else {
                        var FootNotes = Child.getElementsByTagName('a');
                        for (var J = FootNotes.length - 1; J >= 0; J--) {
                            if (FootNotes[J].className.match(/\bfootnote_attached\b/)) {
                                var NoteElement = this.Site.getElementById('f' + FootNotes[J].id);
                                FootnotesAddon = NoteElement.offsetTop + NoteElement.offsetHeight;
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
                    if (!PrevPageBreaker && ChildsCount == 0 && FootnotesAddon > FootnotesAddonCollected && LastLineBreakerParent) {
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
                GoodHeight = this.Element.Node.scrollHeight;
            }

            Addr.shift();
            Addr.shift();
            while (Addr[Addr.length - 1] == 0) {
                Addr.pop();
            }

            //for (var I = 0; I < Addr.length; I++) {
            //	Addr[I] = Addr[I] * 1; // Remove string corruption
            //}
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
    FB3ReaderPage.ReaderPage = ReaderPage;
})(FB3ReaderPage || (FB3ReaderPage = {}));
//# sourceMappingURL=FB3ReaderPage.js.map
