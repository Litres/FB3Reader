/// <reference path="FB3DOMHead.ts" />

module FB3DOM {
	export var TagMapper = {
		title: 'div',
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
		emphasis: 'em',		style: 'span'
	};

	export class FB3Text implements IFB3Block {
		public Chars: number;
		constructor(private text: string, public Parent: IFB3Block, public ID: number) {
			this.Chars = text.length;
		}
		public GetHTML(HyphOn: bool, Range: IRange): InnerHTML {
			return '<span id="' + this.GetXPID() + '">'+this.text+'</span>';  // todo - HyphOn must work, must just replace shy with ''
		}

		public GetXPID(): string {
			var ID: string = "";
			var ParID: string;
			if (this.Parent) {
				ParID = this.Parent.GetXPID();
			}
			if (ParID != '') {
				ID = ParID + '_';
			}
			return ID + this.ID;
		}
	}


	export class FB3Tag extends FB3Text implements IFB3Block {
		public Chars: number;
		public TagName: string;
		public Childs: IFB3Block[];

		public GetHTML(HyphOn: bool, Range: IRange): InnerHTML {
			var Out = [this.GetInitTag(Range)];
			var CloseTag = this.GetCloseTag(Range);
			var From = Range.From.shift() || 0;
			var To = Range.To.shift();
			if (To === undefined)
				To = this.Childs.length - 1;
			if (To >= this.Childs.length) {
				console.log('Invalid "To" on "GetHTML" call, element "' + this.GetXPID + '"');
				To = this.Childs.length - 1;
			}
			if (From < 0 || From >= this.Childs.length) {
				console.log('Invalid "From" on "GetHTML" call, element "' + this.GetXPID + '"');
				From = 0;
			}
			for (var I = From; I <= To; I++) {
				var KidRange: IRange = {From:[] , To:[]};
				if (I == From) {
					KidRange.From = Range.From;
				}
				if (I == To) {
					KidRange.To = Range.To;
				}
				Out.push(<string>this.Childs[I].GetHTML(HyphOn, KidRange));
			}
			Out.push(CloseTag);
			return Out.join(''); // Hope one join is faster than several concats
		}

		constructor(public Data: IJSONBlock, Parent: IFB3Block, ID: number) {
			super('', Parent, ID);
			
			if (Data === null) return;

			this.TagName = Data.t;
			this.Childs = new Array();
			for (var I = 0; I < Data.c.length; I++) {
				var Itm = Data.c[I];
				var Kid: IFB3Block;
				if (typeof Itm === "string") {
					Kid = new FB3Text(Itm, this, I);
				} else {
					Kid = new FB3Tag(Itm, this, I);
				}
				this.Childs.push(Kid);
				this.Chars += Kid.Chars;
			}
		}

		public HTMLTagName(): string {
			if (TagMapper[this.TagName]) {
				return TagMapper[this.TagName];
			} else if (this.TagName == 'p' && this.Parent && this.Parent.TagName == 'title' && this.Data.xp) {
				var lvl = this.Data.xp.length - 2;
				return 'h' + (lvl < 6 ? lvl : 5);
			} else {
				return this.TagName;
			}
		}

		public GetCloseTag(Range: IRange): string {
			return '</' + this.HTMLTagName() + '>';
		}
		public GetInitTag(Range: IRange): string {
			var ElementClasses = new Array();
			if (Range.From[0]) {
				ElementClasses.push('cut_top')
			}
			if (Range.To[0] < this.Childs.length - 1) {
				ElementClasses.push('cut_bot')
			}
			if (this.Data.xp.length) {
				ElementClasses.push('xp_' + this.Data.xp.join('_'))
			}

			if (TagMapper[this.TagName]) {
				ElementClasses.push('tag_' + this.TagName);
			}
			if (this.Data.nc) {
				ElementClasses.push(this.Data.nc)
			}

			var Out = '<' + this.HTMLTagName();
			if (ElementClasses.length) {
				Out += ' class="' + ElementClasses.join(' ') + '"';
			}

			//if (this.data.css) {
			//	out += ' style="' + this.data.css + '"';
			//}

//			if (this.Data.i) {
				Out += ' id="' + this.GetXPID() + '"';
//			}
			return Out + '>';

		}
	}
}