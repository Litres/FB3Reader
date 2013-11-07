/// <reference path="FB3DOMHead.ts" />

module FB3DOM {
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

	export class FB3Text implements IFB3Block {
		public Chars: number;
		public XPID: string;
		public Data: IJSONBlock;
		public Childs: IFB3Block[];
		constructor(private text: string, public Parent: IFB3Block, public ID: number, public IsFootnote?: boolean) {
			this.Chars = text.length;
//			this.text = this.text.replace('\u00AD', '&shy;')
			this.XPID = (Parent && Parent.XPID != '' ? Parent.XPID + '_' : '') + this.ID;
		}
		public GetHTML(HyphOn: boolean, Range: IRange, IDPrefix: string, ViewPortW: number, ViewPortH: number, PageData: IPageContainer) {
			var OutStr = this.text;
			if (Range.To[0]) {
				OutStr = OutStr.substr(0, Range.To[0]);
			}
			if (Range.From[0]) {
				OutStr = OutStr.substr(Range.From[0]);
			}

			if (!HyphOn) {
				OutStr = OutStr.replace(/\u00AD/,'');
			}

			var TargetStream = this.IsFootnote ? PageData.FootNotes : PageData.Body;

			TargetStream.push('<span id="n_' + IDPrefix + this.XPID + '">'+OutStr+'</span>');  // todo - HyphOn must work, must just replace shy with ''
		}

		public ArtID2URL(Chunk?: string): string {
			return this.Parent.ArtID2URL(Chunk);
		}

		public GetXPath(Position: FB3Reader.IPosition): FB3Bookmarks.IXpath {

			die('broken');
			if (Position.length) {
				var ChildID = Position[0];
				if (this.Childs && this.Childs[ChildID] && this.Childs[ChildID].Data.xp) {
					Position.shift();
					return this.Childs[ChildID].GetXPath(Position);
				}
			}
			var XPath = '';
			if (this.Data && this.Data.xp) {
				XPath = '/' + this.Data.xp.join('/');
			} else {
				return '';
			}

			if (ChildID) {

			}
			if (this.Data && this.Data.xp) {
				return '/' + this.Data.xp.join('/');
			}

			var XPath = this.Parent.GetXPath();
			var PreceedingSt = '';
			var PageData = new PageContainer();

			if (this.ID > 0) {
				this.Parent.GetHTML(false, { From: [0], To: [this.ID] }, '', 0, 0, PageData);
				if (PageData.Body.length) {
					var Body = PageData.Body.join('');
					Body = Body.replace(/<[^>]+>/, '');
					XPath += '.' + Body.length.toFixed(0);
				}
			}
			return XPath;
		}

	}


	export class FB3Tag extends FB3Text implements IFB3Block {
		public Chars: number;
		public TagName: string;
		public Childs: IFB3Block[];

		public GetHTML(HyphOn: boolean, Range: IRange, IDPrefix: string, ViewPortW: number, ViewPortH: number, PageData: IPageContainer):void {
			if (this.IsFootnote) {
				PageData.FootNotes = PageData.FootNotes.concat(this.GetInitTag(Range, IDPrefix, ViewPortW, ViewPortH));
			} else {
				PageData.Body = PageData.Body.concat(this.GetInitTag(Range, IDPrefix, ViewPortW, ViewPortH));
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
				this.Childs[I].GetHTML(HyphOn, KidRange, IDPrefix, ViewPortW, ViewPortH, PageData);
			}
			(this.IsFootnote ? PageData.FootNotes : PageData.Body).push(CloseTag);
		}

		constructor(public Data: IJSONBlock, Parent: IFB3Block, ID: number, IsFootnote?: boolean) {
			super('', Parent, ID, IsFootnote);

			if (Data === null) return;

			this.TagName = Data.t;
			this.Childs = new Array();
			var Base = 0;
			if (Data.f) {
				Base++;
				var NKid = new FB3Tag(Data.f, this, Base, true);
				this.Childs.push(NKid);
				this.Chars += NKid.Chars;
			}
			if (Data.c) { // some tags. like <br/>, have no contents
				for (var I = 0; I < Data.c.length; I++) {
					var Itm = Data.c[I];
					var Kid: IFB3Block;
					if (typeof Itm === "string") {
						if (Data.f) {
							Itm = Itm.replace(/[\[\]\{\}\(\)]+/g, '');
						}
						Kid = new FB3Text(Itm, this, I + Base, IsFootnote);
					} else {
						Kid = new FB3Tag(Itm, this, I + Base, IsFootnote);
					}
					this.Childs.push(Kid);
					this.Chars += Kid.Chars;
				}
			}
		}

		public HTMLTagName(): string {
			if (TagMapper[this.TagName]) {
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
		public GetInitTag(Range: IRange, IDPrefix: string, ViewPortW: number, ViewPortH: number): InnerHTML[] {
			var ElementClasses = new Array();
			if (Range.From[0] > 0) {
				ElementClasses.push('cut_top')
			}
			if (Range.To[0] < this.Childs.length - 1) {
				ElementClasses.push('cut_bot')
			}
			//if (this.Data.xp && this.Data.xp.length) {
			//	ElementClasses.push('xp_' + this.Data.xp.join('_'))
			//}

			if (this.IsFootnote) {
				ElementClasses.push('footnote')
			} else if (this.Data.f) {
				ElementClasses.push('footnote_attached')
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
			} else {
				Out.push(' id="n_' + IDPrefix + this.XPID + '">');
			}
			return Out;
		}
	}
}