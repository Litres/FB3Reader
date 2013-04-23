/// <reference path="FB3ReaderAllModules.ts" />

module FB3DOM {
	declare var window;

	export class FB3Block implements IFB3Block {

		public GetPartialHTML(HyphOn: bool, From: IPointer, To: IPointer): string {
			return null;
		}
		GetHTML(HyphOn: bool): string {
			return null;
		}

		GetBlocks(
			From: IPointer,
			To: IPointer,
			DoneCallBack: IDOMBlockReadyCallback,
			ProgressCallback: FB3ReaderSite.ILoadProgress
		): IFB3Block {
			return null;
		}
	}
	export class FB3DOM  extends FB3Block implements IFB3DOM {
		public Ready: bool;
		public Alert: FB3ReaderSite.IAlert;
		private RawData: Array;
		constructor () {
			this.Ready = false;
			super();
		}

		public Init(URL: string) {
			this.RawData.length = 0;
		}

		public TOC() {
			return new Array();
		}

		private parseJSON(data: string): Object {
			// Borrowed bits from JQuery & http://json.org/json2.js
			if (!data) { return null; }

			// trim for IE
			data = data.replace(/^\s\s*/, '').replace(/\s\s*$/, '');

			// Attempt to parse using the native JSON parser first
			if (window.JSON && window.JSON.parse) {
				return window.JSON.parse(data);
			}

			// Make sure the incoming data is actual JSON
			if (/^[\],:{}\s]*$/.test(data.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, "@")
					.replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, "]")
					.replace(/(?:^|:|,)(?:\s*\[)+/g, ""))) {
				return (new Function("return " + data))();
			}
			if (this.Alert) {
				this.Alert("Invalid JSON");
			}
		}
	}
	

}


