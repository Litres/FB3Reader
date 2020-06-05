import {
	IActiveZone,
	IFB3Block,
	IFB3BlockRectangle,
	IFB3DOM, IJSONBlock,
	InnerHTML,
	IPageContainer,
	IRange,
	IRestriction
} from "./FB3DOM.head";
import {FB3Reader} from "../Reader/FB3Reader";
import {IBookmark} from "../Bookmarks/FB3Bookmarks.head";
import {IPosition} from "../FB3ReaderHeaders";
import {FB3MediaCache} from "../MediaCache/MediaCache";

export module FB3DOMBlock {
	export var MaxFootnoteHeight: number = 0.5;
	export var ExtLinkTarget = '_blank'; // may be set to '_top'
	export const UNBREAKABLE_CSS_CLASS = 'fit_to_page'; // class for targeting unbreakable content
	// Metrics for Arial font. 89 - width of "m", 100 - font size
	export const EM_FONT_RATIO = 89 / 100;
	// Metrics for Arial font. 57 - width of "x", 100 - font size
	export const EX_FONT_RATIO = 57 / 100;
	// Suppose 100px = 1 inch (25.4 mm) => 1px = 0.254 mm
	export const PPI = 0.254;
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
		'empty-line': 'div',
		emphasis: 'em',
		style: 'span',
		footnote: 'div',
		nobr: 'span',
		image: 'img',
		trialPurchase: 'div',

		// [94948] Add new tags
		note: 'a',
		br: 'div',
		strikethrough: 'strike',
		underline: 'u',
		spacing: 'span'
	};

	export var BlockLVLRegexp = /^(div|title|p|image|epigraph|poem|stanza|date|cite|v|t[dh]|subtitle|text-author|empty-line)$/;
	var TagSkipDoublePadding = {
		title: 1,
		subtitle: 1,
		epigraph: 1,
		poem: 1,
		annotation: 1,
		cite: 1
	};

	function GetParent(tagName: string, Parent: IFB3Block) {
		if (!Parent || !Parent.Data) {
			return null;
		}

		if (Parent.Data.t === tagName) {
			return Parent;
		}
		return GetParent(tagName, Parent.Parent);
	}

	function IsNote(Data: IJSONBlock) {
		return (Data.t == 'a' || Data.t == 'note') && Data.hr;
	}

	function IsFootnoteLink(Data: IJSONBlock) {
		return (Data.t == 'a' || Data.t == 'note') && Data.f;
	}

	function IsLink(Data: IJSONBlock) {
		return Data.t == 'a' && Data.href;
	}

	export function TagClassFactory(Data: IJSONBlock, Parent: IFB3Block,
									ID: number, NodeN: number, Chars: number, IsFootnote: boolean, IsLinkChild: boolean, DOM: IFB3DOM): IFB3Block {
		var Kid: IFB3Block;
		if (typeof Data === "string") {
			if (Parent.Data.f) {
				Data = (<any> Data).replace(/[\[\]\{\}\(\)]+/g, '');
			}
			Kid = new FB3Text(DOM, (<any> Data), Parent, ID, NodeN, Chars, IsFootnote, IsLinkChild);
			// [94948] Add "img" tag
		} else if (Data.t == 'image' || Data.t == 'img') {
			Kid = new FB3ImgTag(DOM, Data, Parent, ID, IsFootnote, IsLinkChild);
		} else if (Data.t == 'trialPurchase') {
			Kid = new FB3PurchaseTag(DOM, Data, Parent, ID, IsFootnote, IsLinkChild);
		} else if (IsNote(Data)) {
			Kid = new FB3NoteTag(DOM, Data, Parent, ID, IsFootnote, IsLinkChild);
		} else if (IsFootnoteLink(Data)) {
			Kid = new FB3FootnoteLinkTag(DOM, Data, Parent, ID, IsFootnote, IsLinkChild);
		} else if (IsLink(Data)) {
			Kid = new FB3LinkTag(DOM, Data, Parent, ID, IsFootnote, IsLinkChild);
		} else {
			Kid = new FB3Tag(DOM, Data, Parent, ID, IsFootnote, IsLinkChild);
		}
		return Kid;
	}

	export function XPathCompare(Pos1: any[], Pos2: any[]): number {
		// todo - this function is a hack around xpath ".05' endings, whould be done some better way
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

	class Restriction implements IRestriction {
		private Enumeration: object = {
			'1': {
				counters: [0],
				incrementor: (context) => {
					return context.Enumeration['1'].counters[0] = context.Enumeration['1'].counters[0] + 1;
				},
				getter: (context) => {
					return context.Enumeration['1'].counters[0];
				}
			},
			'i': {
				counters: [0],
				incrementor: (context) => {
					return context.Enumeration['i'].counters[0] = context.Enumeration['i'].counters[0] + 1;
				},
				getter: (context) => {
					return Restriction.ToRoman(context.Enumeration['i'].counters[0]);
				}
			},
			'*': {
				counters: [0],
				incrementor: (context) => {
					var Enumeration = context.Enumeration['*'].counters;

					if (Enumeration.length < 3 && Enumeration[Enumeration.length - 1] >= 4) {
						Enumeration[Enumeration.length] = 0;
					}

					return Enumeration[Enumeration.length - 1] = Enumeration[Enumeration.length - 1] + 1;

				},
				getter: (context) => {
					var Enumeration = context.Enumeration['*'].counters,
						result = '';

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
				incrementor: (context) => {
					var Enumeration = context.Enumeration['a'].counters;

					if (Enumeration[Enumeration.length - 1] >= context.Alphabet[context.Lang].len) {
						Enumeration[Enumeration.length] = 0;
					}

					return Enumeration[Enumeration.length - 1] = Enumeration[Enumeration.length - 1] + 1;
				},
				getter: (context) => {
					var Enumeration = context.Enumeration['a'].counters,
						alphabet = context.Alphabet[context.Lang],
						result = '';

					for (var i = 0; i < Enumeration.length; i++) {
						result += String.fromCharCode(alphabet.start - 1 + Enumeration[i]);
					}

					return result;
				}
			}
		}

		private Alphabet: object = {
			en: {
				start: 97,
				len: 26
			},
			ru: {
				start: 1072,
				len: 32
			}
		}

		private Lang: string =  'en'

		// https://www.selftaughtjs.com/algorithm-sundays-converting-roman-numerals/
		static ToRoman(num) {
			var result = '';
			var decimal = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
			var roman = ["M", "CM","D","CD","C", "XC", "L", "XL", "X","IX","V","IV","I"];

			for (var i = 0; i <= decimal.length; i++) {
				while (num % decimal[i] < num) {
					result += roman[i];
					num -= decimal[i];
				}
			}

			return result;
		}

		static Repeat(symbol, n) {
			var result = '';

			for (var i = 0; i < n; i++) {
				result += symbol;
			}

			return result;
		}

		public Increment(att = '1') {
			return this.Enumeration[att].incrementor(this).toString();
		}

		public Get(att = '1') {
			return this.Enumeration[att].getter(this).toString();
		}

		constructor(Lang: string = 'en') {
			this.Lang = Lang;
		}
	};

	// debug
	//(<any>window).Restriction = Restriction;

	export class PageContainer implements IPageContainer {
		public Body: InnerHTML[];
		public FootNotes: InnerHTML[];
		public BodyXML: string[];
		public ActiveZones: IActiveZone[];
		public ContentLength: number;
		public Restriction: IRestriction;
		constructor () {
			this.Body = new Array();
			this.FootNotes = new Array();
			this.BodyXML = new Array();
			this.ActiveZones = new Array();
			this.ContentLength = 0;
			this.Restriction = new Restriction();
		}
	}

	// Each DOM-node holds xpath-adress of self as an array
	// Last item in array is ALWAYS char pos. When converting to string such a zerro is ommited

	export class FB3Text implements IFB3Block {
		public Chars: number;
		public XPID: string;
		public Data: IJSONBlock;
		public Childs: IFB3Block[];
		public XPath: any[];
		public TagName: string;
		public HasFootnote: boolean = false;
		public Footnote: IFB3Block;
		public IsActiveZone: boolean = false;
		public ElementID: string = '';
		public IsLink: boolean = false;
		public Cursor: string = 'selection';

		constructor(public DOM: IFB3DOM,
					public text: string,
					public Parent: IFB3Block,
					public ID: number,
					NodeN: number,
					Chars: number,
					public IsFootnote: boolean,
					public IsLinkChild?: boolean) {
			this.Chars = this.text.replace(/\u00AD|&shy;/, '').length;
			this.text = this.EscapeHtml(this.text);
			//			this.text = this.text.replace(/\u00AD|&shy;/, '')
			this.XPID = (Parent && Parent.XPID != '' ? Parent.XPID + '_' : '') + this.ID;
			if (Parent && Parent.XPath) {
				this.XPath = Parent.XPath.slice(0);
				this.XPath.push(NodeN);
				this.XPath.push('.' + Chars);
			}
		}
		public EscapeHtml(text: string):string {
			var Map: any = {
				'&': '&amp;',
				'<': '&lt;',
				'>': '&gt;'
			};
			function parseChar(txt:string):string {
				return Map[txt]
			}

			return text.replace(/[&<>]/g,parseChar);
		}
		public GetHTML(HyphOn: boolean, BookStyleNotes:boolean, Range: IRange, IDPrefix: string, ViewPortW: number, ViewPortH: number, PageData: IPageContainer, Bookmarks: IBookmark[]) {
			var OutStr = this.text;

			var title, footnote;
			if (this.Parent.Data.f && this.Parent.Data.f && this.Parent.Data.att !== 'keep') {
				OutStr = PageData.Restriction.Get(this.Parent.Data.att);
			}

			if (this.IsFootnote && (title = GetParent('title', this.Parent)) && (footnote = title.Parent) && footnote.Parent && footnote.Parent.Data && footnote.Parent.Data.att !== 'keep') {
				OutStr = PageData.Restriction.Get(footnote.Parent.Data.att);
			}

			if (Range.To[0]) {
				OutStr = OutStr.substr(0, Range.To[0]);
			}
			if (Range.From[0]) {
				OutStr = OutStr.substr(Range.From[0]);
			}

			// TODO skip char calculation if not needed by view
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
				} else {
					ClassNames = _class;
				}
			}
			if (ClassNames) {
				ClassNames = ' class="' + ClassNames + '"';
			}

			if (!HyphOn && OutStr.match(/^\u00AD/)) {
				TargetStream[TargetStream.length - 1] = TargetStream[TargetStream.length - 1]
					.replace('</span>', OutStr.replace(/\u00AD/, '') + '</span>');
			} else {
				if (OutStr.match(/\u00AD/)) {
					OutStr = '<span></span>' + OutStr + '<span></span>';
				}
				this.ElementID = 'n_' + IDPrefix + this.XPID;
				TargetStream.push('<span id="' + this.ElementID + '"' + ClassNames + '>' + OutStr + '</span>');
			}

			if (this.IsLinkChild) {
				PageData.ActiveZones.push(<IActiveZone> {
					fb3tag: this,
					id: this.ElementID,
					xpid: this.XPID,
					cursor: this.Cursor
				});
			}
		}
		public GetXML(Range: IRange, PageData: IPageContainer) {
			var OutStr = this.text;
			if (Range.To[0]) {
				OutStr = OutStr.substr(0, Range.To[0]);
			}
			if (Range.From[0]) {
				OutStr = OutStr.substr(Range.From[0]);
			}
			OutStr.replace(/\u00AD/g,'');
			PageData.BodyXML.push(OutStr);
		}

		public Position(): IPosition {
			var Node:IFB3Block = this;
			var Result = new Array();
			while (Node.Parent) {
				Result.unshift(Node.ID);
				Node = Node.Parent;
			}
			return Result;
		}

		public ArtID2URL(Chunk?: string): string {
			return this.Parent.ArtID2URL(Chunk);
		}

		// Filters Bookmarks the way it contains no items childs. Returns
		// class names for current element CSS
		public GetBookmarkClasses(Bookmarks: IBookmark[]): string {
			if (!Bookmarks.length) { return ''}

			var ThisNodeSelections: string[] = new Array();

			var EffectiveXPath = this.XPath.slice(0);
			if (EffectiveXPath.length == 0) { return '' }

			for (var Bookmark = Bookmarks.length - 1; Bookmark >= 0; Bookmark--) {

				if (Bookmarks[Bookmark].Group == 0) { // current position, no need to draw it
					continue;
				}

				var HowIsStart = XPathCompare(Bookmarks[Bookmark].XStart, EffectiveXPath);
				var HowisEnd = XPathCompare(Bookmarks[Bookmark].XEnd, EffectiveXPath);

				// Start point as far beoung or end point is much before - no use for us or our children
				if (HowIsStart == 10 || HowisEnd == -10) {
					Bookmarks.splice(Bookmark, 1);
					continue;
				}

				// We are not fully in deal, but some of our kids will be surely affected, so we leave
				// record in Bookmarks for them
				if (HowIsStart == 1 || HowisEnd == 1 || HowisEnd == 0 && HowIsStart < 0 && !this.Childs) {
					continue;
				}

				// Our tag is directly targeted or is fully within of the selection
				// In both cases we mark it as a whole and leave our kids alone
				ThisNodeSelections.push(Bookmarks[Bookmark].ClassName());
				Bookmarks.splice(Bookmark, 1); // No need to bother childs if this tag is FULLY selected
			}
			return ThisNodeSelections.join(' ');
		}
		public IsBlock(): boolean {
			if (this.TagName && this.TagName.match(BlockLVLRegexp)) {
				return true;
			} else {
				return false;
			}
		}
		public Fire(): void {
			if (this.IsLinkChild) {
				this.Parent.Fire();
			}
		}
		public InlineStyle(ViewPortW?: any, ViewportH?: any): string {
			return "";
		}
		public PaddingBottom(): number {
			return 0;
		}
	}


	export class FB3Tag extends FB3Text implements IFB3Block {
		public TagName: string;

		readonly IsUnbreakable: boolean;
		readonly IsFloatable: boolean = false;

		public GetHTML(HyphOn: boolean, BookStyleNotes:boolean, Range: IRange, IDPrefix: string, ViewPortW: number, ViewPortH: number, PageData: IPageContainer, Bookmarks: IBookmark[]):void {

			// If someone asks for impossible - just ignore it. May happend when someone tries to go over the end
			if (Range.From[0] > this.Childs.length - 1) {
				Range.From = [this.Childs.length - 1];
			}

			if (this.Data && this.Data.f && this.Data.att !== 'keep') {
				PageData.Restriction.Increment(this.Data.att);
			}

			// keep in mind after GetBookmarkClasses Bookmarks is cleaned of all unneeded bookmarks
			var ClassNames = '';

			Range = FB3Reader.RangeClone(Range); // We are going to destroy it

			if (Bookmarks.length) {
				ClassNames = this.GetBookmarkClasses(Bookmarks);
			}

			if (BookStyleNotes && this.IsFootnote) {
				// If we are not using book-like footnotes, no need to prefill text for them - they are invisible untill clicked
				// we should do something about it
			}

			var InitTag = this.GetInitTag(Range, BookStyleNotes, IDPrefix, ViewPortW, ViewPortH, ClassNames);

			var PaddingBottom = this.PaddingBottom();
			if (PaddingBottom !== 0) {
				let classAttribute = `padding_wrapper`;
				if (this.IsUnbreakable) {
					classAttribute += ` ${FB3DOMBlock.UNBREAKABLE_CSS_CLASS}`;
				}
				if (this.Data.fl) {
					classAttribute += ` tag_float tag_float_${this.Data.fl}`;
				}
				classAttribute = classAttribute ? ` class="${classAttribute}"` : ``;
				InitTag.unshift(`<div style="padding-bottom: ${PaddingBottom}px; ${this.Data.fl ? ('float: ' + this.Data.fl + ';') : ''}" id="nn${this.ElementID}" ${classAttribute}>`);
			}

			if (this.IsFootnote) {
				PageData.FootNotes = PageData.FootNotes.concat(InitTag);
			} else {
				PageData.Body = PageData.Body.concat(InitTag);
			}

			var CloseTag = this.GetCloseTag(Range);
			if (PaddingBottom !== 0) {
				CloseTag += '</div>'
			}
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
				var KidRange: IRange = {From:[] , To:[]};
				if (I == From) {
					KidRange.From = Range.From;
				}
				if (I == To) {
					KidRange.To = Range.To;
				}
				this.Childs[I].GetHTML(HyphOn, BookStyleNotes, KidRange, IDPrefix, ViewPortW, ViewPortH, PageData, Bookmarks.slice(0));


			}
			(this.IsFootnote ? PageData.FootNotes : PageData.Body).push(CloseTag);
		}
		public GetXML(Range: IRange, PageData: IPageContainer):void {

			// keep in mind after GetBookmarkClasses Bookmarks is cleaned of all unneeded bookmarks
			if(this.TagName) {
				if(this.TagName == "footnote") {
					return;
				}
				PageData.BodyXML.push('<' + this.TagName + '>');
				var CloseTag = '</' + this.TagName + '>'//this.GetCloseTag(Range);
			}
			var tRange = FB3Reader.RangeClone(Range);
			var From = tRange.From.shift() || 0;
			var To = tRange.To.shift();
			if (To === undefined)
				To = this.Childs.length - 1;
			if (To >= this.Childs.length) {
//				console.log('Invalid "To" on "GetXML" call, element "' + this.XPID + '"');
				To = this.Childs.length - 1;
			}
			if (From < 0 || From >= this.Childs.length) {
//				console.log('Invalid "From" on "GetXML" call, element "' + this.XPID + '"');
				From = 0;
			}

			From *= 1;
			To *= 1;
			for (var I = From; I <= To; I++) {
				var KidRange: IRange = {From:[] , To:[]};
				if (I == From) {
					KidRange.From = tRange.From;
				}
				if (I == To) {
					KidRange.To = tRange.To;
				}
				this.Childs[I].GetXML(KidRange, PageData);
			}
			if(CloseTag) {
				PageData.BodyXML.push(CloseTag);
			}


		}
		constructor(public DOM: IFB3DOM, public Data: IJSONBlock, Parent: IFB3Block, ID: number, IsFootnote?: boolean, IsLinkChild?: boolean) {
			super(DOM, '', Parent, ID, 1, 0, IsFootnote, IsLinkChild);
			if (Data === null) return;

			this.TagName = Data.t;

			if (Data.xp) {
				this.XPath = this.Data.xp;
			} else {
				this.XPath = null;
			}

			if (Data.t === 'a' || Data.t === 'note') {
				this.IsLink = true;
			}

			this.Childs = new Array();
			var Base = 0;
			if (Data.f) {
				Base++;
				var NKid = new FB3FootnoteTag(this.DOM, Data.f, this, Base);
				this.Childs.push(NKid);
				this.Chars += NKid.Chars;
			}
			if (Data.c) { // some tags. like <br/>, have no contents
				var NodeN = 0; // For text nodes in the mixed content we need it's invisible-node number
				var PrevItmType = 'unknown';
				var Chars = 0;
				for (var I = 0; I < Data.c.length; I++) {
					var Itm = Data.c[I];
					var ItmType = (typeof Itm === "string") ? 'text' : 'tag';
					if (ItmType != PrevItmType || ItmType != 'text') {
						NodeN++;
					}
					PrevItmType = ItmType;
					var Kid = TagClassFactory(Itm, <IFB3Block> this, I + Base, NodeN, Chars, IsFootnote, this.IsLink || this.IsLinkChild, this.DOM);
					if (ItmType == 'text') {
						Chars += Kid.Chars;
					} else {
						Chars = 0;
					}
					this.Childs.push(Kid);
					this.Chars += Kid.Chars;
				}
			}

			if (Data.fl) {
				this.IsFloatable = true;
			}

			this.IsUnbreakable = Boolean(Data.op);
		}

		public HTMLTagName(): string {
			if (this.Data.f) {
				return 'a';
			} else if (TagMapper[this.TagName]) {
				return TagMapper[this.TagName];
			} else if (this.TagName == 'title' && this.Data.xp) {
				var lvl = this.Data.xp.length - 1;
				return 'h' + (lvl < 6 ? lvl : 5);
			} else if (this.TagName == 'p' && this.Parent && this.Parent.TagName == 'title') {
				return 'div';
			} else {
				return this.TagName;
			}
		}

		private CheckPrevTagName(): boolean {
			if (this.ID > 0 && this.Parent.Childs[this.ID - 1] &&
				TagSkipDoublePadding[this.Parent.Childs[this.ID - 1].TagName]) {
				return true;
			}
			return false;
		}

		public GetCloseTag(Range: IRange): string {
			return '</' + this.HTMLTagName() + '>';
		}
		private CutTop(Path: IPosition): boolean {
			for (var I = 0; I <= Path.length; I++) {
				if (Path[I]) return true;
			}
			return false;
		}

		public ElementClasses(): string[] {
			var ElementClasses = new Array();

			if (TagSkipDoublePadding[this.TagName] && this.CheckPrevTagName()) {
				ElementClasses.push('skip_double');
			}

			if (this.IsUnbreakable) {
				ElementClasses.push(FB3DOMBlock.UNBREAKABLE_CSS_CLASS);
			}

			if (this.IsFootnote) {
				ElementClasses.push('footnote')
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
				ElementClasses.push(this.Data.nc)
			}

			return ElementClasses
		}

		public InlineStyle(ViewPortW?: any, ViewportH?: any): string {
			// top-level block elements, we want to align it to greed vertically
			var InlineStyle = '';

			if (this.Data.fl) {
				InlineStyle += 'float: ' + this.Data.fl + ';';
			}

			if (InlineStyle) {
				InlineStyle = ' style="' + InlineStyle + '"';
			}
			return InlineStyle;
		}

		public PaddingBottom(): number {
			if (this.Parent && !this.Parent.Parent) {
				return (<IFB3DOM>this.Parent).PagesPositionsCache.GetMargin(this.XPID) || 0;
			}
			return 0;
		}

		public GetInitTag(Range: IRange, BookStyleNotes: boolean, IDPrefix: string, ViewPortW: number, ViewPortH: number, MoreClasses: string): InnerHTML[] {
			var ElementClasses = this.ElementClasses();

			if (MoreClasses) {
				ElementClasses.push(MoreClasses);
			}

			if (this.CutTop(Range.From)) {
				ElementClasses.push('cut_top');
			}

			// FixMe - this is a weak detection, can't see last p in div splitted (see CutTop above, that's the right way)
			if (Range.To[0] < this.Childs.length - 1) {
				ElementClasses.push('cut_bot');
			}

			var InlineStyle = this.InlineStyle();

			var Out: string[] = ['<'];

			/* [94948] Add note tag from tag mappper (note can only has hr attribute) */
			if (this.TagName == 'a' && this.Data.href) {
				Out.push('a href="' + this.Data.href + '" target="' + ExtLinkTarget + '"');
			} else {
				Out.push(this.HTMLTagName());
			}

			if (ElementClasses.length) {
				Out.push(' class="' + ElementClasses.join(' ') + '"');
			}
			Out.push(InlineStyle);

			if (this.IsFootnote) {
//				Out.push(' id="fn_' + IDPrefix + this.Parent.XPID + '">');
				this.ElementID = 'fn_' + IDPrefix + this.Parent.XPID;
				Out.push(' id="' + this.ElementID + '"' + (ViewPortH > 0 ? ' style="max-height: ' + (ViewPortH * MaxFootnoteHeight).toFixed(0) + 'px"' : '') + '>');
			} else if (this.Data.f && !BookStyleNotes) {
				this.ElementID = 'n_' + IDPrefix + this.XPID;
				Out.push(' id="' + this.ElementID + '" onclick="alert(1)" href="#">');
			}  else {
				this.ElementID = 'n_' + IDPrefix + this.XPID;
				Out.push(' id="' + this.ElementID + '">');
			}

			return Out;
		}

		public Fire(): void {
			var PageContainer = new FB3DOMBlock.PageContainer();

			if (this.IsUnbreakable) {
				this.GetHTML(true, false, {From: [], To: []}, '', 0, 0, PageContainer, []);
				this.DOM.Site.ZoomHTML(PageContainer.Body.join(''));
			}

			super.Fire();
		}
	}
	export class FB3ImgTag extends FB3Tag implements IFB3Block {
		public GetInitTag(Range: IRange, BookStyleNotes: boolean, IDPrefix: string, ViewPortW: number, ViewPortH: number, MoreClasses: string): InnerHTML[] {
			var ElementClasses = this.ElementClasses();

			if (MoreClasses) {
				ElementClasses.push(MoreClasses);
			}
			ElementClasses.push('');

			var InlineStyle = this.InlineStyle(ViewPortW, ViewPortH);

			var Path = this.ArtID2URL(this.Data.s);
			// This is kind of a hack, normally images a inline, but if we have op:1 this mians it's block-level one
			var TagName = this.HTMLTagName();
			this.ElementID = 'ii_' + IDPrefix + this.XPID;
			var Out = ['<' + TagName + ' id="' + this.ElementID + '"' + InlineStyle];

			if (this.DOM.MediaCacheLoader) {
				let ElementID, InsertionRules;
				if (TagName != "span") {
					// if we not a span tag, <img> will be added as a child, so we need to load img there
					ElementID = 'n_' + IDPrefix + this.XPID;
					InsertionRules = 'src';
				} else {
					// in case of span we are adding image as background-url css property
					ElementID = this.ElementID;
					InsertionRules = 'style.background.url';
				}
				this.DOM.MediaCacheLoader.LoadImageAsync(Path, MediaData => FB3MediaCache.MediaCacheLoader.ProcessBlobData(ElementID, MediaData, InsertionRules), () => console.warn(`Error while downloading media source ${Path}`));
			}

			const Rectangle: IFB3BlockRectangle = this.GetRectangleWithinBounds(
				this.Data.w, this.Data.h,
				this.Data.minw, this.Data.maxw,
				ViewPortW, ViewPortH
			);

			if (ElementClasses.length) {
				Out.push(' class="' + ElementClasses.join(' ') + '"');
			}
			if(TagName != "span") {
				if (this.DOM.MediaCacheLoader) {
					Out.push('><img width = "' + Rectangle.Width + '" height = "' + Rectangle.Height + '" alt = "-"');
				} else {
					Out.push('><img width = "' + Rectangle.Width + '" height = "' + Rectangle.Height + '" src = "' + Path + '" alt = "-"');
				}

				Out.push(' id="n_' + IDPrefix + this.XPID + '"/>');
			} else {
				Out.push('></span>')
			}

			return Out;
		}
		public HTMLTagName(): string{
			//return 'div'
			return this.Data.op ? 'div' : 'span';
		}
		public InlineStyle(ViewPortW, ViewPortH): string {
			var display = ""
			var backgroundImage = ""
			if(this.HTMLTagName() == "span") {
				display = "display: inline-block;";
				// TODO: add some spinning animation while real image is loading
				if (!this.DOM.MediaCacheLoader) {
					backgroundImage = "background: url("+ this.ArtID2URL(this.Data.s) +") no-repeat right center; background-size: contain;";
				}
			}

			const Rectangle: IFB3BlockRectangle = this.GetRectangleWithinBounds(
				this.Data.w, this.Data.h,
				this.Data.minw, this.Data.maxw,
				ViewPortW, ViewPortH
			);

			var float = '';
			if (this.Data.fl) {
				float = 'float: ' + this.Data.fl + ';';
			}

			// top-level block elements, we want to align it to greed vertically
			var InlineStyle = 'width:' + Rectangle.Width + 'px;height:' + Rectangle.Height + 'px;' + display + backgroundImage + float;

			return ' style="' + InlineStyle + '"';
		}
		private GetRectangleWithinBounds(Width, Height, MinWidth, MaxWidth, ViewPortW, ViewPortH, preserveAspectRatio: boolean = true): IFB3BlockRectangle {
			const NewWidth = this.GetValueWithinMinMax(Width, MinWidth, MaxWidth, ViewPortW);

			return {
				Width: NewWidth,
				Height: this.GetValueWithinMinMax(preserveAspectRatio ? NewWidth * Height / Width : Height)
			};
		}
		private GetValueWithinMinMax(value, min?, max?, v?) {
			const parsedMin = parseFloat(this.GetValueFromUnits(min || 0, v || value).toFixed(3));
			const parsedMax = parseFloat(this.GetValueFromUnits(max || value, v || value).toFixed(3));

			if (value > parsedMax) {
				return parsedMax;
			}

			if (value < parsedMin) {
				return parsedMin;
			}

			return parseFloat(value.toFixed(3));
		}
		private GetValueFromUnits(value: any, viewport): number {
			const string = value.toString();

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
		}
		private GetValueFromEm(value: string): number {
			return parseFloat(value) * FB3DOMBlock.EM_FONT_RATIO * this.DOM.Site.FontSize;
		}
		private GetValueFromEx(value: string): number {
			return parseFloat(value) * FB3DOMBlock.EX_FONT_RATIO * this.DOM.Site.FontSize;
		}
		private GetValueFromMm(value: string): number {
			return parseFloat(value) / FB3DOMBlock.PPI;
		}
		private GetValueFromPercent(value: string, viewport: number): number {
			return parseFloat(value) * viewport / 100;
		}
	}
	export class FB3PurchaseTag extends FB3Tag implements IFB3Block {
		public GetInitTag(Range: IRange, BookStyleNotes: boolean, IDPrefix: string, ViewPortW: number, ViewPortH: number, MoreClasses: string): InnerHTML[] {
			var Out: string[] = ['<div class="' + FB3DOMBlock.UNBREAKABLE_CSS_CLASS + '" id ="n_' + IDPrefix + this.XPID + '">'];
			Out.push(this.DOM.Site.showTrialEnd('n_' + IDPrefix + this.XPID));
			return Out;
		}
	}
	export class FB3FootnoteTag extends FB3Tag implements IFB3Block {
		public IsFootnote: boolean = true;

		constructor(public DOM: IFB3DOM, public Data: IJSONBlock, Parent: IFB3Block, ID: number) {
			super(DOM, Data, Parent, ID, true);
			Parent.Footnote = this;
			Parent.HasFootnote = true;
		}
	}
	export class FB3NoteTag extends FB3Tag implements IFB3Block {
		public IsActiveZone: boolean = true;

		public GetInitTag(Range: IRange, BookStyleNotes: boolean, IDPrefix: string, ViewPortW: number, ViewPortH: number, MoreClasses: string): InnerHTML[] {
			var ElementClasses = this.ElementClasses();

			if (MoreClasses) {
				ElementClasses.push(MoreClasses);
			}

			var InlineStyle = this.InlineStyle();

			var Out: string[] = ['<'];

			Out.push('a href="about:blank" data-href="' + this.Data.hr + '"');

			if (ElementClasses.length) {
				Out.push(' class="' + ElementClasses.join(' ') + '"');
			}
			Out.push(InlineStyle);

			this.ElementID = 'n_' + IDPrefix + this.XPID;
			Out.push(' id="' + this.ElementID + '">');

			return Out;
		}

		public Fire(): void {
			this.DOM.Site.GoToNote(this.Data.hr.join(''));
		}
	}
	export class FB3FootnoteLinkTag extends FB3Tag implements IFB3Block {
		public IsActiveZone: boolean = true;
		public HasFootnote: boolean = true;

		public GetInitTag(Range: IRange, BookStyleNotes: boolean, IDPrefix: string, ViewPortW: number, ViewPortH: number, MoreClasses: string): InnerHTML[] {
			var ElementClasses = this.ElementClasses();

			ElementClasses.push('footnote_attached')
			if (!BookStyleNotes) {
				ElementClasses.push('footnote_clickable')
			}

			if (MoreClasses) {
				ElementClasses.push(MoreClasses);
			}

			var InlineStyle = this.InlineStyle();

			var Out: string[] = ['<a'];

			if (ElementClasses.length) {
				Out.push(' class="' + ElementClasses.join(' ') + '"');
			}
			Out.push(InlineStyle);

			if (this.Data.f && !BookStyleNotes) {
				this.ElementID = 'n_' + IDPrefix + this.XPID;
				Out.push(' id="' + this.ElementID + '" onclick="alert(1)" href="#">');
			} else {
				this.ElementID = 'n_' + IDPrefix + this.XPID;
				Out.push(' id="' + this.ElementID + '">');
			}

			return Out;
		}

		public Fire(): void {
			var PageContainer = new FB3DOMBlock.PageContainer();

			this.Footnote.GetHTML(true, false, {From: [], To: []}, '', 0, 0, PageContainer, []);
			this.DOM.Site.ZoomHTML(PageContainer.FootNotes.join(''));
		}
	}
	export class FB3LinkTag extends FB3Tag implements IFB3Block {
		public IsActiveZone: boolean = true;
		public IsLink: boolean = true;

		public GetInitTag(Range: IRange, BookStyleNotes: boolean, IDPrefix: string, ViewPortW: number, ViewPortH: number, MoreClasses: string): InnerHTML[] {
			var ElementClasses = this.ElementClasses();

			if (MoreClasses) {
				ElementClasses.push(MoreClasses);
			}

			var InlineStyle = this.InlineStyle();

			var Out: string[] = ['<a href="' + this.Data.href + '" target="' + ExtLinkTarget + '"'];

			if (ElementClasses.length) {
				Out.push(' class="' + ElementClasses.join(' ') + '"');
			}
			Out.push(InlineStyle);

			this.ElementID = 'n_' + IDPrefix + this.XPID;
			Out.push(' id="' + this.ElementID + '">');

			return Out;
		}

		public Fire(): void {
			this.DOM.Site.GoToExternalLink(this.Data.href);
		}
	}
}
