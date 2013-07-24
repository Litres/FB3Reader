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
		nobr: 'span'
	};

	export class FB3Text implements IFB3Block {
		public Chars: number;
		public XPID: string;
		constructor(private text: string, public Parent: IFB3Block, public ID: number, public IsFootnote?: boolean) {
			this.Chars = text.length;
//			this.text = this.text.replace('\u00AD', '&shy;')
			this.XPID = (Parent && Parent.XPID != '' ? Parent.XPID + '_' : '') + this.ID;
		}
		public GetHTML(HyphOn: bool, Range: IRange, IDPrefix:string, PageData: IPageContainer) {
			var OutStr = this.text;
			if (Range.To[0]) {
				OutStr = OutStr.substr(0, Range.To[0]);
			}
			if (Range.From[0]) {
				OutStr = OutStr.substr(Range.From[0]);
			}

			var TargetStream = this.IsFootnote ? PageData.FootNotes : PageData.Body;

			TargetStream.push('<span id="n_' + IDPrefix + this.XPID + '">'+OutStr+'</span>');  // todo - HyphOn must work, must just replace shy with ''
		}

		//public GetXPID(): string {
		//	
		//	var ID: string = "";
		//	var ParID: string;
		//	if (this.Parent) {
		//		ParID = this.Parent.GetXPID();
		//	}
		//	if (ParID != '') {
		//		ID = ParID + '_';
		//	}
		//	
		//	return ID + this.ID;
		//}
	}


	export class FB3Tag extends FB3Text implements IFB3Block {
		public Chars: number;
		public TagName: string;
		public Childs: IFB3Block[];

		public GetHTML(HyphOn: bool, Range: IRange, IDPrefix: string, PageData: IPageContainer) {
			if (this.IsFootnote) {
				PageData.FootNotes = PageData.FootNotes.concat(this.GetInitTag(Range, IDPrefix));
			} else {
				PageData.Body = PageData.Body.concat(this.GetInitTag(Range, IDPrefix));
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
				this.Childs[I].GetHTML(HyphOn, KidRange, IDPrefix, PageData);
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
		public GetInitTag(Range: IRange, IDPrefix:string): InnerHTML[] {
			var ElementClasses = new Array();
			if (Range.From[0]) {
				ElementClasses.push('cut_top')
			}
			if (Range.To[0] < this.Childs.length - 1) {
				ElementClasses.push('cut_bot')
			}
			if (this.Data.xp && this.Data.xp.length) {
				ElementClasses.push('xp_' + this.Data.xp.join('_'))
			}

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

			var Out = ['<' + this.HTMLTagName()];
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