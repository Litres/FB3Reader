/// <reference path="FB3DOMHead.ts" />
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var FB3DOM;
(function (FB3DOM) {
    FB3DOM.TagMapper = {
        poem: 'div',
        stanza: 'div',
        subtitle: 'h6',
        epigraph: 'blockquote',
        annotation: 'blockquote',
        'text-author': 'blockquote',
        date: 'blockquote',
        cite: 'blockquote',
        v: 'p',
        'empty-line': 'hr',
        emphasis: 'em',
        style: 'span',
        footnote: 'div',
        nobr: 'span',
        image: 'img'
    };
    FB3DOM.BlockLVLRegexp = /^(div|blockquote|h\d|p|img)$/;

    // Each DOM-node holds xpath-adress of self as an array
    // Last item in array is ALWAYS char pos. When converting to string such a zerro is ommited
    var FB3Text = (function () {
        function FB3Text(text, Parent, ID, NodeN, Chars, IsFootnote) {
            this.text = text;
            this.Parent = Parent;
            this.ID = ID;
            this.IsFootnote = IsFootnote;
            this.Chars = this.text.replace('\u00AD', '&shy;').length;

            //			this.text = this.text.replace('\u00AD', '&shy;')
            this.XPID = (Parent && Parent.XPID != '' ? Parent.XPID + '_' : '') + this.ID;
            if (Parent) {
                this.XPath = Parent.XPath.slice(0);
                this.XPath.push(NodeN);
                this.XPath.push(Chars);
                this.Bookmarks = Parent.Bookmarks;
            }
        }
        FB3Text.prototype.GetHTML = function (HyphOn, BookStyleNotes, Range, IDPrefix, ViewPortW, ViewPortH, PageData, Bookmarks) {
            var OutStr = this.text;
            if (Range.To[0]) {
                OutStr = OutStr.substr(0, Range.To[0]);
            }
            if (Range.From[0]) {
                OutStr = OutStr.substr(Range.From[0]);
            }

            if (!HyphOn) {
                OutStr = OutStr.replace(/\u00AD/, '');
            }

            var TargetStream = this.IsFootnote ? PageData.FootNotes : PageData.Body;

            var ClassNames = this.GetBookmarkClasses(Bookmarks);
            if (ClassNames) {
                ClassNames = ' class="' + ClassNames + '"';
            }

            TargetStream.push('<span id="n_' + IDPrefix + this.XPID + '"' + ClassNames + '>' + OutStr + '</span>');
        };

        FB3Text.prototype.ArtID2URL = function (Chunk) {
            return this.Parent.ArtID2URL(Chunk);
        };

        // Filters Bookmarks the way it contains no items childs. Returns
        // class names for current element CSS
        FB3Text.prototype.GetBookmarkClasses = function (Bookmarks) {
            if (!Bookmarks.length) {
                return '';
            }

            var ThisNodeSelections = new Array();

            var EffectiveXPath = this.XPath.slice(0);

            for (var Bookmark = Bookmarks.length - 1; Bookmark >= 0; Bookmark--) {
                var HowIsStart = FB3Reader.PosCompare(Bookmarks[Bookmark].XStart, EffectiveXPath);
                var HowisEnd = FB3Reader.PosCompare(Bookmarks[Bookmark].XEnd, EffectiveXPath);

                if (HowIsStart == 10 || HowisEnd == -10) {
                    Bookmarks.splice(Bookmark, 1);
                    continue;
                }

                if (HowIsStart == 1 || HowisEnd == 1) {
                    continue;
                }

                // Our tag is directly targeted or is fully within of the selection
                // In both cases we mark it as a whole and leave our kids alone
                ThisNodeSelections.push(Bookmarks[Bookmark].ClassName());
                Bookmarks.splice(Bookmark, 1);
            }
            return ThisNodeSelections.join(' ');
        };
        return FB3Text;
    })();
    FB3DOM.FB3Text = FB3Text;

    var FB3Tag = (function (_super) {
        __extends(FB3Tag, _super);
        function FB3Tag(Data, Parent, ID, IsFootnote) {
            _super.call(this, '', Parent, ID, 1, 0, IsFootnote);
            this.Data = Data;
            if (Data === null)
                return;

            this.TagName = Data.t;

            if (Data.xp) {
                this.XPath = this.Data.xp;
            }

            this.Childs = new Array();
            var Base = 0;
            if (Data.f) {
                Base++;
                var NKid = new FB3Tag(Data.f, this, Base, true);
                this.Childs.push(NKid);
                this.Chars += NKid.Chars;
            }
            if (Data.c) {
                var NodeN = 1;
                var Chars = 0;
                for (var I = 0; I < Data.c.length; I++) {
                    var Itm = Data.c[I];
                    var Kid;
                    if (typeof Itm === "string") {
                        if (Data.f) {
                            Itm = Itm.replace(/[\[\]\{\}\(\)]+/g, '');
                        }
                        Kid = new FB3Text(Itm, this, I + Base, NodeN, Chars, IsFootnote);
                        Chars += Kid.Chars;
                    } else {
                        Kid = new FB3Tag(Itm, this, I + Base, IsFootnote);
                        NodeN += 2;
                        Chars = 0;
                    }
                    this.Childs.push(Kid);
                    this.Chars += Kid.Chars;
                }
            }
        }
        FB3Tag.prototype.GetHTML = function (HyphOn, BookStyleNotes, Range, IDPrefix, ViewPortW, ViewPortH, PageData, Bookmarks) {
            // keep in mind after GetBookmarkClasses Bookmarks is cleaned of all unneeded bookmarks
            var ClassNames = '';
            if (Bookmarks.length) {
                ClassNames = this.GetBookmarkClasses(Bookmarks);
            }

            if (BookStyleNotes && this.IsFootnote) {
                // If we are not using book-like footnotes, no need to prefill text for them - they are invisible untill clicked
                // we should do something about it
            }

            if (this.IsFootnote) {
                PageData.FootNotes = PageData.FootNotes.concat(this.GetInitTag(Range, BookStyleNotes, IDPrefix, ViewPortW, ViewPortH, ClassNames));
            } else {
                PageData.Body = PageData.Body.concat(this.GetInitTag(Range, BookStyleNotes, IDPrefix, ViewPortW, ViewPortH, ClassNames));
            }
            var CloseTag = this.GetCloseTag(Range);
            var From = Range.From.shift() || 0;
            var To = Range.To.shift();
            if (To === undefined)
                To = this.Childs.length - 1;
            if (To >= this.Childs.length) {
                //				console.log('Invalid "To" on "GetHTML" call, element "' + this.XPID + '"');
                To = this.Childs.length - 1;
            }
            if (From < 0 || From >= this.Childs.length) {
                //				console.log('Invalid "From" on "GetHTML" call, element "' + this.XPID + '"');
                From = 0;
            }

            From *= 1;
            To *= 1;
            for (var I = From; I <= To; I++) {
                var KidRange = { From: [], To: [] };
                if (I == From) {
                    KidRange.From = Range.From;
                }
                if (I == To) {
                    KidRange.To = Range.To;
                }
                this.Childs[I].GetHTML(HyphOn, BookStyleNotes, KidRange, IDPrefix, ViewPortW, ViewPortH, PageData, Bookmarks.slice(0));
            }
            (this.IsFootnote ? PageData.FootNotes : PageData.Body).push(CloseTag);
        };

        FB3Tag.prototype.HTMLTagName = function () {
            if (this.Data.f) {
                return 'a';
            } else if (FB3DOM.TagMapper[this.TagName]) {
                return FB3DOM.TagMapper[this.TagName];
            } else if (this.TagName == 'title' && this.Data.xp) {
                var lvl = this.Data.xp.length - 1;
                return 'h' + (lvl < 6 ? lvl : 5);
            } else if (this.TagName == 'p' && this.Parent && this.Parent.TagName == 'title') {
                return 'div';
            } else {
                return this.TagName;
            }
        };

        FB3Tag.prototype.GetCloseTag = function (Range) {
            return '</' + this.HTMLTagName() + '>';
        };
        FB3Tag.prototype.GetInitTag = function (Range, BookStyleNotes, IDPrefix, ViewPortW, ViewPortH, MoreClasses) {
            var ElementClasses = new Array();
            if (Range.From[0] > 0) {
                ElementClasses.push('cut_top');
            }
            if (Range.To[0] < this.Childs.length - 1) {
                ElementClasses.push('cut_bot');
            }

            if (MoreClasses) {
                ElementClasses.push(MoreClasses);
            }

            if (this.IsFootnote) {
                ElementClasses.push('footnote');
            } else if (this.Data.f) {
                ElementClasses.push('footnote_attached');
                if (!BookStyleNotes) {
                    ElementClasses.push('footnote_clickable');
                }
            }

            if (FB3DOM.TagMapper[this.TagName]) {
                ElementClasses.push('tag_' + this.TagName);
            }
            if (this.Data.nc) {
                ElementClasses.push(this.Data.nc);
            }

            var Out;

            if (this.TagName == 'image') {
                var W = this.Data.w;
                var H = this.Data.h;
                var Path = this.ArtID2URL(this.Data.s);

                if (W > ViewPortW || H > ViewPortH) {
                    var Aspect = Math.min((ViewPortW - 1) / W, (ViewPortH - 1) / H);
                    W = Math.floor(W * Aspect);
                    H = Math.floor(H * Aspect);
                    ElementClasses.push('zoomedout');
                    Out = [
                        '<div style="position:absolute;" class="SmallImgZoom1"><div style="position:relative;left:0.5em;top:0.5em;" class="SmallImgZoom2"><a href="javascript:ZoomImg(\'' + Path + '\',' + this.Data.w + ',' + this.Data.h + ');return false;" class="ZoomAnchor">◄ Zoom ►</a></div></div><' + this.HTMLTagName()
                    ];
                } else {
                    Out = ['<' + this.HTMLTagName()];
                }

                Out.push(' width="' + W + '" height="' + H + '" src="' + Path + '" alt="-"');
            } else {
                Out = ['<' + this.HTMLTagName()];
            }

            if (ElementClasses.length) {
                Out.push(' class="' + ElementClasses.join(' ') + '"');
            }

            if (this.IsFootnote) {
                Out.push(' id="fn_' + IDPrefix + this.Parent.XPID + '">');
            } else if (this.Data.f && !BookStyleNotes) {
                Out.push(' onclick="alert(1)" href="#">');
            } else {
                Out.push(' id="n_' + IDPrefix + this.XPID + '">');
            }
            return Out;
        };
        return FB3Tag;
    })(FB3Text);
    FB3DOM.FB3Tag = FB3Tag;
})(FB3DOM || (FB3DOM = {}));
//# sourceMappingURL=FB3DOMBlock.js.map
