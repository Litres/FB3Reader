/// <reference path="FB3DOMHead.ts" />

module FB3DOM {
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
		'empty-line': 'hr',
		emphasis: 'em',
		style: 'span',
		footnote: 'div',
		nobr: 'span',
		image: 'img',
		trialPurchase: 'div',

		// [94948] Add new tags
		note: 'a',
		br: 'hr',
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

	// FixMe - separate class for (at least) 'a' required, see if-else hacks in GetInitTag below
	export function TagClassFactory(Data: IJSONBlock, Parent: IFB3Block,
		ID: number, NodeN: number, Chars: number, IsFootnote: boolean, DOM: IFB3DOM): IFB3Block {
		var Kid: IFB3Block;
		if (typeof Data === "string") {
			if (Parent.Data.f) {
				Data = (<any> Data).replace(/[\[\]\{\}\(\)]+/g, '');
			}
			Kid = new FB3Text(DOM, (<any> Data), Parent, ID, NodeN, Chars, IsFootnote);
		// [94948] Add "img" tag
		} else if (Data.t == 'image' || Data.t == 'img') {
			Kid = new FB3ImgTag(DOM, Data, Parent, ID, IsFootnote);
		} else if (Data.t == 'trialPurchase') {
			Kid = new FB3PurchaseTag(DOM, Data, Parent, ID, IsFootnote);
		} else {
			Kid = new FB3Tag(DOM, Data, Parent, ID, IsFootnote);
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

	// Each DOM-node holds xpath-adress of self as an array
	// Last item in array is ALWAYS char pos. When converting to string such a zerro is ommited

	export class FB3Text implements IFB3Block {
		public Chars: number;
		public XPID: string;
		public Data: IJSONBlock;
		public Childs: IFB3Block[];
		public XPath: any[];
		public TagName: string;

		constructor(public DOM: IFB3DOM,
			public text: string,
			public Parent: IFB3Block,
			public ID: number,
			NodeN: number,
			Chars: number,
			public IsFootnote: boolean) {
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
		public GetHTML(HyphOn: boolean, BookStyleNotes:boolean, Range: IRange, IDPrefix: string, ViewPortW: number, ViewPortH: number, PageData: IPageContainer, Bookmarks: FB3Bookmarks.IBookmark[]) {
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
				TargetStream.push('<span id="n_' + IDPrefix + this.XPID + '"' + ClassNames + '>' + OutStr + '</span>');
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

		public Position(): FB3ReaderAbstractClasses.IPosition {
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
		public GetBookmarkClasses(Bookmarks: FB3Bookmarks.IBookmark[]): string {
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
	}


	export class FB3Tag extends FB3Text implements IFB3Block {
		public TagName: string;
		
		readonly IsUnbreakable: boolean = false;

		public GetHTML(HyphOn: boolean, BookStyleNotes:boolean, Range: IRange, IDPrefix: string, ViewPortW: number, ViewPortH: number, PageData: IPageContainer, Bookmarks: FB3Bookmarks.IBookmark[]):void {

			// If someone asks for impossible - just ignore it. May happend when someone tries to go over the end
			if (Range.From[0] > this.Childs.length - 1) {
				Range.From = [this.Childs.length - 1];
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
		constructor(public DOM: IFB3DOM, public Data: IJSONBlock, Parent: IFB3Block, ID: number, IsFootnote?: boolean) {
			super(DOM, '', Parent, ID, 1, 0, IsFootnote);
			if (Data === null) return;

			this.TagName = Data.t;

			if (Data.xp) {
				this.XPath = this.Data.xp;
			} else {
				this.XPath = null;
			}

			this.Childs = new Array();
			var Base = 0;
			if (Data.f) {
				Base++;
				var NKid = new FB3Tag(this.DOM, Data.f, this, Base, true);
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
					var Kid = TagClassFactory(Itm, <IFB3Block> this, I + Base, NodeN, Chars, IsFootnote, this.DOM);
					if (ItmType == 'text') {
						Chars += Kid.Chars;
					} else {
						Chars = 0;
					}
					this.Childs.push(Kid);
					this.Chars += Kid.Chars;
				}
			}

			if (Data.op) {
				this.IsUnbreakable = true;
			}
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
		private CutTop(Path: FB3ReaderAbstractClasses.IPosition): boolean {
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
				ElementClasses.push(FB3DOM.UNBREAKABLE_CSS_CLASS);
			}

			if (this.IsFootnote) {
				ElementClasses.push('footnote')
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
			if (!this.Parent.Parent) {
				var Margin = (<IFB3DOM>this.Parent).PagesPositionsCache.GetMargin(this.XPID);
				if (Margin) {
					InlineStyle = 'margin-bottom: ' + Margin + 'px';
				}
			}

			if (InlineStyle) {
				InlineStyle = ' style="' + InlineStyle + '"';
			}
			return InlineStyle;
		}

		public GetInitTag(Range: IRange, BookStyleNotes: boolean, IDPrefix: string, ViewPortW: number, ViewPortH: number, MoreClasses: string): InnerHTML[] {
			var ElementClasses = this.ElementClasses();

			if (this.Data.f) {
				ElementClasses.push('footnote_attached')
				if (!BookStyleNotes) {
					ElementClasses.push('footnote_clickable')
				}
			}
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
			if ((this.TagName == 'a' || this.TagName == 'note') && this.Data.hr){
				Out.push('a href="about:blank" data-href="' + this.Data.hr + '"');
			} else if (this.TagName == 'a' && this.Data.href) {
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
				Out.push(' id="fn_' + IDPrefix + this.Parent.XPID + '" style="max-height: ' + (ViewPortH * MaxFootnoteHeight).toFixed(0) + 'px">');
			} else if (this.Data.f && !BookStyleNotes) {
				Out.push(' id="n_' + IDPrefix + this.XPID + '" onclick="alert(1)" href="#">');
			}  else {
				Out.push(' id="n_' + IDPrefix + this.XPID + '">');
			}
			return Out;
		}
	}
	export class FB3ImgTag extends FB3Tag implements IFB3Block {
		readonly IsUnbreakable: boolean = true;

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
			var Out = ['<' + TagName + ' id="ii_' + IDPrefix + this.XPID + '"' + InlineStyle];

			const Rectangle: IFB3BlockRectangle = this.GetRectangleWithinBounds(
				this.Data.w, this.Data.h,
				this.Data.minw, this.Data.maxw, 
				ViewPortW, ViewPortH
			);

			if (ElementClasses.length) {
				Out.push(' class="' + ElementClasses.join(' ') + '"');
			}
			if(TagName != "span") {
				Out.push('><img width = "' + Rectangle.Width + '" height = "' + Rectangle.Height + '" src = "' + Path + '" alt = "-"');

				Out.push(' id="n_' + IDPrefix + this.XPID + '"/>');
			} else {
				Out.push("</span>")
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
				backgroundImage = "background: url("+ this.ArtID2URL(this.Data.s) +") no-repeat right center;background-size: contain;"
			}
			
			const Rectangle: IFB3BlockRectangle = this.GetRectangleWithinBounds(
				this.Data.w, this.Data.h,
				this.Data.minw, this.Data.maxw, 
				ViewPortW, ViewPortH
			);

			// top-level block elements, we want to align it to greed vertically
			var InlineStyle = 'width:' + Rectangle.Width + 'px;height:' + Rectangle.Height + 'px;' + display + backgroundImage;
			if (!this.Parent.Parent) {
				var Margin = (<IFB3DOM>this.Parent).PagesPositionsCache.GetMargin(this.XPID);
				if (Margin) {
					InlineStyle += 'margin-bottom: ' + Margin + 'px';
				}
			}

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
			return parseFloat(value) * FB3DOM.EM_FONT_RATIO * this.DOM.Site.FontSize;
		}
		private GetValueFromEx(value: string): number {
			return parseFloat(value) * FB3DOM.EX_FONT_RATIO * this.DOM.Site.FontSize;
		}
		private GetValueFromMm(value: string): number {
			return parseFloat(value) / FB3DOM.PPI;
		}
		private GetValueFromPercent(value: string, viewport: number): number {
			return parseFloat(value) * viewport / 100;
		}
	}
	export class FB3PurchaseTag extends FB3Tag implements IFB3Block {
		readonly IsUnbreakable: boolean = true;
		public GetInitTag(Range: IRange, BookStyleNotes: boolean, IDPrefix: string, ViewPortW: number, ViewPortH: number, MoreClasses: string): InnerHTML[] {
			var Out: string[] = ['<div class="' + FB3DOM.UNBREAKABLE_CSS_CLASS + '" id ="n_' + IDPrefix + this.XPID + '">'];
			Out.push(this.DOM.Site.showTrialEnd('n_' + IDPrefix + this.XPID));
			return Out;
		}
	}
}
