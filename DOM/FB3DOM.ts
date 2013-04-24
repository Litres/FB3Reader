/// <reference path="FB3DOMHead.ts" />

module FB3DOM {

	export class FB3Block implements IFB3Block {

		private Alert: FB3ReaderSite.IAlert;

		public GetPartialHTML(HyphOn: bool, From: IPointer, To: IPointer): string {
			return null;
		}
		public GetHTML(HyphOn: bool): string {
			return null;
		}

		public GetBlocks(
			From: IPointer,
			To: IPointer,
			DoneCallBack: IDOMBlockReadyCallback,
			ProgressCallback: FB3ReaderSite.ILoadProgress
		): IFB3Block {
			return null;
		}
	}
	export class FB3DOMBase extends FB3Block implements IFB3DOM {
		public Ready: bool;

		private RawData: Array;

		constructor(Alert: FB3ReaderSite.IAlert, private URL: string) {
			super();
			this.Alert = Alert;
			this._Init();
		}

		public TOC() {
			return {
				Title: 'Title',
				Subitems: new Array(),
				StartBlock: 0,
				EndBlock: 30
			};
		}


		// Wondering why I make _Init public? Because you can't inherite private methods, bah!
		public _Init() {
			this.RawData = new Array();
			this.Ready = false;

		}
	}

}


