/// <reference path="FB3ReaderSiteHead.ts" />

module FB3ReaderSite {

    export class ExampleSite implements IFB3ReaderSite {
		public ViewText: IViewText;
		public Progressor: ILoadProgress;
		public IdleThreadProgressor:ILoadProgress;
		public NotePopup: INotePopup;
		public Alert: IAlert;
		public Key: string;
		public CanStoreBookmark: boolean = false;
		constructor(public Canvas: HTMLElement) {
			this.ViewText = new ViewText();
			this.Progressor = new ExampleProgressor('AlertSpan', 'MessSpan', 'ProgressSpan');
			this.IdleThreadProgressor = new ExampleProgressor('IdleAlertSpan', 'IdleMessSpan', 'IdleProgressSpan');
			this.Alert = (Message: string) => this.Progressor.Alert(Message);
			this.Key = 'Times:16';
		}
		getElementById(elementId: string): HTMLElement {
			return document.getElementById(elementId);
		}
		elementFromPoint(x: number, y: number): Element {
			return document.elementFromPoint(x,y);
		}
		public HeadersLoaded(MetaData: FB3DOM.IMetaData) {}
		public AfterTurnPageDone(Data: ITurnPageData) {
			if (Data.CurPage) {
				document.getElementById('CurPosPage').innerHTML = Data.CurPage.toFixed(0) + '/' +
				(Data.MaxPage ? Data.MaxPage.toFixed(0) : '?');
			}
			LitresLocalBookmarks.SetCurrentPosition(Data.Pos);
		}
		public BookCacheDone(Data: ITurnPageData) {}
		public StoreBookmarksHandler(timer: number) {}
		public AfterStoreBookmarks(): void {}
		public BeforeBookmarksAction(): boolean {
			return true;
		}
		public ZoomImg(obj): void {
			// obj
			// 	data-path="" - src for real img
			//	data-w="" - real img width
			//	data-h="" - real img height
		}
		public ZoomHTML(HTML: FB3DOM.InnerHTML): void {
			// For zoomed down (for any reason) elements engine will call this to
			// show full-scale contents of the element
			alert(HTML);
		}

		public HistoryHandler(Pos: FB3DOM.IXPath): void {}
		public showTrialEnd(ID: string): string { return ''; }
		public addTrialHandlers(): void { }
		public PrepareHTML(HTMLString: string): string {
			return HTMLString;
		}
		public PatchNoteNode(Node: HTMLElement): HTMLElement {
			Node.style.overflow = 'auto';
			Node.className += ' overfloatednote';
			return Node;
		}
	}

	export class ExampleProgressor implements ILoadProgress {
		private Hourglasses: any;
		private Progresses: any;
		public Alert(Message: string): void {
			document.getElementById(this.AlertSpan).innerHTML = Message;
			//			window.alert(Message);
		}
		HourglassOn(Owner: any, LockUI?: boolean, Message?: string): void {
			this.Hourglasses[Owner.toString()] = 1;
			document.getElementById(this.MessSpan).innerHTML = Message;
//			document.body.style.cursor = 'wait';
		}
		Progress(Owner: any, Progress: number): void {
			this.Progresses[Owner] = Progress;
			var N = 0;
			var OverallProgress = 0;
			for (var ProgressInst in this.Progresses) {
				N++;
				OverallProgress = this.Progresses[ProgressInst];
			}
			OverallProgress = OverallProgress / N;
			document.getElementById(this.ProgressSpan).innerHTML = OverallProgress.toFixed(1);
		}
		HourglassOff(Owner: any): void {
			this.Hourglasses[Owner] = 0;
			var HaveLive = 0;
			for (var Hourglass in this.Hourglasses) {
				if (this.Hourglasses[Hourglass] > 0) {
					HaveLive = 1;
					break;
				}
			}
			if (!HaveLive) {
				this.Hourglasses = {};
				this.Progresses = {};
//				document.body.style.cursor = '';
			} else {
				this.Progress(Owner, 100);
			}
		}
		Tick(Owner: any): void {
			if (!this.Progresses[Owner]) {
				this.Progresses[Owner] = 1;
			} else if (this.Progresses[Owner] < 99) {
				this.Progresses[Owner] += 1;
			}
			this.Progress(Owner, this.Progresses[Owner]);
		}
		constructor(private AlertSpan: string, private MessSpan: string, private ProgressSpan:string) {
			this.Hourglasses = {};
			this.Progresses = {};
		}
	}

	export class ViewText implements IViewText {
		private TextArray: ITextArray;
		constructor() {
			this.TextArray = {
				'BOOKMARK_IMAGE_PREVIEW_TEXT': 'Изображение',
				'BOOKMARK_EMPTY_TYPE_1_TEXT': 'Закладка',
				'BOOKMARK_EMPTY_TYPE_3_TEXT': 'Заметка'
			};
		}
		public Print(Index: string): string {
			return this.TextArray[Index];
		}
	}
}
