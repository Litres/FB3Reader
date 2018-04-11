var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var FB3DOM;
(function (FB3DOM) {
    FB3DOM.MaxFootnoteHeight = 0.5;
    FB3DOM.ExtLinkTarget = '_blank';
    FB3DOM.UNBREAKABLE_CSS_CLASS = 'fit_to_page';
    FB3DOM.EM_FONT_RATIO = 89 / 100;
    FB3DOM.EX_FONT_RATIO = 57 / 100;
    FB3DOM.PPI = 0.254;
    var TagMapper = {
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
        image: 'img',
        trialPurchase: 'div',
        note: 'a',
        br: 'hr',
        strikethrough: 'strike',
        underline: 'u',
        spacing: 'span'
    };
    FB3DOM.BlockLVLRegexp = /^(div|title|p|image|epigraph|poem|stanza|date|cite|v|t[dh]|subtitle|text-author|empty-line)$/;
    var TagSkipDoublePadding = {
        title: 1,
        subtitle: 1,
        epigraph: 1,
        poem: 1,
        annotation: 1,
        cite: 1
    };
    function TagClassFactory(Data, Parent, ID, NodeN, Chars, IsFootnote, DOM) {
        var Kid;
        if (typeof Data === "string") {
            if (Parent.Data.f) {
                Data = Data.replace(/[\[\]\{\}\(\)]+/g, '');
            }
            Kid = new FB3Text(DOM, Data, Parent, ID, NodeN, Chars, IsFootnote);
        }
        else if (Data.t == 'image' || Data.t == 'img') {
            Kid = new FB3ImgTag(DOM, Data, Parent, ID, IsFootnote);
        }
        else if (Data.t == 'trialPurchase') {
            Kid = new FB3PurchaseTag(DOM, Data, Parent, ID, IsFootnote);
        }
        else {
            Kid = new FB3Tag(DOM, Data, Parent, ID, IsFootnote);
        }
        return Kid;
    }
    FB3DOM.TagClassFactory = TagClassFactory;
    function XPathCompare(Pos1, Pos2) {
        if (Pos1.length && Pos1[Pos1.length - 1].match && Pos1[Pos1.length - 1].match(/\.\d/)) {
            Pos1 = Pos1.slice(0);
            Pos1[Pos1.length - 1] = Pos1[Pos1.length - 1].replace(/\./, '');
        }
        if (Pos2.length && Pos2[Pos2.length - 1].match && Pos2[Pos2.length - 1].match(/\.\d/)) {
            Pos2 = Pos2.slice(0);
            Pos2[Pos2.length - 1] = Pos2[Pos2.length - 1].replace(/\./, '');
        }
        return FB3Reader.PosCompare(Pos1, Pos2);
    }
    FB3DOM.XPathCompare = XPathCompare;
    var FB3Text = (function () {
        function FB3Text(DOM, text, Parent, ID, NodeN, Chars, IsFootnote) {
            this.DOM = DOM;
            this.text = text;
            this.Parent = Parent;
            this.ID = ID;
            this.IsFootnote = IsFootnote;
            this.Chars = this.text.replace(/\u00AD|&shy;/, '').length;
            this.text = this.EscapeHtml(this.text);
            this.XPID = (Parent && Parent.XPID != '' ? Parent.XPID + '_' : '') + this.ID;
            if (Parent && Parent.XPath) {
                this.XPath = Parent.XPath.slice(0);
                this.XPath.push(NodeN);
                this.XPath.push('.' + Chars);
            }
        }
        FB3Text.prototype.EscapeHtml = function (text) {
            var Map = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;'
            };
            function parseChar(txt) {
                return Map[txt];
            }
            return text.replace(/[&<>]/g, parseChar);
        };
        FB3Text.prototype.GetHTML = function (HyphOn, BookStyleNotes, Range, IDPrefix, ViewPortW, ViewPortH, PageData, Bookmarks) {
            var OutStr = this.text;
            if (Range.To[0]) {
                OutStr = OutStr.substr(0, Range.To[0]);
            }
            if (Range.From[0]) {
                OutStr = OutStr.substr(Range.From[0]);
            }
            var TargetStream = this.IsFootnote ? PageData.FootNotes : PageData.Body;
            var ClassNames = this.GetBookmarkClasses(Bookmarks);
            if (OutStr.match(/\u00AD/)) {
                var _class = 'skip_childs';
                if (ClassNames) {
                    ClassNames += ' ' + _class;
                }
                else {
                    ClassNames = _class;
                }
            }
            if (ClassNames) {
                ClassNames = ' class="' + ClassNames + '"';
            }
            if (!HyphOn && OutStr.match(/^\u00AD/)) {
                TargetStream[TargetStream.length - 1] = TargetStream[TargetStream.length - 1]
                    .replace('</span>', OutStr.replace(/\u00AD/, '') + '</span>');
            }
            else {
                if (OutStr.match(/\u00AD/)) {
                    OutStr = '<span></span>' + OutStr + '<span></span>';
                }
                TargetStream.push('<span id="n_' + IDPrefix + this.XPID + '"' + ClassNames + '>' + OutStr + '</span>');
            }
        };
        FB3Text.prototype.GetXML = function (Range, PageData) {
            var OutStr = this.text;
            if (Range.To[0]) {
                OutStr = OutStr.substr(0, Range.To[0]);
            }
            if (Range.From[0]) {
                OutStr = OutStr.substr(Range.From[0]);
            }
            OutStr.replace(/\u00AD/g, '');
            PageData.BodyXML.push(OutStr);
        };
        FB3Text.prototype.Position = function () {
            var Node = this;
            var Result = new Array();
            while (Node.Parent) {
                Result.unshift(Node.ID);
                Node = Node.Parent;
            }
            return Result;
        };
        FB3Text.prototype.ArtID2URL = function (Chunk) {
            return this.Parent.ArtID2URL(Chunk);
        };
        FB3Text.prototype.GetBookmarkClasses = function (Bookmarks) {
            if (!Bookmarks.length) {
                return '';
            }
            var ThisNodeSelections = new Array();
            var EffectiveXPath = this.XPath.slice(0);
            if (EffectiveXPath.length == 0) {
                return '';
            }
            for (var Bookmark = Bookmarks.length - 1; Bookmark >= 0; Bookmark--) {
                if (Bookmarks[Bookmark].Group == 0) {
                    continue;
                }
                var HowIsStart = XPathCompare(Bookmarks[Bookmark].XStart, EffectiveXPath);
                var HowisEnd = XPathCompare(Bookmarks[Bookmark].XEnd, EffectiveXPath);
                if (HowIsStart == 10 || HowisEnd == -10) {
                    Bookmarks.splice(Bookmark, 1);
                    continue;
                }
                if (HowIsStart == 1 || HowisEnd == 1 || HowisEnd == 0 && HowIsStart < 0 && !this.Childs) {
                    continue;
                }
                ThisNodeSelections.push(Bookmarks[Bookmark].ClassName());
                Bookmarks.splice(Bookmark, 1);
            }
            return ThisNodeSelections.join(' ');
        };
        FB3Text.prototype.IsBlock = function () {
            if (this.TagName && this.TagName.match(FB3DOM.BlockLVLRegexp)) {
                return true;
            }
            else {
                return false;
            }
        };
        return FB3Text;
    }());
    FB3DOM.FB3Text = FB3Text;
    var FB3Tag = (function (_super) {
        __extends(FB3Tag, _super);
        function FB3Tag(DOM, Data, Parent, ID, IsFootnote) {
            var _this = _super.call(this, DOM, '', Parent, ID, 1, 0, IsFootnote) || this;
            _this.DOM = DOM;
            _this.Data = Data;
            _this.IsUnbreakable = false;
            if (Data === null)
                return _this;
            _this.TagName = Data.t;
            if (Data.xp) {
                _this.XPath = _this.Data.xp;
            }
            else {
                _this.XPath = null;
            }
            _this.Childs = new Array();
            var Base = 0;
            if (Data.f) {
                Base++;
                var NKid = new FB3Tag(_this.DOM, Data.f, _this, Base, true);
                _this.Childs.push(NKid);
                _this.Chars += NKid.Chars;
            }
            if (Data.c) {
                var NodeN = 0;
                var PrevItmType = 'unknown';
                var Chars = 0;
                for (var I = 0; I < Data.c.length; I++) {
                    var Itm = Data.c[I];
                    var ItmType = (typeof Itm === "string") ? 'text' : 'tag';
                    if (ItmType != PrevItmType || ItmType != 'text') {
                        NodeN++;
                    }
                    PrevItmType = ItmType;
                    var Kid = TagClassFactory(Itm, _this, I + Base, NodeN, Chars, IsFootnote, _this.DOM);
                    if (ItmType == 'text') {
                        Chars += Kid.Chars;
                    }
                    else {
                        Chars = 0;
                    }
                    _this.Childs.push(Kid);
                    _this.Chars += Kid.Chars;
                }
            }
            if (Data.op) {
                _this.IsUnbreakable = true;
            }
            return _this;
        }
        FB3Tag.prototype.GetHTML = function (HyphOn, BookStyleNotes, Range, IDPrefix, ViewPortW, ViewPortH, PageData, Bookmarks) {
            if (Range.From[0] > this.Childs.length - 1) {
                Range.From = [this.Childs.length - 1];
            }
            var ClassNames = '';
            Range = FB3Reader.RangeClone(Range);
            if (Bookmarks.length) {
                ClassNames = this.GetBookmarkClasses(Bookmarks);
            }
            if (BookStyleNotes && this.IsFootnote) {
            }
            if (this.IsFootnote) {
                PageData.FootNotes = PageData.FootNotes.concat(this.GetInitTag(Range, BookStyleNotes, IDPrefix, ViewPortW, ViewPortH, ClassNames));
            }
            else {
                PageData.Body = PageData.Body.concat(this.GetInitTag(Range, BookStyleNotes, IDPrefix, ViewPortW, ViewPortH, ClassNames));
            }
            var CloseTag = this.GetCloseTag(Range);
            var From = Range.From.shift() || 0;
            var To = Range.To.shift();
            if (To === undefined)
                To = this.Childs.length - 1;
            if (To >= this.Childs.length) {
                To = this.Childs.length - 1;
            }
            if (From < 0 || From >= this.Childs.length) {
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
        FB3Tag.prototype.GetXML = function (Range, PageData) {
            if (this.TagName) {
                if (this.TagName == "footnote") {
                    return;
                }
                PageData.BodyXML.push('<' + this.TagName + '>');
                var CloseTag = '</' + this.TagName + '>';
            }
            var tRange = FB3Reader.RangeClone(Range);
            var From = tRange.From.shift() || 0;
            var To = tRange.To.shift();
            if (To === undefined)
                To = this.Childs.length - 1;
            if (To >= this.Childs.length) {
                To = this.Childs.length - 1;
            }
            if (From < 0 || From >= this.Childs.length) {
                From = 0;
            }
            From *= 1;
            To *= 1;
            for (var I = From; I <= To; I++) {
                var KidRange = { From: [], To: [] };
                if (I == From) {
                    KidRange.From = tRange.From;
                }
                if (I == To) {
                    KidRange.To = tRange.To;
                }
                this.Childs[I].GetXML(KidRange, PageData);
            }
            if (CloseTag) {
                PageData.BodyXML.push(CloseTag);
            }
        };
        FB3Tag.prototype.HTMLTagName = function () {
            if (this.Data.f) {
                return 'a';
            }
            else if (TagMapper[this.TagName]) {
                return TagMapper[this.TagName];
            }
            else if (this.TagName == 'title' && this.Data.xp) {
                var lvl = this.Data.xp.length - 1;
                return 'h' + (lvl < 6 ? lvl : 5);
            }
            else if (this.TagName == 'p' && this.Parent && this.Parent.TagName == 'title') {
                return 'div';
            }
            else {
                return this.TagName;
            }
        };
        FB3Tag.prototype.CheckPrevTagName = function () {
            if (this.ID > 0 && this.Parent.Childs[this.ID - 1] &&
                TagSkipDoublePadding[this.Parent.Childs[this.ID - 1].TagName]) {
                return true;
            }
            return false;
        };
        FB3Tag.prototype.GetCloseTag = function (Range) {
            return '</' + this.HTMLTagName() + '>';
        };
        FB3Tag.prototype.CutTop = function (Path) {
            for (var I = 0; I <= Path.length; I++) {
                if (Path[I])
                    return true;
            }
            return false;
        };
        FB3Tag.prototype.ElementClasses = function () {
            var ElementClasses = new Array();
            if (TagSkipDoublePadding[this.TagName] && this.CheckPrevTagName()) {
                ElementClasses.push('skip_double');
            }
            if (this.IsUnbreakable) {
                ElementClasses.push(FB3DOM.UNBREAKABLE_CSS_CLASS);
            }
            if (this.IsFootnote) {
                ElementClasses.push('footnote');
            }
            if (TagMapper[this.TagName] || this.TagName == 'title') {
                ElementClasses.push('tag_' + this.TagName);
            }
            if (this.Data.nc) {
                ElementClasses.push(this.Data.nc);
            }
            return ElementClasses;
        };
        FB3Tag.prototype.InlineStyle = function (ViewPortW, ViewportH) {
            var InlineStyle = '';
            if (!this.Parent.Parent) {
                var Margin = this.Parent.PagesPositionsCache.GetMargin(this.XPID);
                if (Margin) {
                    InlineStyle = 'margin-bottom: ' + Margin + 'px';
                }
            }
            if (InlineStyle) {
                InlineStyle = ' style="' + InlineStyle + '"';
            }
            return InlineStyle;
        };
        FB3Tag.prototype.GetInitTag = function (Range, BookStyleNotes, IDPrefix, ViewPortW, ViewPortH, MoreClasses) {
            var ElementClasses = this.ElementClasses();
            if (this.Data.f) {
                ElementClasses.push('footnote_attached');
                if (!BookStyleNotes) {
                    ElementClasses.push('footnote_clickable');
                }
            }
            if (MoreClasses) {
                ElementClasses.push(MoreClasses);
            }
            if (this.CutTop(Range.From)) {
                ElementClasses.push('cut_top');
            }
            if (Range.To[0] < this.Childs.length - 1) {
                ElementClasses.push('cut_bot');
            }
            var InlineStyle = this.InlineStyle();
            var Out = ['<'];
            if ((this.TagName == 'a' || this.TagName == 'note') && this.Data.hr) {
                Out.push('a href="about:blank" data-href="' + this.Data.hr + '"');
            }
            else if (this.TagName == 'a' && this.Data.href) {
                Out.push('a href="' + this.Data.href + '" target="' + FB3DOM.ExtLinkTarget + '"');
            }
            else {
                Out.push(this.HTMLTagName());
            }
            if (ElementClasses.length) {
                Out.push(' class="' + ElementClasses.join(' ') + '"');
            }
            Out.push(InlineStyle);
            if (this.IsFootnote) {
                Out.push(' id="fn_' + IDPrefix + this.Parent.XPID + '" style="max-height: ' + (ViewPortH * FB3DOM.MaxFootnoteHeight).toFixed(0) + 'px">');
            }
            else if (this.Data.f && !BookStyleNotes) {
                Out.push(' id="n_' + IDPrefix + this.XPID + '" onclick="alert(1)" href="#">');
            }
            else {
                Out.push(' id="n_' + IDPrefix + this.XPID + '">');
            }
            return Out;
        };
        return FB3Tag;
    }(FB3Text));
    FB3DOM.FB3Tag = FB3Tag;
    var FB3ImgTag = (function (_super) {
        __extends(FB3ImgTag, _super);
        function FB3ImgTag() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this.IsUnbreakable = true;
            return _this;
        }
        FB3ImgTag.prototype.GetInitTag = function (Range, BookStyleNotes, IDPrefix, ViewPortW, ViewPortH, MoreClasses) {
            var ElementClasses = this.ElementClasses();
            if (MoreClasses) {
                ElementClasses.push(MoreClasses);
            }
            ElementClasses.push('');
            var InlineStyle = this.InlineStyle(ViewPortW, ViewPortH);
            var Path = this.ArtID2URL(this.Data.s);
            var TagName = this.HTMLTagName();
            var Out = ['<' + TagName + ' id="ii_' + IDPrefix + this.XPID + '"' + InlineStyle];
            var Rectangle = this.GetRectangleWithinBounds(this.Data.w, this.Data.h, this.Data.minw, this.Data.maxw, ViewPortW, ViewPortH);
            if (ElementClasses.length) {
                Out.push(' class="' + ElementClasses.join(' ') + '"');
            }
            if (TagName != "span") {
                Out.push('><img width = "' + Rectangle.Width + '" height = "' + Rectangle.Height + '" src = "' + Path + '" alt = "-"');
                Out.push(' id="n_' + IDPrefix + this.XPID + '"/>');
            }
            else {
                Out.push("</span>");
            }
            return Out;
        };
        FB3ImgTag.prototype.HTMLTagName = function () {
            return this.Data.op ? 'div' : 'span';
        };
        FB3ImgTag.prototype.InlineStyle = function (ViewPortW, ViewPortH) {
            var display = "";
            var backgroundImage = "";
            if (this.HTMLTagName() == "span") {
                display = "display: inline-block;";
                backgroundImage = "background: url(" + this.ArtID2URL(this.Data.s) + ") no-repeat right center;background-size: contain;";
            }
            var Rectangle = this.GetRectangleWithinBounds(this.Data.w, this.Data.h, this.Data.minw, this.Data.maxw, ViewPortW, ViewPortH);
            var InlineStyle = 'width:' + Rectangle.Width + 'px;height:' + Rectangle.Height + 'px;' + display + backgroundImage;
            if (!this.Parent.Parent) {
                var Margin = this.Parent.PagesPositionsCache.GetMargin(this.XPID);
                if (Margin) {
                    InlineStyle += 'margin-bottom: ' + Margin + 'px';
                }
            }
            return ' style="' + InlineStyle + '"';
        };
        FB3ImgTag.prototype.GetRectangleWithinBounds = function (Width, Height, MinWidth, MaxWidth, ViewPortW, ViewPortH, preserveAspectRatio) {
            if (preserveAspectRatio === void 0) { preserveAspectRatio = true; }
            var NewWidth = this.GetValueWithinMinMax(Width, MinWidth, MaxWidth, ViewPortW);
            return {
                Width: NewWidth,
                Height: this.GetValueWithinMinMax(preserveAspectRatio ? NewWidth * Height / Width : Height)
            };
        };
        FB3ImgTag.prototype.GetValueWithinMinMax = function (value, min, max, v) {
            var parsedMin = parseFloat(this.GetValueFromUnits(min || 0, v || value).toFixed(3));
            var parsedMax = parseFloat(this.GetValueFromUnits(max || value, v || value).toFixed(3));
            if (value > parsedMax) {
                return parsedMax;
            }
            if (value < parsedMin) {
                return parsedMin;
            }
            return parseFloat(value.toFixed(3));
        };
        FB3ImgTag.prototype.GetValueFromUnits = function (value, viewport) {
            var string = value.toString();
            if (string.match(/\d+em/)) {
                return this.GetValueFromEm(value);
            }
            if (string.match(/\d+ex/)) {
                return this.GetValueFromEx(value);
            }
            if (string.match(/\d+mm/)) {
                return this.GetValueFromMm(value);
            }
            if (string.match(/\d+%/)) {
                return this.GetValueFromPercent(value, viewport);
            }
            return parseFloat(string);
        };
        FB3ImgTag.prototype.GetValueFromEm = function (value) {
            return parseFloat(value) * FB3DOM.EM_FONT_RATIO * this.DOM.Site.FontSize;
        };
        FB3ImgTag.prototype.GetValueFromEx = function (value) {
            return parseFloat(value) * FB3DOM.EX_FONT_RATIO * this.DOM.Site.FontSize;
        };
        FB3ImgTag.prototype.GetValueFromMm = function (value) {
            return parseFloat(value) / FB3DOM.PPI;
        };
        FB3ImgTag.prototype.GetValueFromPercent = function (value, viewport) {
            return parseFloat(value) * viewport / 100;
        };
        return FB3ImgTag;
    }(FB3Tag));
    FB3DOM.FB3ImgTag = FB3ImgTag;
    var FB3PurchaseTag = (function (_super) {
        __extends(FB3PurchaseTag, _super);
        function FB3PurchaseTag() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this.IsUnbreakable = true;
            return _this;
        }
        FB3PurchaseTag.prototype.GetInitTag = function (Range, BookStyleNotes, IDPrefix, ViewPortW, ViewPortH, MoreClasses) {
            var Out = ['<div class="' + FB3DOM.UNBREAKABLE_CSS_CLASS + '" id ="n_' + IDPrefix + this.XPID + '">'];
            Out.push(this.DOM.Site.showTrialEnd('n_' + IDPrefix + this.XPID));
            return Out;
        };
        return FB3PurchaseTag;
    }(FB3Tag));
    FB3DOM.FB3PurchaseTag = FB3PurchaseTag;
})(FB3DOM || (FB3DOM = {}));
//# sourceMappingURL=FB3DOMBlock.js.map