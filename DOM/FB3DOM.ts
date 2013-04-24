/// <reference path="FB3DOMHead.ts" />

module FB3DOM {

	export class FB3Text implements IFB3Block {
		constructor(private text: string, public Parent: IFB3Block) { }
		public GetHTML(HyphOn: bool, Range: IRange): string {
			return this.text;
		}
	}


	export class FB3Tag implements IFB3Block {
		private TagName: string;
		private Childs: IFB3Block[];

		public GetHTML(HyphOn: bool, Range: IRange): string {
			return "";
		}

		constructor(public Data: IJSONBlock, public Parent: IFB3Block) {
			this.TagName = Data.t;
			this.Childs = new Array();
			for (var I = 0; I <= Data.c.length; I++) {
				var Itm = Data.c[I];
				if (typeof Itm === "string") {
					this.Childs.push(new FB3Tag(Itm, this));
				} else {
					this.Childs.push(new FB3Text(Itm, this));
				}
			}
		}

		private GetInitTag(Range: IRange) {
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
			if (this.Data.nc) {
				ElementClasses.push(this.Data.nc)
			}

			var Out = '<' + this.TagName;
			if (ElementClasses.length) {
				Out += ' class="' + ElementClasses.join(' ') + '"';
			}

			//if (this.data.css) {
			//	out += ' style="' + this.data.css + '"';
			//}

			if (this.Data.i) {
				Out += ' id="' + this.Data.i + '"';
			}
			return Out + '>';

		}
	}

	export class FB3DOMBase extends FB3Tag implements IFB3DOM {
		public Ready: bool;

		private RawData: Array;

		constructor(private Alert: FB3ReaderSite.IAlert, private URL: string) {
			super(null, null);
			this._Init();
		}

		public TOC() {
			return {
				Title: 'Title',
				Subitems: new Array(),
				StartBlock: 0,
				EndBlock: 30
			};
		}

		// Wondering why I make _Init public? Because you can't inherite private methods, bah!
		public _Init() {
			this.RawData = new Array();
			this.Ready = false;

		}
	}

}


