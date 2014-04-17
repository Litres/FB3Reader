/// <reference path="FB3BookmarksHead.ts" />

module FB3Bookmarks {



	export class LitResBookmarksProcessor implements IBookmarks {
		public Ready: boolean;
		public Reader: FB3Reader.IFBReader;
		public Bookmarks: IBookmark[];
		public CurPos: IBookmark;
		public ClassPrefix: string;
		private LoadEndCallback: IBookmarksReadyCallback;
		private TemporaryNotes: IBookmarks;
		constructor(public FB3DOM: FB3DOM.IFB3DOM) {
			this.Ready = false;
			this.FB3DOM.Bookmarks.push(this);
			this.ClassPrefix = 'my_';
			this.Bookmarks = new Array();
			this.CurPos = new Bookmark(this);
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
			this.LoadEndCallback = Callback;
			// do some data transfer init stuff here, set AfterTransferFromServerComplete to run at the end
			setTimeout(()=>this.AfterTransferFromServerComplete(),200); // for now we just fire it as it is
		}

		private AfterTransferFromServerComplete(XML?: any) {
			this.ParseXML(XML);
			this.LoadEndCallback(this);
		}

		private ParseXML(XML: any) {
			// do some xml-parsing upon data receive here to make pretty JS-bookmarks from ugly XML
		}

		public Store(): void { } // todo - fill it

		public ApplyPosition(): void {
			// If DOM.TOC not ready yet, we can't expand XPath for any way - we wait while Reader.LoadDone fire this
			if (!this.FB3DOM.Ready) {
				return;
			}
			this.Ready = true;
			this.Reader.GoTO(this.CurPos.Range.From.slice(0));
		}

		public ReLoad(ArtID: string) {
			var TemporaryNotes = new LitResBookmarksProcessor(this.FB3DOM);
			TemporaryNotes.Load(ArtID, (Bookmarks: IBookmarks) => this.ReLoadComplete(Bookmarks));
		}

		private ReLoadComplete(TemporaryNotes: IBookmarks): void {
			// merge data from TemporaryNotes to this, then dispose of temporary LitResBookmarksProcessor

		}

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
		public XPathMappingReady: boolean;
		private RequiredChunks: number[];
		constructor(private Owner: IBookmarks) {
			this.ID = this.MakeSelectionID();
			this.Group = 0;
			this.Class = 'default';
			this.Range = { From: [20], To: [0] };
			this.XPathMappingReady = true;
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
			if (BaseTo && BaseTo.length > 1) {
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
			while (PosInBlock < Block.Childs.length - 1 && !Block.Childs[PosInBlock].Childs && !Block.Childs[PosInBlock].text.match(/\s$/)) {
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
			if (PosInBlock < Block.Childs.length - 2) {
				PosInBlock++;
			}
			while (PosInBlock > 0 && !Block.Childs[PosInBlock-1].Childs && !Block.Childs[PosInBlock-1].text.match(/\s$/)) {
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
			this.Owner.FB3DOM.GetHTML(this.Owner.Reader.HyphON, this.Owner.Reader.BookStyleNotes, FB3Reader.RangeClone(this.Range), '', 100, 100, PageData);
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
		private MakeSelectionID(): string {
			var MakeSelectionIDSub = function (chars, len) {
				var text = '';
				for (var i = 0; i < len; i++) { text += chars.charAt(Math.floor(Math.random() * chars.length)); }
				return text;
			}
      var text = '',
				chars = 'ABCDEFabcdef0123456789';
			text += MakeSelectionIDSub(chars, 8) + '-';
			text += MakeSelectionIDSub(chars, 4) + '-';
			text += MakeSelectionIDSub(chars, 4) + '-';
			text += MakeSelectionIDSub(chars, 4) + '-';
			text += MakeSelectionIDSub(chars, 12);
			return text;
		}

		private InitSyncXPathWithDOM(): void {
			this.XPathMappingReady = false;
			this.RequiredChunks = this.ChunksRequired();
			var ChunksToLoad = new Array();

			// First we check, if some of required chunks are not set to be loaded yet
			for (var I = 0; I < this.RequiredChunks.length; I++) {
				if (!this.Owner.FB3DOM.DataChunks[this.RequiredChunks[I]].loaded) {
					ChunksToLoad.push(this.RequiredChunks[I]);
				}
			}
			// If there are missing chunks - we initiate loading for them
			if (ChunksToLoad.length) {
				this.Owner.FB3DOM.LoadChunks(ChunksToLoad, () => this.DoSyncXPathWithDOM());
			} else {
				this.DoSyncXPathWithDOM();
			}
		}

		private DoSyncXPathWithDOM(): void {
			for (var I = 0; I < this.RequiredChunks.length; I++) {
				if (this.Owner.FB3DOM.DataChunks[this.RequiredChunks[I]].loaded != 2) {
					// There is at least one chunk still being loaded - we will return later
					setTimeout(() => this.DoSyncXPathWithDOM(), 10);
					return;
				}
			}

			// Ok, all chunks are here, now we need to map fb2 xpath to internal xpath
			this.Range = {
				From: this.Owner.FB3DOM.GetAddrByXPath(this.XStart),
				To: this.Owner.FB3DOM.GetAddrByXPath(this.XEnd)
			};
		}

		private ChunksRequired(): number[]{
			var Result = new Array();
			Result[0] = this.XPChunk(this.XStart);
			var EndChunk = this.XPChunk(this.XEnd);
			if (EndChunk != Result[0]) {
				Result.push(EndChunk);
			}
			return Result;
		}

		private XPChunk(X: IXPath): number {
			for (var I = 0; I < this.Owner.FB3DOM.DataChunks.length; I++) {
				if (FB3Reader.PosCompare(X, this.Owner.FB3DOM.DataChunks[I].xps) <= 0) {
					return I;
				}
			}
		}

	}}