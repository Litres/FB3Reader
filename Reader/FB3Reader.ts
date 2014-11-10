/// <reference path="FB3ReaderHead.ts" />
/// <reference path="FB3ReaderPage.ts" />

module FB3Reader {
//	interface IDumbCallback { () }

	// 0 on equal
	// 1 if 1 past 2 on child level like [0,1,2] is past [0,1]
	// 10 if Pos1 is PAST Pos2 on subling level like [0,1,2] is past [0,2,1]
	// -1 and -10 are the cases where Pos2 is below Pos1 respectively
	export function PosCompare(Pos1: number[], Pos2: number[]): number {
		var Result = 0; // Positions are equal
		for (var I = 0; I < Math.min(Pos1.length, Pos2.length); I++) {
			if (Pos1[I] != Pos2[I]) {
				Result = Pos1[I]*1 > Pos2[I]*1 ? 10 : -10;
				break;
			}
		}

		if (Result == 0 && Pos1.length != Pos2.length) {
			Result = Pos1.length > Pos2.length ? 1 : -1;
		}

		return Result;
	}

	export function RangeClone(BaseRange: FB3DOM.IRange): FB3DOM.IRange {
		return {
			From: BaseRange.From.slice(0),
			To: BaseRange.To.slice(0)
		}
	}

	export function PRIClone(Range: IPageRenderInstruction): IPageRenderInstruction {
		return {
			Range: RangeClone(Range.Range),
			CacheAs: Range.CacheAs,
			Height: Range.Height,
			NotesHeight: Range.NotesHeight
		};

	}

	interface IRect {
		left: number;
		right: number;
		top: number;
		bottom: number;
	}

	function GetElementRect(elem): IRect {
		var Dat: IRect;
		if (elem.getBoundingClientRect) {
        // "правильный" вариант
			Dat = getOffsetRect(elem)
		} else {
			// пусть работает хоть как-то
			Dat = getOffsetSum(elem)
		}
		Dat.right	= Dat.left + elem.offsetWidth;
		Dat.bottom = Dat.top + elem.offsetHeight;
		return Dat;
	}

	function getOffsetSum(elem): IRect {
		var top = 0, left = 0
		while (elem) {
				top = top + parseInt(elem.offsetTop)
			left = left + parseInt(elem.offsetLeft)
			elem = elem.offsetParent
		}

		return <IRect> { top: top, left: left }
	}

	function getOffsetRect(elem: HTMLElement): IRect {
		var box = elem.getBoundingClientRect()

		var body = document.body
		var docElem = document.documentElement

		var scrollTop = window.pageYOffset || docElem.scrollTop || body.scrollTop
		var scrollLeft = window.pageXOffset || docElem.scrollLeft || body.scrollLeft

		var clientTop = docElem.clientTop || body.clientTop || 0
		var clientLeft = docElem.clientLeft || body.clientLeft || 0

		var top = box.top + scrollTop - clientTop
		var left = box.left + scrollLeft - clientLeft

		return <IRect> {top: Math.round(top),left: Math.round(left)}
	}

	export class Reader implements IFBReader {
		public HyphON: boolean;
		public BookStyleNotes: boolean;
		public TextPercent: number; 
		public NColumns: number;
		public CacheForward: number;
		public CacheBackward: number;
		public CurStartPos: IPosition;
		public CurStartPage: number;
		public BookStyleNotesTemporaryOff: boolean;
		public CanvasReadyCallback: ICanvasReadyCallback;
		public IsIE: boolean;
		public Destroy: boolean;
		public LineHeight: number;
		public CurVisiblePage: number;

		private Alert: FB3ReaderSite.IAlert;
		private Pages: FB3ReaderPage.ReaderPage[];
		private BackgroundRenderFrame: FB3ReaderPage.ReaderPage;
		private OnResizeTimeout: any;
		private MoveTimeoutID: number;

		private IsIdle: boolean;
		private IdleAction: string;
		private IdleTimeoutID: number;

		private CanvasW: number;
		private CanvasH: number;
		private TicksFromSave: number;
		private XPToJump: FB3DOM.IXPath;
		private CachingDone: any;

		private RedrawState: boolean; // stupid workaround to fix AfterTurnPageDone fire

		public _CanvasReadyCallback(){
			if (this.CanvasReadyCallback) {
				this.CanvasReadyCallback(this.GetVisibleRange());
				this.Site.AfterTurnPageDone({
					CurPage: this.CurStartPage,
					MaxPage: this.PagesPositionsCache.LastPage(),
					Percent: this.CurPosPercent(),
					Pos: this.CurStartPos
				});
			}
		}

		private SetStartPos(NewPos: IPosition): void {
			if (this.RedrawState) {
				this.RedrawState = false;
				return;
			}
			this.CurStartPos = NewPos.slice(0);
			this.Bookmarks.Bookmarks[0].Range = { From: NewPos.slice(0), To: NewPos.slice(0) };
			if (!this.Bookmarks.Bookmarks[0].SkipUpdateDatetime) {
				this.Bookmarks.Bookmarks[0].DateTime = moment().unix();
			} else {
				this.Bookmarks.Bookmarks[0].SkipUpdateDatetime = false;
			}
		}

		constructor(public ArtID: string,
			public EnableBackgroundPreRender: boolean,
			public Site: FB3ReaderSite.IFB3ReaderSite,
			public FB3DOM: FB3DOM.IFB3DOM,
			public Bookmarks: FB3Bookmarks.IBookmarks,
			public Version: string,
			public PagesPositionsCache: FB3PPCache.IFB3PPCache) {

			// Basic class init
			this.Destroy = false;
			this.HyphON = true;
			this.NColumns = 2;
			this.CacheForward = 6;
			this.CacheBackward = 2;
			this.BookStyleNotes = true;
			this.BookStyleNotesTemporaryOff = false;
			this.IsIE = /MSIE|\.NET CLR/.test(navigator.userAgent);
			this.TicksFromSave = 0;
			this.LineHeight = 0;
			this.CachingDone = {};

			this.IdleOff();
		}

		public Init(StartFrom: IPosition): void {
			this.PrepareCanvas();
			this.FB3DOM.Init(this.HyphON, this.ArtID, () => {
				this.Site.HeadersLoaded(this.FB3DOM.MetaData);
				if (!this.Bookmarks.ApplyPosition() && this.CurStartPos) {
					this.Bookmarks.Bookmarks[0].SkipUpdateDatetime = true;
					this.GoTO(StartFrom);
				}
			});
			this.Bookmarks.FB3DOM = this.FB3DOM;
			this.Bookmarks.Reader = this;
			this.PutBlockIntoView(0);
			this.Bookmarks.LoadFromCache(() => { this.Bookmarks.ApplyPosition() });
		}

		public GoTO(NewPos: IPosition, Force?: boolean) {
			if (!NewPos || NewPos.length == 0) {
				this.Site.Alert('Bad adress targeted');
				return;
			}
			if (!Force && this.CurStartPos && PosCompare(this.CurStartPos, NewPos) == 0) {
				return; // Already there
			}
			clearTimeout(this.MoveTimeoutID);
			this.IdleOff();
			var GotoPage = this.GetCachedPage(NewPos);
			if (GotoPage != undefined) {
				this.GoTOPage(GotoPage);
			} else {
				this.GoToOpenPosition(NewPos);
			}
		}
		public GoTOPage(Page: number): void {
			if (this.PagesPositionsCache.LastPage() && Page > this.PagesPositionsCache.LastPage()) {
				this.Site.NotePopup('Paging beyong the file end');
				return;
			}
			// Wow, we know the page. It'll be fast. Page is in fact a column, so it belongs to it's
			// set, NColumns per one. Let's see what start column we are going to deal with
			this.StopRenders();
			clearTimeout(this.MoveTimeoutID);
			var RealStartPage = Math.floor(Page / this.NColumns) * this.NColumns;

			var FirstPageNToRender: number;
			var FirstFrameToFill: FB3ReaderPage.ReaderPage;
			var WeeHaveFoundReadyPage = false;
			// First let's check if the page was ALREADY rendered, so we can show it right away
			var CallbackFired = false;

			this.CurStartPage = RealStartPage;
			this.SetStartPos(this.PagesPositionsCache.Get(Page).Range.From);

			for (var I = 0; I < this.Pages.length / this.NColumns; I++) {
				var BasePage = I * this.NColumns;
				// Page is rendered, that's just great - we first show what we have, then render the rest, if required
				if (this.Pages[BasePage].Ready && this.Pages[BasePage].PageN == RealStartPage) {
					this.PutBlockIntoView(BasePage);
					WeeHaveFoundReadyPage = true;
					// Ok, now we at least see ONE page, first one, from the right set. Let's deal with others
					var CrawlerCurrentPage = this.Pages[BasePage];
					for (var J = 1; J < (this.CacheForward + 1) * this.NColumns; J++) {
						if (CrawlerCurrentPage.ID == BasePage + this.NColumns) {
							this._CanvasReadyCallback();
							CallbackFired = true;
						}
						CrawlerCurrentPage = CrawlerCurrentPage.Next;
						if (!CrawlerCurrentPage.Ready || CrawlerCurrentPage.PageN != RealStartPage + J) {
							// Here it is - the page with the wrong content. We set up our re-render queue
							FirstPageNToRender = RealStartPage + J;
							FirstFrameToFill = CrawlerCurrentPage;
							break;
						}
					}
					break;
				}
			}


			if (WeeHaveFoundReadyPage && !FirstFrameToFill) { // Looks like we have our full pages set rendered already,
				if (!CallbackFired) {
					this._CanvasReadyCallback();
				}
				this.IdleOn();																	// maybe we go to the same place several times? Anyway, quit!
				return;
			} else if (!WeeHaveFoundReadyPage) {							// No prerendered page found, bad luck. We start rendering
				FirstPageNToRender = RealStartPage;							// just as if we would during the application start
				FirstFrameToFill = this.Pages[this.CurVisiblePage];
				this.PutBlockIntoView(this.CurVisiblePage);
			}

			var CacheBroken = false;
			var NewInstr: IPageRenderInstruction[] = new Array();
			var PageWeThinkAbout = FirstFrameToFill;
			for (var I = FirstPageNToRender; I < RealStartPage + (this.CacheForward + 1) * this.NColumns; I++) {
				if (this.PagesPositionsCache.LastPage() && this.PagesPositionsCache.LastPage() < I) { // This is the end, baby. The book is over
					if (I < RealStartPage + this.NColumns) {
						PageWeThinkAbout.CleanPage(); // We need some empty pages
					} else {												// But only if they are visible
						break;
					}
				} else {
					if (!CacheBroken && this.PagesPositionsCache.Get(I)) {
						NewInstr.push(PRIClone(this.PagesPositionsCache.Get(I)));
					} else {
						if (!CacheBroken) {
							CacheBroken = true;
							NewInstr.push({ Start: this.PagesPositionsCache.Get(I - 1).Range.To.slice(0) });
						} else {
							NewInstr.push({});
						}
						NewInstr[NewInstr.length - 1].CacheAs = I;
					}
				}
				PageWeThinkAbout = FirstFrameToFill.Next;
			}
			FirstFrameToFill.SetPending(NewInstr);
			FirstFrameToFill.DrawInit(NewInstr); // IdleOn will fire after the DrawInit chain ends

		}

		private PutBlockIntoView(Page: number): void {
			this.CurVisiblePage = Page;
			for (var I = 0; I < this.Pages.length; I++) {
				if (I < Page || I >= Page + this.NColumns) {
					this.Pages[I].Hide()
				} else {
					this.Pages[I].Show()
				}
			}
		}

		public GoToOpenPosition(NewPos: IPosition): void {
			clearTimeout(this.MoveTimeoutID);

			if (NewPos[0] > this.FB3DOM.TOC[this.FB3DOM.TOC.length - 1].e) {
				NewPos = [this.FB3DOM.TOC.length - 1];
			}

			var NewInstr: IPageRenderInstruction[] = [{ Start: NewPos }];

			var ShouldWeCachePositions = NewPos.length == 1 && NewPos[0] == 0;
			if (ShouldWeCachePositions) { // If we render from the begining, we can safely cache page layaut
				NewInstr[0].CacheAs = 0;
				this.CurStartPage = 0;
			} else {
				this.CurStartPage = undefined; // this means we are walking out of the ladder, right over the grass - this fact affects page turning greatly
			}

			this.SetStartPos(NewPos);
			this.StopRenders();

			for (var I = 1; I < (this.CacheForward + 1) * this.NColumns; I++) {
				NewInstr.push({});
				if (ShouldWeCachePositions) {
					NewInstr[I].CacheAs = I;
				}
			}

			for (var I = 0; I < this.Pages.length; I++) {
				this.Pages[I].Ready = false;
			}
			if (!this.CurVisiblePage) {
				this.PutBlockIntoView(0);
			}
			this.Pages[this.CurVisiblePage].SetPending(NewInstr);
			this.Pages[this.CurVisiblePage].DrawInit(NewInstr);
		}


		public TOC():FB3DOM.ITOC[] {
			var PatchedTOC = this.CloneTOCNodes(this.FB3DOM.TOC);
			this.PatchToc(PatchedTOC, this.CurStartPos, 0);
			for (var I = 0; I < this.Bookmarks.Bookmarks.length; I++) {
				this.PatchToc(PatchedTOC, this.Bookmarks.Bookmarks[I].Range.From, this.Bookmarks.Bookmarks[I].Group);
			}
			return PatchedTOC;
		}

		private CloneTOCNodes(TOC: FB3DOM.ITOC[]): FB3DOM.ITOC[]{
			var NewTOC: FB3DOM.ITOC[] = new Array();
			for (var I = 0; I < TOC.length; I++) {
				NewTOC[I] = <FB3DOM.ITOC> {};
				for (var P in TOC[I]) {
					if (P == 'c') { // contents ie childs
						NewTOC[I].c = this.CloneTOCNodes(TOC[I].c);
					} else {
						NewTOC[I][P] = TOC[I][P];
					}
				}
			}
			return NewTOC;
		}

		private PatchToc(TOC: FB3DOM.ITOC[], Pos: IPosition, Group: number):void {
			for (var I = 0; I < TOC.length; I++) {
				var StartCmp = PosCompare([TOC[I].s], Pos);
				var EndComp = PosCompare([TOC[I].e], Pos);
				if (StartCmp == 0 || StartCmp < 0 && EndComp > 0 && !TOC[I].c || StartCmp > 0) {
					if (!TOC[I].bookmarks) {
						TOC[I].bookmarks = {};
					}
					if (TOC[I].bookmarks['g' + Group]) {
						TOC[I].bookmarks['g' + Group]++;
					} else {
						TOC[I].bookmarks['g' + Group] = 1;
					}
					return;
				} else if (StartCmp <= 0 && EndComp >= 0 && TOC[I].c) {
					this.PatchToc(TOC[I].c, Pos, Group);
					return;
				}
			}
		}

		public ResetCache(): void {
			this.IdleAction = 'load_page';
			this.IdleOff();
			this.PagesPositionsCache.Reset();
		}

		public GetCachedPage(NewPos: IPosition): number {
			for (var I = this.PagesPositionsCache.Length() - 1; I >= 0; I--) {
				var Pos = this.PagesPositionsCache.Get(I).Range;
				if (PosCompare(Pos.To, NewPos) >= -1
					&& PosCompare(Pos.From, NewPos) <= 0) {
					return I;
				}
			}
			return undefined;
		}


		public StoreCachedPage(Range: IPageRenderInstruction) {
			this.PagesPositionsCache.Set(Range.CacheAs, PRIClone(Range));
		}

		public SearchForText(Text: string): FB3DOM.ITOC[]{ return null }

		private PrepareCanvas() {
			this.ResetCache();
			var InnerHTML = '<div class="FB3ReaderColumnset' + this.NColumns + '" id="FB3ReaderHostDiv" style="width:100%; overflow:hidden; height:100%">';
			this.Pages = new Array();
			for (var I = 0; I < this.CacheBackward + this.CacheForward + 1; I++) { // Visible page + precached ones
				for (var J = 0; J < this.NColumns; J++) {
					var NewPage = new FB3ReaderPage.ReaderPage(J, this.FB3DOM, this, this.Pages[this.Pages.length-1]);
					this.Pages[this.Pages.length] = NewPage;
					InnerHTML += NewPage.GetInitHTML(I * this.NColumns + J + 1);
				}
			}
			this.Pages[this.Pages.length-1].Next = this.Pages[0]; // Cycled canvas reuse

			this.BackgroundRenderFrame = new FB3ReaderPage.ReaderPage(0, this.FB3DOM, this, null); // Meet the background page borders detector!
			InnerHTML += this.BackgroundRenderFrame.GetInitHTML(0);

			InnerHTML += '</div>'
			this.Site.Canvas.innerHTML = InnerHTML;

			for (var I = 0; I < this.Pages.length; I++) {
				this.Pages[I].BindToHTMLDoc(this.Site);
			}

			this.BackgroundRenderFrame.BindToHTMLDoc(this.Site);
			this.BackgroundRenderFrame.PagesToRender = new Array(100);
			this.BackgroundRenderFrame.ViewPortH = this.Pages[0].ViewPortH;
			this.BackgroundRenderFrame.ViewPortW = this.Pages[0].ViewPortW;
			this.CanvasW = this.Site.Canvas.clientWidth;
			this.CanvasH = this.Site.Canvas.clientHeight;
			this.TicksFromSave = 0;
			this.LineHeight = this.BackgroundRenderFrame.GetLineHeight();
			this.LoadCache();
		}

		public AfterCanvasResize() {
			if (this.OnResizeTimeout) {
				clearTimeout(this.OnResizeTimeout);
			}
			this.OnResizeTimeout = setTimeout(() => {
				// This was a real resise
				if (this.CanvasW != this.Site.Canvas.clientWidth ||
					this.CanvasH != this.Site.Canvas.clientHeight) {
					this.Reset();
					this.OnResizeTimeout = undefined;
				}
			} , 200)
		}

		private FirstUncashedPage(): IPageRenderInstruction {
			var FirstUncached: IPageRenderInstruction;
			if (this.PagesPositionsCache.Length()) {
				FirstUncached = {
					Start: this.PagesPositionsCache.Get(this.PagesPositionsCache.Length() - 1).Range.To.slice(0),
					CacheAs: this.PagesPositionsCache.Length()
				}
				FB3ReaderPage.To2From(FirstUncached.Start);
			} else {
				FirstUncached = {
					Start: [0],
					CacheAs: 0
				}
			}
			return FirstUncached;
		}
		public PageForward() {
			clearTimeout(this.MoveTimeoutID);
			if (this.CurStartPage !== undefined) { // Wow, we are on the pre-rendered page, things are quite simple!
				if (this.CurStartPage + this.NColumns < this.PagesPositionsCache.Length()) { // We know how many pages we have so we can check if the next one exists
					this.GoTOPage(this.CurStartPage + this.NColumns);
				} else if (this.PagesPositionsCache.LastPage() && this.PagesPositionsCache.LastPage() < this.CurStartPage + this.NColumns) {
					return;
				} else { // If cache is not yet ready - let's wait a bit.
					this.MoveTimeoutID = setTimeout(() => { this.PageForward() }, 50)
				}
			} else { // Ouch, we are out of the ladder, this makes things a bit complicated
				// First wee seek forward NColimns times to see if the page wee want to show is rendered. If not - we will wait untill it is
				var PageToView = this.Pages[this.CurVisiblePage];
				for (var I = 0; I < this.NColumns; I++) {
					PageToView = PageToView.Next;
				}
				if (!PageToView.Ready) {
					if (PageToView.Pending
						|| !this.Pages[this.CurVisiblePage + this.NColumns - 1].RenderInstr
						|| !this.Pages[this.CurVisiblePage + this.NColumns - 1].RenderInstr.Range
						|| !this.Pages[this.CurVisiblePage + this.NColumns - 1].RenderInstr.Range.To
						|| !this.Pages[this.CurVisiblePage + this.NColumns - 1].RenderInstr.Range.To.length
						) {
						this.MoveTimeoutID = setTimeout(() => { this.PageForward() }, 50)
					} else if (this.Pages[this.CurVisiblePage + this.NColumns - 1].RenderInstr.Range.To[0] == -1
						|| this.Pages[this.CurVisiblePage + this.NColumns]
							&& this.Pages[this.CurVisiblePage + this.NColumns].RenderInstr
							&& this.Pages[this.CurVisiblePage + this.NColumns].RenderInstr.Range.To[0] == -1) {
						return; // EOF reached, the book is over
					} else {
						this.GoToOpenPosition(this.Pages[this.CurVisiblePage + this.NColumns - 1].RenderInstr.Range.To);
					}
				} else {
					this.SetStartPos(PageToView.RenderInstr.Range.From);
					this.PutBlockIntoView(PageToView.ID - 1);
					this._CanvasReadyCallback();
				}
			}
			return;
		}
		public PageBackward() {
			clearTimeout(this.MoveTimeoutID);
			if (this.CurStartPage !== undefined) { // Wow, we are on the pre-rendered page, things are quite simple!
				if (this.CurStartPage > 0) {
					this.GoTOPage(this.CurStartPage - this.NColumns);
				}
			} else {	// Ouch, we are out of the ladder, this makes things complicated like hell, sometimes
						// we will even have to get back to the ladder (and may be even wait until the ladder is ready, too bad)
				var GotoPage = this.GetCachedPage(this.CurStartPos);
				if (GotoPage != undefined) {  // All right, first we check if our current page IS on the ladder already
					this.GoTOPage(GotoPage);  // If so - go to the ledder and never care of the rest
				} else { // If not - we can only jump somewhat back, hope this will look like a page
					var ParaPerPage = 4;
					if (this.PagesPositionsCache.Length()) {
						ParaPerPage = Math.round(
							this.PagesPositionsCache.Get(this.PagesPositionsCache.Length() - 1).Range.To[0] / this.PagesPositionsCache.Length()
							);
						if (ParaPerPage < 1) {
							ParaPerPage = 1
						}
					}
					var TravelBack = this.CurStartPos[0] - ParaPerPage * this.NColumns;
					if (TravelBack < 0) {
						TravelBack = 0;
					}
					this.GoTO([TravelBack]);
				}
			}
		}

        /** 
        * Navigates to the specific percentage taking into account current cache
        * status, namely whether we already know total number of pages or not.
        * If not, block-wise navigation will be used instead of a page-wise.
        *
        * @param Percent The target percentage to navigate to.
        */
        public GoToPercent(Percent: number): void {
            if (this.IsFullyInCache()) {
                var totalPages = this.PagesPositionsCache.Length();
                var newPage = Math.round(totalPages * Percent / 100);
                if (newPage < 0) {
                    newPage = 0;
                } else if (newPage >= totalPages) {                    
                    newPage = totalPages - 1; // If there are 233 pages, then the last available one is 232.
                }
                this.GoTOPage(newPage);
            }
            else {
                var BlockN = Math.round(this.FB3DOM.TOC[this.FB3DOM.TOC.length - 1].e * Percent / 100);
                this.GoTO([BlockN]);
            }
		}

        /** 
        * Navigates to the specific point within base FB2 targeting scheme.
        * First resolves external xpath to internal (asyncroneous operation),
        * then fires GoToOpenPosition()
        *
        * @XP external xpath to jump to
        */
		public GoToXPath(XP: FB3DOM.IXPath): void {
			var TargetChunk = this.FB3DOM.XPChunk(XP);
			if (!this.XPToJump) {
				this.XPToJump = XP;
				if (!this.FB3DOM.DataChunks[TargetChunk].loaded) {
					this.FB3DOM.LoadChunks([TargetChunk], () => this.GoToXPathFinal());
				} else {
					this.GoToXPathFinal();
				}
			}
		}

		private GoToXPathFinal(): void {
			var XP = this.XPToJump;
			this.XPToJump = undefined; // clean it before the async monster comes!
			this.GoToOpenPosition(this.FB3DOM.GetAddrByXPath(this.XPToJump));
		}

		public CurPosPercent(): number {
			if (!this.FB3DOM.TOC) {
				return undefined;
			}
			var Percent: number;
			if (!(this.CurStartPage === undefined) && this.IsFullyInCache()) {
				Percent = this.CurStartPage / this.PagesPositionsCache.LastPage();
			} else {
				Percent = this.CurStartPos[0] / this.FB3DOM.TOC[this.FB3DOM.TOC.length - 1].e;
			}
			return Percent * 100;
		}

		public ElementAtXY(X: number, Y: number): IPosition {
			var Node = <HTMLElement> this.Site.elementFromPoint(X, Y);

			if (!Node) {
				return undefined; // Do not know how would this happen, just in case
			}


			if (!Node.id.match(/n(_\d+)+/)) {
				return undefined; // This is some wrong element with wrong ID, must be an error
			}

			if (!Node.nodeName.match(/span/i)) {
				var ElRect = GetElementRect(Node);
				// too bad, this is a block, we have to search for it's text
				var MayShift = Node.scrollWidth;
				var NewX = X + 3;
				while (NewX < ElRect.right && (!Node || !Node.nodeName.match(/span/i) || !Node.id.match(/n(_\d+)+/))) {
					NewX = NewX + 3;
					Node = <HTMLElement> this.Site.elementFromPoint(NewX, Y);
				}
				NewX = X - 3;
				while (NewX > ElRect.left && (!Node || !Node.nodeName.match(/span/i) || !Node.id.match(/n(_\d+)+/))) {
					NewX = NewX - 3;
					Node = <HTMLElement> this.Site.elementFromPoint(NewX, Y);
				}
			}

			if (!Node || !Node.nodeName.match(/span/i) || !Node.id.match(/n(_\d+)+/)) {
				return undefined;
			}

			var Addr: IPosition = <IPosition> <any> Node.id.split('_');
			Addr.shift();
			Addr.shift();
			FB3ReaderPage.NumericArray(Addr);
			return Addr;
		}


		private IdleGo(PageData?: FB3DOM.IPageContainer): void {
			if (this.IsIdle && !this.BackgroundRenderFrame.ThreadsRunning) {
				switch (this.IdleAction) {
					case 'load_page':
						var PageToPrerender = this.FirstUncashedPage();
						var NewPos = PageToPrerender.Start[0] / this.FB3DOM.TOC[this.FB3DOM.TOC.length - 1].e * 100;
                        if (this.IsFullyInCache()) {
							// Caching done - we save results and stop idle processing
							this.PagesPositionsCache.LastPage(this.PagesPositionsCache.Length() - 1);
							this.IdleOff();
							this.Site.IdleThreadProgressor.Progress(this, 100);
							this.Site.IdleThreadProgressor.HourglassOff(this);
							var end = new Date().getTime();
							var time = end - start;
//							alert('Execution time: ' + time);
							this.Site.Alert('Tome taken: ' + time);
							clearInterval(this.IdleTimeoutID);
							this.SaveCache();
							this.Site.BookCacheDone({
								CurPage: this.CurStartPage,
								MaxPage: this.PagesPositionsCache.LastPage()
							});
							this.CachingDone[this.FullKey()] = true;
							return;
						} else {
							this.PagesPositionsCache.LastPage(0);
							if (this.TicksFromSave > 30) {
								// We only save pages position cache once per 3% because it is SLOW like hell
								this.SaveCache();
								this.TicksFromSave = 0;
							} else {
								this.TicksFromSave++;
							}
							this.Site.IdleThreadProgressor.Progress(this, NewPos);
							this.Site.IdleThreadProgressor.Alert(this.PagesPositionsCache.Length().toFixed(0)+' pages ready');
						}
						this.IdleAction = 'wait';

						// Kind of lightweight DrawInit here, it looks like copy-paste is reasonable here
						this.BackgroundRenderFrame.RenderInstr = PageToPrerender;

						for (var I = 0; I < 100; I++) { // There is a little chance PrerenderBlocks will give us 100 pages at once
							this.BackgroundRenderFrame.PagesToRender[I] = { CacheAs: PageToPrerender.CacheAs + I + 1}
						}

						this.BackgroundRenderFrame.WholeRangeToRender = this.BackgroundRenderFrame.DefaultRangeApply(PageToPrerender);

						this.FB3DOM.GetHTMLAsync(this.HyphON,
							this.BookStyleNotes,
							this.BackgroundRenderFrame.WholeRangeToRender,
							this.BackgroundRenderFrame.ID + '_',
							this.BackgroundRenderFrame.ViewPortW,
							this.BackgroundRenderFrame.ViewPortH,
							(PageData: FB3DOM.IPageContainer) => {
								this.IdleAction = 'fill_page';
								this.IdleGo(PageData)
							});
						break;
					case 'fill_page':
						this.PagesPositionsCache.LastPage(0);
						if (PageData) {
							this.BackgroundRenderFrame.DrawEnd(PageData)
						}
						this.IdleAction = 'load_page';
						break;
					default:
				}
			}
		}

        /** 
        * Returns a value indicating whether book's content has 
        * already been fully loaded into cache or not.
        */
        private IsFullyInCache(): boolean {
            var pageToPrerender = this.FirstUncashedPage();
            return this.FB3DOM.TOC[this.FB3DOM.TOC.length - 1].e <= pageToPrerender.Start[0];
        }

		private SaveCache() {
			if (!this.CachingDone[this.FullKey()]) {
				this.PagesPositionsCache.Save(this.FullKey());
			}
		}

		private LoadCache() {
			this.PagesPositionsCache.Load(this.FullKey());
		}

		private FullKey(): string {
			return this.ArtID + ':' +
				this.BackgroundRenderFrame.ViewPortW + ':' +
				this.CanvasW + ':' +
				this.CanvasH + ':' +
				this.Version + ':' +
				this.BookStyleNotes + ':' +
				this.Site.Key;
		}

		public IdleOn(): void {
			if (!this.EnableBackgroundPreRender) {
				return; // We do not want to prerender pages.
			}
			clearInterval(this.IdleTimeoutID);
			this.IsIdle = true;
			this.Site.IdleThreadProgressor.HourglassOn(this);
			this.IdleGo();
			// Looks like small delay prevents garbage collector from doing it's job - so we let it breath a bit
			this.IdleTimeoutID = setInterval(() => { this.IdleGo() }, 100);
		}

		public IdleOff(): void {
			this.IsIdle = false;
		}

		public Redraw(): void {
			this.RedrawState = true;
			for (var I = 0; I < this.Pages.length; I++) {
				this.Pages[I].Ready = false;
			}
			this.GoTO(this.CurStartPos.slice(0),true);
		}

		private StopRenders() {
			for (var I = 0; I < this.Pages.length; I++) {
				this.Pages[I].Reset();
			}
		}

		public Reset(): void {
			this.FB3DOM.Reset();
			this.StopRenders();
			this.BackgroundRenderFrame.Reset();
			this.PrepareCanvas();
			this.CurVisiblePage = 0;
			this.GoTO(this.CurStartPos.slice(0), true);
		}

		public GetVisibleRange(): FB3DOM.IRange {
			if (!this.Pages[this.CurVisiblePage + this.NColumns - 1].Ready) {
				return undefined;
			}
			var Range = RangeClone(this.Pages[this.CurVisiblePage].RenderInstr.Range);
			if (this.NColumns > 1) {
				Range.To = this.Pages[this.CurVisiblePage + this.NColumns - 1].RenderInstr.Range.To.slice(0);
			}
			return Range;
		}
	}

}