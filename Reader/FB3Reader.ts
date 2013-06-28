/// <reference path="FB3ReaderHead.ts" />

module FB3Reader {
//	interface IDumbCallback { () }

	export interface IPageRenderInstruction {
		Range?: FB3DOM.IRange;
		Start?: IPosition;
		CacheAs?: number;
		Height?: number;
	}

	interface IFallOut {
		FallOut: IPosition; // Agress of the first element to not fit the page
		Height: number;			// Height of the page we've examined
	}

	function IsNodePageBreaker(Node:HTMLElement):boolean {
		return Node.children[0] && Node.children[0].nodeName.toLowerCase() == 'h1' ? true : false;
		//return false;
	}

	function IsNodeUnbreakable(Node: HTMLElement): boolean {
		return Node.children[0] && Node.children[0].nodeName.match(/^h\d$/i) ? true : false;
		//		return Node.nodeName.match(/^p$/i) ? true : false;
	}

	function RangeClone(BaseRange: FB3DOM.IRange): FB3DOM.IRange {
		return {
			From: BaseRange.From.slice(0),
			To: BaseRange.To.slice(0)
		}
	}

	class ReaderPage {
		private Element: HTMLDivElement;
		private ID: number;
		private PagesToRender: IPageRenderInstruction[];
		private End: IPosition;
		private RenderInstr: IPageRenderInstruction;
		public Next: ReaderPage;
		public Busy: boolean;
		public Reseted: boolean;
		public Width: number;
		public Height: number;
		public MarginTop: number;
		public MarginBottom: number;
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
			this.PrerenderBlocks = 10;
		}
		GetInitHTML(ID: number): FB3DOM.InnerHTML {
			this.ID = ID;
			return '<div class="FB2readerCell' + this.ColumnN + 'of' + this.FBReader.NColumns + ' FB2readerPage"><div class="FBReaderContentDiv" id="FB3ReaderColumn' + this.ID + '">...</div></div>';
		}
		BindToHTMLDoc(Site: FB3ReaderSite.IFB3ReaderSite): void {
			this.Element = <HTMLDivElement> Site.getElementById('FB3ReaderColumn' + this.ID);
			this.Width = this.Element.offsetWidth;
			this.Height = this.Element.parentElement.offsetHeight;
			if (document.all) {// IE
				this.MarginTop = parseInt(this.Element.currentStyle.marginTop, 10)
				+ parseInt(this.Element.currentStyle.paddingTop, 10);
				this.MarginBottom = parseInt(this.Element.currentStyle.marginBottom, 10)
				+ parseInt(this.Element.currentStyle.paddingBottom, 10);
			} else {// Mozilla
				this.MarginTop = parseInt(getComputedStyle(this.Element, '').getPropertyValue('margin-top'))
				+ parseInt(getComputedStyle(this.Element, '').getPropertyValue('padding-top'));
				this.MarginBottom = parseInt(getComputedStyle(this.Element, '').getPropertyValue('margin-bottom'))
				+ parseInt(getComputedStyle(this.Element, '').getPropertyValue('padding-bottom'));
			}
//			console.log(this.MarginTop + ':' + this.MarginBottom);
		}

		DrawInit(PagesToRender: IPageRenderInstruction[]): void {
			if (PagesToRender.length == 0) return;
			this.Busy = true;
			this.Reseted = false;

			this.RenderInstr = PagesToRender.shift();
			this.PagesToRender = PagesToRender;

			var Range: FB3DOM.IRange;
			if (this.RenderInstr.Range) { // Exact fragment (must be a cache?)
				Range = this.RenderInstr.Range;
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

			this.FB3DOM.GetHTMLAsync(this.FBReader.HyphON, RangeClone(Range), (HTML: string) => this.DrawEnd(HTML));
		}

		DrawEnd(HTML: string) {
			this.Busy = false;
			//			console.log('DrawEnd ' + this.ID);
			if (this.Reseted) {
				this.Reseted = false;
				return;
			}

			this.Element.innerHTML = HTML;
			if (!this.RenderInstr.Range) {
				var FallOut = this.FallOut(this.Height - this.MarginBottom);
				if (!FallOut) {
					// Ups, our page is incomplete - have to retry filling it. Take more data now
					this.PrerenderBlocks *= 2;
					this.RenderInstr.Range = null;
					bah();
					this.DrawInit([this.RenderInstr].concat(this.PagesToRender));
					return;
				}
				this.RenderInstr.Range = {
					From: this.RenderInstr.Start.splice(0),
					To: FallOut.FallOut
				};
				this.RenderInstr.Height = FallOut.Height;


				if (this.RenderInstr.CacheAs !== undefined) {
					this.FBReader.StoreCachedPage(this.RenderInstr.CacheAs, this.RenderInstr);
				}

				// Ok, we have rendered the page nice. Now we can check, wether we have created
				// a page long enough to fin the NEXT page. If so, we are going to estimate it's
				// content to create next page(s) with EXACTLY the required html - this will
				// speed up the render
				var LastChild = <HTMLElement> this.Element.children[this.Element.children.length - 1];
				if (LastChild) {
					var CollectedHeight = FallOut.Height;
					for (var I = 0; I < this.PagesToRender.length; I++) {
						var TestHeight = CollectedHeight +this.Height - this.MarginBottom - this.MarginTop;
						if (LastChild.offsetTop + LastChild.scrollHeight > TestHeight) {
							var NextPageFallOut = this.FallOut(TestHeight);
							if (NextPageFallOut) {
								var NextPageRange = {
									From: (I == 0?this.RenderInstr.Range.To:this.PagesToRender[I-1].Range.To).splice(0),
									To: NextPageFallOut.FallOut
								};
								this.PagesToRender[I].Height = NextPageFallOut.Height - CollectedHeight + this.MarginTop;
								CollectedHeight = NextPageFallOut.Height;
								if (this.PagesToRender[I].CacheAs !== undefined) {
									this.FBReader.StoreCachedPage(this.RenderInstr.CacheAs, NextPageRange);
								}
								this.PagesToRender[I].Range = NextPageRange;
							} else { break }
						} else { break }
					}
				}
			}

			this.Element.parentElement.style.height = this.RenderInstr.Height + 'px';

			if (this.PagesToRender && this.PagesToRender.length) {
				// we fire setTimeout to let the browser draw the page before we render the next
				if (!this.PagesToRender[0].Range && !this.PagesToRender[0].Start) {
					this.PagesToRender[0].Start = this.RenderInstr.Range.To;
				}
				setTimeout(() => { this.Next.DrawInit(this.PagesToRender) },1)
			}
		}

		Reset() {
			this.PagesToRender = null;
			if (this.Busy) {
				this.Reseted = true;
			}
		}

		public PutPagePlace(Place: number) {
			if (Place < 0) {
				this.Element.style.display = 'none';
			} else {
				this.Element.style.display = 'block';

			}
		}

		FallOut(Limit: number): IFallOut {
//		CSS3 tabs - DIY
			var Element = <HTMLElement> this.Element;
			var I = 0;
			var GoodHeight = 0;
			var ChildsCount = Element.children.length;
			var ForceDenyElementBreaking = true;
			var LastOffsetParent: Element;
			var LastOffsetShift: number;
			var GotTheBottom = false;
			while (I < ChildsCount) {
				var Child = <HTMLElement> Element.children[I];
				var ChildBot = Child.offsetTop + Child.scrollHeight;
				var PrevPageBreaker: boolean;
				if ((ChildBot < Limit) && !PrevPageBreaker) {
					I++;
					ForceDenyElementBreaking = false;
				} else {
					GotTheBottom = true;
					var CurShift = Child.offsetTop;
					var ApplyShift: number;
					if (LastOffsetParent == Child.offsetParent) {
						ApplyShift = CurShift - LastOffsetShift;
					} else {
						ApplyShift = CurShift;
					}
					LastOffsetShift = CurShift;

					GoodHeight += ApplyShift;
					LastOffsetParent = Child.offsetParent;
					//Child.className += ' cut_bot';
					Element = Child;
					ChildsCount = (!ForceDenyElementBreaking && IsNodeUnbreakable(Element)) ? 0 : Element.children.length;
					Limit = Limit - ApplyShift;
					I = 0;
					if (PrevPageBreaker) break;
				}
				PrevPageBreaker = !ForceDenyElementBreaking && IsNodePageBreaker(Child);
			}

			if (!GotTheBottom) { // We had not enough data on the page!
				return null;
			}
			var Addr = Element.id.split('_');
			Addr.shift();
			return { FallOut: Addr, Height: GoodHeight };
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
				this.PrepareCanvas();
				this.GoTO(this.CurStartPos);
				this.OnResizeTimeout = undefined;
			} , 200)
		}

	}

}