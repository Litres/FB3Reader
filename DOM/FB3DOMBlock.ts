/// <reference path="FB3DOMHead.ts" />

module FB3DOM {
	export var MaxFootnoteHeight = 0.75;
	export var TagMapper = {
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
		emphasis: 'em',		style: 'span',
		footnote: 'div',
		nobr: 'span',
		image: 'img',
	};
	export var BlockLVLRegexp = /^(div|blockquote|h\d|p|img)$/;

	export function XPathCompare(Pos1: any[], Pos2: any[]): number {
		// todo - this function is a hack around xpath ".05' endings, whould be done some better way
		if (Pos1.length && Pos1[Pos1.length - 1].match && Pos1[Pos1.length - 1].match(/\.\d/)) {
			Pos1[Pos1.length - 1] = Pos1[Pos1.length - 1].replace(/\./, '') * 1;
		}
		if (Pos2.length && Pos2[Pos2.length - 1].match && Pos2[Pos2.length - 1].match(/\.\d/)) {
			Pos2[Pos2.length - 1] = Pos2[Pos2.length - 1].replace(/\./, '') * 1;
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
		public Bookmarks: FB3Bookmarks.IBookmarks[];
		public XPath: any[];
		constructor(public text: string,
			public Parent: IFB3Block,
			public ID: number,
			NodeN: number,
			Chars: number,
			public IsFootnote: boolean) {
			this.Chars = this.text.replace('\u00AD', '&shy;').length;
			//			this.text = this.text.replace('\u00AD', '&shy;')
			this.XPID = (Parent && Parent.XPID != '' ? Parent.XPID + '_' : '') + this.ID;
			if (Parent && Parent.XPath) {
				this.XPath = Parent.XPath.slice(0);
				this.XPath.push(NodeN);
				this.XPath.push('.' + Chars);
				this.Bookmarks = Parent.Bookmarks;
			}
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
			if (ClassNames) {
				ClassNames = ' class="' + ClassNames + '"';
			}

			if (!HyphOn && OutStr.match(/^\u00AD/)) {
				TargetStream[TargetStream.length - 1] = TargetStream[TargetStream.length - 1].replace('</span>', OutStr.replace(/\u00AD/, '') + '</span>');
			} else {
				TargetStream.push('<span id="n_' + IDPrefix + this.XPID + '"' + ClassNames + '>' + OutStr + '</span>');
			}
		}

		public Position(): FB3Reader.IPosition {
			var Node:IFB3Block = this;
			var Result = new Array();
			while (Node.Parent) {
				Result.push(Node.ID);
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

			for (var Bookmark = Bookmarks.length - 1; Bookmark >= 0; Bookmark--) {

				var HowIsStart = XPathCompare(Bookmarks[Bookmark].XStart, EffectiveXPath);
				var HowisEnd = XPathCompare(Bookmarks[Bookmark].XEnd, EffectiveXPath);

				// Start point as far beoung or end point is much before - no use for us or our children
				if (HowIsStart == 10 || HowisEnd == -10) {
					Bookmarks.splice(Bookmark, 1);
					continue;
				}

				// We are not fully in deal, but some of our kids will be surely affected, so we leave
				// record in Bookmarks for them
				if (HowIsStart == 1 || HowisEnd == 1) {
					continue;
				}

				// Our tag is directly targeted or is fully within of the selection
				// In both cases we mark it as a whole and leave our kids alone
				ThisNodeSelections.push(Bookmarks[Bookmark].ClassName());
				Bookmarks.splice(Bookmark, 1); // No need to bother childs if this tag is FULLY selected
			}
			return ThisNodeSelections.join(' ');
		}
	}


	export class FB3Tag extends FB3Text implements IFB3Block {
		public TagName: string;

		public GetHTML(HyphOn: boolean, BookStyleNotes:boolean, Range: IRange, IDPrefix: string, ViewPortW: number, ViewPortH: number, PageData: IPageContainer, Bookmarks: FB3Bookmarks.IBookmark[]):void {

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

		constructor(public Data: IJSONBlock, Parent: IFB3Block, ID: number, IsFootnote?: boolean) {
			super('', Parent, ID, 1, 0, IsFootnote);
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
				var NKid = new FB3Tag(Data.f, this, Base, true);
				this.Childs.push(NKid);
				this.Chars += NKid.Chars;
			}
			if (Data.c) { // some tags. like <br/>, have no contents
				var NodeN = 1; // For text nodes in the mixed content we need it's invisible-node number
				var Chars = 0;
				for (var I = 0; I < Data.c.length; I++) {
					var Itm = Data.c[I];
					var Kid: IFB3Block;
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

		public GetCloseTag(Range: IRange): string {
			return '</' + this.HTMLTagName() + '>';
		}
		public GetInitTag(Range: IRange, BookStyleNotes: boolean, IDPrefix: string, ViewPortW: number, ViewPortH: number, MoreClasses: string): InnerHTML[] {
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
			//if (this.Data.xp && this.Data.xp.length) {
			//	ElementClasses.push('xp_' + this.Data.xp.join('_'))
			//}

			if (this.IsFootnote) {
				ElementClasses.push('footnote')
			} else if (this.Data.f) {
				ElementClasses.push('footnote_attached')
				if (!BookStyleNotes) {
					ElementClasses.push('footnote_clickable')
				}
			}

			if (TagMapper[this.TagName]) {
				ElementClasses.push('tag_' + this.TagName);
			}
			if (this.Data.nc) {
				ElementClasses.push(this.Data.nc)
			}

			var Out: string[];

			if (this.TagName == 'image') {
				var W = this.Data.w;
				var H = this.Data.h;
				var Path = this.ArtID2URL(this.Data.s);
				// Image is loo large to fit the screen - forcibly zoom it out
				if (W > ViewPortW || H > ViewPortH) {
					var Aspect = Math.min((ViewPortW - 1) / W, (ViewPortH - 1) / H);
					W = Math.floor(W * Aspect);
					H = Math.floor(H * Aspect);
					ElementClasses.push('zoomedout');
					Out = ['<div style="position:absolute;" class="SmallImgZoom1"><div style="position:relative;left:0.5em;top:0.5em;" class="SmallImgZoom2"><a href="javascript:ZoomImg(\''
						+ Path + '\',' + this.Data.w + ',' + this.Data.h + ');return false;" class="ZoomAnchor">◄ Zoom ►</a></div></div><'
						+ this.HTMLTagName()];
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
			//if (this.data.css) {
			//	out += ' style="' + this.data.css + '"';
			//}

			//			if (this.Data.i) {}
			if (this.IsFootnote) {
				Out.push(' id="fn_' + IDPrefix + this.Parent.XPID + '">');
//				Out.push(' id="fn_' + IDPrefix + this.Parent.XPID + '" style="max-height: ' + (ViewPortH * MaxFootnoteHeight).toFixed(0) + 'px">');
			} else if (this.Data.f && !BookStyleNotes) {
				Out.push(' onclick="alert(1)" href="#">');
			}  else {
				Out.push(' id="n_' + IDPrefix + this.XPID + '">');
			}
			return Out;
		}
	}
}