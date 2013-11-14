/// <reference path="FB3BookmarksHead.ts" />

module FB3Bookmarks {



	export class LitResBookmarksProcessor implements IBookmarks {
		public Ready: boolean;
		public Reader: FB3Reader.IFBReader;
		public Bookmarks: IBookmark[];
		public CurPos: IBookmark;
		public ClassPrefix: string;
		constructor(public FB3DOM: FB3DOM.IFB3DOM) {
			this.Ready = false;
			this.FB3DOM.Bookmarks.push(this);
			this.ClassPrefix = 'my_';
			this.Bookmarks = new Array();
		}

		public AddBookmark(Bookmark: IBookmark): void {
			this.Bookmarks.push(Bookmark);
		}
		public DropBookmark(Bookmark: IBookmark): void {
			for (var I = 0; I < this.Bookmarks.length; I++) {
				if (this.Bookmarks[I] == Bookmark) {
					this.Bookmarks.splice(I, 1);
					return;
				}
			}
		}


		// fake methods below - todo to implement them
		public Load(ArtID: string, Callback?: IBookmarksReadyCallback) {
			this.Ready = true; //fake
		}
		public Store(): void { } // fake
	}

	export class Bookmark implements IBookmark {
		public ID: string;
		public Range: FB3DOM.IRange;
		public XStart: IXPath;
		public XEnd: IXPath;
		public Group: number;
		public Class: string;
		public Title: string;
		public Note: InnerFB2;
		public Extract: InnerFB2;
		public RawText: string;
		constructor(private Owner: IBookmarks) {
			this.Group = 0;
			this.Class = 'default';
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

		public RoundClone(ToBlock: boolean): IBookmark {
			var Clone = new Bookmark(this.Owner);

			Clone.Range = FB3Reader.RangeClone(this.Range);

			if (ToBlock) {
				this.RoundToBlockLVLUp(Clone.Range.From);
				this.RoundToBlockLVLDn(Clone.Range.To);
			} else {
				this.RoundToWordLVLUp(Clone.Range.From);
				this.RoundToWordLVLDn(Clone.Range.To);
			}

			Clone.GetDataFromText();
			Clone.Group = this.Group;
			Clone.Class = this.Class;

			return Clone;
		}

		public Detach() {
			this.Owner.DropBookmark(this);
			// this.Owner.Store();
		}

		private RoundToWordLVLDn(Adress: FB3Reader.IPosition) {
			var Block = this.Owner.FB3DOM.GetElementByAddr(Adress.slice(0));
			var PosInBlock = Adress[Adress.length - 1];
			while (Block.Parent && (!Block.TagName || !Block.TagName.match(FB3DOM.BlockLVLRegexp))) {
				Block = Block.Parent;
				PosInBlock = Adress[Adress.length - 1];
				Adress.pop();
			}
			while (PosInBlock < Block.Childs.length && !Block.Childs[PosInBlock].Childs && !Block.Childs[PosInBlock].text.match(/\s$/)) {
				PosInBlock++;
			}
			Adress.push(PosInBlock);
		}
		private RoundToWordLVLUp(Adress: FB3Reader.IPosition) {
			var Block = this.Owner.FB3DOM.GetElementByAddr(Adress.slice(0));
			var PosInBlock = Adress[Adress.length - 1];
			while (Block.Parent && (!Block.TagName || !Block.TagName.match(FB3DOM.BlockLVLRegexp))) {
				Block = Block.Parent;
				PosInBlock = Adress[Adress.length - 1];
				Adress.pop();
			}
			PosInBlock++;
			while (PosInBlock >= 0 && !Block.Childs[PosInBlock-1].Childs && !Block.Childs[PosInBlock-1].text.match(/\s$/)) {
				PosInBlock--;
			}
			Adress.push(PosInBlock);
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
			if (Block.TagName && Block.TagName.match(FB3DOM.BlockLVLRegexp)) {
				return;
			}
			if (Block.Parent.Childs.length > Block.ID + 1) {
				Adress[Adress.length - 1]++;
			} else {
				Adress.push(Block.Childs.length);
			}
		}

		public ClassName(): string {
			return this.Owner.ClassPrefix + 'selec_' + this.Group + '_' + this.Class;
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

		private Raw2FB2(RawText: string): string {
			RawText = RawText.replace(/\[(\/)?b[^>]*\]/, '<$1strong>');
			RawText = RawText.replace(/\[(\/)?i[^>]*\]/, '<$1emphasis>');
			RawText = '<p>' + RawText.replace(/\n/, '</p><p>') + '</p>';
			return RawText;
		}
	}}