/// <reference path="FB3BookmarksHead.ts" />

module FB3Bookmarks {
	export class LitResBookmarksProcessor implements IBookmarks {
		public Ready: boolean;
		public Reader: FB3Reader.IFBReader;
		public Bookmarks: IBookmark[];
		public CurPos: IBookmark;
		constructor(public FB3DOM: FB3DOM.IFB3DOM) {
			this.Ready = false;
			this.FB3DOM.Bookmarks.push(this);
		}
		Load(ArtID: string, Callback?: IBookmarksReadyCallback) {
			this.Ready = true; //fake
		}
		Store(): void { } // fake
	}
	export class Bookmark implements IBookmark {
		public ID: string;
		public Range: FB3DOM.IRange;
		public XStart: IXpath;
		public XEnd: IXpath;
		public Group: number;
		public Class: string;
		public Title: string;
		public Note: InnerFB2;
		public Extract: InnerFB2;
		public RawText: string;
		constructor(private Owner: IBookmarks) {
			this.Group = 0;
			this.Range = {From: undefined, To: undefined};
		}

		public InitFromXY(X: number, Y: number): boolean {
			var BaseFrom = this.Owner.Reader.ElementAtXY(X, Y);
			if (BaseFrom) {
				this.Range.From = BaseFrom.slice(0);
				this.Range.To = BaseFrom;
				this.GetDataFromText();
				return true;
			} else {
				return undefined;
			}
		}

		public ExtendToXY(X: number, Y: number): boolean {
			var BaseTo = this.Owner.Reader.ElementAtXY(X, Y);
			if (BaseTo) {
				this.Range.To = BaseTo;
				this.GetDataFromText();
				return true;
			} else {
				return undefined;
			}
		}

		public RoundClone(): IBookmark {
			var Clone = new Bookmark(this.Owner);

			Clone.Range = FB3Reader.RangeClone(this.Range);

			this.RoundToBlockLVLUp(Clone.Range.From);
			this.RoundToBlockLVLDn(Clone.Range.To);

			Clone.GetDataFromText();
			Clone.Group = this.Group;
			Clone.Class = this.Class;

			return Clone;
		}

		private GetDataFromText() {
			var PageData = new FB3DOM.PageContainer();
			this.Owner.FB3DOM.GetHTML(this.Owner.Reader.HyphON, FB3Reader.RangeClone(this.Range), '', 100, 100, PageData);
			// We first remove unknown characters
			var InnerHTML = PageData.Body.join('').replace(/<(?!\/?p\b|\/?strong\b|\/?em\b)[^>]*>/, '');
			// Then we extract plain text
			this.Title = InnerHTML.replace(/<[^>]+>|\u00AD/gi, '').substr(0, 50).replace(/\s+\S*$/, '');
			this.RawText = InnerHTML.replace(/(\s\n\r)+/gi, ' ');
			this.RawText = this.RawText.replace(/<(\/)?strong[^>]*>/gi, '[$1b]');
			this.RawText = this.RawText.replace(/<(\/)?em[^>]*>/gi, '[$1i]');
			this.RawText = this.RawText.replace(/<\/p>/gi, '\n');
			this.RawText = this.RawText.replace(/<\/?[^>]+>|\u00AD/gi, '');
			this.RawText = this.RawText.replace(/^\s+|\s+$/gi, '');
			this.Note = this.Raw2FB2(this.RawText);
			// todo - should fill this.Extract with something equal|close to raw fb2 fragment
			this.XStart = this.Owner.FB3DOM.GetXPathFromPos(this.Range.From.slice(0));
			this.XEnd = this.Owner.FB3DOM.GetXPathFromPos(this.Range.To.slice(0));
		}

		private RoundToBlockLVLUp(Adress: FB3Reader.IPosition) {
			var Block = this.Owner.FB3DOM.GetElementByAddr(Adress.slice(0));
			while (Block.Parent && (!Block.TagName || !Block.TagName.match(FB3DOM.BlockLVLRegexp))) {
				Block = Block.Parent;
				Adress.pop();
			}
		}
		private RoundToBlockLVLDn(Adress: FB3Reader.IPosition) {
			this.RoundToBlockLVLUp(Adress);
			var Block = this.Owner.FB3DOM.GetElementByAddr(Adress.slice(0));
			if (Block.Parent.Childs.length > Block.ID + 1) {
				Adress[Adress.length - 1]++;
			} else {
				Adress.push(Block.Childs.length);
			}
		}

		private Raw2FB2(RawText: string): string {
			RawText = RawText.replace(/\[(\/)?b[^>]*\]/, '<$1strong>');
			RawText = RawText.replace(/\[(\/)?i[^>]*\]/, '<$1emphasis>');
			RawText = '<p>' + RawText.replace(/\n/, '</p><p>') + '</p>';
			return RawText;
		}
	}}