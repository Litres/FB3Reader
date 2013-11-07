/// <reference path="FB3BookmarksHead.ts" />

module FB3Bookmarks {
	export class LitResBookmarksProcessor implements IBookmarks {
		public Ready: boolean;
		public FB3DOM: FB3DOM.IFB3DOM;
		public Reader: FB3Reader.IFBReader;
		public Bookmarks: IBookmark[];
		public CurPos: IBookmark;
		constructor() {
			this.Ready = false;
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
		private RawText: string;
		constructor(private Owner: IBookmarks) {
			this.Group = 0;
		}

		public InitFromXY(X: number, Y: number, X1?:number, Y1?:number) {
			this.Range.From = this.Owner.Reader.ElementAtXY(X, Y);
			if (X1 != undefined && Y1 != undefined) {
				this.Range.To = this.Owner.Reader.ElementAtXY(X1, Y1);
			} else {
				this.Range.To = this.Range.From;
			}
			var PageData = new FB3DOM.PageContainer();
			this.Owner.FB3DOM.GetHTML(this.Owner.Reader.HyphON, this.Range, '', 100, 100, PageData);
			// We first remove unknown characters
			var InnerHTML = PageData.Body.join('').replace(/<(?!\/?p\b|\/?strong\b|\/?em\b)[^>]*>/, '');
			// Then we extract plain text
			this.Title = InnerHTML.replace(/<[^>]+>/gi, '').substr(0, 100);
			this.RawText = InnerHTML.replace(/(\s\n\r)+/, ' ');
			this.RawText = this.RawText.replace(/<(\/)?strong[^>]*>/, '[$1b]');
			this.RawText = this.RawText.replace(/<(\/)?em[^>]*>/, '[$1i]');
			this.RawText = this.RawText.replace('</p>', '\n');
			this.RawText = this.RawText.replace(/<\/?[^>]+>/, '');
			this.Note = this.Raw2FB2(this.RawText);
			// todo - should fill this.Extract with something equal|close to raw fb2 fragment
			this.XStart = this.Owner.FB3DOM.GetXPath(this.Range.From);
			this.XEnd = this.Owner.FB3DOM.GetXPath(this.Range.To);
		}

		private Raw2FB2(RawText: string): string {
			RawText = RawText.replace(/\[(\/)?b[^>]*\]/, '<$1strong>');
			RawText = RawText.replace(/\[(\/)?i[^>]*\]/, '<$1emphasis>');
			RawText = '<p>' + RawText.replace(/\n/, '</p><p>') + '</p>';
			return RawText;
		}
	}}