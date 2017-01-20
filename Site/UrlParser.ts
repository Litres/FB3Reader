/// <reference path="../DataProvider/FB3AjaxDataProvider.ts" />

interface IURLparserClass {
	UUID: string; // used in bookmarks syncro with server
	ArtID: string; // used in engine
	SID: string; // used in bookmarks syncro with server
	BaseURL: string; // url path for JSON's, examples
									// trials at litres /static/trials/12/94/95/12949594.
									// fullbook at litres /download_book/12949594/15986849/
	Trial: string; // trial state, if 1 we will show purchase button and notification about it
    Biblio: boolean; // biblio user state without self-service mode, if 1 we will show biblio notification, useless for fullbook
    SelfBiblio: boolean; // biblio user state self-service mode, if 1 we will show biblio notification, useless for fullbook
    RequestUser: boolean; // biblio user state without self-service mode, when book is requested. If 1 we will show biblio notification, useless for fullbook
    Librarian: boolean; // librarian, if 1 we show a notification for the librarian
	User: number; // user ID, used in bookmarks syncro with server, if 0, syncro off
	FileID: string; // used in shring and bookmarks syncro with server, book cover
	FreeBook: boolean; // free book state, if 1 we will show free book notification, useless for fullbook
	Lfrom: number; // partner stuff
	PartID: number; // partner id
	Iframe: boolean; // iframe state, changes appearance, actions
	Modal: boolean; // modal state, changes appearance, actions
	ArtID2URL(Chunk?: string): string; // if you have diffirent location of json, you can change same part of url
									// it`s incrementing chunk Number, makes full JSON url
}

module URLparser {
	export class URLparserClass implements IURLparserClass {
		private href: string;
		public UUID: string;
		public ArtID: string;
		public SID: string;
		public BaseURL: string;
		public Trial: string;
        public Biblio: boolean;
        public SelfBiblio: boolean;
        public RequestUser: boolean;
        public Librarian: boolean;
		public User: number;
		public FileID: string;
		public FreeBook: boolean;
		public Lfrom: number;
		public PartID: number;
		public Iframe: boolean;
		public Modal: boolean;
		constructor() {
			this.href = decodeURIComponent(window.location.href);
			this.CheckTrial();
            this.CheckBiblio();
            this.CheckSelfBiblio();
            this.CheckRequestUser();
            this.CheckLibrarian();
			this.GetUUID();
			this.GetArtID();
			this.GetBaseURL();
			this.GetSID();
			this.GetUser();
			this.GetFileID();
			this.CheckFreeBook();
			this.GetLfrom();
			this.GetPartId();
			this.GetIframe();
			this.GetModal();
		}
		public ArtID2URL(Chunk?: string): string {
			var OutURL = this.BaseURL + 'json/';
			if (Chunk == null) {
				OutURL += 'toc.js';
			} else if (Chunk.match(/\./)) {
				OutURL += Chunk;
			} else {
				OutURL += FB3DataProvider.zeroPad(Chunk, 3) + '.js';
			}
			return OutURL;
		}
		private CheckURLVal(index: string): boolean {
			if (this.href.match(index)) {
				return true;
			}
			return false;
		}
		private CheckBiblio(): void {
			this.Biblio = this.CheckURLVal('buser');
        }
        private CheckSelfBiblio(): void {
            this.SelfBiblio = this.CheckURLVal('self_user');
        }
        private CheckRequestUser(): void {
            this.RequestUser = this.CheckURLVal('request_user');
        }
        private CheckLibrarian(): void {
            this.Librarian = this.CheckURLVal('librarian');
        }
		private CheckTrial(): void {
			this.Trial = this.GetURLVal('trials=([0-1])');
		}
		private GetURLVal(regexpStr: string): string {
			var tmp = this.href.match(new RegExp('\\b' + regexpStr + '', 'i'));
			if (tmp == null || !tmp.length) {
				return '';
			}
			return tmp[1];
		}
		private GetUUID(): void {
			this.UUID = this.GetURLVal('uuid=([-0-9a-z]+)');
		}
		private GetArtID(): void {
			this.ArtID = this.GetURLVal('art=([0-9]+)');
		}
		private GetBaseURL(): void {
			this.BaseURL = this.GetURLVal('baseurl=([0-9\/a-z\:\._]+)');
		}
		private GetUser(): void {
			this.User = 0;
			var UserTmp = this.GetURLVal('user=([0-9]+)');
			if (UserTmp != '') {
				this.User = parseInt(UserTmp);
			}
		}
		private GetSID(): void {
			this.SID = this.GetURLVal('sid=([0-9a-zA-Z]+)');
			if (this.SID == '') {
				var Cookies = document.cookie.match(/(?:(?:^|.*;\s*)SID\s*\=\s*([^;]*).*$)|^.*$/);
				if (Cookies.length) {
					this.SID = Cookies[1];
				}
			}
		}
		private GetFileID(): void {
			this.FileID = this.GetURLVal('file=([0-9]+)');
			if (this.FileID == '') {
				if (this.BaseURL == '') {
					return undefined;
				}
				var urlData = this.BaseURL.split('/');
				this.FileID = urlData[urlData.length - 2].replace('.', '');
			}
			this.FileID = this.lpad(this.FileID, '0', 8);
		}
		private lpad(str, padString, length) {
			while (str.length < length) str = padString + str;
			return str;
		}
		private CheckFreeBook(): void {
			this.FreeBook = this.CheckURLVal('free');
		}
		private GetLfrom(): void {
			this.Lfrom = 0;
			var LfromTmp = this.GetURLVal('lfrom=([0-9]+)');
			if (LfromTmp != '') {
				this.Lfrom = parseInt(LfromTmp);
			}
		}
		private GetPartId(): void {
			this.PartID = 0;
			var PartIDTmp = this.GetURLVal('scecpartid=([0-9]+)');
			if (PartIDTmp != '') {
				this.PartID = parseInt(PartIDTmp);
			}
		}
		private GetIframe(): void {
			this.Iframe = this.CheckURLVal('iframe');
		}
		private GetModal(): void {
			this.Modal = this.CheckURLVal('modal');
		}
	}
}
