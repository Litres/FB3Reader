/// <reference path="FB3DataProviderHead.ts" />

module FB3DataProvider {

	export class AJAXDataProvider implements IJsonLoaderFactory {
		public Request(URL: string, Callback: IJSonLoadedCallback, Progressor: FB3ReaderSite.ILoadProgress) {
			new AjaxLoader(URL, Callback, Progressor);
		}
	}

	interface AJWindow extends Window { JSON: JSON; XMLHttpRequest: XMLHttpRequest; ActiveXObject: any}
	declare var window: AJWindow;


	class AjaxLoader {
		private Req: XMLHttpRequest;
		constructor(public URL: string,
			private Callback: IJSonLoadedCallback,
			private Progressor: FB3ReaderSite.ILoadProgress
			) {
			this.Progressor.HourglassOn(this, 'Loading ' + URL);
			this.Req = this.HttpRequest();
			try { // Old IE with it's internals does not support this
				this.Req.addEventListener("progress", (e: ProgressEvent) => this.onUpdateProgress(e), false);
				this.Req.addEventListener("error", (e: ProgressEvent) => this.onTransferFailed(e), false);
				this.Req.addEventListener("abort", (e: ProgressEvent) => this.onTransferAborted(e), false);
			} catch (e) { }
			this.Req.onreadystatechange = () => this.onTransferComplete();
			this.Req.open('GET', URL, true);
			this.Req.send(null);
		}

		public onTransferComplete() {
			try {
				if (this.Req.readyState != 4) {
					this.Progressor.Tick(this);
				} else {
					this.Progressor.HourglassOff(this);
					if (this.Req.status == 200) {
						this.Callback(this.parseJSON(this.Req.responseText));
					} else {
						this.Progressor.Alert('Failed to load "' + this.URL + '", server returned error "' + this.Req.status + '"');
					}
				}
			} catch (err) {
				this.Progressor.HourglassOff(this);
				this.Progressor.Alert('Failed to load "' + this.URL + '" (unknown error "' + err.description+'")');
			}
		}

		private onUpdateProgress(e: ProgressEvent) {
			this.Progressor.Progress(this, e.loaded / e.total * 100);
		}
		private onTransferFailed(e: ProgressEvent) {
			this.Progressor.HourglassOff(this);
			this.Progressor.Alert('Failed to load "' + URL + '"');
		}
		private onTransferAborted(e: ProgressEvent) {
			this.Progressor.HourglassOff(this);
			this.Progressor.Alert('Failed to load "' + URL + '" (interrupted)');
		}

		private HttpRequest(): XMLHttpRequest {
			var ref = null;
			if (window.XMLHttpRequest) {
				ref = new XMLHttpRequest();
			} else if (window.ActiveXObject) { // Older IE.
				ref = new ActiveXObject("MSXML2.XMLHTTP.3.0");
			}
			return ref;
		}
		private parseJSON(data: string): Object {
			// Borrowed bits from JQuery & http://json.org/json2.js
			if (data === undefined || data =='') { return null; }

			// trim for IE
			//data = data.replace(/^\s\s*/, '').replace(/\s\s*$/, '');

			// Attempt to parse using the native JSON parser first
			//if (window.JSON && window.JSON.parse) {
			//	return window.JSON.parse(data);
			//}

			// Make sure the incoming data is actual JSON
			//if (/^[\],:{}\s]*$/.test(data.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, "@")
			//	.replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, "]")
			//	.replace(/(?:^|:|,)(?:\s*\[)+/g, ""))) {
			//	return (new Function("return " + data))();
			//}
			//this.Progressor.Alert("Invalid JSON");

			// all shis safe and pretty stuff is nice, but I stick to simple
			return (new Function("return " + data))();
		}
	}
}