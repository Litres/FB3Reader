/// <reference path="FB3DOMHead.ts" />
/// <reference path="FB3DOMBlock.ts" />

module FB3DOM {
	declare var window;

	class AsyncLoadConsumer {
		private ImDone: boolean;
		BlockLoaded(N: number): number {
			if (this.ImDone) return;
			for (var I = 0; I <= this.WaitedBlocks.length; I++) {
				if (this.WaitedBlocks[I] == N)
					this.WaitedBlocks.splice(I,1);
			}
			if (!this.WaitedBlocks.length) {
				var HTML = this.FB3DOM.GetHTML(this.FB3DOM.HyphOn, this.Range);
				IDOMTextReadyCallback(HTML);
				this.ImDone = true;
			}
		}
		constructor(private FB3DOM: IFB3DOM,
			private WaitedBlocks: number[],
			private Range: IRange,
			private OnDone: IDOMTextReadyCallback) {
		}
	}

	interface IJSonLoadingDone{ (JSON: string) };

	export class FB3DOM extends FB3Tag implements IFB3DOM {
		private RawData: Array;
		private LoadDequests: Array;
		public HyphOn: bool;
		
		constructor(private Alert: FB3ReaderSite.IAlert) {
			super(null, null, 0);
			this.RawData = new Array();
		}

		public TOC() {
			return {
				Title: 'Title',
				Subitems: new Array(),
				StartBlock: 0,
				EndBlock: 30
			};
		}

		public GetCloseTag(Range: IRange): string {
			return '';
		}
		public GetInitTag(Range: IRange): string {
			return '';
		}

		private CheckAndPullRequiredBlocks(Range: IRange): number[] {
			return [1];
		}

		// Wondering why I make _Init public? Because you can't inherite private methods, darling!
		public Init(HyphOn: bool, URL: string, OnDone: { (FB3DOM: IFB3DOM): void; }) {
			this.HyphOn = HyphOn;
		}


		private LoadJSON(URL: string): any {
			var Req: XMLHttpRequest = this.XMLHttpRequest();
			Req.open('GET', URL, true);
			Req.send(null);
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

		private XMLHttpRequest(): XMLHttpRequest {
			var Ret: any = XMLHttpRequest;
			if (typeof Ret === "undefined") {
				Ret = function () {
					try { return new ActiveXObject("Msxml2.XMLHTTP.6.0"); }
					catch (e) { }
					try { return new ActiveXObject("Msxml2.XMLHTTP.3.0"); }
					catch (e) { }
					try { return new ActiveXObject("Microsoft.XMLHTTP"); }
					catch (e) { }
					// Microsoft.XMLHTTP points to Msxml2.XMLHTTP and is redundant
					throw new Error("This browser does not support XMLHttpRequest.");
				};
			}
			return <XMLHttpRequest> Ret;
		}

	}

}


