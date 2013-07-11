/// <reference path="FB3ReaderHead.ts" />

module FB3Reader {
//	interface IDumbCallback { () }

	export interface IPageRenderInstruction {
		Range?: FB3DOM.IRange;
		Start?: IPosition;
		CacheAs?: number;
		Height?: number;
		NotesHeight?: number;
	}

	interface IFallOut {
		FallOut: IPosition; // Agress of the first element to not fit the page
		Height: number;			// Height of the page we've examined
		NotesHeight: number;
		FalloutElementN: number;
	}

	function IsNodePageBreaker(Node:HTMLElement):boolean {
		return Node.children[0] && Node.children[0].nodeName.toLowerCase() == 'h1' ? true : false;
		//return false;
	}

	function IsNodeUnbreakable(Node: HTMLElement): boolean {

		if (Node.nodeName.match(/^(h\d|a)$/i)) {
			return true;
		}

		if (Node.className.match(/\btag_nobr\b/)) {
			return true;
		}

		var Chld1 = Node.children[0];
		if (Chld1) {
			if (Chld1.nodeName.match(/^h\d$/i)) {
				return true;
			}
		}
		return false;
	}

	function RangeClone(BaseRange: FB3DOM.IRange): FB3DOM.IRange {
		return {
			From: BaseRange.From.slice(0),
			To: BaseRange.To.slice(0)
		}
	}

	interface ElementDesc {
		Node: HTMLDivElement;
		Width: number;
		Height: number;
		MarginTop: number;
		MarginBottom: number;
	}

	class ReaderPage {
		private Element: ElementDesc;
		private NotesElement: ElementDesc;
		private ID: number;
		private PagesToRender: IPageRenderInstruction[];
		private End: IPosition;
		private RenderInstr: IPageRenderInstruction;
		private RenderMoreTimeout: number;
		private Site: FB3ReaderSite.IFB3ReaderSite;
		public Next: ReaderPage;
		public Busy: boolean;
		public Reseted: boolean;
		public PrerenderBlocks: number;
		Show(): void { }
		Hide(): void { }
		constructor(public ColumnN: number,
			private FB3DOM: FB3DOM.IFB3DOM,
			private FBReader: Reader,
			Prev: ReaderPage) {
			this.Busy = false;
			this.Reseted = false;
			if (Prev) {
				Prev.Next = this;
			}
			this.PrerenderBlocks = 4;
		}
		GetInitHTML(ID: number): FB3DOM.InnerHTML {
			this.ID = ID;
			return '<div class="FB2readerCell' + this.ColumnN + 'of' + this.FBReader.NColumns +
				' FB2readerPage"><div class="FBReaderContentDiv" id="FB3ReaderColumn' + this.ID +
				'">...</div><div class="FBReaderNotesDiv" id="FB3ReaderNotes' + this.ID + '">...</div></div>';
		}

		FillElementData(ID: string): ElementDesc {
			var Element = <HTMLDivElement> this.Site.getElementById(ID);
			var Width = Element.offsetWidth;
			var Height = Element.parentElement.offsetHeight;
			var MarginTop; var MarginBottom;
			if (document.all) {// IE
				MarginTop = parseInt(Element.currentStyle.marginTop, 10)
				+ parseInt(Element.currentStyle.paddingTop, 10);
				MarginBottom = parseInt(Element.currentStyle.marginBottom, 10)
				+ parseInt(Element.currentStyle.paddingBottom, 10);
			} else {// Mozilla
				MarginTop = parseInt(getComputedStyle(Element, '').getPropertyValue('margin-top'))
				+ parseInt(getComputedStyle(Element, '').getPropertyValue('padding-top'));
				MarginBottom = parseInt(getComputedStyle(Element, '').getPropertyValue('margin-bottom'))
				+ parseInt(getComputedStyle(Element, '').getPropertyValue('padding-bottom'));
			}
			return { Node: Element, Width: Width, Height: Height, MarginTop: MarginTop, MarginBottom: MarginBottom};
		}
		BindToHTMLDoc(Site: FB3ReaderSite.IFB3ReaderSite): void {
			this.Site = Site;
			this.Element = this.FillElementData('FB3ReaderColumn' + this.ID);
			this.NotesElement = this.FillElementData('FB3ReaderNotes' + this.ID);
		}

		DrawInit(PagesToRender: IPageRenderInstruction[]): void {
//			console.log('DrawInit '+this.ID);
			if (PagesToRender.length == 0) return;
			if (this.Reseted) {
				this.Reseted = false;
				return;
			}
			this.Busy = true;

			this.RenderInstr = PagesToRender.shift();
			this.PagesToRender = PagesToRender;

			var Range: FB3DOM.IRange;
			if (this.RenderInstr.Range) { // Exact fragment (must be a cache?)
				Range = {
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
				if (Range.To[Range.To.length - 1]) {
					Range.To[Range.To.length - 1]++;
				} else {
					//while (Addr.length && Addr[Addr.length - 1] == 0) {
					//	Addr.pop();
					//	Addr[Addr.length - 1]--;
					//}
				}
			} else {
				if (!this.RenderInstr.Start) { // It's fake instruction. We consider in as "Render from start" request
					this.RenderInstr.Start = [0];
				} // Start point defined

				var FragmentEnd = this.RenderInstr.Start[0] * 1 + this.PrerenderBlocks;
				if (FragmentEnd > this.FB3DOM.TOC[this.FB3DOM.TOC.length - 1].e) {
					FragmentEnd = this.FB3DOM.TOC[this.FB3DOM.TOC.length - 1].e;
				}
				Range = { From: this.RenderInstr.Start.slice(0), To: [FragmentEnd] };
			}

			this.FB3DOM.GetHTMLAsync(this.FBReader.HyphON, RangeClone(Range),this.ID+'_', (PageData: FB3DOM.IPageContainer) => this.DrawEnd(PageData));
		}

		DrawEnd(PageData: FB3DOM.IPageContainer) {
			this.Busy = false;
			//			console.log('DrawEnd ' + this.ID);
			if (this.Reseted) {
				this.Reseted = false;
				return;
			}
			this.Element.Node.innerHTML =  PageData.Body.join('');
			if (PageData.FootNotes.length) {
				this.NotesElement.Node.innerHTML = PageData.FootNotes.join('');
			}
			this.NotesElement.Node.style.display = PageData.FootNotes.length ? 'block' : 'none';
			if (!this.RenderInstr.Range) {
				var FallOut = this.FallOut(this.Element.Height - this.Element.MarginTop,0);
				if (!FallOut) {
					// Ups, our page is incomplete - have to retry filling it. Take more data now
					this.PrerenderBlocks *= 2;
					this.RenderInstr.Range = null;
					this.DrawInit([this.RenderInstr].concat(this.PagesToRender));
					return;
				}
				this.RenderInstr.Range = {
					From: this.RenderInstr.Start.splice(0),
					To: FallOut.FallOut
				};
				this.RenderInstr.Height = FallOut.Height;
				this.RenderInstr.NotesHeight = FallOut.NotesHeight;


				if (this.RenderInstr.CacheAs !== undefined) {
					this.FBReader.StoreCachedPage(this.RenderInstr.CacheAs, this.RenderInstr);
				}

				// Ok, we have rendered the page nice. Now we can check, wether we have created
				// a page long enough to fit the NEXT page. If so, we are going to estimate it's
				// content to create next page(s) with EXACTLY the required html - this will
				// speed up the render
				var LastChild = <HTMLElement> this.Element.Node.children[this.Element.Node.children.length - 1];
				if (LastChild) {
					var CollectedHeight = FallOut.Height;
					var CollectedNotesHeight = FallOut.NotesHeight;
					var PrevTo: Array;
					for (var I = 0; I < this.PagesToRender.length; I++) {
						var TestHeight = CollectedHeight + this.Element.Height
							- this.Element.MarginTop;
						if (LastChild.offsetTop + LastChild.scrollHeight > TestHeight) {
							FallOut = this.FallOut(TestHeight, CollectedNotesHeight, FallOut.FalloutElementN);
							if (FallOut) {
								var NextPageRange = <any> {};
								NextPageRange.From = (PrevTo?PrevTo:this.RenderInstr.Range.To).slice(0);
								PrevTo = FallOut.FallOut.slice(0);
								NextPageRange.To = FallOut.FallOut.slice(0);

								this.PagesToRender[I].Height = FallOut.Height - CollectedHeight + this.Element.MarginTop;
								this.PagesToRender[I].NotesHeight = FallOut.NotesHeight;
								CollectedHeight = FallOut.Height;
								CollectedNotesHeight += FallOut.NotesHeight;
								if (this.PagesToRender[I].CacheAs !== undefined) {
									this.FBReader.StoreCachedPage(this.RenderInstr.CacheAs, NextPageRange);
								}
								this.PagesToRender[I].Range = NextPageRange;
							} else { break }
						} else { break }
					}
				}
			}

			this.Element.Node.parentElement.style.height = (this.RenderInstr.Height + this.RenderInstr.NotesHeight + this.NotesElement.MarginTop) + 'px';
			this.Element.Node.style.height = (this.RenderInstr.Height - this.Element.MarginBottom - this.Element.MarginTop) + 'px';
			if (this.RenderInstr.NotesHeight) {
				this.NotesElement.Node.style.height = (this.RenderInstr.NotesHeight) + 'px';
			}
			this.Element.Node.style.overflow = 'hidden';

			if (this.PagesToRender && this.PagesToRender.length) {
				// we fire setTimeout to let the browser draw the page before we render the next
				if (!this.PagesToRender[0].Range && !this.PagesToRender[0].Start) {
					this.PagesToRender[0].Start = this.RenderInstr.Range.To;
				}
				this.RenderMoreTimeout = setTimeout(() => { this.Next.DrawInit(this.PagesToRender) },1)
			}
		}

		Reset() {
			clearTimeout(this.RenderMoreTimeout);
//			console.log('Reset ' + this.ID);
			this.PagesToRender = null;
			this.Reseted = true;
		}

		public PutPagePlace(Place: number) {
			if (Place < 0) {
				this.Element.Node.style.display = 'none';
			} else {
				this.Element.Node.style.display = 'block';

			}
		}

		FallOut(Limit: number, NotesShift: number, SkipUntill?: number): IFallOut {
			//		Hand mage CSS3 tabs. I thouth it would take more than this
			var Element = <HTMLElement> this.Element.Node;
			var I = SkipUntill > 0 ? SkipUntill : 0;
			var GoodHeight = 0;
			var ChildsCount = Element.children.length;
			var ForceDenyElementBreaking = true;
			var LastOffsetParent: Element;
			var LastOffsetShift: number;
			var GotTheBottom = false;
			var FootnotesAddonCollected = 0;

			// To shift notes to the next page we may have to eliminale last line as a whole - so we keep track of it
			var LastLineBreakerParent: HTMLElement;
			var LastLineBreakerPos: number;
			var LastFullLinePosition = 0;

			var PrevPageBreaker = false;
			var NoMoreFootnotesHere = false;
			var FalloutElementN = -1;
			while (I < ChildsCount) {
				var FootnotesAddon = 0;
				var Child = <HTMLElement> Element.children[I];
				var ChildBot = Child.offsetTop + Math.max(Child.scrollHeight, Child.offsetHeight);

				if (!NoMoreFootnotesHere) {
					// Footnotes kind of expand element height - NoMoreFootnotesHere is for making things faster
					if (Child.nodeName.match(/a/i) && Child.className.match(/\bfootnote_attached\b/)) {
						var NoteElement = this.Site.getElementById('f' + Child.id);
						if (NoteElement) {
							FootnotesAddon = NoteElement.offsetTop + NoteElement.scrollHeight;
						}
					} else {
						var FootNotes = Child.getElementsByTagName('a');
						for (var J = FootNotes.length - 1; J >= 0; J--) {
							if (FootNotes[J].className.match(/\bfootnote_attached\b/)) {
								var NoteElement = this.Site.getElementById('f' + FootNotes[J].id);
								FootnotesAddon = NoteElement.offsetTop + NoteElement.scrollHeight;
								break;
							}
						}
					}
				}
				if (FootnotesAddon) {
					FootnotesAddon += this.NotesElement.MarginTop - NotesShift;
				}

				var FootnotesHeightNow = FootnotesAddon ? FootnotesAddon : FootnotesAddonCollected;
				if ((ChildBot + FootnotesHeightNow < Limit) && !PrevPageBreaker) {
					ForceDenyElementBreaking = false;
					if (FootnotesAddon) { FootnotesAddonCollected = FootnotesAddon };
					if (LastFullLinePosition + 1 < ChildBot) { // +1 because of the browser positioning rounding on the zoomed screen
						LastLineBreakerParent = Element;
						LastLineBreakerPos = I;
						LastFullLinePosition = ChildBot;
					}
					I++;
				} else {
					GotTheBottom = true;
					if (FalloutElementN == -1) {
//						FalloutElementN = I
					}
					if (!FootnotesAddon) {
						NoMoreFootnotesHere = true;
					}
					var CurShift: number = Child.offsetTop;
					if (Child.innerHTML.match(/^(\u00AD|\s)/)) {
						CurShift += Math.floor(Math.max(Child.scrollHeight, Child.offsetHeight) / 2);
					} else {
						var NextChild = <HTMLElement> Element.children[I + 1];
						//if (NextChild && NextChild.innerHTML.match(/^\u00AD/)) {
						//	Child.innerHTML += '_';
						//}
					}
					var ApplyShift: number;
					if (LastOffsetParent == Child.offsetParent) {
						ApplyShift = CurShift - LastOffsetShift;
					} else {
						ApplyShift = CurShift;
					}
					LastOffsetShift = CurShift;

					GoodHeight += ApplyShift;
					LastOffsetParent = Child.offsetParent;
//					Child.className += ' cut_bot';
					Element = Child;
					ChildsCount = (!ForceDenyElementBreaking && IsNodeUnbreakable(Element)) ? 0 : Element.children.length;

					if (ChildsCount == 0 && FootnotesAddon > FootnotesAddonCollected) {
						// So, it looks like we do not fit because of the footnote, not the falling out text itself.
						// Let's force page break on the previous line end - kind of time machine
						I = LastLineBreakerPos;
						Element = LastLineBreakerParent;
						PrevPageBreaker = true;
						ChildsCount = Element.children.length;
						continue;
					}
					Limit = Limit - ApplyShift;
					I = 0;
					if (PrevPageBreaker) break;
				}
				PrevPageBreaker = PrevPageBreaker || !ForceDenyElementBreaking && IsNodePageBreaker(Child);
			}

			if (!GotTheBottom) { // We had not enough data on the page!
				return null;
			}
			var Addr = <any> Element.id.split('_');
			Addr.shift();
			Addr.shift();
			return {
				FallOut: Addr,
				Height: GoodHeight,
				NotesHeight: FootnotesAddonCollected - this.NotesElement.MarginTop,
				FalloutElementN: FalloutElementN
			};
		}
	}

	export class Reader implements IFBReader {
		public HyphON: bool;
		public BookStyleNotes: bool;
		public TextPercent: number; 
		public NColumns: number;
		public CacheForward: number;
		public CacheBackward: number;
		public CurStartPos: IPosition;

		private Alert: FB3ReaderSite.IAlert;
		private Pages: ReaderPage[];
		private PagesPositionsCache: IPageRenderInstruction[];
		private OnResizeTimeout: any;

		constructor(public ArtID: string,
			public Site: FB3ReaderSite.IFB3ReaderSite,
			private FB3DOM: FB3DOM.IFB3DOM,
			public Bookmarks: FB3Bookmarks.IBookmarks) {

			// Basic class init
			this.HyphON = true;
			this.NColumns = 2;
			this.CacheForward = 6;
			this.CacheBackward = 2;
			this.PagesPositionsCache = new Array();
			this.CurStartPos = [5, 14];
//			this.CurStartPos = [0];
		}

		public Init(): void {
			this.PrepareCanvas();
			this.FB3DOM.Init(this.HyphON, this.ArtID, () => { this.LoadDone(1) } );
			this.Bookmarks.Load(this.ArtID, () => { this.LoadDone(2) } );
		}

		private LoadDone(a): void {
//			console.log('LoadDone ' + a + '/' + this.FB3DOM.Ready + ':' + this.Bookmarks.Ready);
			var ReadPos: IPosition;
			if (this.FB3DOM.Ready && this.Bookmarks.Ready) {
				if (this.Bookmarks && this.Bookmarks.CurPos) {
					ReadPos = this.Bookmarks.CurPos.Fragment.From;
				} else {
					ReadPos = this.CurStartPos;
				}
				this.GoTO(ReadPos);
			}
		}


		public GoTO(NewPos: IPosition) {
//			console.log('GoTO ' + NewPos);
			this.CurStartPos = NewPos.slice(0); // NewPos is going to be destroyed, we need a hardcopy
			var GotoPage = this.GetCachedPage(NewPos);
			if (GotoPage != undefined) {
				this.GoTOPage(GotoPage);
			} else {
				this.GoToOpenPosition(NewPos);
			}
		}
		public GoTOPage(Page: number): void {

		}

		public GoToOpenPosition(NewPos: IPosition): void {
			var FragmentEnd = NewPos[0] + 10;
			if (FragmentEnd > this.FB3DOM.TOC[this.FB3DOM.TOC.length - 1].e) {
				FragmentEnd = this.FB3DOM.TOC[this.FB3DOM.TOC.length - 1].e;
			}
			var Range: FB3DOM.IRange = { From: NewPos, To: [FragmentEnd] };
			//			console.log('GoToOpenPosition ' + NewPos);
			var NewInstr = <any> [{ Start: NewPos }];
			for (var I = 0; I < this.CacheForward * this.NColumns; I++) {
				NewInstr.push({});
			}
			this.Pages[0].DrawInit(NewInstr);
		}


		public TOC() {
			return this.FB3DOM.TOC;
		}

		public ResetCache(): void { this.PagesPositionsCache = new Array();}
		public GetCachedPage(NewPos: IPosition): number { return undefined }
		public StoreCachedPage(Page: number, Range: IPageRenderInstruction) { this.PagesPositionsCache[Page] = Range }

		public SearchForText(Text: string): FB3DOM.ITOC[]{ return null }

		private PrepareCanvas() {
			this.ResetCache();
			var InnerHTML = '<div class="FB3ReaderColumnset' + this.NColumns + '" id="FB3ReaderHostDiv" style="width:100%; overflow:hidden; height:100%">';
			this.Pages = new Array();
			for (var I = 0; I < this.CacheBackward + this.CacheForward; I++) {
				for (var J = 0; J < this.NColumns; J++) {
					var NewPage = new ReaderPage(J, this.FB3DOM, this, this.Pages[this.Pages.length-1]);
					this.Pages[this.Pages.length] = NewPage;
					InnerHTML += NewPage.GetInitHTML(I * this.NColumns + J);
				}
			}
			this.Pages[this.Pages.length-1].Next = this.Pages[0];
			InnerHTML += '</div>'
			this.Site.Canvas.innerHTML = InnerHTML;

			// this.Site.Canvas.addEventListener('resize', () => this.RefreshCanvas()); // not working for sime reason, hm

			for (var I = 0; I < this.Pages.length; I++) {
				this.Pages[I].BindToHTMLDoc(this.Site);
			}
		}

		public AfterCanvasResize() {
			if (this.OnResizeTimeout) {
				clearTimeout(this.OnResizeTimeout);
			}
			this.OnResizeTimeout = setTimeout(() => {
				for (var I = 0; I < this.Pages.length; I++) {
					this.Pages[I].Reset();
				}
				this.PrepareCanvas();
				this.GoTO(this.CurStartPos);
				this.OnResizeTimeout = undefined;
			} , 200)
		}

	}

}