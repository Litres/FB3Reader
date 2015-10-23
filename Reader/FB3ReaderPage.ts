/// <reference path="FB3ReaderHead.ts" />
/// <reference path="FB3Reader.ts" />

module FB3ReaderPage {
	export var PageBreakRegexp = /^h[1-4]/;
	export var BreakIterationEvery = 50; // every ## miliseconds script will process user input
	export var SemiSleepTimeout = 20;     // time for SetTimeout. You can rise it to let the browser more time for garbage collection
	export var PrerenderBlocks = 6;
	export var EnableForwardScan = true; // AI to not set InnerHTML several times but scan one page instead

	var FallCalls = 0; // debug

	interface ElementDesc {
		Node: HTMLDivElement;
		Width: number;
		Height: number;
		MarginTop: number;
		MarginBottom: number;
		MarginLeft: number;
		MarginRight: number;
	}
	interface IFallOut {
		FallOut: FB3ReaderAbstractClasses.IPosition; // Agress of the first element to not fit the page
		Height: number;								// Height of the page we've examined
		NotesHeight: number;					// Height for the notes block
		FalloutElementN: number;			// Last root element to fully fit the page - skipped during future lookup
		EndReached: boolean;					// False if there were not enough text to fill the page
		DenyForwardScan: boolean;		// If we had items to breake forward scan, we start from the blank page
		FitAnythingAtAll: boolean;		// If (for some reason) we were unable to fit ANYTHUNG - engine should know
	}

	interface IFalloutState {
		Limit: number;
		NotesShift: number;
		Element: HTMLElement;
		I: number;
		GoodHeight: number;
		ChildsCount: number;
		ForceDenyElementBreaking: boolean;
		LastOffsetParent: Element;
		LastOffsetShift: number;
		EndReached: boolean;
		FootnotesAddonCollected: number;

		// To shift notes to the next page we may have to eliminale last line as a whole - so we keep track of it
		LastLineBreakerParent: HTMLElement;
		LastLineBreakerPos: number;
		LastFullLinePosition: number;

		PrevPageBreaker: boolean;
		NoMoreFootnotesHere: boolean;
		FalloutElementN: number;
		SplitHistory: {
			I: number;
			Element: HTMLElement;
			Limit: number;
			GoodHeight: number;
			LastOffsetShift: number;
			LastOffsetParent: Element;
		}[];
		ForceFitBlock: boolean;
		BTreeModeOn: boolean;
		BTreeLastOK: number;
		BTreeLastFail: number;
		HasFootnotes: boolean;
		QuickMode: boolean;
		Baseline: number;
		ThisBlockLineShift: number;
		UnconfirmedShift: number;
		DenyForwardScan: boolean;
		FitAnythingAtAll: boolean;
	}

	interface IQuickFallautState {
		RealPageSize: number;
		QuickFallout: number;
		CollectedHeight: number;
		CollectedNotesHeight: number
		PrevTo: number[]
	}
	
	// hanging para extermination - we need inline to hang for hyph to work, but no reason for block to hang
	export function CropTo(Range: FB3DOM.IRange): void {
		if (Range.To.length == 1 && Range.To[0] > Range.From[0]) {
			Range.To[0]--;
		}
	}
	export function To2From(From: FB3ReaderAbstractClasses.IPosition): void {
		if (From.length == 1) {
			From[0]++;
		}
	}

	export function NumericArray(Ar: any[]) {
		for (var I = 0; I < Ar.length; I++) {
			Ar[I] = Number(Ar[I]);
		}

	}


	function HardcoreParseInt(Input: string): number {
		Input = Input.replace(/\D/g, '');
		if (Input == '')
			Input = '0';
		return parseInt(Input);
	}

	function PageBreakBefore(Node: HTMLElement): boolean {
		return Node.nodeName.toLowerCase().match(PageBreakRegexp) ? true : false;
	}
	function PageBreakAfter(Node: HTMLElement): boolean {
		return false; // todo
	}

	function IsNodeUnbreakable(Node: HTMLElement): boolean {

		if (Node.nodeName.match(/^(h\d|a|su[bp])$/i)) {
			return true;
		}

		if (Node.className.match(/\btag_(nobr|image)\b/)) {
			return true;
		}

		//var Chld1 = Node.children[0];
		//if (Chld1) {
		//	if (Chld1.nodeName.match(/^h\d$/i)) {
		//		return true;
		//	}
		//}
		if (Node.className.match(/\bfit_to_page\b/)){
			return true;
		}
		if (Node.className.match('skip_childs') != null) {
			return true;
		}
		return false;
	}

	export class ReaderPage {
		private Element: ElementDesc;
		private ParentElement: HTMLDivElement;
		private NotesElement: ElementDesc;
		private RenderMoreTimeout: number;
		private RenderMoreTimeoutApply: number;
		private RenderMoreTimeoutFallout: number;
		private Site: FB3ReaderSite.IFB3ReaderSite;
		private Visible: boolean;
		private Width: number;
		private FalloutState: IFalloutState;
		private QuickFallautState: IQuickFallautState;
		private RenderBreakerTimeout: number;
		private RenderBreakerTimeoutFallout: number;
		private ActialRequest: number = 0;
		public WholeRangeToRender: FB3DOM.IRange; // Range for currently rendered with FallOut page
		public ThreadsRunning: number;

		public ViewPortW: number;
		public ViewPortH: number;
		public RenderInstr: FB3Reader.IPageRenderInstruction;
		public PagesToRender: FB3Reader.IPageRenderInstruction[];
		public ID: number;
		public Next: ReaderPage; // If null - it's not a page but prerender container
		public Ready: boolean;
		public PrerenderBlocks: number;
		public PageN: number;
		public Pending: boolean;

		constructor(public ColumnN: number,
			private FB3DOM: FB3DOM.IFB3DOM,
			private FBReader: FB3Reader.Reader,
			Prev: ReaderPage) {
			if (Prev) {
				Prev.Next = this;
			}
			this.PrerenderBlocks = PrerenderBlocks;
			this.Ready = false;
			this.Pending = false;
			this.FalloutState = <IFalloutState> {};
			this.QuickFallautState = <IQuickFallautState> {};
			this.ThreadsRunning = 0;
		}

		Show(): void {
			if (!this.Visible) {
				this.ParentElement.style.top = '0';
				this.Visible = true;
			}
		}

		Hide(): void {
			// It's breaking apart here somehow :(
			//			return;
			if (this.Visible) {
				this.ParentElement.style.top = '100000px';
				this.Visible = false;
			}
		}

		GetInitHTML(ID: number): FB3DOM.InnerHTML {
			this.ID = ID;
			return '<div class="FB2readerCell' + this.ColumnN + 'of' + this.FBReader.NColumns +
				' FB2readerPage"><div class="FBReaderContentDiv" id="FB3ReaderColumn' + this.ID +
				'"><p id="FB3ReaderParaSize' + this.ID + '"><span id="FB3ReaderSpanSize' + this.ID +'">&#160; </span><span>&#160;<br/>&#160;<br/>&#160;</span></p></div><div class="FBReaderNotesDiv" id="FB3ReaderNotes' + this.ID + '">&#160;</div></div>';
		}

		private FillElementData(ID: string): ElementDesc {
			var Element = <any> this.Site.getElementById(ID);
			var Width = Element.offsetWidth;
			var Height = Element.parentElement.offsetHeight;
			var MarginTop; var MarginBottom;
			var MarginLeft; var MarginRight;
			if (document.all) {// IE
				MarginTop = HardcoreParseInt(Element.currentStyle.marginTop)
				+ HardcoreParseInt(Element.currentStyle.paddingTop);
				MarginBottom = HardcoreParseInt(Element.currentStyle.marginBottom)
				+ HardcoreParseInt(Element.currentStyle.paddingBottom);
				MarginLeft = HardcoreParseInt(Element.currentStyle.marginLeft)
				+ HardcoreParseInt(Element.currentStyle.paddingLeft);
				MarginRight = HardcoreParseInt(Element.currentStyle.marginRight)
				+ HardcoreParseInt(Element.currentStyle.paddingRight);
			} else {// Mozilla
				MarginTop = parseInt(getComputedStyle(Element, '').getPropertyValue('margin-top'))
				+ parseInt(getComputedStyle(Element, '').getPropertyValue('padding-top'));
				MarginBottom = parseInt(getComputedStyle(Element, '').getPropertyValue('margin-bottom'))
				+ parseInt(getComputedStyle(Element, '').getPropertyValue('padding-bottom'));
				MarginLeft = parseInt(getComputedStyle(Element, '').getPropertyValue('margin-left'))
				+ parseInt(getComputedStyle(Element, '').getPropertyValue('padding-left'));
				MarginRight = parseInt(getComputedStyle(Element, '').getPropertyValue('margin-right'))
				+ parseInt(getComputedStyle(Element, '').getPropertyValue('padding-right'));
			}
			return {
				Node: Element,
				Width: Width,
				Height: Height,
				MarginTop: MarginTop,
				MarginBottom: MarginBottom,
				MarginLeft: MarginLeft,
				MarginRight: MarginRight
			};
		}
		BindToHTMLDoc(Site: FB3ReaderSite.IFB3ReaderSite): void {
			this.Site = Site;
			this.Element = this.FillElementData('FB3ReaderColumn' + this.ID);
			this.NotesElement = this.FillElementData('FB3ReaderNotes' + this.ID);
			this.ParentElement = <HTMLDivElement> this.Element.Node.parentElement;
			this.Visible = false;
			this.Width = Math.floor(this.Site.Canvas.scrollWidth / this.FBReader.NColumns);
			this.ViewPortH = this.ParentElement.scrollHeight - this.Element.MarginTop - this.Element.MarginBottom;
			this.ViewPortW = this.Element.Width - this.Element.MarginLeft - this.Element.MarginRight;
			this.ParentElement.style.width = this.Width + 'px';
			this.ParentElement.style.position = 'absolute';
			this.ParentElement.style.left = (this.Width * this.ColumnN) + 'px';
			this.ParentElement.style.top = '-100000px';
		}

		SetPending(PagesToRender: FB3Reader.IPageRenderInstruction[]): void {
			var PageToPend = this;
			for (var I = 0; I < PagesToRender.length; I++) {
				PageToPend.Pending = true;
				PageToPend = PageToPend.Next;
			}
		}

		DrawInit(PagesToRender: FB3Reader.IPageRenderInstruction[]): void {
			if (this.FBReader.Destroy) {
				return;
			}
			//console.log(this.ID, 'DrawInit');
			if (PagesToRender.length == 0) return;
			this.Ready = false;
			this.Pending = true;
			this.FBReader.IdleOff();

			this.RenderInstr = PagesToRender.shift();
			this.PagesToRender = PagesToRender;

			if (this.Visible) {
				this.Element.Node.innerHTML = '';
				this.NotesElement.Node.innerHTML = '';
			}


			if (this.RenderInstr.Range) { // Exact fragment (must be a cache?)
				this.WholeRangeToRender = {
					From: this.RenderInstr.Range.From.slice(0),
					To: this.RenderInstr.Range.To.slice(0)
				};
				//  As we host hyphen in the NEXT element(damn webkit) and a hyphen has it's width,
				//  we always need to have one more inline - element to make sure the element without
				//  a hyphen(and thus enormously narrow) will not be left on the page as a last element,
				//  while it should fall down being too wide with hyphen attached Like this:
				//  Wrong:                                            Right:
				//  |aaa bb-|                                         |aaa bb-|
				//  |bb cccc|                                         |bb cccc|
				//  |d eeeee|<if page cut here - error>               |d  eee-| << this hyphen fits ok, next will not
				//  |-ee    |<< this hyphen must be the               |eeee   | << this tail bring excess part down
				//              6-th char, so "eeeee" would NOT fit
				// With IE it's even worse as IE renders soft hyps randomly, it may break asdasd-asdadsad
				// where asdasdasdads-ad would fit. So it's not enough to only have "asdasd-as",
				// we have to have the whole word in place to render always the same way in IE
				if (this.WholeRangeToRender.To.length > 1) { // some hacking required for sub-selects, no need to hack top-level blocks
					var RangeNodeTo = this.FB3DOM.GetElementByAddr(this.WholeRangeToRender.To);
					if ((<any> RangeNodeTo).ArtID) {
						// GetElementByAddr returned FB3DOM, DOM must have not being loaded yet
						// we suplty force last element to fully load - just in case
						this.WholeRangeToRender.To.pop();
					} else if (RangeNodeTo.text) {
						var RangeToNodeParent = RangeNodeTo.Parent;
						while (this.WholeRangeToRender.To[this.WholeRangeToRender.To.length - 1] < RangeToNodeParent.Childs.length - 1) {
							this.WholeRangeToRender.To[this.WholeRangeToRender.To.length - 1]++;
							if (RangeToNodeParent.Childs[this.WholeRangeToRender.To[this.WholeRangeToRender.To.length - 1]].text.match(/\s/)) {
								break;
							}
						}
					}
				}

			} else {
				if (!this.RenderInstr.Start) { // It's fake instruction. We consider in as "Render from start" request
					this.RenderInstr.Start = [0];
				} // Start point defined

				this.WholeRangeToRender = this.DefaultRangeApply(this.RenderInstr);
			}
			this.ActialRequest++;
			var ReqID = this.ActialRequest;
			this.FB3DOM.GetHTMLAsync(this.FBReader.HyphON,
				this.FBReader.BookStyleNotes,
				this.WholeRangeToRender,
				this.ID + '_',
				this.ViewPortW,
				this.ViewPortH,
				(PageData: FB3DOM.IPageContainer) => this.DrawEnd(PageData, ReqID));
		}

		// Take a poind and add PrerenderBlocks of blocks to it
		DefaultRangeApply(RenderInstr: FB3Reader.IPageRenderInstruction) {
			// TODO: fix, we have something bad with RenderInstr.Start
			// hub ticket #52217
			var FragmentEnd = RenderInstr.Start[0] * 1 + this.PrerenderBlocks;
			if (FragmentEnd > this.FB3DOM.TOC[this.FB3DOM.TOC.length - 1].e) {
				FragmentEnd = this.FB3DOM.TOC[this.FB3DOM.TOC.length - 1].e;
			}
			return { From: RenderInstr.Start.slice(0), To: [FragmentEnd] };
		}

		CleanPage() {
			this.NotesElement.Node.innerHTML = this.Element.Node.innerHTML = '';
			this.PageN = undefined;
			this.Ready = true;
			this.Pending = false;
		}

		PatchExtraLargeFootnote(Node: HTMLElement): void {
			if (Node.scrollHeight > this.Element.Height * FB3DOM.MaxFootnoteHeight) {
				Node.style.height = (this.Element.Height * FB3DOM.MaxFootnoteHeight).toFixed(0) + 'px';
				Node = this.Site.PatchNoteNode(Node);
			}
		}

		DrawEnd(PageData: FB3DOM.IPageContainer, ReqID?:number) {
			//console.log(this.ID, 'DrawEnd');
			if (ReqID != null && ReqID != this.ActialRequest) {
				// this is some outdated request, we have newer orders since then - so we just ignore this
				return;
			}
			this.Element.Node.innerHTML = this.Site.PrepareHTML(PageData.Body.join(''));

			this.PatchUnbreakableContent();

			var HasFootnotes = PageData.FootNotes.length && this.FBReader.BookStyleNotes;
			if (HasFootnotes) {
				this.NotesElement.Node.innerHTML = this.Site.PrepareHTML('<div class="NotesLine"></div>' +
					PageData.FootNotes.join(''));
				this.NotesElement.Node.style.display = 'block';
				var NotesNodes = this.NotesElement.Node.children.length
				for (var I = 0; I < this.NotesElement.Node.children.length; I++) {
					this.PatchExtraLargeFootnote(<HTMLElement> this.NotesElement.Node.children[I]);
				}
			}
			//			this.NotesElement.Node.style.display = PageData.FootNotes.length ? 'block' : 'none';
			if (!this.RenderInstr.Range) {
				this.QuickFallautState.CollectedHeight = 0;
				this.InitFalloutState(this.Element.Height - this.Element.MarginBottom, 0, HasFootnotes, false);
				this.ThreadsRunning++;
				//				console.log(this.ID, FallCalls, this.ThreadsRunning, 'FalloutConsumeSecondInit');
				clearTimeout(this.RenderBreakerTimeout);
				this.RenderBreakerTimeout = setTimeout(() => {
					this.ThreadsRunning--;
//					console.log(this.ID, FallCalls, this.ThreadsRunning, 'FalloutConsumeSecondInitFire');
					this.RenderBreakerTimeout = 0;
					this.FallOut();
				}, SemiSleepTimeout);
			} else {
				this.PageN = this.RenderInstr.CacheAs;
				this.ApplyPageMetrics();
				if (!this.PagesToRender.length) {
					this.FBReader.IdleOn();
				}
			}
		}

		PatchUnbreakableContent() {
			var NodesCount = this.Element.Node.children.length;
			for (var I = 0; I < NodesCount; I++) {
				var KidToCrop = <any> this.Element.Node.children[I];
				var ElWidth = Math.min(KidToCrop.scrollWidth, KidToCrop.clientWidth);
				if (ElWidth > this.ViewPortW + 1) {
					var LeftMargin;
					if (document.all) {
						LeftMargin = HardcoreParseInt(KidToCrop.currentStyle.marginLeft)
					} else {
						LeftMargin = parseInt(getComputedStyle(KidToCrop, '').getPropertyValue('margin-left'));
					}
					if (LeftMargin < 0) {
						ElWidth += LeftMargin;
					}
				}
				// Hack for internal wide-width block, mostly images but others as well
				if (!KidToCrop.tagName.match(/^p$/i) && this.ViewPortW - ElWidth <= 1) {
					var IntDivs = KidToCrop.querySelectorAll('div');
					for (var J = 0; J < IntDivs.length; J++) {
						var El = <HTMLElement> IntDivs[J];
						var DivW = Math.min(El.scrollWidth, El.clientWidth);
						if (DivW > ElWidth) {
							ElWidth = DivW;
						}
					}
				}
				if (ElWidth > this.ViewPortW ||
					IsNodeUnbreakable(KidToCrop)
					&& KidToCrop.scrollHeight > this.ViewPortH) {
					this.CropNodeToViewport(KidToCrop);
				}
			}
		}
		CropNodeToViewport(Node: HTMLElement) {
			var BaseElementW = Node.scrollWidth;
			var BaseElementH = Node.scrollHeight;
			var Ratio = Math.round(Math.min(this.ViewPortH / BaseElementH, this.ViewPortW / BaseElementW) * 999999)/1000000;
			var NewW = Math.round(BaseElementW * Ratio);
			var NewH = Math.round(BaseElementH * Ratio);
			var WShift = Math.floor((BaseElementW - NewW) / 2);
			var HShift = Math.floor((BaseElementH - NewH) / 2);
			var BaseID = Node.id;
			var Native_Bottom_Margin = Node.style.marginBottom; // This style produced by "AlignElementBottomLine" system,
			// we must preserve this

			Node.style.marginBottom = '';
			var MoveToCenter = NewW < this.ViewPortW - 1 ? Math.floor((this.ViewPortW - NewW) / 2) : 0;

			var BtnHTML = '<span class="span-zoom" id="zbs' + BaseID + '">' +
				'<button class="zoom_block" id="zb' + BaseID + '">' +
				'Zoom ' + BaseID + '</button></span>';

			var ContainerDivs = BtnHTML + '<div id="n0' + BaseID + '" style ="height:' + BaseElementH + 'px;width:' + BaseElementW + 'px;left:' + MoveToCenter + 'px;">'
				+ '<div id="n1' + BaseID + '" style="transform: scale(' + Ratio + ');top:-' + HShift + 'px;left:-' + WShift+'px; position:relative;">';


			var HTML = ContainerDivs + Node.outerHTML + '</div></div>';
			var NewNode = document.createElement('div');
			NewNode.style.height = NewH + 'px';
			NewNode.style.overflow = 'hidden';
			NewNode.className = 'fit_to_page';
			NewNode.style.marginBottom = Native_Bottom_Margin;

			NewNode.id = 'nn' + BaseID;
			NewNode.innerHTML = HTML;

			this.Element.Node.replaceChild(NewNode,Node);
		}



		private AddHandlers() {
			this.DoAddLinkHandlers(this.Element.Node.querySelectorAll('a'));
			this.DoAddLinkHandlers(this.NotesElement.Node.querySelectorAll('a'));
			var zoom = this.Element.Node.querySelectorAll('.zoom_block');
			if (zoom.length) {
				for (var j = 0; j < zoom.length; j++) {
					zoom[j].addEventListener('click', (t) => {
						var obj = <HTMLElement> ((t.currentTarget) ? t.currentTarget : t.srcElement);
						var ID = obj.id.replace(/^zb/, '');
						this.FBReader.Site.ZoomHTML(this.Site.getElementById(ID).outerHTML);
						obj.blur();
					}, false);
				}
			}
			this.Site.addTrialHandlers();
		}

		private DoAddLinkHandlers(Links: NodeList) {
			if (Links.length) {
				for (var j = 0; j < Links.length; j++) {
					Links[j].addEventListener('click', (t) => {
						var obj = (t.currentTarget) ? t.currentTarget : t.srcElement;
						var href = (<HTMLElement> obj).getAttribute('data-href');
						if (href == undefined) {
							return true;
						}
						t.preventDefault();
						t.stopPropagation();
						var tmpArr = href.split(',');
						var newPos = [];
						for (var i = 0; i < tmpArr.length; i++) {
							newPos.push(parseInt(tmpArr[i]));
						}
						this.FBReader.Site.HistoryHandler(this.FBReader.CurStartPos);
						this.FBReader.GoTO(newPos);
					}, false);
				}
			}
		}

		private ApplyPageMetrics() {
			this.Element.Node.style.height = (this.RenderInstr.Height - this.Element.MarginBottom - this.Element.MarginTop - 1) + 'px';
			if (this.RenderInstr.NotesHeight) {
				this.NotesElement.Node.style.height = (this.RenderInstr.NotesHeight) + 'px';
				this.NotesElement.Node.style.top = (this.Element.Height
				- this.RenderInstr.NotesHeight
				- this.NotesElement.MarginBottom) + 'px'
			} else {
				this.NotesElement.Node.style.display = 'none'
			}
			this.Element.Node.style.overflow = 'hidden';
			this.AddHandlers();

			this.Ready = true;
			this.Pending = false;

			// We have a queue waiting and it is not a background renderer frame - then fire the next page fullfilment
			if (this.PagesToRender && this.PagesToRender.length && this.Next) {
				// we fire setTimeout to let the browser draw the page before we render the next
				if (!this.PagesToRender[0].Range && !this.PagesToRender[0].Start) {
					this.PagesToRender[0].Start = this.RenderInstr.Range.To.slice(0);
					To2From(this.PagesToRender[0].Start);
				}
				//				console.log(this.ID, FallCalls, 'ApplyPageMetrics setTimeout');
				clearTimeout(this.RenderMoreTimeoutApply);
				this.RenderMoreTimeoutApply = setTimeout(() => { this.Next.DrawInit(this.PagesToRender); this.RenderMoreTimeoutApply = 0; }, SemiSleepTimeout);


				// This page is clearly the last visible by absolute number
				if (this.PageN + 1 == this.FBReader.CurStartPage + this.FBReader.NColumns
					||
					// or, if we walk over the grass this it the relative last page
					this.PageN === undefined
						&& this.FBReader.CurStartPage === undefined
						&& this.ID == this.FBReader.CurVisiblePage + this.FBReader.NColumns
					) {
					this.FBReader._CanvasReadyCallback();
				}
			} else if (this.Next
				&& (
					this.FBReader.CurVisiblePage + this.FBReader.NColumns == this.ID
					||
					!this.PagesToRender.length && this.FBReader.CurVisiblePage >= this.ID - 1
					&& this.FBReader.CurVisiblePage < this.ID + this.FBReader.NColumns // last page, if it's empty, may not fire ApplyPageMetrics
					)
				) {
				// Looks like the end of the text
				this.FBReader._CanvasReadyCallback();
			}
		}
		private FalloutConsumeFirst(FallOut: IFallOut) {
			//console.log(this.ID, FallCalls, this.ThreadsRunning, 'FalloutConsumeFirst');
			if (!FallOut.FitAnythingAtAll) {
			//if (FB3Reader.PosCompare(FallOut.FallOut, this.RenderInstr.Start) == 0
			//	&& FallOut.FallOut[0] < this.FB3DOM.TOC[this.FB3DOM.TOC.length - 1].e) {
				// It's too bad baby: text does not fit the page, not even a char
				// Let's try to stripe book-style footnotes first (if they are ON) - this must clean up some space
				if (this.FBReader.BookStyleNotes && this.FalloutState.HasFootnotes) {
					this.FBReader.BookStyleNotes = false;
					this.FBReader.BookStyleNotesTemporaryOff = true;
					this.RenderInstr.Range = null;
					this.NotesElement.Node.innerHTML = '';
					this.DrawInit([this.RenderInstr].concat(this.PagesToRender));
					//					this.FBReader.IdleOff();
					return;
				} else {
					// That's it - no way to recover. We die now, later we will make some fix here
					this.FBReader.Site.Alert('We can not fit the text into the page!');
					this.RenderInstr.Start = [this.RenderInstr.Start[0] + 1];
					this.RenderInstr.Range = null;
					if (this.FBReader.BookStyleNotesTemporaryOff) {
						this.FBReader.BookStyleNotes = true;
						this.FBReader.BookStyleNotesTemporaryOff = false;
					}
					this.DrawInit([this.RenderInstr].concat(this.PagesToRender));
					return;
				}
			}

			var PageCorrupt = false;
			if (this.FBReader.BookStyleNotesTemporaryOff) {
				this.FBReader.BookStyleNotes = true;
				this.FBReader.BookStyleNotesTemporaryOff = false;
				PageCorrupt = true;
			}

			// We can have not enough content to fill the page. Sometimes we will refill it,
			// but sometimes (doc end or we only 
			if (!FallOut.EndReached) {
				var EndRiched = this.FB3DOM.TOC[this.FB3DOM.TOC.length - 1].e < FallOut.FallOut[0]
					||
					FallOut.FallOut.length == 1 && this.FB3DOM.TOC[this.FB3DOM.TOC.length - 1].e == FallOut.FallOut[0];
				if (!EndRiched) {
					// Ups, our page is incomplete - have to retry filling it. Take more data now
					//var BasePrerender = this.PrerenderBlocks;
					this.PrerenderBlocks += 2;
					this.RenderInstr.Range = null;
					this.DrawInit([this.RenderInstr].concat(this.PagesToRender));
					//this.PrerenderBlocks = BasePrerender;
					return;
				} else if (this.Next) { // Unless this is prerender frrame, otherwase no need to bother
					var NP = this;
					for (var I = 0; I < this.PagesToRender.length; I++) {
						NP = NP.Next;
						NP.CleanPage();
						NP.Ready = false;
						NP.RenderInstr = {Range:{ From: [-1], To: [-1] }};
					}
				}
				this.PagesToRender = [];
				this.RenderInstr.Range = {
					From: this.RenderInstr.Start.splice(0),
					To: FallOut.FallOut.slice(0)
				};
			} else {
				this.RenderInstr.Range = {
					From: this.RenderInstr.Start.splice(0),
					To: FallOut.FallOut.slice(0)
				};
				this.QuickFallautState.PrevTo = this.RenderInstr.Range.To.slice(0);
				CropTo(this.RenderInstr.Range);
			}
			this.RenderInstr.Height = FallOut.Height;
			this.RenderInstr.NotesHeight = FallOut.NotesHeight;


			this.JumpOnLadder(FallOut,this.RenderInstr.CacheAs);
			this.PageN = this.RenderInstr.CacheAs;
			if (this.PageN !== undefined) {
				this.FBReader.StoreCachedPage(this.RenderInstr);
			}

			// Ok, we have rendered the page nice. Now we can check, wether we have created
			// a page long enough to fit the NEXT page. If so, we are going to estimate it's
			// content to create next page(s) with EXACTLY the required html - this will
			// speed up the render a lot
			var LastChild = <HTMLElement> this.Element.Node.children[this.Element.Node.children.length - 1];
			if (!FallOut.DenyForwardScan && EnableForwardScan && LastChild && !PageCorrupt && FallOut.EndReached) { // fixme - should have a better fix for IE
				this.QuickFallautState.CollectedHeight = FallOut.Height;
				this.QuickFallautState.CollectedNotesHeight = FallOut.NotesHeight;
				var TestHeight = this.QuickFallautState.CollectedHeight + this.Element.Height
					- this.Element.MarginTop - this.Element.MarginBottom;
				this.QuickFallautState.RealPageSize = LastChild.offsetTop + LastChild.scrollHeight;
				if (this.QuickFallautState.RealPageSize > TestHeight && this.PagesToRender.length) { // this is a peace of copy+paste, cant fix it now
					this.QuickFallautState.QuickFallout = 0;
					this.InitFalloutState(TestHeight, this.QuickFallautState.CollectedNotesHeight, this.FalloutState.HasFootnotes, true, FallOut.FalloutElementN);
					//					this.FallOut();
					FallCalls++;
//					console.log(this.ID, FallCalls, this.ThreadsRunning, 'FalloutConsumeSecondInit');
					this.ThreadsRunning++;
					clearTimeout(this.RenderBreakerTimeoutFallout);
					this.RenderBreakerTimeoutFallout = setTimeout(() => {
						this.ThreadsRunning--;
//						console.log(this.ID, FallCalls, this.ThreadsRunning, 'FalloutConsumeSecondInitFire');
						this.RenderBreakerTimeoutFallout = 0;
						this.FallOut();
					}, SemiSleepTimeout);
					return;// should be here to make ApplyPageMetrics work
				}
			}
			this.ApplyPageMetrics();
			if (!this.PagesToRender.length || !this.Next) {
				this.FBReader.IdleOn();
			}
		}
		private FalloutConsumeNext(FallOut: IFallOut) {

			//console.log(this.ID, this.QuickFallautState.QuickFallout, 'FalloutConsumeNext');
			if (FallOut.EndReached
				|| FallOut.FallOut[0] >= this.FB3DOM.TOC[this.FB3DOM.TOC.length - 1].e && !this.Next) {
				var NextPageRange = <FB3DOM.IRange> {};
				NextPageRange.From = this.QuickFallautState.PrevTo.slice(0);

				// We check if we had any progress at all. If not - we rely on FalloutConsumeFirst to handle this and just abort this page scan
				if (FallOut.FitAnythingAtAll) {
					this.QuickFallautState.PrevTo = FallOut.FallOut.slice(0);
					NextPageRange.To = FallOut.FallOut.slice(0);

					// No need to ignore "hanging" element - there is no hanging element at the end of the book
					if (FallOut.FallOut[0] < this.FB3DOM.TOC[this.FB3DOM.TOC.length - 1].e) {
						CropTo(NextPageRange);
					}

					this.PagesToRender[this.QuickFallautState.QuickFallout].Height = FallOut.Height - this.QuickFallautState.CollectedHeight + this.Element.MarginTop;
					this.PagesToRender[this.QuickFallautState.QuickFallout].NotesHeight = FallOut.NotesHeight;
					this.QuickFallautState.CollectedHeight = FallOut.Height;
					this.QuickFallautState.CollectedNotesHeight += FallOut.NotesHeight;
					this.PagesToRender[this.QuickFallautState.QuickFallout].Range = NextPageRange;
					if (this.PagesToRender[this.QuickFallautState.QuickFallout].CacheAs !== undefined) {
						this.FBReader.StoreCachedPage(this.PagesToRender[this.QuickFallautState.QuickFallout]);
						this.JumpOnLadder(FallOut, this.PagesToRender[this.QuickFallautState.QuickFallout].CacheAs);
					}
					if (FallOut.EndReached && this.QuickFallautState.QuickFallout < this.PagesToRender.length - 1) {
						this.QuickFallautState.QuickFallout++;
						var TestHeight = this.QuickFallautState.CollectedHeight + this.Element.Height
							- this.Element.MarginTop - this.Element.MarginBottom;
						if (this.QuickFallautState.RealPageSize > TestHeight
							|| this.WholeRangeToRender.To[0] >= this.FB3DOM.TOC[this.FB3DOM.TOC.length - 1].e) {
							this.InitFalloutState(TestHeight, this.QuickFallautState.CollectedNotesHeight, this.FalloutState.HasFootnotes, true, FallOut.FalloutElementN);
							//this.FallOut();
//							console.log(this.ID, FallCalls, this.ThreadsRunning, 'FalloutConsumeNextInit');
							this.ThreadsRunning++;
							clearTimeout(this.RenderMoreTimeout);
							this.RenderMoreTimeout = setTimeout(() => {
								this.ThreadsRunning--;
//								console.log(this.ID, FallCalls, this.ThreadsRunning, 'FalloutConsumeNextFire');
								this.FallOut();
							}, SemiSleepTimeout);
							return; // should be here to make ApplyPageMetrics work
						}
					}
				}
			}
			if (this.Next) {
				this.ApplyPageMetrics();
			}
			if (!this.PagesToRender.length || !this.ID) {
				// Get back to idle processing if we are done or we are in idle mode already
				this.FBReader.IdleOn();
			}
		}

		private JumpOnLadder(FallOut: IFallOut, PageN:number) {
			// We are making background render - let's check if the visible page is off-ladder
			// and is equal to our current page. if so we set our visible page PageN, so it will no longer
			// be on the grass
			if (!this.Next
				&& PageN
				&& ((PageN - 1) % this.FBReader.NColumns == 0) // Only jump in for the first page in multicolumn view
				&& this.FBReader.CurStartPage === undefined
				&& this.FBReader.CurStartPos) {
				if (FB3Reader.PosCompare(FallOut.FallOut, this.FBReader.CurStartPos) == 0) {
					this.FBReader.CurStartPage = PageN + 1; // Why +1? Donno, but somehow it works
				}
			}
		}


		public Reset() {
			clearTimeout(this.RenderMoreTimeout);
			clearTimeout(this.RenderMoreTimeoutApply);
			clearTimeout(this.RenderMoreTimeoutFallout);
			clearTimeout(this.RenderBreakerTimeout);
			clearTimeout(this.RenderBreakerTimeoutFallout);
			//			console.log('Reset ' + this.ID);
			this.PagesToRender = null;
			this.Pending = false;
			this.ActialRequest++;
		}

		public PutPagePlace(Place: number) {
			if (Place < 0) {
				this.Element.Node.style.display = 'none';
			} else {
				this.Element.Node.style.display = 'block';

			}
		}

		private InitFalloutState(Limit: number, NotesShift: number, HasFootnotes: boolean, QuickMode:boolean, SkipUntill?: number): void {
			this.FalloutState.Limit = Limit;
			this.FalloutState.NotesShift = NotesShift;
			this.FalloutState.I = SkipUntill > 0 ? SkipUntill : 0;
			this.FalloutState.Element = <HTMLElement> this.Element.Node;
			this.FalloutState.GoodHeight = 0;
			this.FalloutState.ChildsCount = this.FalloutState.Element.children.length;
			this.FalloutState.ForceDenyElementBreaking = true;
			this.FalloutState.LastOffsetParent = null;
			this.FalloutState.LastOffsetShift = null;
			this.FalloutState.EndReached = false;
			this.FalloutState.FootnotesAddonCollected = 0;

			// To shift notes to the next page we may have to eliminale last line as a whole - so we keep track of it
			this.FalloutState.LastLineBreakerParent = null;
			this.FalloutState.LastLineBreakerPos= null;
			this.FalloutState.LastFullLinePosition = 0;

			this.FalloutState.PrevPageBreaker = false;
			this.FalloutState.NoMoreFootnotesHere = false;
			this.FalloutState.FalloutElementN = -1;
			this.FalloutState.SplitHistory = [];
			this.FalloutState.ForceFitBlock = false;
			this.FalloutState.BTreeModeOn = false;
			this.FalloutState.BTreeLastOK = null;
			this.FalloutState.BTreeLastFail = null;
			this.FalloutState.HasFootnotes = HasFootnotes;
			this.FalloutState.QuickMode = QuickMode;
			this.FalloutState.ThisBlockLineShift = 0;
			this.FalloutState.Baseline = this.QuickFallautState.CollectedHeight || this.Element.MarginTop;
			this.FalloutState.UnconfirmedShift = 0;
			this.FalloutState.DenyForwardScan = false;
			this.FalloutState.FitAnythingAtAll = false;
		}

		// Hand mage CSS3 tabs. I thouth it would take more than this
		private FallOut() {
			//console.log(this.ID, this.QuickFallautState.QuickFallout, 'Fallout');
			var IterationStartedAt = new Date().getTime();
			while (this.FalloutState.I < this.FalloutState.ChildsCount) {
				if (BreakIterationEvery && new Date().getTime() - IterationStartedAt > BreakIterationEvery) {
					//console.log(this.ID, FallCalls, this.ThreadsRunning, 'FallOutInit');
					this.ThreadsRunning++;
					clearTimeout(this.RenderMoreTimeoutFallout);
					this.RenderMoreTimeoutFallout = setTimeout(() => {
						this.ThreadsRunning--;
						//console.log(this.ID, FallCalls, this.ThreadsRunning, 'FallOutFire');
						this.FallOut();
						this.RenderMoreTimeoutFallout = 0;
					}, SemiSleepTimeout);
					return;
				}
				var FootnotesAddon = 0;
				var Child = <HTMLElement> this.FalloutState.Element.children[this.FalloutState.I];
				if (Child.style.position.match(/absolute/i)) {
					this.FalloutState.I++;
					continue;
				}
				this.FalloutState.PrevPageBreaker = this.FalloutState.PrevPageBreaker || !this.FalloutState.ForceDenyElementBreaking && PageBreakBefore(Child);
				var SH = Child.scrollHeight;
				if (Child.style.overflow.match(/hidden/)) {
					// For cropped element scrollHeight returns un-cropped size (at least in webkit)
					SH = Child.offsetHeight;
				}
				var ChildBot: number;
				// IE has both offsetHeight && scrollHeight always equal plus
				// it gets offset * and scroll * values SLOW, sy why waste time?
				if (!this.FBReader.IsIE) {
					var OH = Child.offsetHeight;
					SH = Math.max(SH, OH);
				}
				ChildBot = Child.offsetTop + SH;


				if (!this.FalloutState.NoMoreFootnotesHere && this.FBReader.BookStyleNotes) {
					// Footnotes kind of expand element height - NoMoreFootnotesHere is for making things faster
					if (Child.nodeName.match(/a/i) && Child.className.match(/\bfootnote_attached\b/)) {
						var NoteElement = this.Site.getElementById('f' + Child.id);
						if (NoteElement) {
							FootnotesAddon = NoteElement.offsetTop + NoteElement.offsetHeight;
						}
					} else {
						var FootNotes = Child.getElementsByTagName('a');
						for (var J = FootNotes.length - 1; J >= 0; J--) {
							if (FootNotes[J].className.match(/\bfootnote_attached\b/)) {
								var NoteElement = this.Site.getElementById('f' + FootNotes[J].id);
								FootnotesAddon = NoteElement.offsetTop + NoteElement.offsetHeight;
								break;
							}
						}
					}
				}
				if (FootnotesAddon) {
					FootnotesAddon += this.NotesElement.MarginTop - this.FalloutState.NotesShift;
				}

				var FootnotesHeightNow = FootnotesAddon ? FootnotesAddon : this.FalloutState.FootnotesAddonCollected;
				if ((ChildBot + FootnotesHeightNow <= this.FalloutState.Limit) && !this.FalloutState.PrevPageBreaker
					|| this.FalloutState.ForceFitBlock				// For sime reason we have to fit this to the page
					|| !this.FalloutState.BTreeModeOn && Child.className.match(/\btag_empty-line\b/)	// empty-line always fits, see FB3DOM.GetHTML for similar hack
					) { // Page is still not filled
					this.FalloutState.ForceDenyElementBreaking = false;
					this.FalloutState.ForceFitBlock = false;
					this.FalloutState.FitAnythingAtAll = true;
					if (FootnotesAddon) {
						this.FalloutState.FootnotesAddonCollected = FootnotesAddon;
						this.FalloutState.DenyForwardScan = true;
					}
					if (Math.abs(this.FalloutState.LastFullLinePosition - ChildBot) > 1 || FootnotesAddon) { // +1 because of the browser positioning rounding on the zoomed screen
						this.FalloutState.LastLineBreakerParent = this.FalloutState.Element;
						this.FalloutState.LastLineBreakerPos = this.FalloutState.I;
						this.FalloutState.LastFullLinePosition = ChildBot;
					}
					this.FalloutState.BTreeLastOK = this.FalloutState.I;

					if (this.FalloutState.I == 0 && this.FalloutState.SplitHistory.length == 1
						&& Child.tagName.match(/span/i)) {
						// This is 1-st level node under block level, we want to know it's line height
						this.FalloutState.ThisBlockLineShift = Child.offsetTop;
					}
					if (this.FalloutState.I == 0 &&
						this.FalloutState.NoMoreFootnotesHere &&
						this.FalloutState.ChildsCount > 7 &&
						!this.FalloutState.BTreeModeOn) {
						// In fact we could work with Footnotes as well, but it's a bit dedicated, perhaps return to it later on
						this.FalloutState.BTreeModeOn = true;
						this.FalloutState.BTreeLastFail = this.FalloutState.ChildsCount;
					}
					if (this.FalloutState.BTreeModeOn){
						this.FalloutState.I = this.GuessNextElement();
					} else {
						this.FalloutState.I++;
					}
					this.FalloutState.UnconfirmedShift = 0;
					// We deal with top-level block element, we want it to have bottom margin
					// to align with our line-height
					if (this.FBReader.LineHeight && !this.FalloutState.SplitHistory.length) {
						this.FalloutState.ThisBlockLineShift = 0;
						this.AlignElementBottomLine(ChildBot, this.FalloutState.Baseline, Child);
					} else if (this.FalloutState.I == this.FalloutState.ChildsCount && this.FalloutState.SplitHistory.length) { // SplitHistory.length means we can break on fit the page
						// Well, we could not fit the whole element, but all it's childs fit perfectly. Hopefully
						// the reason is the bottom margin/padding. So we assume the whole element fits and leave those
						// paddings hang below the visible page
						var Fallback = this.FalloutState.SplitHistory.pop();
						this.FalloutState.Element = Fallback.Element;
						this.FalloutState.I = Fallback.I;
						this.FalloutState.Limit = Fallback.Limit;
						this.FalloutState.NoMoreFootnotesHere = false;
						this.FalloutState.ChildsCount = this.FalloutState.Element.children.length;
						this.FalloutState.ForceFitBlock = true;
						this.FalloutState.PrevPageBreaker = false;
						this.FalloutState.BTreeModeOn = false;
						this.FalloutState.LastOffsetShift = Fallback.LastOffsetShift;
						this.FalloutState.GoodHeight = Fallback.GoodHeight;
						this.FalloutState.LastOffsetParent = Fallback.LastOffsetParent;
					}
				} else {
					// If we are in BTree Mode we save nothing exept BTreeLastFail. Just pretend like this fail have never happend
					if (this.FalloutState.BTreeModeOn) {
						this.FalloutState.BTreeLastFail = this.FalloutState.I;
						this.FalloutState.I = this.GuessNextElement();
						continue;
					}
					this.FalloutState.EndReached = true;
					if (this.FalloutState.FalloutElementN == -1) {
						this.FalloutState.FalloutElementN = this.FalloutState.I
					}
					if (!FootnotesAddon) {
						this.FalloutState.NoMoreFootnotesHere = true;
					}
					var CurShift: number = Child.offsetTop;

					if (this.FalloutState.SplitHistory.length && Child.innerHTML.match(/^(\u00AD|&shy;)/)) {
						// the reason for this is that soft hyph on the last line makes the hanging element
						// twice as hi and 100% wide. So we keep it in mind and shift the line hald the element size
						// first we will try to select next node in the hope it's placed right.
						if (this.FalloutState.Element.children[this.FalloutState.I + 1]) {
							CurShift = (<HTMLElement> this.FalloutState.Element.children[this.FalloutState.I + 1]).offsetTop;
						} else {
							// No luck, we will make some reasonable assumptions by dividing node height by 2
							CurShift += Math.floor(Math.max(SH, OH) / 2) + this.FalloutState.ThisBlockLineShift; 
						}
					}

					var OffsetParent = Child.offsetParent;
					var ApplyShift: number;
					if (this.FalloutState.LastOffsetParent == OffsetParent) {
						ApplyShift = CurShift - this.FalloutState.LastOffsetShift;
					} else {
						ApplyShift = CurShift;
					}
					this.FalloutState.LastOffsetShift = CurShift;

					if (this.FalloutState.I == 0) {
						this.FalloutState.UnconfirmedShift += ApplyShift;
					} else {
						this.FalloutState.UnconfirmedShift = 0;
					}
					this.FalloutState.GoodHeight += ApplyShift;

					this.FalloutState.LastOffsetParent = OffsetParent;
					
					this.FalloutState.SplitHistory.push({
						I: this.FalloutState.I,
						Element: this.FalloutState.Element,
						Limit: this.FalloutState.Limit,
						GoodHeight: this.FalloutState.GoodHeight,
						LastOffsetShift: this.FalloutState.LastOffsetShift,
						LastOffsetParent: this.FalloutState.LastOffsetParent});
					this.FalloutState.Element = Child;
					this.FalloutState.ChildsCount = (!this.FalloutState.ForceDenyElementBreaking && IsNodeUnbreakable(this.FalloutState.Element)) ? 0 : this.FalloutState.Element.children.length;
					if (!this.FalloutState.PrevPageBreaker && this.FalloutState.ChildsCount == 0 && FootnotesAddon > this.FalloutState.FootnotesAddonCollected && this.FalloutState.LastLineBreakerParent) {
						// So, it looks like we do not fit because of the footnote, not the falling out text itself.
						// Let's force page break on the previous line end - kind of time machine
						this.FalloutState.I = this.FalloutState.LastLineBreakerPos;
						this.FalloutState.Element = this.FalloutState.LastLineBreakerParent;
						this.FalloutState.PrevPageBreaker = true;
						this.FalloutState.ChildsCount = this.FalloutState.Element.children.length;
						continue;
					}

					// If we have nested non-block tags we should keep Limit - they all count from one point
					if (this.FalloutState.ChildsCount) {
						var FirstChild = <HTMLElement> this.FalloutState.Element.children[0];
						if (FirstChild && FirstChild.offsetParent != OffsetParent) {
							this.FalloutState.Limit = this.FalloutState.Limit - CurShift;
						}
					}
					if (this.FalloutState.PrevPageBreaker) break;
					this.FalloutState.I = 0;
				}
			}

			var Addr: any[];
			if (this.FalloutState.EndReached) {
				if (this.FalloutState.Element != this.Element.Node) {
					var ID = '';
					if (this.FalloutState.Element.id) {
						ID = this.FalloutState.Element.id;
					} else if (this.FalloutState.Element.parentElement.id) {
						ID = this.FalloutState.Element.id;
					} else if (this.FalloutState.Element.children.length && (<HTMLElement> this.FalloutState.Element.children[0]).id) {
						ID = (<HTMLElement> this.FalloutState.Element.children[0]).id;
					}
					Addr = ID.split('_');
				} else {
					// Special case: we have exact match for the page with a little bottom margin hanging, still consider it OK
					Addr = Child.id.split('_');
				}
			} else {
				Addr = Child.id.split('_');
				this.FalloutState.GoodHeight = this.Element.Node.scrollHeight;
			}

			Addr.shift();
			Addr.shift();

			NumericArray(Addr);

			while (Addr[Addr.length - 1] == 0 && Addr.length > 1) {
				Addr.pop();
			}

			var FinalHeight = this.FalloutState.GoodHeight - this.FalloutState.ThisBlockLineShift;
			if (Addr.length == 1) {
				FinalHeight -= this.FalloutState.UnconfirmedShift;
			}

			var Result = {
				FallOut: Addr,
				Height: FinalHeight,
				NotesHeight: this.FalloutState.FootnotesAddonCollected ? this.FalloutState.FootnotesAddonCollected - this.NotesElement.MarginTop : 0,
				FalloutElementN: this.FalloutState.FalloutElementN,
				EndReached: this.FalloutState.EndReached,
				DenyForwardScan: this.FalloutState.DenyForwardScan,
				FitAnythingAtAll: this.FalloutState.FitAnythingAtAll
			};

			if (this.FalloutState.QuickMode) {
					//console.log(this.ID, this.QuickFallautState.QuickFallout, 'GoNext');
				this.FalloutConsumeNext(Result);
			} else {
					//console.log(this.ID, this.QuickFallautState.QuickFallout, 'GoFirst');
				this.FalloutConsumeFirst(Result);
			}
		}

		private AlignElementBottomLine(ChildBot:number,Baseline:number,Element: HTMLElement) {
			var CurBottomLine = ChildBot - Baseline;
			var LinesFit = parseInt(<any> (CurBottomLine / this.FBReader.LineHeight));
			if (CurBottomLine / this.FBReader.LineHeight != LinesFit && Element.id) {
				// Ok. this element has non-standard height, we align it's bottom line
				// so that the next element will be aligned
				var XPID = Element.id.replace(/[a-z0-9]+_\d+_/, '');
				if (XPID) {
					var ExactNewMargin = this.FBReader.PagesPositionsCache.GetMargin(XPID);
					if (!ExactNewMargin) {
						var MissingPixels = (LinesFit + 1) * this.FBReader.LineHeight - ChildBot + Baseline;
						var MarginAlready = 0;
						if (document.all) {
							MarginAlready = HardcoreParseInt((<any> Element).currentStyle.marginBottom)
						} else {
							MarginAlready = parseInt(getComputedStyle(Element, '').getPropertyValue('margin-bottom'));
						}
						ExactNewMargin = MarginAlready + MissingPixels;
						if (this.RenderInstr.CacheAs !== undefined) {
						this.FBReader.PagesPositionsCache.SetMargin(XPID, ExactNewMargin);
					}
					}
					Element.style.marginBottom = ExactNewMargin + 'px';
				}
			}

		}

		private GuessNextElement(): number {
			// we are going to be greedy optimists with ceil :) 
			var BTreePoint = Math.ceil(this.FalloutState.BTreeLastOK + (this.FalloutState.BTreeLastFail - this.FalloutState.BTreeLastOK) / 2);
			if (BTreePoint - this.FalloutState.BTreeLastOK < 2) {
				this.FalloutState.BTreeModeOn = false;
			} 
			return BTreePoint;
		}
		GetLineHeight(): number {
			var ParaData = this.FillElementData('FB3ReaderParaSize' + this.ID);
			if (ParaData.MarginBottom > 0
				|| ParaData.MarginTop > 0) {
				return 0
			}

			var RealLineHeight: any = ParaData.Node.offsetHeight / 3; // Browser may have 110% zoom so we can not trust CSS line-height we provide!

			if (RealLineHeight != parseInt(RealLineHeight)) {
				// All this 110% in the browser may lead to mad things like 5+5=9, so we try
				// to mage RUDE attempt to theck if we ever should mess with line-heights at all
				return 0;
			} else {
				return RealLineHeight;
			}
		}
	}
}