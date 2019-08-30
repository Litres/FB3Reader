module FB3ReaderSite {

	// Mothership with all interfaces aboard - everybody will pick here
	export interface IFB3ReaderSite {
		ViewText: IViewText;
		Progressor: ILoadProgress;
		IdleThreadProgressor: ILoadProgress;
		Canvas: HTMLElement;
		NotePopup: INotePopup;
		Alert: IAlert;
		Key: string; // Settings key, like font size and name, user for cache srore/read
		getElementById(elementId: string): HTMLElement;
		elementFromPoint(x: number, y: number): Element;
		HeadersLoaded(MetaData: FB3DOM.IMetaData): void; // when headers (Meta, toc and chunks info) loaded
		AfterTurnPageDone(Data: ITurnPageData, callback: Function): void; // when first start, default position and bookmark position set
		BookCacheDone(Data: ITurnPageData): void; // after full 100% book cache done
		StoreBookmarksHandler(timer: number, callback?: Function, failureCallback?: Function);
		AfterStoreBookmarks(): void;
		AfterStoreBookmarksFailure(): void;
		BeforeBookmarksAction(): boolean;
		ZoomImg(obj): void;
		ZoomHTML(HTML: FB3DOM.InnerHTML): void;
		HistoryHandler(Pos: FB3DOM.IXPath): void;
		showTrialEnd(ID: string): string;
		addTrialHandlers(): void;
		PrepareHTML(HTMLString: string): string;
		PatchNoteNode(Node: HTMLElement): HTMLElement;
		OnBookmarksSync(ActualBookmarks: FB3Bookmarks.IBookmarks, PrevBookmarks: FB3Bookmarks.IBookmarks): void;
		IsAuthorizeMode(): boolean;
		IsAlreadyClicked(sourceAction: string): boolean;
		GetArtTrialInfo(): IArtTrialInfo;
		SetArtTrialInfo(newArtTrialInfo: IArtTrialInfo): void;
		GoToExternalLink(URL: string): void;
		HTMLPopup(MsgHTML: FB3DOM.InnerHTML): void;
		GoToNote(Href: string): void;
		AuthorizeIFrame: IFrame.AuthorizeIFrame;
		UpsaleIFrame: IFrame.IFrame;
		RatingIFrame: IFrame.IFrame;
		FontSize: number
		MinimalCharacterCountInColumn: number;
	}

	export interface IArtTrialInfo {
		isFair?: boolean;
		counter?: number;
	}

	// General-purpose interface for progress feedback
	export interface ILoadProgress {
		Progresses: any;
		HourglassOn(Owner: any, LockUI?: boolean, Message?: string): void;
		Progress(Owner: any, Progress: number): void; // Progress vary 0 - 100, means percent
		HourglassOff(Owner: any): void;
		Tick(Owner: any): void;
		Alert(Message: string): void;
	}

	// A dumb clone of window.alert(). Defined just to make this clear
	export interface IAlert {
		(Message: string): void;
	}

	// When the Reader will want to show the footnote in the poup-up window, it will call this:
	export interface INotePopup {
		(NoteBody: FB3DOM.InnerHTML): void;
	}

	export interface ITurnPageData {
		CurPage: number;
		MaxPage: number;
		Percent?: number;
		Pos?: FB3DOM.IXPath;
		TurnByProgressBar?: boolean;
	}

	export interface IViewText {
		Print(Index: string): string;
	}
	export interface ITextArray {
		[Index: string]: string;
	}

}
