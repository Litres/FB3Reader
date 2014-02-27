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
            this.PrerenderBlocks = 16;
            this.Ready = false;
            this.Pending = false;
            this.FalloutState = {};
        }
        ReaderPage.prototype.Show = function () {
            if (!this.Visible) {
                this.ParentElement.style.top = '0';
                this.Visible = true;
            }
        };

        ReaderPage.prototype.Hide = function () {
            // It's breaking apart here somehow :(
            //			return;
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
            //			console.log('DrawInit '+this.ID);
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
            //			console.log('DrawEnd ' + this.ID);
            if (this.Reseted) {
                this.Reseted = false;
                return;
            }
            this.Element.Node.innerHTML = PageData.Body.join('');
            var HasFootnotes = PageData.FootNotes.length && this.FBReader.BookStyleNotes;
            if (HasFootnotes) {
                this.NotesElement.Node.innerHTML = PageData.FootNotes.join('');
                this.NotesElement.Node.style.display = 'block';
            }

            //			this.NotesElement.Node.style.display = PageData.FootNotes.length ? 'block' : 'none';
            if (!this.RenderInstr.Range) {
                this.InitFalloutState(this.Element.Height - this.Element.MarginBottom, 0, HasFootnotes);
                var FallOut = this.FallOut();
                this.FalloutConsume(FallOut);
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

            // We have a queue waiting and it is not a background renderer frame - then fire the next page fullfilment
            if (this.PagesToRender && this.PagesToRender.length && this.Next) {
                // we fire setTimeout to let the browser draw the page before we render the next
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

        ReaderPage.prototype.FalloutConsume = function (FallOut) {
            if (FB3Reader.PosCompare(FallOut.FallOut, this.RenderInstr.Start) == 0) {
                // It's too bad baby: text does not fit the page, not even a char
                // Let's try to stripe book-style footnotes first (if they are ON) - this must clean up some space
                if (this.FBReader.BookStyleNotes && this.FalloutState.HasFootnotes) {
                    this.FBReader.BookStyleNotes = false;
                    this.FBReader.BookStyleNotesTemporaryOff = true;
                    this.RenderInstr.Range = null;
                    this.NotesElement.Node.innerHTML = '';
                    this.DrawInit([this.RenderInstr].concat(this.PagesToRender));
                    return;
                } else {
                    // That's it - no way to recover. We die now, later we will make some fix here
                    this.FBReader.Site.Alert('We can not fit the text into the page!');
                    this.RenderInstr.Start = [this.RenderInstr.Start[0] * 1 + 1]; // * 1 removes string problem
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

            // We can have not enough content to fill the page. Sometimes we will refill it,
            // but sometimes (doc end or we only
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
                        this.InitFalloutState(this.Element.Height - this.Element.MarginBottom, 0, this.FalloutState.HasFootnotes, FallOut.FalloutElementN);
                        FallOut = this.FallOut();
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

        ReaderPage.prototype.InitFalloutState = function (Limit, NotesShift, HasFootnotes, SkipUntill) {
            this.FalloutState.Limit = Limit;
            this.FalloutState.NotesShift = NotesShift;
            this.FalloutState.I = SkipUntill > 0 ? SkipUntill : 0;
            this.FalloutState.Element = this.Element.Node;
            this.FalloutState.GoodHeight = 0;
            this.FalloutState.ChildsCount = this.FalloutState.Element.children.length;
            this.FalloutState.ForceDenyElementBreaking = true;
            this.FalloutState.LastOffsetParent = null;
            this.FalloutState.LastOffsetShift = null;
            this.FalloutState.EndReached = false;
            this.FalloutState.FootnotesAddonCollected = 0;

            // To shift notes to the next page we may have to eliminale last line as a whole - so we keep track of it
            this.FalloutState.LastLineBreakerParent = null;
            this.FalloutState.LastLineBreakerPos = null;
            this.FalloutState.LastFullLinePosition = 0;

            this.FalloutState.PrevPageBreaker = false;
            this.FalloutState.NoMoreFootnotesHere = false;
            this.FalloutState.FalloutElementN = -1;
            this.FalloutState.SplitHistory = [];
            this.FalloutState.ForceFitBlock = false;
            this.FalloutState.BTreeModeOn = false;
            this.FalloutState.BTreeLastOK = null;
            this.FalloutState.BTreeLastFail = null;
            this.FalloutState.HasFootnotes = HasFootnotes;
        };

        // Hand mage CSS3 tabs. I thouth it would take more than this
        ReaderPage.prototype.FallOut = function () {
            while (this.FalloutState.I < this.FalloutState.ChildsCount) {
                var FootnotesAddon = 0;
                var Child = this.FalloutState.Element.children[this.FalloutState.I];
                if (Child.style.position.match(/absolute/i)) {
                    this.FalloutState.I++;
                    continue;
                }
                this.FalloutState.PrevPageBreaker = this.FalloutState.PrevPageBreaker || !this.FalloutState.ForceDenyElementBreaking && PageBreakBefore(Child);
                var SH = Child.scrollHeight;
                var OH = Child.offsetHeight;
                var ChildBot = Child.offsetTop + Math.max(SH, OH);

                if (SH != OH) {
                    // While calculating browser's widths&heights you can find that 1+1=3. We "round" it up
                    // if things look suspisiously
                    ChildBot++;
                }

                if (!this.FalloutState.NoMoreFootnotesHere && this.FBReader.BookStyleNotes) {
                    // Footnotes kind of expand element height - NoMoreFootnotesHere is for making things faster
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
                    FootnotesAddon += this.NotesElement.MarginTop - this.FalloutState.NotesShift;
                }

                var FootnotesHeightNow = FootnotesAddon ? FootnotesAddon : this.FalloutState.FootnotesAddonCollected;
                if ((ChildBot + FootnotesHeightNow < this.FalloutState.Limit) && !this.FalloutState.PrevPageBreaker || this.FalloutState.ForceFitBlock) {
                    this.FalloutState.ForceDenyElementBreaking = false;
                    if (FootnotesAddon) {
                        this.FalloutState.FootnotesAddonCollected = FootnotesAddon;
                    }
                    ;
                    if (Math.abs(this.FalloutState.LastFullLinePosition - ChildBot) > 1) {
                        this.FalloutState.LastLineBreakerParent = this.FalloutState.Element;
                        this.FalloutState.LastLineBreakerPos = this.FalloutState.I;
                        this.FalloutState.LastFullLinePosition = ChildBot;
                    }
                    this.FalloutState.BTreeLastOK = this.FalloutState.I;
                    if (this.FalloutState.I == 0 && this.FalloutState.NoMoreFootnotesHere && this.FalloutState.ChildsCount > 7 && !this.FalloutState.BTreeModeOn && false) {
                        // In fact we could work with Footnotes as well, but it's a bit dedicated, perhaps return to it later on
                        this.FalloutState.BTreeModeOn = true;
                        this.FalloutState.BTreeLastFail = this.FalloutState.ChildsCount;
                    }
                    if (this.FalloutState.BTreeModeOn) {
                        this.FalloutState.I = this.GuessNextElement();
                    } else {
                        this.FalloutState.I++;
                    }

                    if (this.FalloutState.I == this.FalloutState.ChildsCount && this.FalloutState.SplitHistory.length) {
                        // Well, we could not fit the whole element, but all it's childs fit perfectly. Hopefully
                        // the reason is the bottom margin/padding. So we assume the whole element fits and leave those
                        // paddings hang below the visible page
                        var Fallback = this.FalloutState.SplitHistory.pop();
                        this.FalloutState.Element = Fallback.Element;
                        this.FalloutState.I = Fallback.I;
                        this.FalloutState.NoMoreFootnotesHere = false;
                        this.FalloutState.ChildsCount = this.FalloutState.Element.children.length;
                        this.FalloutState.ForceFitBlock = true;
                        this.FalloutState.PrevPageBreaker = false;
                        this.FalloutState.BTreeModeOn = false;
                    } else {
                        this.FalloutState.ForceFitBlock = false;
                    }
                } else {
                    // If we are in BTree Mode we save nothing exept BTreeLastFail. Just pretend like this fail have never happend
                    if (this.FalloutState.BTreeModeOn) {
                        this.FalloutState.BTreeLastFail = this.FalloutState.I;
                        this.FalloutState.I = this.GuessNextElement();
                        continue;
                    }
                    this.FalloutState.EndReached = true;
                    if (this.FalloutState.FalloutElementN == -1) {
                        this.FalloutState.FalloutElementN = this.FalloutState.I;
                    }
                    if (!FootnotesAddon) {
                        this.FalloutState.NoMoreFootnotesHere = true;
                    }
                    var CurShift = Child.offsetTop;
                    if (Child.innerHTML.match(/^(\u00AD|\s)/)) {
                        CurShift += Math.floor(Math.max(SH, OH) / 2); // what is this, hm?
                    }

                    //	var NextChild = <HTMLElement> Element.children[I + 1];
                    //if (NextChild && NextChild.innerHTML.match(/^\u00AD/)) {
                    //	Child.innerHTML += '_';
                    //}
                    //}
                    var OffsetParent = Child.offsetParent;
                    var ApplyShift;
                    if (this.FalloutState.LastOffsetParent == OffsetParent) {
                        ApplyShift = CurShift - this.FalloutState.LastOffsetShift;
                    } else {
                        ApplyShift = CurShift;
                    }
                    this.FalloutState.LastOffsetShift = CurShift;

                    this.FalloutState.GoodHeight += ApplyShift;
                    this.FalloutState.LastOffsetParent = OffsetParent;
                    this.FalloutState.SplitHistory.push({ I: this.FalloutState.I, Element: this.FalloutState.Element });
                    this.FalloutState.Element = Child;
                    this.FalloutState.ChildsCount = (!this.FalloutState.ForceDenyElementBreaking && IsNodeUnbreakable(this.FalloutState.Element)) ? 0 : this.FalloutState.Element.children.length;
                    if (!this.FalloutState.PrevPageBreaker && this.FalloutState.ChildsCount == 0 && FootnotesAddon > this.FalloutState.FootnotesAddonCollected && this.FalloutState.LastLineBreakerParent) {
                        // So, it looks like we do not fit because of the footnote, not the falling out text itself.
                        // Let's force page break on the previous line end - kind of time machine
                        this.FalloutState.I = this.FalloutState.LastLineBreakerPos;
                        this.FalloutState.Element = this.FalloutState.LastLineBreakerParent;
                        this.FalloutState.PrevPageBreaker = true;
                        this.FalloutState.ChildsCount = this.FalloutState.Element.children.length;
                        continue;
                    }
                    this.FalloutState.Limit = this.FalloutState.Limit - ApplyShift;
                    if (this.FalloutState.PrevPageBreaker)
                        break;
                    this.FalloutState.I = 0;
                }
            }

            var Addr;
            if (this.FalloutState.EndReached) {
                if (this.FalloutState.Element != this.Element.Node) {
                    Addr = this.FalloutState.Element.id.split('_');
                } else {
                    // Special case: we have exact match for the page with a little bottom margin hanging, still consider it OK
                    Addr = Child.id.split('_');
                }
            } else {
                Addr = Child.id.split('_');
                this.FalloutState.GoodHeight = this.Element.Node.scrollHeight;
            }

            Addr.shift();
            Addr.shift();

            while (Addr[Addr.length - 1] == 0 && Addr.length > 1) {
                Addr.pop();
            }

            //for (var I = 0; I < Addr.length; I++) {
            //	Addr[I] = Addr[I] * 1; // Remove string corruption
            //}
            return {
                FallOut: Addr,
                Height: this.FalloutState.GoodHeight,
                NotesHeight: this.FalloutState.FootnotesAddonCollected ? this.FalloutState.FootnotesAddonCollected - this.NotesElement.MarginTop : 0,
                FalloutElementN: this.FalloutState.FalloutElementN,
                EndReached: this.FalloutState.EndReached
            };
        };
        ReaderPage.prototype.GuessNextElement = function () {
            // we are going to be greedy optimists with ceil :)
            var BTreePoint = Math.ceil(this.FalloutState.BTreeLastOK + (this.FalloutState.BTreeLastFail - this.FalloutState.BTreeLastOK) / 2);
            if (BTreePoint - this.FalloutState.BTreeLastOK < 2) {
                this.FalloutState.BTreeModeOn = false;
            }
            return BTreePoint;
        };
        return ReaderPage;
    })();
    FB3ReaderPage.ReaderPage = ReaderPage;
})(FB3ReaderPage || (FB3ReaderPage = {}));
//# sourceMappingURL=FB3ReaderPage.js.map
