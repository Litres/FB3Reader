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
    function GetParent(tagName, Parent) {
        if (!Parent || !Parent.Data) {
            return null;
        }
        if (Parent.Data.t === tagName) {
            return Parent;
        }
        return GetParent(tagName, Parent.Parent);
    }
    function IsNote(Data) {
        return (Data.t == 'a' || Data.t == 'note') && Data.hr;
    }
    function IsFootnoteLink(Data) {
        return (Data.t == 'a' || Data.t == 'note') && Data.f;
    }
    function IsLink(Data) {
        return Data.t == 'a' && Data.href;
    }
    function TagClassFactory(Data, Parent, ID, NodeN, Chars, IsFootnote, IsLinkChild, DOM) {
        var Kid;
        if (typeof Data === "string") {
            if (Parent.Data.f) {
                Data = Data.replace(/[\[\]\{\}\(\)]+/g, '');
            }
            Kid = new FB3Text(DOM, Data, Parent, ID, NodeN, Chars, IsFootnote, IsLinkChild);
        }
        else if (Data.t == 'image' || Data.t == 'img') {
            Kid = new FB3ImgTag(DOM, Data, Parent, ID, IsFootnote, IsLinkChild);
        }
        else if (Data.t == 'trialPurchase') {
            Kid = new FB3PurchaseTag(DOM, Data, Parent, ID, IsFootnote, IsLinkChild);
        }
        else if (IsNote(Data)) {
            Kid = new FB3NoteTag(DOM, Data, Parent, ID, IsFootnote, IsLinkChild);
        }
        else if (IsFootnoteLink(Data)) {
            Kid = new FB3FootnoteLinkTag(DOM, Data, Parent, ID, IsFootnote, IsLinkChild);
        }
        else if (IsLink(Data)) {
            Kid = new FB3LinkTag(DOM, Data, Parent, ID, IsFootnote, IsLinkChild);
        }
        else {
            Kid = new FB3Tag(DOM, Data, Parent, ID, IsFootnote, IsLinkChild);
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
    var Restriction = (function () {
        function Restriction(Lang) {
            if (Lang === void 0) { Lang = 'en'; }
            this.Enumeration = {
                '1': {
                    counters: [0],
                    incrementor: function (context) {
                        return context.Enumeration['1'].counters[0] = context.Enumeration['1'].counters[0] + 1;
                    },
                    getter: function (context) {
                        return context.Enumeration['1'].counters[0];
                    }
                },
                'i': {
                    counters: [0],
                    incrementor: function (context) {
                        return context.Enumeration['i'].counters[0] = context.Enumeration['i'].counters[0] + 1;
                    },
                    getter: function (context) {
                        return Restriction.ToRoman(context.Enumeration['i'].counters[0]);
                    }
                },
                '*': {
                    counters: [0],
                    incrementor: function (context) {
                        var Enumeration = context.Enumeration['*'].counters;
                        if (Enumeration.length < 3 && Enumeration[Enumeration.length - 1] >= 4) {
                            Enumeration[Enumeration.length] = 0;
                        }
                        return Enumeration[Enumeration.length - 1] = Enumeration[Enumeration.length - 1] + 1;
                    },
                    getter: function (context) {
                        var Enumeration = context.Enumeration['*'].counters, result = '';
                        if (Enumeration.length === 1) {
                            result += Restriction.Repeat('*', Enumeration[0]);
                        }
                        if (Enumeration.length === 2) {
                            result += Restriction.Repeat('\'', Enumeration[1]);
                        }
                        if (Enumeration.length === 3) {
                            result += '' + Enumeration[2] + '<sup>*</sup>';
                        }
                        return result;
                    }
                },
                'a': {
                    counters: [0],
                    incrementor: function (context) {
                        var Enumeration = context.Enumeration['a'].counters;
                        if (Enumeration[Enumeration.length - 1] >= context.Alphabet[context.Lang].len) {
                            Enumeration[Enumeration.length] = 0;
                        }
                        return Enumeration[Enumeration.length - 1] = Enumeration[Enumeration.length - 1] + 1;
                    },
                    getter: function (context) {
                        var Enumeration = context.Enumeration['a'].counters, alphabet = context.Alphabet[context.Lang], result = '';
                        for (var i = 0; i < Enumeration.length; i++) {
                            result += String.fromCharCode(alphabet.start - 1 + Enumeration[i]);
                        }
                        return result;
                    }
                }
            };
            this.Alphabet = {
                en: {
                    start: 97,
                    len: 26
                },
                ru: {
                    start: 1072,
                    len: 32
                }
            };
            this.Lang = 'en';
            this.Lang = Lang;
        }
        Restriction.ToRoman = function (num) {
            var result = '';
            var decimal = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
            var roman = ["M", "CM", "D", "CD", "C", "XC", "L", "XL", "X", "IX", "V", "IV", "I"];
            for (var i = 0; i <= decimal.length; i++) {
                while (num % decimal[i] < num) {
                    result += roman[i];
                    num -= decimal[i];
                }
            }
            return result;
        };
        Restriction.Repeat = function (symbol, n) {
            var result = '';
            for (var i = 0; i < n; i++) {
                result += symbol;
            }
            return result;
        };
        Restriction.prototype.Increment = function (att) {
            if (att === void 0) { att = '1'; }
            return this.Enumeration[att].incrementor(this).toString();
        };
        Restriction.prototype.Get = function (att) {
            if (att === void 0) { att = '1'; }
            return this.Enumeration[att].getter(this).toString();
        };
        return Restriction;
    }());
    ;
    window.Restriction = Restriction;
    var PageContainer = (function () {
        function PageContainer() {
            this.Body = new Array();
            this.FootNotes = new Array();
            this.BodyXML = new Array();
            this.ActiveZones = new Array();
            this.ContentLength = 0;
            this.Restriction = new Restriction();
        }
        return PageContainer;
    }());
    FB3DOM.PageContainer = PageContainer;
    var FB3Text = (function () {
        function FB3Text(DOM, text, Parent, ID, NodeN, Chars, IsFootnote, IsLinkChild) {
            this.DOM = DOM;
            this.text = text;
            this.Parent = Parent;
            this.ID = ID;
            this.IsFootnote = IsFootnote;
            this.IsLinkChild = IsLinkChild;
            this.HasFootnote = false;
            this.IsActiveZone = false;
            this.ElementID = '';
            this.IsLink = false;
            this.Cursor = 'selection';
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
            var title, footnote;
            if (this.Parent.Data.f && this.Parent.Data.att !== 'keep') {
                OutStr = PageData.Restriction.Get(this.Parent.Data.att);
            }
            if (this.IsFootnote && (title = GetParent('title', this.Parent)) && (footnote = title.Parent) && footnote.Parent && footnote.Parent.Data.att !== 'keep') {
                OutStr = PageData.Restriction.Get(footnote.Parent.Data.att);
            }
            if (Range.To[0]) {
                OutStr = OutStr.substr(0, Range.To[0]);
            }
            if (Range.From[0]) {
                OutStr = OutStr.substr(Range.From[0]);
            }
            PageData.ContentLength += OutStr.length;
            var hyphs = OutStr.match(/\u00AD/g);
            if (hyphs) {
                PageData.ContentLength -= hyphs.length;
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
                this.ElementID = 'n_' + IDPrefix + this.XPID;
                TargetStream.push('<span id="' + this.ElementID + '"' + ClassNames + '>' + OutStr + '</span>');
            }
            if (this.IsLinkChild) {
                PageData.ActiveZones.push({
                    fb3tag: this,
                    id: this.ElementID,
                    xpid: this.XPID,
                    cursor: this.Cursor
                });
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
        FB3Text.prototype.Fire = function () {
            if (this.IsLinkChild) {
                this.Parent.Fire();
            }
        };
        FB3Text.prototype.InlineStyle = function (ViewPortW, ViewportH) {
            return "";
        };
        FB3Text.prototype.PaddingBottom = function () {
            return 0;
        };
        return FB3Text;
    }());
    FB3DOM.FB3Text = FB3Text;
    var FB3Tag = (function (_super) {
        __extends(FB3Tag, _super);
        function FB3Tag(DOM, Data, Parent, ID, IsFootnote, IsLinkChild) {
            var _this = _super.call(this, DOM, '', Parent, ID, 1, 0, IsFootnote, IsLinkChild) || this;
            _this.DOM = DOM;
            _this.Data = Data;
            _this.IsFloatable = false;
            if (Data === null)
                return _this;
            _this.TagName = Data.t;
            if (Data.xp) {
                _this.XPath = _this.Data.xp;
            }
            else {
                _this.XPath = null;
            }
            if (Data.t === 'a' || Data.t === 'note') {
                _this.IsLink = true;
            }
            _this.Childs = new Array();
            var Base = 0;
            if (Data.f) {
                Base++;
                var NKid = new FB3FootnoteTag(_this.DOM, Data.f, _this, Base);
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
                    var Kid = TagClassFactory(Itm, _this, I + Base, NodeN, Chars, IsFootnote, _this.IsLink || _this.IsLinkChild, _this.DOM);
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
            if (Data.fl) {
                _this.IsFloatable = true;
            }
            _this.IsUnbreakable = Boolean(Data.op);
            return _this;
        }
        FB3Tag.prototype.GetHTML = function (HyphOn, BookStyleNotes, Range, IDPrefix, ViewPortW, ViewPortH, PageData, Bookmarks) {
            if (Range.From[0] > this.Childs.length - 1) {
                Range.From = [this.Childs.length - 1];
            }
            if (this.Data && this.Data.f && this.Data.att !== 'keep') {
                PageData.Restriction.Increment(this.Data.att);
            }
            var ClassNames = '';
            Range = FB3Reader.RangeClone(Range);
            if (Bookmarks.length) {
                ClassNames = this.GetBookmarkClasses(Bookmarks);
            }
            if (BookStyleNotes && this.IsFootnote) {
            }
            var InitTag = this.GetInitTag(Range, BookStyleNotes, IDPrefix, ViewPortW, ViewPortH, ClassNames);
            var PaddingBottom = this.PaddingBottom();
            if (PaddingBottom !== 0) {
                var classAttribute = "padding_wrapper";
                if (this.IsUnbreakable) {
                    classAttribute += " " + FB3DOM.UNBREAKABLE_CSS_CLASS;
                }
                if (this.Data.fl) {
                    classAttribute += " tag_float tag_float_" + this.Data.fl;
                }
                classAttribute = classAttribute ? " class=\"" + classAttribute + "\"" : "";
                InitTag.unshift("<div style=\"padding-bottom: " + PaddingBottom + "px; " + (this.Data.fl ? ('float: ' + this.Data.fl + ';') : '') + "\" id=\"nn" + this.ElementID + "\" " + classAttribute + ">");
            }
            if (this.IsFootnote) {
                PageData.FootNotes = PageData.FootNotes.concat(InitTag);
            }
            else {
                PageData.Body = PageData.Body.concat(InitTag);
            }
            var CloseTag = this.GetCloseTag(Range);
            if (PaddingBottom !== 0) {
                CloseTag += '</div>';
            }
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
            if (this.Data.fl) {
                ElementClasses.push('tag_float');
                ElementClasses.push('tag_float_' + this.Data.fl);
            }
            if (this.Data.brd) {
                ElementClasses.push('tag_border');
            }
            if (this.Data.t === 'image' || this.Data.t === TagMapper['image']) {
                ElementClasses.push('tag_img');
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
            if (this.Data.fl) {
                InlineStyle += 'float: ' + this.Data.fl + ';';
            }
            if (InlineStyle) {
                InlineStyle = ' style="' + InlineStyle + '"';
            }
            return InlineStyle;
        };
        FB3Tag.prototype.PaddingBottom = function () {
            if (this.Parent && !this.Parent.Parent) {
                return this.Parent.PagesPositionsCache.GetMargin(this.XPID) || 0;
            }
            return 0;
        };
        FB3Tag.prototype.GetInitTag = function (Range, BookStyleNotes, IDPrefix, ViewPortW, ViewPortH, MoreClasses) {
            var ElementClasses = this.ElementClasses();
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
            if (this.TagName == 'a' && this.Data.href) {
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
                this.ElementID = 'fn_' + IDPrefix + this.Parent.XPID;
                Out.push(' id="' + this.ElementID + '"' + (ViewPortH > 0 ? ' style="max-height: ' + (ViewPortH * FB3DOM.MaxFootnoteHeight).toFixed(0) + 'px"' : '') + '>');
            }
            else if (this.Data.f && !BookStyleNotes) {
                this.ElementID = 'n_' + IDPrefix + this.XPID;
                Out.push(' id="' + this.ElementID + '" onclick="alert(1)" href="#">');
            }
            else {
                this.ElementID = 'n_' + IDPrefix + this.XPID;
                Out.push(' id="' + this.ElementID + '">');
            }
            return Out;
        };
        FB3Tag.prototype.Fire = function () {
            var PageContainer = new FB3DOM.PageContainer();
            if (this.IsUnbreakable) {
                this.GetHTML(true, false, { From: [], To: [] }, '', 0, 0, PageContainer, []);
                this.DOM.Site.ZoomHTML(PageContainer.Body.join(''));
            }
            _super.prototype.Fire.call(this);
        };
        return FB3Tag;
    }(FB3Text));
    FB3DOM.FB3Tag = FB3Tag;
    var FB3ImgTag = (function (_super) {
        __extends(FB3ImgTag, _super);
        function FB3ImgTag() {
            return _super !== null && _super.apply(this, arguments) || this;
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
            this.ElementID = 'ii_' + IDPrefix + this.XPID;
            var Out = ['<' + TagName + ' id="' + this.ElementID + '"' + InlineStyle];
            if (this.DOM.MediaCacheLoader) {
                var ElementID = void 0, InsertionRules = void 0;
                if (TagName != "span") {
                    ElementID = 'n_' + IDPrefix + this.XPID;
                    InsertionRules = 'src';
                }
                else {
                    ElementID = this.ElementID;
                    InsertionRules = 'style.background.url';
                }
                this.DOM.MediaCacheLoader.LoadImageAsync(ElementID, Path, InsertionRules);
            }
            var Rectangle = this.GetRectangleWithinBounds(this.Data.w, this.Data.h, this.Data.minw, this.Data.maxw, ViewPortW, ViewPortH);
            if (ElementClasses.length) {
                Out.push(' class="' + ElementClasses.join(' ') + '"');
            }
            if (TagName != "span") {
                if (this.DOM.MediaCacheLoader) {
                    Out.push('><img width = "' + Rectangle.Width + '" height = "' + Rectangle.Height + '" alt = "-"');
                }
                else {
                    Out.push('><img width = "' + Rectangle.Width + '" height = "' + Rectangle.Height + '" src = "' + Path + '" alt = "-"');
                }
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
                display = "display: block;";
                if (!this.DOM.MediaCacheLoader) {
                    backgroundImage = "background: url(" + this.ArtID2URL(this.Data.s) + ") no-repeat right center; background-size: contain;";
                }
            }
            var Rectangle = this.GetRectangleWithinBounds(this.Data.w, this.Data.h, this.Data.minw, this.Data.maxw, ViewPortW, ViewPortH);
            var float = '';
            if (this.Data.fl) {
                float = 'float: ' + this.Data.fl + ';';
            }
            var InlineStyle = 'width:' + Rectangle.Width + 'px;height:' + Rectangle.Height + 'px;' + display + backgroundImage + float;
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
            return _super !== null && _super.apply(this, arguments) || this;
        }
        FB3PurchaseTag.prototype.GetInitTag = function (Range, BookStyleNotes, IDPrefix, ViewPortW, ViewPortH, MoreClasses) {
            var Out = ['<div class="' + FB3DOM.UNBREAKABLE_CSS_CLASS + '" id ="n_' + IDPrefix + this.XPID + '">'];
            Out.push(this.DOM.Site.showTrialEnd('n_' + IDPrefix + this.XPID));
            return Out;
        };
        return FB3PurchaseTag;
    }(FB3Tag));
    FB3DOM.FB3PurchaseTag = FB3PurchaseTag;
    var FB3FootnoteTag = (function (_super) {
        __extends(FB3FootnoteTag, _super);
        function FB3FootnoteTag(DOM, Data, Parent, ID) {
            var _this = _super.call(this, DOM, Data, Parent, ID, true) || this;
            _this.DOM = DOM;
            _this.Data = Data;
            _this.IsFootnote = true;
            Parent.Footnote = _this;
            Parent.HasFootnote = true;
            return _this;
        }
        return FB3FootnoteTag;
    }(FB3Tag));
    FB3DOM.FB3FootnoteTag = FB3FootnoteTag;
    var FB3NoteTag = (function (_super) {
        __extends(FB3NoteTag, _super);
        function FB3NoteTag() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this.IsActiveZone = true;
            return _this;
        }
        FB3NoteTag.prototype.GetInitTag = function (Range, BookStyleNotes, IDPrefix, ViewPortW, ViewPortH, MoreClasses) {
            var ElementClasses = this.ElementClasses();
            if (MoreClasses) {
                ElementClasses.push(MoreClasses);
            }
            var InlineStyle = this.InlineStyle();
            var Out = ['<'];
            Out.push('a href="about:blank" data-href="' + this.Data.hr + '"');
            if (ElementClasses.length) {
                Out.push(' class="' + ElementClasses.join(' ') + '"');
            }
            Out.push(InlineStyle);
            this.ElementID = 'n_' + IDPrefix + this.XPID;
            Out.push(' id="' + this.ElementID + '">');
            return Out;
        };
        FB3NoteTag.prototype.Fire = function () {
            this.DOM.Site.GoToNote(this.Data.hr.join(''));
        };
        return FB3NoteTag;
    }(FB3Tag));
    FB3DOM.FB3NoteTag = FB3NoteTag;
    var FB3FootnoteLinkTag = (function (_super) {
        __extends(FB3FootnoteLinkTag, _super);
        function FB3FootnoteLinkTag() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this.IsActiveZone = true;
            _this.HasFootnote = true;
            return _this;
        }
        FB3FootnoteLinkTag.prototype.GetInitTag = function (Range, BookStyleNotes, IDPrefix, ViewPortW, ViewPortH, MoreClasses) {
            var ElementClasses = this.ElementClasses();
            ElementClasses.push('footnote_attached');
            if (!BookStyleNotes) {
                ElementClasses.push('footnote_clickable');
            }
            if (MoreClasses) {
                ElementClasses.push(MoreClasses);
            }
            var InlineStyle = this.InlineStyle();
            var Out = ['<a'];
            if (ElementClasses.length) {
                Out.push(' class="' + ElementClasses.join(' ') + '"');
            }
            Out.push(InlineStyle);
            if (this.Data.f && !BookStyleNotes) {
                this.ElementID = 'n_' + IDPrefix + this.XPID;
                Out.push(' id="' + this.ElementID + '" onclick="alert(1)" href="#">');
            }
            else {
                this.ElementID = 'n_' + IDPrefix + this.XPID;
                Out.push(' id="' + this.ElementID + '">');
            }
            return Out;
        };
        FB3FootnoteLinkTag.prototype.Fire = function () {
            var PageContainer = new FB3DOM.PageContainer();
            this.Footnote.GetHTML(true, false, { From: [], To: [] }, '', 0, 0, PageContainer, []);
            this.DOM.Site.ZoomHTML(PageContainer.FootNotes.join(''));
        };
        return FB3FootnoteLinkTag;
    }(FB3Tag));
    FB3DOM.FB3FootnoteLinkTag = FB3FootnoteLinkTag;
    var FB3LinkTag = (function (_super) {
        __extends(FB3LinkTag, _super);
        function FB3LinkTag() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this.IsActiveZone = true;
            _this.IsLink = true;
            return _this;
        }
        FB3LinkTag.prototype.GetInitTag = function (Range, BookStyleNotes, IDPrefix, ViewPortW, ViewPortH, MoreClasses) {
            var ElementClasses = this.ElementClasses();
            if (MoreClasses) {
                ElementClasses.push(MoreClasses);
            }
            var InlineStyle = this.InlineStyle();
            var Out = ['<a href="' + this.Data.href + '" target="' + FB3DOM.ExtLinkTarget + '"'];
            if (ElementClasses.length) {
                Out.push(' class="' + ElementClasses.join(' ') + '"');
            }
            Out.push(InlineStyle);
            this.ElementID = 'n_' + IDPrefix + this.XPID;
            Out.push(' id="' + this.ElementID + '">');
            return Out;
        };
        FB3LinkTag.prototype.Fire = function () {
            this.DOM.Site.GoToExternalLink(this.Data.href);
        };
        return FB3LinkTag;
    }(FB3Tag));
    FB3DOM.FB3LinkTag = FB3LinkTag;
})(FB3DOM || (FB3DOM = {}));
//# sourceMappingURL=FB3DOMBlock.js.map